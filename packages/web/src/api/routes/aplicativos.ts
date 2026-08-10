import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { aplicativos as tabelaAplicativos, contasMatrizes, pacotes } from "../database/schema";

/**
 * CATÁLOGO DE APLICATIVOS.
 * É a fonte de verdade dos apps que podem compor um pacote e uma conta matriz.
 * A leitura é pública (a landing e os ícones precisam de nome/cor de cada app);
 * toda escrita exige sessão de administrador.
 */

const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const aplicativoInput = z.object({
  nome: z.string().min(1),
  slug: z.string().optional(),
  mono: z.string().default(""),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hex, ex.: #22d3ee")
    .default("#22d3ee"),
  tipo: z.enum(["video", "musica", "extra"]).default("video"),
  categoria: z
    .enum(["streaming", "esportes", "produtividade", "musica", "iptv", "asiatico"])
    .default("streaming"),
  precoAvulso: z.number().nonnegative().default(0),
  preco: z.number().nonnegative().default(0),
  ativo: z.boolean().default(true),
});

export const aplicativos = {
  /** catálogo completo — leitura pública (ícones, landing, formulários) */
  listar: base.handler(() => db.select().from(tabelaAplicativos).orderBy(asc(tabelaAplicativos.nome))),

  criar: adminOnly.input(aplicativoInput).handler(async ({ input }) => {
    const slug = slugify(input.slug || input.nome);
    if (!slug) throw new ORPCError("BAD_REQUEST", { message: "Nome inválido para gerar o slug" });

    const [existente] = await db.select().from(tabelaAplicativos).where(eq(tabelaAplicativos.slug, slug));
    if (existente)
      throw new ORPCError("CONFLICT", { message: `Já existe um app com o slug "${slug}"` });

    const [row] = await db
      .insert(tabelaAplicativos)
      .values({
        ...input,
        slug,
        mono: input.mono || input.nome.slice(0, 2).toUpperCase(),
      })
      .returning();
    return row;
  }),

  atualizar: adminOnly
    .input(aplicativoInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, slug, ...patch } = input;
      const [row] = await db
        .update(tabelaAplicativos)
        .set({ ...patch, ...(slug ? { slug: slugify(slug) } : {}) })
        .where(eq(tabelaAplicativos.id, id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Aplicativo não encontrado" });
      return row;
    }),

  /**
   * Remove um app do catálogo. Bloqueia se ele ainda estiver em uso por algum
   * pacote ou conta matriz — evita pacote apontando para app inexistente.
   */
  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [app] = await db.select().from(tabelaAplicativos).where(eq(tabelaAplicativos.id, input.id));
    if (!app) throw new ORPCError("NOT_FOUND", { message: "Aplicativo não encontrado" });

    const contas = await db
      .select({ id: contasMatrizes.id })
      .from(contasMatrizes)
      .where(eq(contasMatrizes.servico, app.slug));
    if (contas.length)
      throw new ORPCError("CONFLICT", {
        message: `${contas.length} conta(s) matriz ainda usam este app. Remova-as antes.`,
      });

    const todos = await db.select({ id: pacotes.id, servicos: pacotes.servicos }).from(pacotes);
    const emUso = todos.filter((p) => (p.servicos ?? []).includes(app.slug));
    if (emUso.length)
      throw new ORPCError("CONFLICT", {
        message: `${emUso.length} pacote(s) incluem este app. Edite-os antes.`,
      });

    await db.delete(tabelaAplicativos).where(eq(tabelaAplicativos.id, input.id));
    return { ok: true };
  }),
};
