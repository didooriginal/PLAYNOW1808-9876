import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { aplicativos, combos } from "../database/schema";

/**
 * COMBO INTELIGENTE.
 * O admin seleciona 2+ apps do catálogo e define um preço promocional.
 * `precoCheio` NUNCA é digitado: é sempre a soma dos `aplicativos.preco`
 * dos apps escolhidos, recalculada a cada gravação — assim o desconto
 * exibido na landing e no painel do cliente é sempre real.
 */

const comboInput = z.object({
  nome: z.string().min(1),
  descricao: z.string().default(""),
  apps: z.array(z.string().min(1)).min(2, "Selecione ao menos 2 aplicativos"),
  preco: z.number().positive("Informe o preço promocional"),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  visivelLanding: z.boolean().default(true),
  visivelCliente: z.boolean().default(true),
  destaque: z.boolean().default(false),
  ativo: z.boolean().default(true),
});

/** soma dos preços de venda avulsos dos apps do combo */
async function somaAvulsa(slugs: string[]) {
  const rows = await db
    .select({ slug: aplicativos.slug, preco: aplicativos.preco })
    .from(aplicativos)
    .where(inArray(aplicativos.slug, slugs));

  const faltando = slugs.filter((s) => !rows.some((r) => r.slug === s));
  if (faltando.length)
    throw new ORPCError("BAD_REQUEST", {
      message: `App(s) fora do catálogo: ${faltando.join(", ")}`,
    });

  return Math.round(rows.reduce((soma, r) => soma + (r.preco ?? 0), 0) * 100) / 100;
}

const comCalculo = <T extends { preco: number; precoCheio: number }>(row: T) => ({
  ...row,
  economia: Math.round((row.precoCheio - row.preco) * 100) / 100,
  economiaPct:
    row.precoCheio > 0 ? Math.round((1 - row.preco / row.precoCheio) * 100) : 0,
});

export const combosRoutes = {
  /** vitrine pública da landing — só combos ativos e marcados para a landing */
  vitrine: base.handler(async () => {
    const rows = await db
      .select()
      .from(combos)
      .where(and(eq(combos.ativo, true), eq(combos.visivelLanding, true)))
      .orderBy(asc(combos.preco));
    return rows.map(comCalculo);
  }),

  /** sugestões de upgrade no painel do cliente */
  paraCliente: base.handler(async () => {
    const rows = await db
      .select()
      .from(combos)
      .where(and(eq(combos.ativo, true), eq(combos.visivelCliente, true)))
      .orderBy(asc(combos.preco));
    return rows.map(comCalculo);
  }),

  /** lista completa (admin) */
  listar: adminOnly.handler(async () => {
    const rows = await db.select().from(combos).orderBy(asc(combos.nome));
    return rows.map(comCalculo);
  }),

  criar: adminOnly.input(comboInput).handler(async ({ input }) => {
    const precoCheio = await somaAvulsa(input.apps);
    const [row] = await db.insert(combos).values({ ...input, precoCheio }).returning();
    return comCalculo(row);
  }),

  atualizar: adminOnly
    .input(comboInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [atual] = await db.select().from(combos).where(eq(combos.id, id));
      if (!atual) throw new ORPCError("NOT_FOUND", { message: "Combo não encontrado" });

      const apps = patch.apps ?? atual.apps ?? [];
      if (apps.length < 2)
        throw new ORPCError("BAD_REQUEST", { message: "Selecione ao menos 2 aplicativos" });

      const precoCheio = await somaAvulsa(apps);
      const [row] = await db
        .update(combos)
        .set({ ...patch, precoCheio })
        .where(eq(combos.id, id))
        .returning();
      return comCalculo(row);
    }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.delete(combos).where(eq(combos.id, input.id)).returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Combo não encontrado" });
    return { ok: true };
  }),
};
