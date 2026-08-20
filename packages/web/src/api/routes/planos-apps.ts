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
import { notificar } from "./notificacoes";
import { avisarCliente } from "../lib/avisos-cliente";

/**
 * OPÇÕES DE APLICATIVO (variantes) + FILA DE CONVITES.
 *
 * Leitura do catálogo é pública (a vitrine precisa mostrar "a partir de R$ X"
 * e abrir o seletor de opções). Escrita e fila de convites são do admin.
 */

/**
 * AVISO DO PEDIDO DE CONVITE.
 * O pedido de "membro extra" depende 100% de acao humana (alguem tem que
 * cadastrar o e-mail no painel do provedor). Antes ele so caia na fila da aba
 * Convites e ninguem era avisado — pedido dormia. Agora sai por e-mail,
 * WhatsApp e Telegram como alerta CRITICO, com o e-mail do cliente pronto para
 * copiar. A `chave` leva o horario para nunca engolir um pedido novo.
 */
async function avisarPedidoConvite(
  cliente: { id: number; nome: string; telefone?: string | null },
  servico: { slug: string; nome: string },
  email: string,
  origem: string,
) {
  await notificar({
    escopo: "admin",
    clienteId: cliente.id,
    tipo: "sistema",
    severidade: "critico",
    titulo: `Pedido de convite (membro extra): ${cliente.nome}`,
    mensagem:
      `Cliente: ${cliente.nome} (#${cliente.id})\n` +
      `Opcao: ${servico.nome}\n` +
      `E-mail para o convite: ${email}\n` +
      (cliente.telefone ? `WhatsApp do cliente: ${cliente.telefone}\n` : "") +
      `Pedido: ${origem}\n` +
      `Acao: cadastre esse e-mail como membro extra no painel do provedor e marque como enviado na aba Convites.`,
    destino: "convites",
    chave: `convite:${cliente.id}:${servico.slug}:${email}:${Date.now()}`,
  });
}

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


/**
 * VAGA DE CONVITE DA CONTA MATRIZ.
 * Cada conta liberada para individual comporta `convitesMaximos` convites
 * (padrão 2, o limite de membro extra da Netflix). Aqui a gente confere se
 * ainda cabe antes de amarrar o convite naquela conta — e se a conta está
 * realmente liberada para individual, para não furar o compartilhamento.
 */
async function validarVagaDeConvite(contaId: number, conviteId?: number) {
  const [conta] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, contaId));
  if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });
  if (!conta.liberaIndividual)
    throw new ORPCError("BAD_REQUEST", {
      message: `A conta "${conta.rotulo}" não está liberada para convite individual. Marque "libera individual" nela primeiro.`,
    });

  const usados = await db
    .select({ id: convitesApps.id })
    .from(convitesApps)
    .where(
      and(
        eq(convitesApps.contaId, contaId),
        inArray(convitesApps.status, ["pendente", "enviado", "ativo"]),
      ),
    );
  const ocupados = usados.filter((u) => u.id !== conviteId).length;
  if (ocupados >= conta.convitesMaximos)
    throw new ORPCError("BAD_REQUEST", {
      message: `A conta "${conta.rotulo}" já está com ${ocupados} de ${conta.convitesMaximos} convites. Libere um convite ou escolha outra conta.`,
    });
  return conta;
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
        if (aberto.email === email) {
          await avisarPedidoConvite(ficha, servico, email, "cliente reenviou o mesmo pedido");
          return aberto;
        }
        const [atualizado] = await db
          .update(convitesApps)
          .set({ email, status: "pendente", atendidoEm: null })
          .where(eq(convitesApps.id, aberto.id))
          .returning();
        await avisarPedidoConvite(ficha, servico, email, "e-mail trocado pelo cliente");
        return atualizado;
      }

      const [row] = await db
        .insert(convitesApps)
        .values({ clienteId: ficha.id, servico: servico.slug, email })
        .returning();
      await avisarPedidoConvite(ficha, servico, email, "novo pedido");
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

  /**
   * ADMIN LANÇA O CONVITE NA MÃO.
   * Antes só existia o caminho do cliente (`pedirConvite`): se o cliente
   * mandava o e-mail pelo WhatsApp, o admin não tinha por onde registrar e o
   * convite ficava fora do sistema. Aqui ele cria a linha já apontando a conta
   * matriz de onde o convite vai sair.
   */
  criarConvite: adminOnly
    .input(
      z.object({
        clienteId: z.number().int(),
        servico: z.string().min(1),
        email: z.string().email("Informe um e-mail válido"),
        contaId: z.number().int().nullable().optional(),
        status: z.enum(["pendente", "enviado", "ativo"]).default("pendente"),
        observacao: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const servico = await resolverServico(input.servico);
      if (!servico)
        throw new ORPCError("NOT_FOUND", { message: "Essa opção não existe no catálogo" });
      if (servico.entrega !== "convite")
        throw new ORPCError("BAD_REQUEST", {
          message: "Essa opção é entregue por login e senha, não por convite.",
        });

      const email = input.email.trim().toLowerCase();
      if (input.contaId) await validarVagaDeConvite(input.contaId);
      if ((input.status === "enviado" || input.status === "ativo") && !input.contaId)
        throw new ORPCError("BAD_REQUEST", {
          message: "Escolha de qual conta matriz o convite saiu.",
        });

      // mesmo cliente + mesmo serviço com pedido em aberto: atualiza em vez de duplicar
      const [aberto] = await db
        .select()
        .from(convitesApps)
        .where(
          and(
            eq(convitesApps.clienteId, input.clienteId),
            eq(convitesApps.servico, servico.slug),
            inArray(convitesApps.status, ["pendente", "enviado"]),
          ),
        );

      const valores = {
        email,
        status: input.status,
        contaId: input.contaId ?? null,
        observacao: input.observacao ?? "",
        atendidoEm: input.status === "pendente" ? null : new Date(),
      };

      const [row] = aberto
        ? await db
            .update(convitesApps)
            .set(valores)
            .where(eq(convitesApps.id, aberto.id))
            .returning()
        : await db
            .insert(convitesApps)
            .values({ clienteId: input.clienteId, servico: servico.slug, ...valores })
            .returning();

      if (row && (input.status === "enviado" || input.status === "ativo")) {
        await avisarCliente(row.clienteId, "convite", {
          app: row.servico,
          chave: `${row.id}:${input.status}`,
        });
      }
      return row;
    }),

  /**
   * CONTAS QUE PODEM RECEBER CONVITE INDIVIDUAL, com as vagas de convite de
   * cada uma e quem está em cada vaga. É a resposta para "qual cliente está em
   * qual conta matriz", que antes não existia em lugar nenhum.
   */
  contasDeConvite: adminOnly.handler(async () => {
    const contas = await db
      .select()
      .from(contasMatrizes)
      .where(eq(contasMatrizes.liberaIndividual, true))
      .orderBy(asc(contasMatrizes.servico), asc(contasMatrizes.rotulo));
    if (contas.length === 0) return [];

    const linhas = await db
      .select()
      .from(convitesApps)
      .where(inArray(convitesApps.status, ["pendente", "enviado", "ativo"]));

    const { usuarios } = await import("../database/schema");
    const ids = [...new Set(linhas.map((l) => l.clienteId))];
    const clientes = ids.length
      ? await db.select().from(usuarios).where(inArray(usuarios.id, ids))
      : [];
    const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]));

    return contas.map((c) => {
      const ocupantes = linhas
        .filter((l) => l.contaId === c.id)
        .map((l) => ({
          conviteId: l.id,
          clienteId: l.clienteId,
          cliente: nomePorId.get(l.clienteId) ?? `Cliente #${l.clienteId}`,
          email: l.email,
          status: l.status,
        }));
      return {
        id: c.id,
        servico: c.servico,
        rotulo: c.rotulo,
        email: c.email,
        convitesMaximos: c.convitesMaximos,
        ocupantes,
        livres: Math.max(c.convitesMaximos - ocupantes.length, 0),
      };
    });
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
      const [antes] = await db.select().from(convitesApps).where(eq(convitesApps.id, input.id));
      if (!antes) throw new ORPCError("NOT_FOUND", { message: "Convite não encontrado" });

      /**
       * De qual conta matriz saiu o convite é obrigatório ao marcar enviado ou
       * ativo. Sem isso ninguém sabia em qual conta o cliente estava, e as
       * duas vagas de convite de cada conta eram impossíveis de controlar.
       */
      const contaFinal = input.contaId !== undefined ? input.contaId : antes.contaId;
      if ((input.status === "enviado" || input.status === "ativo") && !contaFinal)
        throw new ORPCError("BAD_REQUEST", {
          message: "Escolha de qual conta matriz o convite saiu antes de marcar como enviado.",
        });
      if (contaFinal) await validarVagaDeConvite(contaFinal, input.id);

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

      // convite entregue: push automatico + WhatsApp na fila do admin
      if (input.status === "enviado" || input.status === "ativo") {
        await avisarCliente(row.clienteId, "convite", {
          app: row.servico,
          chave: `${row.id}:${input.status}`,
        });
      }

      return row;
    }),
};
