import { z } from "zod";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { lerParametros } from "../lib/config";
import { db } from "../database";
import { alocacoes, chamados, contasMatrizes, usuarios } from "../database/schema";

/**
 * MONITOR DE SAÚDE DAS CONTAS + ESTOQUE INTELIGENTE
 * ------------------------------------------------------------------
 * Duas dores que só aparecem quando a operação cresce:
 *
 *  1. CONTA PROBLEMÁTICA — uma matriz começa a dar erro de login/senha e o
 *     alocador continua enfiando cliente novo lá dentro. Aqui, ao passar de
 *     N falhas em 30 dias (`falhasParaPausar`, 3 por padrão), a conta perde
 *     `aceitaNovos` e os clientes atuais podem ser remanejados em 1 clique
 *     para uma conta marcada como `reserva`.
 *
 *  2. ESTOQUE NO LIMITE — vender uma vaga que não existe é o pior jeito de
 *     perder cliente. Ao bater `alertaOcupacao` (95%) num serviço, o admin
 *     recebe alerta para comprar matriz nova ANTES de faltar.
 *
 * `varrer()` é idempotente e roda a cada abertura do painel — sem cron.
 */

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

/** tipos de chamado que contam como falha de acesso da conta */
const TIPOS_FALHA = ["senha_incorreta", "sem_credito", "erro_login", "tela_ocupada"];

type LinhaConta = typeof contasMatrizes.$inferSelect;

function ocupacaoDe(c: { totalVagas: number; vagasOcupadas: number }) {
  if (c.totalVagas <= 0) return 100;
  return Math.round((Math.min(c.vagasOcupadas, c.totalVagas) / c.totalVagas) * 100);
}

/**
 * Recalcula falhas, pausa contas doentes e emite os alertas de estoque.
 * Devolve o retrato completo usado pela aba de saúde do admin.
 */
export async function varrerSaude() {
  const params = await lerParametros();
  const desde = new Date(Date.now() - TRINTA_DIAS_MS);

  const contas = await db.select().from(contasMatrizes);
  const porId = new Map<number, LinhaConta>(contas.map((c) => [c.id, c]));

  // falhas de acesso por conta na janela de 30 dias
  const recentes = await db
    .select({ contaId: chamados.contaId, tipo: chamados.tipo })
    .from(chamados)
    .where(and(gte(chamados.criadoEm, desde), inArray(chamados.tipo, TIPOS_FALHA)));

  const falhas = new Map<number, number>();
  for (const ch of recentes) {
    if (!ch.contaId) continue;
    falhas.set(ch.contaId, (falhas.get(ch.contaId) ?? 0) + 1);
  }

  const pausadas: { id: number; rotulo: string; falhas: number }[] = [];

  for (const conta of contas) {
    const total = falhas.get(conta.id) ?? 0;
    const deveriaPausar = total >= params.falhasParaPausar && !conta.reserva;
    const mudouContagem = conta.falhasRecentes !== total;
    const mudouAceite = deveriaPausar && conta.aceitaNovos;

    if (mudouContagem || mudouAceite) {
      await db
        .update(contasMatrizes)
        .set({
          falhasRecentes: total,
          aceitaNovos: deveriaPausar ? false : conta.aceitaNovos,
        })
        .where(eq(contasMatrizes.id, conta.id));
      const atual = porId.get(conta.id);
      if (atual) {
        atual.falhasRecentes = total;
        if (deveriaPausar) atual.aceitaNovos = false;
      }
    }

    if (mudouAceite) {
      pausadas.push({ id: conta.id, rotulo: conta.rotulo, falhas: total });
      await notificar({
        escopo: "admin",
        tipo: "sistema",
        severidade: "critico",
        titulo: `Conta pausada: ${conta.rotulo}`,
        mensagem: `${total} falhas de acesso em 30 dias. A conta parou de receber clientes novos — remaneje os atuais para uma conta reserva.`,
        destino: "saude",
        chave: `saude:pausada:${conta.id}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
  }

  // ---- estoque por serviço ----
  const porServico = new Map<string, { totalVagas: number; ocupadas: number; contas: number }>();
  for (const conta of porId.values()) {
    if (conta.poolJogos || conta.status !== "ativo") continue;
    const atual = porServico.get(conta.servico) ?? { totalVagas: 0, ocupadas: 0, contas: 0 };
    atual.totalVagas += conta.totalVagas;
    atual.ocupadas += Math.min(conta.vagasOcupadas, conta.totalVagas);
    atual.contas += 1;
    porServico.set(conta.servico, atual);
  }

  const estoque = [...porServico.entries()]
    .map(([servico, v]) => ({
      servico,
      contas: v.contas,
      totalVagas: v.totalVagas,
      ocupadas: v.ocupadas,
      livres: Math.max(0, v.totalVagas - v.ocupadas),
      ocupacao: ocupacaoDe({ totalVagas: v.totalVagas, vagasOcupadas: v.ocupadas }),
    }))
    .sort((a, b) => b.ocupacao - a.ocupacao);

  const competencia = new Date().toISOString().slice(0, 10);
  for (const linha of estoque) {
    if (linha.ocupacao < params.alertaOcupacao) continue;
    await notificar({
      escopo: "admin",
      tipo: "sistema",
      severidade: linha.livres === 0 ? "critico" : "alerta",
      titulo: `Estoque no limite: ${linha.servico}`,
      mensagem: `${linha.ocupacao}% das vagas ocupadas (${linha.ocupadas}/${linha.totalVagas}). Compre uma matriz nova antes de vender a próxima.`,
      destino: "contas",
      chave: `estoque:${linha.servico}:${competencia}`,
    });
  }

  return { params, contas: [...porId.values()], estoque, pausadas };
}

export const saude = {
  /** retrato completo: saúde das contas, estoque por serviço e reservas */
  painel: adminOnly.handler(async () => {
    const { params, contas, estoque, pausadas } = await varrerSaude();

    const emRisco = contas
      .filter((c) => c.falhasRecentes > 0 || !c.aceitaNovos)
      .map((c) => ({
        id: c.id,
        rotulo: c.rotulo,
        servico: c.servico,
        falhasRecentes: c.falhasRecentes,
        aceitaNovos: c.aceitaNovos,
        reserva: c.reserva,
        status: c.status,
        totalVagas: c.totalVagas,
        vagasOcupadas: c.vagasOcupadas,
      }))
      .sort((a, b) => b.falhasRecentes - a.falhasRecentes);

    const reservas = contas
      .filter((c) => c.reserva)
      .map((c) => ({
        id: c.id,
        rotulo: c.rotulo,
        servico: c.servico,
        livres: Math.max(0, c.totalVagas - c.vagasOcupadas),
      }));

    return {
      limiteFalhas: params.falhasParaPausar,
      alertaOcupacao: params.alertaOcupacao,
      pausadasAgora: pausadas,
      emRisco,
      reservas,
      estoque,
      resumo: {
        contas: contas.length,
        pausadas: contas.filter((c) => !c.aceitaNovos).length,
        reservas: reservas.length,
        servicosNoLimite: estoque.filter((e) => e.ocupacao >= params.alertaOcupacao).length,
      },
    };
  }),

  /** força a varredura (botão "reavaliar agora") */
  varrer: adminOnly.handler(async () => {
    const { pausadas, estoque } = await varrerSaude();
    return { ok: true, pausadas: pausadas.length, servicos: estoque.length };
  }),

  /** marca/desmarca conta de reserva */
  alternarReserva: adminOnly
    .input(z.object({ contaId: z.number().int(), reserva: z.boolean() }))
    .handler(async ({ input }) => {
      await db
        .update(contasMatrizes)
        .set({ reserva: input.reserva })
        .where(eq(contasMatrizes.id, input.contaId));
      return { ok: true };
    }),

  /** religa a entrada de clientes novos numa conta (problema resolvido) */
  liberarEntrada: adminOnly
    .input(z.object({ contaId: z.number().int(), aceitaNovos: z.boolean() }))
    .handler(async ({ input }) => {
      await db
        .update(contasMatrizes)
        .set({
          aceitaNovos: input.aceitaNovos,
          falhasRecentes: input.aceitaNovos ? 0 : undefined,
        })
        .where(eq(contasMatrizes.id, input.contaId));
      return { ok: true };
    }),

  /**
   * REMANEJAMENTO — move os clientes de uma conta doente para contas reserva
   * do mesmo serviço, preservando o histórico (alocação antiga vira `liberado`).
   */
  remanejar: adminOnly
    .input(z.object({ contaId: z.number().int() }))
    .handler(async ({ input }) => {
      const [origem] = await db
        .select()
        .from(contasMatrizes)
        .where(eq(contasMatrizes.id, input.contaId));
      if (!origem) return { ok: false, movidos: 0, motivo: "Conta não encontrada" };

      const ativos = await db
        .select()
        .from(alocacoes)
        .where(and(eq(alocacoes.contaId, origem.id), eq(alocacoes.status, "ativo")));

      const destinos = (
        await db
          .select()
          .from(contasMatrizes)
          .where(
            and(
              eq(contasMatrizes.servico, origem.servico),
              eq(contasMatrizes.reserva, true),
              eq(contasMatrizes.status, "ativo"),
            ),
          )
      ).filter((c) => c.vagasOcupadas < c.totalVagas);

      let movidos = 0;
      const semVaga: string[] = [];

      for (const aloc of ativos) {
        const destino = destinos.find((d) => d.vagasOcupadas < d.totalVagas);
        if (!destino) {
          semVaga.push(String(aloc.clienteId));
          continue;
        }

        await db
          .update(alocacoes)
          .set({ status: "liberado", motivo: "reposicao", liberadoEm: new Date() })
          .where(eq(alocacoes.id, aloc.id));
        await db.insert(alocacoes).values({
          clienteId: aloc.clienteId,
          contaId: destino.id,
          servico: aloc.servico,
          status: "ativo",
        });
        destino.vagasOcupadas += 1;
        await db
          .update(contasMatrizes)
          .set({ vagasOcupadas: destino.vagasOcupadas })
          .where(eq(contasMatrizes.id, destino.id));
        await db
          .update(contasMatrizes)
          .set({ vagasOcupadas: sql`max(${contasMatrizes.vagasOcupadas} - 1, 0)` })
          .where(eq(contasMatrizes.id, origem.id));

        await notificar({
          escopo: "cliente",
          clienteId: aloc.clienteId,
          tipo: "sistema",
          severidade: "info",
          titulo: "Seu acesso foi renovado",
          mensagem: `Trocamos a conta do seu ${aloc.servico} por uma nova para evitar instabilidade. Confira os dados atualizados no painel.`,
          destino: "acessos",
          chave: `remanejo:${aloc.clienteId}:${aloc.id}`,
        });
        movidos += 1;
      }

      if (movidos > 0) {
        await db
          .update(contasMatrizes)
          .set({ aceitaNovos: false })
          .where(eq(contasMatrizes.id, origem.id));
      }

      return {
        ok: true,
        movidos,
        semVaga: semVaga.length,
        motivo:
          semVaga.length > 0
            ? "Faltou vaga em conta reserva para todo mundo — cadastre uma matriz reserva."
            : "",
      };
    }),

  /** últimas falhas registradas, para o admin ver o padrão */
  falhas: adminOnly.handler(async () => {
    const desde = new Date(Date.now() - TRINTA_DIAS_MS);
    const linhas = await db
      .select({
        id: chamados.id,
        tipo: chamados.tipo,
        servico: chamados.servico,
        status: chamados.status,
        criadoEm: chamados.criadoEm,
        cliente: usuarios.nome,
        conta: contasMatrizes.rotulo,
      })
      .from(chamados)
      .innerJoin(usuarios, eq(usuarios.id, chamados.clienteId))
      .leftJoin(contasMatrizes, eq(contasMatrizes.id, chamados.contaId))
      .where(and(gte(chamados.criadoEm, desde), inArray(chamados.tipo, TIPOS_FALHA)))
      .orderBy(desc(chamados.criadoEm))
      .limit(40);

    return linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() }));
  }),
};
