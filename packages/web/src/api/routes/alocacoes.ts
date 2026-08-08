import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { alocacoes, contasMatrizes, usuarios } from "../database/schema";

/**
 * ALOCAÇÕES — vínculo real entre cliente e conta matriz.
 * Substitui o contador solto `vagasOcupadas` como fonte de verdade: o contador
 * continua existindo (KPIs e queries legadas), mas é sempre derivado daqui.
 *
 * Regra de ouro: liberar NUNCA apaga a linha nem o cadastro do cliente —
 * apenas marca `status = liberado` e carimba `liberadoEm`.
 */

/** recalcula `vagasOcupadas` da conta a partir das alocações ativas */
export async function sincronizarVagas(contaId: number) {
  const ativas = await db
    .select({ id: alocacoes.id })
    .from(alocacoes)
    .where(and(eq(alocacoes.contaId, contaId), eq(alocacoes.status, "ativo")));
  await db
    .update(contasMatrizes)
    .set({ vagasOcupadas: ativas.length })
    .where(eq(contasMatrizes.id, contaId));
  return ativas.length;
}

/**
 * Garante que o cliente tenha uma vaga ativa no serviço informado.
 * Idempotente: se já existe alocação ativa, devolve a existente.
 * Retorna `null` quando não há nenhuma conta com vaga livre.
 */
export async function garantirAlocacao(clienteId: number, servico: string) {
  const [existente] = await db
    .select()
    .from(alocacoes)
    .where(
      and(
        eq(alocacoes.clienteId, clienteId),
        eq(alocacoes.servico, servico),
        eq(alocacoes.status, "ativo"),
      ),
    );
  if (existente) return existente;

  const contas = await db
    .select()
    .from(contasMatrizes)
    .where(and(eq(contasMatrizes.servico, servico), eq(contasMatrizes.status, "ativo")));

  const livre = contas
    .filter((c) => c.vagasOcupadas < c.totalVagas)
    .sort((a, b) => b.totalVagas - b.vagasOcupadas - (a.totalVagas - a.vagasOcupadas))[0];
  if (!livre) return null;

  const [row] = await db
    .insert(alocacoes)
    .values({ clienteId, contaId: livre.id, servico })
    .returning();
  await sincronizarVagas(livre.id);
  return row;
}

export const alocacoesRoutes = {
  /** clientes vinculados a uma conta matriz (item "vínculo cliente × conta") */
  porConta: adminOnly
    .input(z.object({ contaId: z.number().int(), incluirHistorico: z.boolean().default(false) }))
    .handler(({ input }) => {
      const filtro = input.incluirHistorico
        ? eq(alocacoes.contaId, input.contaId)
        : and(eq(alocacoes.contaId, input.contaId), eq(alocacoes.status, "ativo"));

      return db
        .select({
          id: alocacoes.id,
          clienteId: alocacoes.clienteId,
          contaId: alocacoes.contaId,
          servico: alocacoes.servico,
          status: alocacoes.status,
          motivo: alocacoes.motivo,
          criadoEm: alocacoes.criadoEm,
          liberadoEm: alocacoes.liberadoEm,
          clienteNome: usuarios.nome,
          clienteEmail: usuarios.email,
          clienteStatus: usuarios.statusPagamento,
        })
        .from(alocacoes)
        .innerJoin(usuarios, eq(alocacoes.clienteId, usuarios.id))
        .where(filtro)
        .orderBy(desc(alocacoes.criadoEm));
    }),

  /** mapa contaId → clientes ativos, para renderizar todas as contas de uma vez */
  mapa: adminOnly.handler(async () => {
    const rows = await db
      .select({
        id: alocacoes.id,
        contaId: alocacoes.contaId,
        clienteId: alocacoes.clienteId,
        servico: alocacoes.servico,
        criadoEm: alocacoes.criadoEm,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        clienteStatus: usuarios.statusPagamento,
      })
      .from(alocacoes)
      .innerJoin(usuarios, eq(alocacoes.clienteId, usuarios.id))
      .where(eq(alocacoes.status, "ativo"))
      .orderBy(desc(alocacoes.criadoEm));

    const mapa: Record<number, typeof rows> = {};
    for (const row of rows) {
      (mapa[row.contaId] ??= []).push(row);
    }
    return mapa;
  }),

  /** aloca manualmente um cliente numa conta matriz específica */
  alocar: adminOnly
    .input(z.object({ clienteId: z.number().int(), contaId: z.number().int() }))
    .handler(async ({ input }) => {
      const [conta] = await db
        .select()
        .from(contasMatrizes)
        .where(eq(contasMatrizes.id, input.contaId));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

      const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, input.clienteId));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const ativas = await db
        .select({ id: alocacoes.id, clienteId: alocacoes.clienteId })
        .from(alocacoes)
        .where(and(eq(alocacoes.contaId, input.contaId), eq(alocacoes.status, "ativo")));

      if (ativas.some((a) => a.clienteId === input.clienteId))
        throw new ORPCError("CONFLICT", { message: "Este cliente já está nesta conta" });

      if (ativas.length >= conta.totalVagas)
        throw new ORPCError("BAD_REQUEST", {
          message: "Conta lotada — libere uma vaga ou aumente o total",
        });

      const [row] = await db
        .insert(alocacoes)
        .values({ clienteId: input.clienteId, contaId: conta.id, servico: conta.servico })
        .returning();
      await sincronizarVagas(conta.id);
      return row;
    }),

  /**
   * Libera a vaga para realocação — mantém a linha (histórico) e o cadastro
   * do cliente intactos.
   */
  liberar: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        motivo: z.enum(["reposicao", "manual", "troca_pacote"]).default("manual"),
      }),
    )
    .handler(async ({ input }) => {
      const [alocacao] = await db.select().from(alocacoes).where(eq(alocacoes.id, input.id));
      if (!alocacao) throw new ORPCError("NOT_FOUND", { message: "Alocação não encontrada" });
      if (alocacao.status === "liberado") return alocacao;

      const [row] = await db
        .update(alocacoes)
        .set({ status: "liberado", motivo: input.motivo, liberadoEm: new Date() })
        .where(eq(alocacoes.id, input.id))
        .returning();
      await sincronizarVagas(alocacao.contaId);
      return row;
    }),

  /** histórico completo (ativos + liberados) de uma conta */
  historico: adminOnly
    .input(z.object({ contaId: z.number().int() }))
    .handler(({ input }) =>
      db
        .select({
          id: alocacoes.id,
          status: alocacoes.status,
          motivo: alocacoes.motivo,
          criadoEm: alocacoes.criadoEm,
          liberadoEm: alocacoes.liberadoEm,
          clienteNome: usuarios.nome,
          clienteEmail: usuarios.email,
        })
        .from(alocacoes)
        .innerJoin(usuarios, eq(alocacoes.clienteId, usuarios.id))
        .where(eq(alocacoes.contaId, input.contaId))
        .orderBy(desc(alocacoes.criadoEm)),
    ),

  /** clientes que ainda não têm vaga ativa na conta — alimenta o seletor do admin */
  disponiveis: adminOnly
    .input(z.object({ contaId: z.number().int() }))
    .handler(async ({ input }) => {
      const ativas = await db
        .select({ clienteId: alocacoes.clienteId })
        .from(alocacoes)
        .where(and(eq(alocacoes.contaId, input.contaId), eq(alocacoes.status, "ativo")));
      const ocupados = ativas.map((a) => a.clienteId);

      const todos = await db
        .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
        .from(usuarios)
        .where(eq(usuarios.admin, false));

      return todos.filter((u) => !ocupados.includes(u.id));
    }),

  /** todas as alocações ativas de um cliente (usado na ficha do cliente) */
  porCliente: adminOnly
    .input(z.object({ clienteId: z.number().int() }))
    .handler(async ({ input }) => {
      const rows = await db
        .select()
        .from(alocacoes)
        .where(and(eq(alocacoes.clienteId, input.clienteId), eq(alocacoes.status, "ativo")));
      if (!rows.length) return [];

      const contas = await db
        .select()
        .from(contasMatrizes)
        .where(
          inArray(
            contasMatrizes.id,
            rows.map((r) => r.contaId),
          ),
        );

      return rows.map((r) => ({
        ...r,
        conta: contas.find((c) => c.id === r.contaId) ?? null,
      }));
    }),
};
