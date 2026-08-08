import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { pacotes } from "../database/schema";

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

export const pacotesRoutes = {
  /** todos os pacotes cadastrados */
  listar: base.handler(() => db.select().from(pacotes).orderBy(asc(pacotes.preco))),

  obter: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(pacotes).where(eq(pacotes.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Pacote não encontrado" });
    return row;
  }),

  criar: adminOnly.input(pacoteInput).handler(async ({ input }) => {
    const [row] = await db.insert(pacotes).values(input).returning();
    return row;
  }),

  atualizar: adminOnly
    .input(pacoteInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db.update(pacotes).set(patch).where(eq(pacotes.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Pacote não encontrado" });
      return row;
    }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(pacotes).where(eq(pacotes.id, input.id));
    return { ok: true };
  }),
};
