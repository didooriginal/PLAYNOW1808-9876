import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { pacotes as tabelaPacotes } from "../database/schema";

const pacoteInput = z.object({
  nome: z.string().min(1),
  tagline: z.string().default(""),
  preco: z.number().nonnegative(),
  precoAnual: z.number().nonnegative().nullable().optional(),
  servicos: z.array(z.string()).default([]),
  perks: z.array(z.string()).default([]),
  accent: z.enum(["red", "cyan", "purple"]).default("cyan"),
  badge: z.string().nullable().optional(),
  destaque: z.boolean().default(false),
  vagasRestantes: z.number().int().nonnegative().default(0),
  ativo: z.boolean().default(true),
});

export const pacotes = {
  /** todos os pacotes cadastrados */
  listar: base.handler(() => db.select().from(tabelaPacotes).orderBy(asc(tabelaPacotes.preco))),

  obter: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(tabelaPacotes).where(eq(tabelaPacotes.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Pacote não encontrado" });
    return row;
  }),

  criar: adminOnly.input(pacoteInput).handler(async ({ input }) => {
    const [row] = await db.insert(tabelaPacotes).values(input).returning();
    return row;
  }),

  /**
   * Edicao parcial. ATENCAO: nao da para reaproveitar `pacoteInput.partial()`
   * aqui — os `.default()` do schema de criacao continuam valendo no parse e
   * transformam um patch tipo `{ ativo: false }` em "zera servicos, perks,
   * vagas e accent". Por isso existe um schema proprio sem defaults e as
   * chaves ausentes sao descartadas antes do UPDATE.
   */
  atualizar: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        nome: z.string().min(1).optional(),
        tagline: z.string().optional(),
        preco: z.number().nonnegative().optional(),
        precoAnual: z.number().nonnegative().nullable().optional(),
        servicos: z.array(z.string()).optional(),
        perks: z.array(z.string()).optional(),
        accent: z.enum(["red", "cyan", "purple"]).optional(),
        badge: z.string().nullable().optional(),
        destaque: z.boolean().optional(),
        vagasRestantes: z.number().int().nonnegative().optional(),
        ativo: z.boolean().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { id, ...bruto } = input;
      const patch = Object.fromEntries(
        Object.entries(bruto).filter(([, v]) => v !== undefined),
      ) as Partial<typeof bruto>;
      if (Object.keys(patch).length === 0) {
        const [atual] = await db.select().from(tabelaPacotes).where(eq(tabelaPacotes.id, id));
        if (!atual) throw new ORPCError("NOT_FOUND", { message: "Pacote não encontrado" });
        return atual;
      }
      const [row] = await db.update(tabelaPacotes).set(patch).where(eq(tabelaPacotes.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Pacote não encontrado" });
      return row;
    }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(tabelaPacotes).where(eq(tabelaPacotes.id, input.id));
    return { ok: true };
  }),
};
