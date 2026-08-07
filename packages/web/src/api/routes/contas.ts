import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import { contasMatrizes } from "../database/schema";

const contaInput = z.object({
  servico: z.string().min(1),
  rotulo: z.string().min(1),
  email: z.string().min(1),
  senha: z.string().min(1),
  totalVagas: z.number().int().positive().default(1),
  vagasOcupadas: z.number().int().nonnegative().default(0),
  status: z.enum(["ativo", "manutencao"]).default("ativo"),
  renovacao: z.string().default(""),
  custo: z.number().nonnegative().default(0),
  regiao: z.string().default("BR"),
  observacao: z.string().nullable().optional(),
});

export const contasRoutes = {
  /** estoque completo de contas matrizes */
  listar: base.handler(() =>
    db.select().from(contasMatrizes).orderBy(asc(contasMatrizes.servico), asc(contasMatrizes.rotulo)),
  ),

  obter: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });
    return row;
  }),

  criar: base.input(contaInput).handler(async ({ input }) => {
    const [row] = await db.insert(contasMatrizes).values(input).returning();
    return row;
  }),

  atualizar: base
    .input(contaInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db
        .update(contasMatrizes)
        .set(patch)
        .where(eq(contasMatrizes.id, id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });
      return row;
    }),

  /** ocupa (+1) ou libera (-1) uma vaga, respeitando o total */
  ajustarVagas: base
    .input(z.object({ id: z.number().int(), delta: z.number().int() }))
    .handler(async ({ input }) => {
      const [conta] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

      const proximo = conta.vagasOcupadas + input.delta;
      if (proximo < 0) throw new ORPCError("BAD_REQUEST", { message: "Não há vagas ocupadas para liberar" });
      if (proximo > conta.totalVagas)
        throw new ORPCError("BAD_REQUEST", { message: "Conta esgotada — reponha antes de alocar" });

      const [row] = await db
        .update(contasMatrizes)
        .set({ vagasOcupadas: proximo })
        .where(eq(contasMatrizes.id, input.id))
        .returning();
      return row;
    }),

  /** reposição: zera a lotação e volta a conta para ativo */
  repor: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db
      .update(contasMatrizes)
      .set({ vagasOcupadas: 0, status: "ativo" })
      .where(eq(contasMatrizes.id, input.id))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });
    return row;
  }),

  remover: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(contasMatrizes).where(eq(contasMatrizes.id, input.id));
    return { ok: true };
  }),

  /** resumo de lotação usado nos KPIs do admin */
  resumo: base.handler(async () => {
    const [row] = await db
      .select({
        contas: sql<number>`count(*)`,
        vagasTotais: sql<number>`coalesce(sum(${contasMatrizes.totalVagas}), 0)`,
        vagasOcupadas: sql<number>`coalesce(sum(${contasMatrizes.vagasOcupadas}), 0)`,
        esgotadas: sql<number>`coalesce(sum(case when ${contasMatrizes.vagasOcupadas} >= ${contasMatrizes.totalVagas} then 1 else 0 end), 0)`,
        custoMensal: sql<number>`coalesce(sum(${contasMatrizes.custo}), 0)`,
      })
      .from(contasMatrizes);
    return row;
  }),
};
