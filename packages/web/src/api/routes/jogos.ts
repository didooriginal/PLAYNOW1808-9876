import { z } from "zod";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { estaBloqueado, MSG_BLOQUEIO } from "../lib/cobranca";
import { lerParametros } from "../lib/config";
import { db } from "../database";
import { contasMatrizes, liberacoesJogos, usuarios } from "../database/schema";

/**
 * FUTEBOL AO VIVO — adicional com liberação automática
 * ------------------------------------------------------------------
 * O gargalo que isso resolve: em dia de jogo, todo mundo pede acesso ao mesmo
 * tempo e o suporte humano vira fila. Aqui o cliente com o adicional ativo
 * pega o acesso sozinho no painel, direto de um pool de contas dedicadas que
 * o admin cadastra (`contas_matrizes.pool_jogos = true`).
 *
 * Regras:
 *  1. Só cliente com `usuarios.sala_jogos = true` e pagamento em dia entra.
 *  2. Uma liberação ativa por cliente. Pedir de novo devolve a mesma.
 *  3. A liberação vence sozinha (12h por padrão) e a vaga volta ao pool —
 *     `expirarVencidas()` roda a cada leitura, sem cron.
 *  4. O admin nunca precisa aprovar nada: só manter o pool abastecido.
 */

const UM_MINUTO_MS = 60 * 1000;

/** devolve as liberações vencidas ao pool. Idempotente, roda a cada leitura. */
export async function expirarVencidas() {
  const agora = new Date();
  const vencidas = await db
    .select()
    .from(liberacoesJogos)
    .where(and(eq(liberacoesJogos.status, "ativa"), lt(liberacoesJogos.expiraEm, agora)));

  for (const lib of vencidas) {
    await db
      .update(liberacoesJogos)
      .set({ status: "expirada" })
      .where(eq(liberacoesJogos.id, lib.id));
    await db
      .update(contasMatrizes)
      .set({ vagasOcupadas: sql`max(${contasMatrizes.vagasOcupadas} - 1, 0)` })
      .where(eq(contasMatrizes.id, lib.contaId));
  }
  return vencidas.length;
}

async function clienteDaSessao(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

/** conta do pool com vaga livre e menor ocupação relativa */
async function melhorContaDoPool() {
  const contas = await db
    .select()
    .from(contasMatrizes)
    .where(and(eq(contasMatrizes.poolJogos, true), eq(contasMatrizes.status, "ativo")));

  const disponiveis = contas
    .filter((c) => c.aceitaNovos && c.vagasOcupadas < c.totalVagas)
    .sort((a, b) => a.vagasOcupadas / a.totalVagas - b.vagasOcupadas / b.totalVagas);

  return disponiveis[0] ?? null;
}

function resumoLiberacao(
  lib: typeof liberacoesJogos.$inferSelect,
  conta: typeof contasMatrizes.$inferSelect,
) {
  return {
    id: lib.id,
    servico: lib.servico || conta.servico,
    rotulo: conta.rotulo,
    email: conta.email,
    senha: conta.senha,
    status: lib.status,
    criadoEm: lib.criadoEm.toISOString(),
    expiraEm: lib.expiraEm.toISOString(),
    minutosRestantes: Math.max(
      0,
      Math.round((lib.expiraEm.getTime() - Date.now()) / UM_MINUTO_MS),
    ),
  };
}

export const jogos = {
  /* ---------------------------------------------------------------- */
  /* CLIENTE                                                           */
  /* ---------------------------------------------------------------- */

  /** estado do adicional + liberação ativa (com credenciais quando houver) */
  meuAcesso: authed.handler(async ({ context }) => {
    await expirarVencidas();
    const cliente = await clienteDaSessao(context.user.id);
    const params = await lerParametros();

    const [ativa] = await db
      .select()
      .from(liberacoesJogos)
      .where(
        and(eq(liberacoesJogos.clienteId, cliente.id), eq(liberacoesJogos.status, "ativa")),
      )
      .orderBy(desc(liberacoesJogos.criadoEm))
      .limit(1);

    let acesso: ReturnType<typeof resumoLiberacao> | null = null;
    if (ativa) {
      const [conta] = await db
        .select()
        .from(contasMatrizes)
        .where(eq(contasMatrizes.id, ativa.contaId));
      if (conta) acesso = resumoLiberacao(ativa, conta);
    }

    const historico = await db
      .select()
      .from(liberacoesJogos)
      .where(eq(liberacoesJogos.clienteId, cliente.id))
      .orderBy(desc(liberacoesJogos.criadoEm))
      .limit(10);

    const pool = await db
      .select()
      .from(contasMatrizes)
      .where(and(eq(contasMatrizes.poolJogos, true), eq(contasMatrizes.status, "ativo")));

    const vagasLivres = pool.reduce(
      (soma, c) => soma + Math.max(0, c.totalVagas - c.vagasOcupadas),
      0,
    );

    return {
      contratado: cliente.salaJogos,
      desde: cliente.salaJogosDesde,
      preco: params.precoSalaJogos,
      horas: params.horasLiberacaoJogos,
      bloqueado: estaBloqueado(cliente.statusPagamento, cliente.confiancaAte),
      vagasLivres,
      acesso,
      historico: historico.map((h) => ({
        id: h.id,
        servico: h.servico,
        status: h.status,
        criadoEm: h.criadoEm.toISOString(),
        expiraEm: h.expiraEm.toISOString(),
      })),
    };
  }),

  /** contrata o adicional (self-service) */
  contratar: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte)) {
      throw new ORPCError("FORBIDDEN", { message: MSG_BLOQUEIO });
    }
    if (cliente.salaJogos) return { ok: true, jaTinha: true };

    const params = await lerParametros();
    const hoje = new Date().toISOString().slice(0, 10);
    await db
      .update(usuarios)
      .set({ salaJogos: true, salaJogosDesde: hoje })
      .where(eq(usuarios.id, cliente.id));

    await notificar({
      escopo: "admin",
      clienteId: cliente.id,
      tipo: "sistema",
      severidade: "info",
      titulo: "Futebol Ao Vivo contratada",
      mensagem: `${cliente.nome} ativou o adicional Futebol Ao Vivo (R$ ${params.precoSalaJogos.toFixed(2).replace(".", ",")}/mês). Some ao próximo faturamento.`,
      destino: "jogos",
      chave: `jogos:contratou:${cliente.id}:${hoje}`,
    });

    return { ok: true, jaTinha: false, preco: params.precoSalaJogos };
  }),

  /** cancela o adicional e revoga a liberação em curso */
  cancelar: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    await db
      .update(usuarios)
      .set({ salaJogos: false, salaJogosDesde: "" })
      .where(eq(usuarios.id, cliente.id));

    const ativas = await db
      .select()
      .from(liberacoesJogos)
      .where(
        and(eq(liberacoesJogos.clienteId, cliente.id), eq(liberacoesJogos.status, "ativa")),
      );
    for (const lib of ativas) {
      await db
        .update(liberacoesJogos)
        .set({ status: "revogada" })
        .where(eq(liberacoesJogos.id, lib.id));
      await db
        .update(contasMatrizes)
        .set({ vagasOcupadas: sql`max(${contasMatrizes.vagasOcupadas} - 1, 0)` })
        .where(eq(contasMatrizes.id, lib.contaId));
    }
    return { ok: true };
  }),

  /**
   * LIBERAÇÃO AUTOMÁTICA — o coração do módulo.
   * Sem suporte, sem espera: pega a melhor conta do pool e devolve o acesso.
   */
  pegarAcesso: authed.handler(async ({ context }) => {
    await expirarVencidas();
    const cliente = await clienteDaSessao(context.user.id);
    const params = await lerParametros();

    if (!cliente.salaJogos) {
      throw new ORPCError("FORBIDDEN", {
        message: "Adicional Futebol Ao Vivo não está ativo na sua conta.",
      });
    }
    if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte)) {
      throw new ORPCError("FORBIDDEN", { message: MSG_BLOQUEIO });
    }

    const [ativa] = await db
      .select()
      .from(liberacoesJogos)
      .where(
        and(eq(liberacoesJogos.clienteId, cliente.id), eq(liberacoesJogos.status, "ativa")),
      )
      .orderBy(desc(liberacoesJogos.criadoEm))
      .limit(1);

    if (ativa) {
      const [conta] = await db
        .select()
        .from(contasMatrizes)
        .where(eq(contasMatrizes.id, ativa.contaId));
      if (conta) return { ok: true, novo: false, acesso: resumoLiberacao(ativa, conta) };
    }

    const conta = await melhorContaDoPool();
    if (!conta) {
      await notificar({
        escopo: "admin",
        tipo: "sistema",
        severidade: "critico",
        titulo: "Pool da Futebol Ao Vivo esgotado",
        mensagem: "Um cliente pediu acesso e não havia vaga livre no pool de jogos.",
        destino: "jogos",
        chave: `jogos:esgotado:${new Date().toISOString().slice(0, 13)}`,
      });
      throw new ORPCError("CONFLICT", {
        message:
          "Todas as telas da Futebol Ao Vivo estão ocupadas neste momento. Tente de novo em alguns minutos — as vagas giram rápido.",
      });
    }

    const expiraEm = new Date(Date.now() + params.horasLiberacaoJogos * 60 * 60 * 1000);
    const [criada] = await db
      .insert(liberacoesJogos)
      .values({
        clienteId: cliente.id,
        contaId: conta.id,
        servico: conta.servico,
        status: "ativa",
        expiraEm,
      })
      .returning();

    await db
      .update(contasMatrizes)
      .set({ vagasOcupadas: conta.vagasOcupadas + 1 })
      .where(eq(contasMatrizes.id, conta.id));

    return {
      ok: true,
      novo: true,
      acesso: resumoLiberacao(criada, { ...conta, vagasOcupadas: conta.vagasOcupadas + 1 }),
    };
  }),

  /** devolve a vaga antes da hora (libera o pool para outro cliente) */
  devolverAcesso: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    const ativas = await db
      .select()
      .from(liberacoesJogos)
      .where(
        and(eq(liberacoesJogos.clienteId, cliente.id), eq(liberacoesJogos.status, "ativa")),
      );
    for (const lib of ativas) {
      await db
        .update(liberacoesJogos)
        .set({ status: "expirada" })
        .where(eq(liberacoesJogos.id, lib.id));
      await db
        .update(contasMatrizes)
        .set({ vagasOcupadas: sql`max(${contasMatrizes.vagasOcupadas} - 1, 0)` })
        .where(eq(contasMatrizes.id, lib.contaId));
    }
    return { ok: true, devolvidas: ativas.length };
  }),

  /* ---------------------------------------------------------------- */
  /* ADMIN                                                             */
  /* ---------------------------------------------------------------- */

  /** painel da aba Futebol Ao Vivo: pool, ocupação, liberações e assinantes */
  painel: adminOnly.handler(async () => {
    await expirarVencidas();
    const params = await lerParametros();

    const pool = await db
      .select()
      .from(contasMatrizes)
      .where(eq(contasMatrizes.poolJogos, true))
      .orderBy(asc(contasMatrizes.rotulo));

    const ativas = await db
      .select({
        id: liberacoesJogos.id,
        clienteId: liberacoesJogos.clienteId,
        cliente: usuarios.nome,
        contaId: liberacoesJogos.contaId,
        servico: liberacoesJogos.servico,
        criadoEm: liberacoesJogos.criadoEm,
        expiraEm: liberacoesJogos.expiraEm,
      })
      .from(liberacoesJogos)
      .innerJoin(usuarios, eq(usuarios.id, liberacoesJogos.clienteId))
      .where(eq(liberacoesJogos.status, "ativa"))
      .orderBy(desc(liberacoesJogos.criadoEm));

    const assinantes = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        statusPagamento: usuarios.statusPagamento,
        desde: usuarios.salaJogosDesde,
      })
      .from(usuarios)
      .where(eq(usuarios.salaJogos, true))
      .orderBy(asc(usuarios.nome));

    const totalVagas = pool.reduce((s, c) => s + c.totalVagas, 0);
    const ocupadas = pool.reduce((s, c) => s + Math.min(c.vagasOcupadas, c.totalVagas), 0);

    return {
      preco: params.precoSalaJogos,
      horas: params.horasLiberacaoJogos,
      totalVagas,
      ocupadas,
      livres: Math.max(0, totalVagas - ocupadas),
      ocupacao: totalVagas > 0 ? Math.round((ocupadas / totalVagas) * 100) : 0,
      receitaMensal: Math.round(assinantes.length * params.precoSalaJogos * 100) / 100,
      pool: pool.map((c) => ({
        id: c.id,
        rotulo: c.rotulo,
        servico: c.servico,
        email: c.email,
        senha: c.senha,
        status: c.status,
        aceitaNovos: c.aceitaNovos,
        totalVagas: c.totalVagas,
        vagasOcupadas: c.vagasOcupadas,
      })),
      liberacoes: ativas.map((a) => ({
        ...a,
        criadoEm: a.criadoEm.toISOString(),
        expiraEm: a.expiraEm.toISOString(),
        minutosRestantes: Math.max(
          0,
          Math.round((a.expiraEm.getTime() - Date.now()) / UM_MINUTO_MS),
        ),
      })),
      assinantes,
    };
  }),

  /** cadastra uma conta nova direto no pool de jogos */
  cadastrarConta: adminOnly
    .input(
      z.object({
        rotulo: z.string().min(2),
        servico: z.string().min(2).default("jogos"),
        email: z.string().email(),
        senha: z.string().min(1),
        totalVagas: z.number().int().min(1).max(20).default(4),
        custoMensal: z.number().min(0).default(0),
      }),
    )
    .handler(async ({ input }) => {
      const [conta] = await db
        .insert(contasMatrizes)
        .values({
          servico: input.servico,
          rotulo: input.rotulo,
          nomeConta: input.rotulo,
          email: input.email,
          senha: input.senha,
          totalVagas: input.totalVagas,
          custoMensal: input.custoMensal,
          custo: input.custoMensal,
          poolJogos: true,
          status: "ativo",
        })
        .returning();
      return { ok: true, id: conta?.id ?? 0 };
    }),

  /** liga/desliga uma conta matriz existente no pool de jogos */
  alternarPool: adminOnly
    .input(z.object({ contaId: z.number().int(), pool: z.boolean() }))
    .handler(async ({ input }) => {
      await db
        .update(contasMatrizes)
        .set({ poolJogos: input.pool })
        .where(eq(contasMatrizes.id, input.contaId));
      return { ok: true };
    }),

  /** revoga uma liberação em curso (uso indevido, conta caída, etc.) */
  revogar: adminOnly
    .input(z.object({ liberacaoId: z.number().int() }))
    .handler(async ({ input }) => {
      const [lib] = await db
        .select()
        .from(liberacoesJogos)
        .where(eq(liberacoesJogos.id, input.liberacaoId));
      if (!lib) throw new ORPCError("NOT_FOUND", { message: "Liberação não encontrada" });

      await db
        .update(liberacoesJogos)
        .set({ status: "revogada" })
        .where(eq(liberacoesJogos.id, lib.id));
      if (lib.status === "ativa") {
        await db
          .update(contasMatrizes)
          .set({ vagasOcupadas: sql`max(${contasMatrizes.vagasOcupadas} - 1, 0)` })
          .where(eq(contasMatrizes.id, lib.contaId));
      }
      return { ok: true };
    }),

  /** liga/desliga o adicional para um cliente (venda feita fora do painel) */
  alternarCliente: adminOnly
    .input(z.object({ clienteId: z.number().int(), ativo: z.boolean() }))
    .handler(async ({ input }) => {
      await db
        .update(usuarios)
        .set({
          salaJogos: input.ativo,
          salaJogosDesde: input.ativo ? new Date().toISOString().slice(0, 10) : "",
        })
        .where(eq(usuarios.id, input.clienteId));
      return { ok: true };
    }),
};
