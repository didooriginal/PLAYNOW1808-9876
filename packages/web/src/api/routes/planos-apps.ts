import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import {
  alocacoes,
  aplicativos,
  assinaturasApps,
  contasMatrizes,
  convitesApps,
  planosApps,
} from "../database/schema";
import { catalogoComOpcoes, resolverServico } from "../lib/planos";
import { garantirFichaDaSessao } from "../lib/sessao";

/**
 * OPÇÕES DE APLICATIVO (variantes) + FILA DE CONVITES.
 *
 * Leitura do catálogo é pública (a vitrine precisa mostrar "a partir de R$ X"
 * e abrir o seletor de opções). Escrita e fila de convites são do admin.
 */

const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const planoInput = z.object({
  aplicativoId: z.number().int(),
  nome: z.string().min(1),
  slug: z.string().optional(),
  descricao: z.string().default(""),
  preco: z.number().nonnegative().default(0),
  precoAvulso: z.number().nonnegative().default(0),
  entrega: z.enum(["vaga", "convite"]).default("vaga"),
  padrao: z.boolean().default(false),
  ordem: z.number().int().nonnegative().default(0),
  ativo: z.boolean().default(true),
});

/** garante que só exista UMA opção padrão por app */
async function fixarPadrao(aplicativoId: number, planoId: number) {
  await db
    .update(planosApps)
    .set({ padrao: false })
    .where(eq(planosApps.aplicativoId, aplicativoId));
  await db.update(planosApps).set({ padrao: true }).where(eq(planosApps.id, planoId));
}

export const planosDeApps = {
  /** catálogo agrupado (app + opções) — usado pela vitrine e pelo checkout */
  catalogo: base.handler(() => catalogoComOpcoes()),

  /** opções de um app específico */
  listar: base
    .input(z.object({ aplicativoId: z.number().int() }))
    .handler(({ input }) =>
      db
        .select()
        .from(planosApps)
        .where(eq(planosApps.aplicativoId, input.aplicativoId))
        .orderBy(asc(planosApps.ordem), asc(planosApps.id)),
    ),

  criar: adminOnly.input(planoInput).handler(async ({ input }) => {
    const [app] = await db
      .select()
      .from(aplicativos)
      .where(eq(aplicativos.id, input.aplicativoId));
    if (!app) throw new ORPCError("NOT_FOUND", { message: "Aplicativo não encontrado" });

    const slug = slugify(input.slug || `${app.slug}-${input.nome}`);
    if (!slug) throw new ORPCError("BAD_REQUEST", { message: "Nome inválido para gerar o slug" });

    const [colisaoPlano] = await db.select().from(planosApps).where(eq(planosApps.slug, slug));
    if (colisaoPlano)
      throw new ORPCError("CONFLICT", { message: `Já existe uma opção com o slug "${slug}"` });
    const [colisaoApp] = await db.select().from(aplicativos).where(eq(aplicativos.slug, slug));
    if (colisaoApp)
      throw new ORPCError("CONFLICT", {
        message: `O slug "${slug}" já é usado por um aplicativo do catálogo`,
      });

    const irmas = await db
      .select()
      .from(planosApps)
      .where(eq(planosApps.aplicativoId, input.aplicativoId));

    const [row] = await db
      .insert(planosApps)
      .values({
        ...input,
        slug,
        precoAvulso: input.precoAvulso || input.preco,
        ordem: input.ordem || irmas.length + 1,
        // a primeira opção de um app vira padrão automaticamente, senão o app
        // ficaria com opções cadastradas e nenhuma entregável em pacote
        padrao: input.padrao || irmas.length === 0,
      })
      .returning();

    if (row.padrao) await fixarPadrao(row.aplicativoId, row.id);
    return row;
  }),

  atualizar: adminOnly
    .input(planoInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, slug, aplicativoId: _ignorado, ...patch } = input;
      const [atual] = await db.select().from(planosApps).where(eq(planosApps.id, id));
      if (!atual) throw new ORPCError("NOT_FOUND", { message: "Opção não encontrada" });

      // trocar o slug mexe no estoque: as contas matrizes e alocações já
      // gravadas apontam para o slug antigo, então movemos tudo junto
      const novoSlug = slug ? slugify(slug) : null;
      if (novoSlug && novoSlug !== atual.slug) {
        const [colisao] = await db.select().from(planosApps).where(eq(planosApps.slug, novoSlug));
        if (colisao)
          throw new ORPCError("CONFLICT", { message: `Já existe uma opção com o slug "${novoSlug}"` });
        await db
          .update(contasMatrizes)
          .set({ servico: novoSlug })
          .where(eq(contasMatrizes.servico, atual.slug));
        await db.update(alocacoes).set({ servico: novoSlug }).where(eq(alocacoes.servico, atual.slug));
        await db
          .update(assinaturasApps)
          .set({ servico: novoSlug })
          .where(eq(assinaturasApps.servico, atual.slug));
      }

      const [row] = await db
        .update(planosApps)
        .set({ ...patch, ...(novoSlug ? { slug: novoSlug } : {}) })
        .where(eq(planosApps.id, id))
        .returning();

      if (patch.padrao) await fixarPadrao(row.aplicativoId, row.id);
      return row;
    }),

  /**
   * Remove uma opção. Bloqueia se ainda houver conta matriz, assinatura ativa
   * ou alocação ativa nela — apagar deixaria cliente pagando por um slug que
   * não existe mais.
   */
  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [plano] = await db.select().from(planosApps).where(eq(planosApps.id, input.id));
    if (!plano) throw new ORPCError("NOT_FOUND", { message: "Opção não encontrada" });

    const contas = await db
      .select({ id: contasMatrizes.id })
      .from(contasMatrizes)
      .where(eq(contasMatrizes.servico, plano.slug));
    if (contas.length)
      throw new ORPCError("CONFLICT", {
        message: `${contas.length} conta(s) matriz ainda usam esta opção. Migre o estoque antes de remover.`,
      });

    const ativas = await db
      .select({ id: assinaturasApps.id })
      .from(assinaturasApps)
      .where(and(eq(assinaturasApps.servico, plano.slug), eq(assinaturasApps.status, "ativo")));
    if (ativas.length)
      throw new ORPCError("CONFLICT", {
        message: `${ativas.length} cliente(s) têm esta opção ativa. Migre-os antes de remover.`,
      });

    await db.delete(planosApps).where(eq(planosApps.id, input.id));
    return { ok: true };
  }),

  /* ---------------------------------------------------------------- */
  /* FILA DE CONVITES (membro extra)                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Cliente informa o e-mail que quer usar no provedor.
   * Vale para planos com `entrega = "convite"` (ex.: Netflix individual, onde
   * o acesso é o convite de "membro extra" enviado pela própria Netflix).
   */
  pedirConvite: authed
    .input(
      z.object({
        servico: z.string().min(1),
        email: z.string().email("Informe um e-mail válido"),
      }),
    )
    .handler(async ({ input, context }) => {
      const ficha = await garantirFichaDaSessao(context.user);
      if (!ficha) throw new ORPCError("NOT_FOUND", { message: "Cadastro não encontrado" });

      const servico = await resolverServico(input.servico);
      if (!servico)
        throw new ORPCError("NOT_FOUND", { message: "Essa opção não existe mais no catálogo" });
      if (servico.entrega !== "convite")
        throw new ORPCError("BAD_REQUEST", {
          message: "Essa opção é entregue por login e senha, não por convite.",
        });

      const email = input.email.trim().toLowerCase();

      // reaproveita o pedido em aberto em vez de empilhar duplicatas na fila
      const [aberto] = await db
        .select()
        .from(convitesApps)
        .where(
          and(
            eq(convitesApps.clienteId, ficha.id),
            eq(convitesApps.servico, servico.slug),
            inArray(convitesApps.status, ["pendente", "enviado"]),
          ),
        );

      if (aberto) {
        if (aberto.email === email) return aberto;
        const [atualizado] = await db
          .update(convitesApps)
          .set({ email, status: "pendente", atendidoEm: null })
          .where(eq(convitesApps.id, aberto.id))
          .returning();
        return atualizado;
      }

      const [row] = await db
        .insert(convitesApps)
        .values({ clienteId: ficha.id, servico: servico.slug, email })
        .returning();
      return row;
    }),

  /** o que o cliente vê no painel: status dos convites dele */
  meusConvites: authed.handler(async ({ context }) => {
    const ficha = await garantirFichaDaSessao(context.user);
    if (!ficha) return [];
    return db
      .select()
      .from(convitesApps)
      .where(eq(convitesApps.clienteId, ficha.id))
      .orderBy(asc(convitesApps.criadoEm));
  }),

  /** fila do admin, com o nome do cliente já resolvido */
  filaConvites: adminOnly.handler(async () => {
    const linhas = await db.select().from(convitesApps).orderBy(asc(convitesApps.criadoEm));
    if (linhas.length === 0) return [];

    const { usuarios } = await import("../database/schema");
    const ids = [...new Set(linhas.map((l) => l.clienteId))];
    const clientes = await db.select().from(usuarios).where(inArray(usuarios.id, ids));
    const porId = new Map(clientes.map((c) => [c.id, c]));

    return linhas.map((l) => ({
      ...l,
      cliente: porId.get(l.clienteId)?.nome ?? `Cliente #${l.clienteId}`,
      whatsapp: porId.get(l.clienteId)?.telefone ?? "",
    }));
  }),

  /** admin marca o andamento: pendente → enviado → ativo (ou recusado) */
  atualizarConvite: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["pendente", "enviado", "ativo", "recusado"]),
        contaId: z.number().int().nullable().optional(),
        observacao: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const [row] = await db
        .update(convitesApps)
        .set({
          status: input.status,
          ...(input.contaId !== undefined ? { contaId: input.contaId } : {}),
          ...(input.observacao !== undefined ? { observacao: input.observacao } : {}),
          atendidoEm: input.status === "pendente" ? null : new Date(),
        })
        .where(eq(convitesApps.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Convite não encontrado" });
      return row;
    }),
};
