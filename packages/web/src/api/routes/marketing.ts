import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { marketingTexts } from "../database/schema";

/**
 * MARKETING — biblioteca de textos prontos (promoções, boas-vindas, suporte)
 * que o admin copia e cola no WhatsApp/Instagram. Tudo `adminOnly`.
 */
export const marketing = {
  listar: adminOnly.handler(async () => {
    return db.select().from(marketingTexts).orderBy(desc(marketingTexts.criadoEm));
  }),

  salvar: adminOnly
    .input(
      z.object({
        id: z.number().int().optional(),
        titulo: z.string().min(1).max(120),
        conteudo: z.string().min(1).max(4000),
        categoria: z.enum(["geral", "promo", "suporte", "boas_vindas"]).default("geral"),
      }),
    )
    .handler(async ({ input }) => {
      if (input.id) {
        const [row] = await db
          .update(marketingTexts)
          .set({
            titulo: input.titulo,
            conteudo: input.conteudo,
            categoria: input.categoria,
          })
          .where(eq(marketingTexts.id, input.id))
          .returning();
        return row;
      }
      const [row] = await db
        .insert(marketingTexts)
        .values({
          titulo: input.titulo,
          conteudo: input.conteudo,
          categoria: input.categoria,
        })
        .returning();
      return row;
    }),

  remover: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(marketingTexts).where(eq(marketingTexts.id, input.id));
      return { ok: true };
    }),
};
