import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { diasAteVencimento } from "../lib/cobranca";
import { lerParametros } from "../lib/config";
import { db } from "../database";
import { recompensasProgresso, usuarios, winbackEnvios } from "../database/schema";

/**
 * WIN-BACK — régua automática de reativação
 * ------------------------------------------------------------------
 * Cliente suspenso/cancelado não volta sozinho: alguém precisa chamar, com
 * uma oferta na mão. A régua tem 3 etapas por tempo de inatividade e um
 * cupom que cresce conforme a distância:
 *
 *   etapa 1 — 15 dias  → desconto base (30%)
 *   etapa 2 — 30 dias  → base + 10 pontos
 *   etapa 3 — 60 dias  → base + 20 pontos
 *
 * Cada etapa vira UMA linha em `winback_envios` com `chave` única
 * (cliente:etapa), então rodar a varredura mil vezes não gera spam. A
 * mensagem sai pronta em pt-BR para o WhatsApp e o cupom já fica gravado no
 * progresso do cliente, valendo na próxima fatura assim que ele voltar.
 */

const ETAPAS = [
  { etapa: 1, dias: 15, extra: 0 },
  { etapa: 2, dias: 30, extra: 10 },
  { etapa: 3, dias: 60, extra: 20 },
] as const;

const STATUS_ALVO = ["suspenso", "cancelado"];

function cupomDe(clienteId: number, etapa: number, desconto: number) {
  return `VOLTA${desconto}-${String(clienteId).padStart(3, "0")}${etapa}`;
}

function mensagemDe(nome: string, desconto: number, dias: number) {
  const primeiro = nome.split(" ")[0] ?? nome;
  return (
    `Oi, ${primeiro}! Aqui é da PLAYPLUSNOW. Vimos que sua conta está parada há ${dias} dias ` +
    `e ficamos com saudade. Separei um cupom de ${desconto}% de desconto na volta — ` +
    `é só responder esta mensagem que a gente reativa tudo em minutos, com os mesmos apps de antes.`
  );
}

/** dias desde o vencimento (quanto tempo o cliente está fora) */
function diasInativo(cliente: typeof usuarios.$inferSelect) {
  const dias = diasAteVencimento(cliente.proximaCobranca);
  if (dias === null) return null;
  return dias < 0 ? Math.abs(dias) : 0;
}

/**
 * Varre os inativos e cria as etapas pendentes. Idempotente.
 */
export async function varrerWinback() {
  const params = await lerParametros();
  const alvos = await db
    .select()
    .from(usuarios)
    .where(inArray(usuarios.statusPagamento, STATUS_ALVO));

  const existentes = await db.select().from(winbackEnvios);
  const jaTem = new Set(existentes.map((e) => e.chave));

  const novos: (typeof winbackEnvios.$inferInsert)[] = [];

  for (const cliente of alvos) {
    if (cliente.admin) continue;
    const dias = diasInativo(cliente);
    if (dias === null) continue;

    for (const etapa of ETAPAS) {
      const gatilho = etapa.etapa === 1 ? params.winbackDias : etapa.dias;
      if (dias < gatilho) continue;

      const chave = `winback:${cliente.id}:${etapa.etapa}`;
      if (jaTem.has(chave)) continue;

      const desconto = Math.min(70, params.winbackDesconto + etapa.extra);
      novos.push({
        clienteId: cliente.id,
        etapa: etapa.etapa,
        diasInativo: dias,
        cupom: cupomDe(cliente.id, etapa.etapa, desconto),
        desconto,
        mensagem: mensagemDe(cliente.nome, desconto, dias),
        status: "pendente",
        chave,
      });
      jaTem.add(chave);
    }
  }

  if (novos.length > 0) {
    await db.insert(winbackEnvios).values(novos).onConflictDoNothing();
    await notificar({
      escopo: "admin",
      tipo: "sistema",
      severidade: "alerta",
      titulo: `${novos.length} cliente(s) na fila de recuperação`,
      mensagem: "A régua de win-back gerou novas ofertas de retorno. Dispare pela aba Recuperação.",
      destino: "winback",
      chave: `winback:fila:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  return novos.length;
}

export const winback = {
  /** fila de recuperação, agrupada por situação */
  painel: adminOnly.handler(async () => {
    const criados = await varrerWinback();
    const params = await lerParametros();

    const linhas = await db
      .select({
        id: winbackEnvios.id,
        clienteId: winbackEnvios.clienteId,
        nome: usuarios.nome,
        email: usuarios.email,
        telefone: usuarios.telefone,
        statusCliente: usuarios.statusPagamento,
        etapa: winbackEnvios.etapa,
        diasInativo: winbackEnvios.diasInativo,
        cupom: winbackEnvios.cupom,
        desconto: winbackEnvios.desconto,
        mensagem: winbackEnvios.mensagem,
        status: winbackEnvios.status,
        criadoEm: winbackEnvios.criadoEm,
        enviadoEm: winbackEnvios.enviadoEm,
      })
      .from(winbackEnvios)
      .innerJoin(usuarios, eq(usuarios.id, winbackEnvios.clienteId))
      .orderBy(desc(winbackEnvios.criadoEm))
      .limit(100);

    const itens = linhas.map((l) => ({
      ...l,
      criadoEm: l.criadoEm.toISOString(),
      enviadoEm: l.enviadoEm ? l.enviadoEm.toISOString() : null,
      whatsapp: l.telefone
        ? `https://wa.me/55${l.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(l.mensagem)}`
        : "",
    }));

    return {
      criadosAgora: criados,
      dias: params.winbackDias,
      descontoBase: params.winbackDesconto,
      resumo: {
        pendentes: itens.filter((i) => i.status === "pendente").length,
        enviados: itens.filter((i) => i.status === "enviado").length,
        recuperados: itens.filter((i) => i.status === "recuperado").length,
      },
      itens,
    };
  }),

  /** força a varredura */
  varrer: adminOnly.handler(async () => {
    const criados = await varrerWinback();
    return { ok: true, criados };
  }),

  /**
   * Marca a oferta como enviada e grava o cupom no progresso do cliente,
   * para ele já entrar com desconto quando voltar.
   */
  marcarEnviado: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const [envio] = await db
        .select()
        .from(winbackEnvios)
        .where(eq(winbackEnvios.id, input.id));
      if (!envio) return { ok: false };

      await db
        .update(winbackEnvios)
        .set({ status: "enviado", enviadoEm: new Date() })
        .where(eq(winbackEnvios.id, envio.id));

      await db
        .insert(recompensasProgresso)
        .values({
          clienteId: envio.clienteId,
          cupomAtivo: envio.cupom,
          cupomDesconto: envio.desconto,
        })
        .onConflictDoUpdate({
          target: recompensasProgresso.clienteId,
          set: {
            cupomAtivo: envio.cupom,
            cupomDesconto: envio.desconto,
            atualizadoEm: new Date(),
          },
        });

      await notificar({
        escopo: "cliente",
        clienteId: envio.clienteId,
        tipo: "pagamento",
        severidade: "info",
        titulo: `Cupom de retorno: ${envio.desconto}% OFF`,
        mensagem: `Use o cupom ${envio.cupom} para reativar seu plano com ${envio.desconto}% de desconto.`,
        destino: "faturas",
        chave: `winback:cupom:${envio.id}`,
      });

      return { ok: true };
    }),

  /** encerra a oferta: voltou ou desistiu de vez */
  encerrar: adminOnly
    .input(z.object({ id: z.number().int(), status: z.enum(["recuperado", "descartado"]) }))
    .handler(async ({ input }) => {
      await db
        .update(winbackEnvios)
        .set({ status: input.status })
        .where(eq(winbackEnvios.id, input.id));
      return { ok: true };
    }),
};
