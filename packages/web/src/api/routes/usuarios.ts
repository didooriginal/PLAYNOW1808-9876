import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { contasMatrizes, pacotes, usuarios } from "../database/schema";
import { garantirAlocacao } from "./alocacoes";

const usuarioInput = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().nullable().optional(),
  statusPagamento: z.enum(["ativo", "vencendo", "inadimplente"]).default("ativo"),
  pacoteId: z.number().int().nullable().optional(),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  valor: z.number().nonnegative().default(0),
  proximaCobranca: z.string().default(""),
  clienteDesde: z.string().default(""),
  admin: z.boolean().default(false),
});

/** join usuário + pacote, no formato consumido pela tabela de clientes do admin */
const listarComPacote = () =>
  db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      telefone: usuarios.telefone,
      statusPagamento: usuarios.statusPagamento,
      pacoteId: usuarios.pacoteId,
      ciclo: usuarios.ciclo,
      valor: usuarios.valor,
      proximaCobranca: usuarios.proximaCobranca,
      clienteDesde: usuarios.clienteDesde,
      admin: usuarios.admin,
      pacoteNome: pacotes.nome,
      pacoteServicos: pacotes.servicos,
    })
    .from(usuarios)
    .leftJoin(pacotes, eq(usuarios.pacoteId, pacotes.id))
    .orderBy(asc(usuarios.nome));

export const usuariosRoutes = {
  /** base de clientes com o pacote contratado resolvido */
  listar: adminOnly.handler(() => listarComPacote()),

  obter: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(usuarios).where(eq(usuarios.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
    return row;
  }),

  criar: adminOnly.input(usuarioInput).handler(async ({ input }) => {
    const [row] = await db.insert(usuarios).values(input).returning();
    return row;
  }),

  atualizar: adminOnly
    .input(usuarioInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db.update(usuarios).set(patch).where(eq(usuarios.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
      return row;
    }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(usuarios).where(eq(usuarios.id, input.id));
    return { ok: true };
  }),

  /**
   * PAINEL DO CLIENTE — exige sessão. Resolve o cliente pelo vínculo
   * `usuarios.auth_user_id` (fallback: e-mail da conta de login) e devolve o
   * pacote contratado + as credenciais (contas matrizes) de cada serviço.
   */
  painel: authed.handler(async ({ context }) => {
    const [porVinculo] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.authUserId, context.user.id));

    let cliente = porVinculo;

    if (!cliente) {
      const [porEmail] = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.email, context.user.email.toLowerCase()));
      if (porEmail) {
        await db
          .update(usuarios)
          .set({ authUserId: context.user.id })
          .where(eq(usuarios.id, porEmail.id));
        cliente = { ...porEmail, authUserId: context.user.id };
      }
    }

    if (!cliente) return null;

      const [pacote] = cliente.pacoteId
        ? await db.select().from(pacotes).where(eq(pacotes.id, cliente.pacoteId))
        : [];

      const servicos = pacote?.servicos ?? [];

      /**
       * Um acesso por serviço do pacote. A credencial vem da ALOCAÇÃO do
       * cliente — se ele ainda não tem vaga naquele app, alocamos uma agora
       * (idempotente). Isso garante que a mesma conta apareça sempre, em vez
       * de mudar a cada reload. Sem vaga livre → acesso fica "aguardando".
       *
       * O cliente nunca vê quantas vagas existem nem quem mais usa a conta.
       */
      const acessos = [] as {
        servico: string;
        contaId: number | null;
        email: string;
        senha: string;
        status: string;
        regiao: string;
        aguardando: boolean;
      }[];

      for (const servico of servicos) {
        const alocacao = await garantirAlocacao(cliente.id, servico);
        if (!alocacao) {
          acessos.push({
            servico,
            contaId: null,
            email: "",
            senha: "",
            status: "aguardando",
            regiao: "BR",
            aguardando: true,
          });
          continue;
        }

        const [conta] = await db
          .select()
          .from(contasMatrizes)
          .where(eq(contasMatrizes.id, alocacao.contaId));
        if (!conta) continue;

        acessos.push({
          servico,
          contaId: conta.id,
          email: conta.email,
          senha: conta.senha,
          status: conta.status,
          regiao: conta.regiao,
          aguardando: false,
        });
      }

      return { cliente, pacote: pacote ?? null, acessos };
  }),

  /**
   * Registra a intenção de compra do cliente logado (vindo do fluxo de cadastro):
   * grava o pacote escolhido, o ciclo e o valor. O pagamento segue no WhatsApp,
   * então o status fica como `vencendo` até o admin confirmar.
   */
  escolherPacote: authed
    .input(
      z.object({
        pacoteId: z.number().int().nullable(),
        ciclo: z.enum(["mensal", "anual"]).default("mensal"),
        valor: z.number().nonnegative().default(0),
        telefone: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [cliente] = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.authUserId, context.user.id));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const [row] = await db
        .update(usuarios)
        .set({
          pacoteId: input.pacoteId,
          ciclo: input.ciclo,
          valor: input.valor,
          ...(input.telefone ? { telefone: input.telefone } : {}),
          statusPagamento: cliente.statusPagamento === "ativo" ? "ativo" : "vencendo",
        })
        .where(eq(usuarios.id, cliente.id))
        .returning();
      return row;
    }),

  /** Perfil da sessão atual + flag de admin, para proteger rotas no front. */
  eu: authed.handler(async ({ context }) => {
    const [cliente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.authUserId, context.user.id));
    const [porEmail] = cliente
      ? []
      : await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, context.user.email.toLowerCase()));
    const registro = cliente ?? porEmail ?? null;
    return {
      authId: context.user.id,
      nome: registro?.nome ?? context.user.name,
      email: context.user.email,
      admin: registro?.admin ?? false,
      clienteId: registro?.id ?? null,
    };
  }),

  /** KPIs de clientes/receita para o painel admin */
  resumo: adminOnly.handler(async () => {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        ativos: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'ativo' then 1 else 0 end), 0)`,
        vencendo: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'vencendo' then 1 else 0 end), 0)`,
        inadimplentes: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'inadimplente' then 1 else 0 end), 0)`,
        mrr: sql<number>`coalesce(sum(case when ${usuarios.ciclo} = 'anual' then ${usuarios.valor} / 12.0 else ${usuarios.valor} end), 0)`,
        emAtraso: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'inadimplente' then ${usuarios.valor} else 0 end), 0)`,
      })
      .from(usuarios)
      .where(eq(usuarios.admin, false));
    return row;
  }),
};
