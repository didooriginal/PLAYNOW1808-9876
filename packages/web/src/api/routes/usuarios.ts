import { z } from "zod";
import { asc, desc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { contasMatrizes, historicoVencimento, pacotes, usuarios as tabelaUsuarios } from "../database/schema";
import { garantirAlocacao } from "./alocacoes";
import {
  FORMAS_PAGAMENTO,
  MSG_BLOQUEIO,
  STATUS_CLIENTE,
  estaBloqueado,
  situacaoCobranca,
  statusEsperado,
} from "../lib/cobranca";
import { notificar, varrerVencimentos } from "./notificacoes";

/**
 * Patch de edicao: TODOS os campos opcionais e SEM default, para que uma
 * edicao parcial (ex.: so a forma de pagamento) nunca sobrescreva status,
 * data de cobranca ou valor com o valor padrao do schema.
 */
const usuarioPatch = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional(),
  telefone: z.string().nullable().optional(),
  statusPagamento: z.enum(STATUS_CLIENTE).optional(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
  pacoteId: z.number().int().nullable().optional(),
  ciclo: z.enum(["mensal", "anual"]).optional(),
  valor: z.number().nonnegative().optional(),
  proximaCobranca: z.string().optional(),
  clienteDesde: z.string().optional(),
  admin: z.boolean().optional(),
});

const usuarioInput = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().nullable().optional(),
  statusPagamento: z.enum(STATUS_CLIENTE).default("ativo"),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).default("pix"),
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
      id: tabelaUsuarios.id,
      nome: tabelaUsuarios.nome,
      email: tabelaUsuarios.email,
      telefone: tabelaUsuarios.telefone,
      statusPagamento: tabelaUsuarios.statusPagamento,
      formaPagamento: tabelaUsuarios.formaPagamento,
      termosAceitosEm: tabelaUsuarios.termosAceitosEm,
      vencimentoTravado: tabelaUsuarios.vencimentoTravado,
      pacoteId: tabelaUsuarios.pacoteId,
      ciclo: tabelaUsuarios.ciclo,
      valor: tabelaUsuarios.valor,
      proximaCobranca: tabelaUsuarios.proximaCobranca,
      clienteDesde: tabelaUsuarios.clienteDesde,
      admin: tabelaUsuarios.admin,
      pacoteNome: pacotes.nome,
      pacoteServicos: pacotes.servicos,
    })
    .from(tabelaUsuarios)
    .leftJoin(pacotes, eq(tabelaUsuarios.pacoteId, pacotes.id))
    .orderBy(asc(tabelaUsuarios.nome));

export const usuarios = {
  /** base de clientes com o pacote contratado resolvido */
  listar: adminOnly.handler(async () => {
    // mantem os status coerentes com a data de vencimento antes de listar
    await varrerVencimentos();
    return listarComPacote();
  }),

  obter: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(tabelaUsuarios).where(eq(tabelaUsuarios.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
    return row;
  }),

  criar: adminOnly.input(usuarioInput).handler(async ({ input }) => {
    const [row] = await db.insert(tabelaUsuarios).values(input).returning();
    return row;
  }),

  atualizar: adminOnly
    .input(usuarioPatch.extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...bruto } = input;
      // remove chaves ausentes para nao sobrescrever coluna com undefined
      const patch = Object.fromEntries(
        Object.entries(bruto).filter(([, v]) => v !== undefined),
      ) as Partial<typeof bruto>;

      // TRAVA DE VENCIMENTO: a data de cobranca nunca muda por edicao livre.
      // Use `tabelaUsuarios.alterarVencimento`, que exige motivo e grava historico.
      // (zod preenche defaults, entao so bloqueia quando veio valor real e diferente)
      if (patch.proximaCobranca) {
        const [atual] = await db
          .select({ atualData: tabelaUsuarios.proximaCobranca, travado: tabelaUsuarios.vencimentoTravado })
          .from(tabelaUsuarios)
          .where(eq(tabelaUsuarios.id, id));
        if (atual?.travado && patch.proximaCobranca !== atual.atualData) {
          throw new ORPCError("FORBIDDEN", {
            message:
              "Data de vencimento travada. Use \"Alterar vencimento\" e informe o motivo para registrar no histórico.",
          });
        }
        delete patch.proximaCobranca;
      }

      const [row] = await db.update(tabelaUsuarios).set(patch).where(eq(tabelaUsuarios.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
      return row;
    }),

  /**
   * Unica porta para mexer na data de vencimento. Exige motivo, grava o
   * historico (quem, quando, de/para) e reavalia o status do cliente.
   */
  alterarVencimento: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        proximaCobranca: z
          .string()
          .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato dd/mm/aaaa"),
        motivo: z.string().min(5, "Descreva o motivo da alteração (mínimo 5 caracteres)"),
      }),
    )
    .handler(async ({ input, context }) => {
      const [cliente] = await db.select().from(tabelaUsuarios).where(eq(tabelaUsuarios.id, input.id));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const novoStatus = statusEsperado(input.proximaCobranca, cliente.statusPagamento);

      const [row] = await db
        .update(tabelaUsuarios)
        .set({ proximaCobranca: input.proximaCobranca, statusPagamento: novoStatus })
        .where(eq(tabelaUsuarios.id, input.id))
        .returning();

      await db.insert(historicoVencimento).values({
        clienteId: input.id,
        de: cliente.proximaCobranca,
        para: input.proximaCobranca,
        motivo: input.motivo,
        autor: context.user.email,
      });

      await notificar({
        escopo: "cliente",
        clienteId: input.id,
        tipo: "vencimento",
        severidade: "info",
        titulo: "Data de vencimento atualizada",
        mensagem: `Sua próxima cobrança passou de ${cliente.proximaCobranca || "—"} para ${input.proximaCobranca}.`,
        destino: "faturas",
        chave: `venc-alt:${input.id}:${Date.now()}`,
      });

      return row;
    }),

  /** historico de alteracoes de vencimento de um cliente */
  historicoVencimento: adminOnly
    .input(z.object({ clienteId: z.number().int() }))
    .handler(({ input }) =>
      db
        .select()
        .from(historicoVencimento)
        .where(eq(historicoVencimento.clienteId, input.clienteId))
        .orderBy(desc(historicoVencimento.criadoEm)),
    ),

  /** aceite do checklist de boas-vindas (regras de uso) */
  aceitarTermos: authed.handler(async ({ context }) => {
    const [cliente] = await db
      .select()
      .from(tabelaUsuarios)
      .where(eq(tabelaUsuarios.authUserId, context.user.id));
    if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
    const [row] = await db
      .update(tabelaUsuarios)
      .set({ termosAceitosEm: new Date() })
      .where(eq(tabelaUsuarios.id, cliente.id))
      .returning();
    return { ok: true, termosAceitosEm: row?.termosAceitosEm ?? null };
  }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(tabelaUsuarios).where(eq(tabelaUsuarios.id, input.id));
    return { ok: true };
  }),

  /**
   * PAINEL DO CLIENTE — exige sessão. Resolve o cliente pelo vínculo
   * `tabelaUsuarios.auth_user_id` (fallback: e-mail da conta de login) e devolve o
   * pacote contratado + as credenciais (contas matrizes) de cada serviço.
   */
  painel: authed.handler(async ({ context }) => {
    // reavalia vencimentos/bloqueios antes de montar o painel
    await varrerVencimentos();

    const [porVinculo] = await db
      .select()
      .from(tabelaUsuarios)
      .where(eq(tabelaUsuarios.authUserId, context.user.id));

    let cliente = porVinculo;

    if (!cliente) {
      const [porEmail] = await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.email, context.user.email.toLowerCase()));
      if (porEmail) {
        await db
          .update(tabelaUsuarios)
          .set({ authUserId: context.user.id })
          .where(eq(tabelaUsuarios.id, porEmail.id));
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

      // BLOQUEIO POR INADIMPLENCIA: cliente atrasado/suspenso nao ve senha
      // nem e-mail das contas matrizes — so a tela de regularizacao.
      const bloqueado = estaBloqueado(cliente.statusPagamento);

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
          email: bloqueado ? "" : conta.email,
          senha: bloqueado ? "" : conta.senha,
          status: conta.status,
          regiao: conta.regiao,
          aguardando: false,
        });
      }

      return {
        cliente,
        pacote: pacote ?? null,
        acessos,
        /** contador regressivo + estado da cobranca, prontos para a UI */
        situacao: situacaoCobranca(cliente),
        bloqueado,
        motivoBloqueio: bloqueado ? MSG_BLOQUEIO : "",
        /** checklist de boas-vindas ainda nao aceito */
        precisaAceitarTermos: !cliente.termosAceitosEm,
      };
  }),

  /**
   * Registra a intenção de compra do cliente logado (vindo do fluxo de cadastro):
   * grava o pacote escolhido, o ciclo e o valor. O pagamento segue no WhatsApp,
   * então o status fica como `pendente` até o admin confirmar.
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
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.authUserId, context.user.id));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const [row] = await db
        .update(tabelaUsuarios)
        .set({
          pacoteId: input.pacoteId,
          ciclo: input.ciclo,
          valor: input.valor,
          ...(input.telefone ? { telefone: input.telefone } : {}),
          statusPagamento: cliente.statusPagamento === "ativo" ? "ativo" : "pendente",
        })
        .where(eq(tabelaUsuarios.id, cliente.id))
        .returning();
      return row;
    }),

  /** Perfil da sessão atual + flag de admin, para proteger rotas no front. */
  eu: authed.handler(async ({ context }) => {
    const [cliente] = await db
      .select()
      .from(tabelaUsuarios)
      .where(eq(tabelaUsuarios.authUserId, context.user.id));
    const [porEmail] = cliente
      ? []
      : await db
          .select()
          .from(tabelaUsuarios)
          .where(eq(tabelaUsuarios.email, context.user.email.toLowerCase()));
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
        ativos: sql<number>`coalesce(sum(case when ${tabelaUsuarios.statusPagamento} = 'ativo' then 1 else 0 end), 0)`,
        vencendo: sql<number>`coalesce(sum(case when ${tabelaUsuarios.statusPagamento} = 'pendente' then 1 else 0 end), 0)`,
        inadimplentes: sql<number>`coalesce(sum(case when ${tabelaUsuarios.statusPagamento} in ('atrasado','suspenso') then 1 else 0 end), 0)`,
        suspensos: sql<number>`coalesce(sum(case when ${tabelaUsuarios.statusPagamento} = 'suspenso' then 1 else 0 end), 0)`,
        mrr: sql<number>`coalesce(sum(case when ${tabelaUsuarios.ciclo} = 'anual' then ${tabelaUsuarios.valor} / 12.0 else ${tabelaUsuarios.valor} end), 0)`,
        emAtraso: sql<number>`coalesce(sum(case when ${tabelaUsuarios.statusPagamento} in ('atrasado','suspenso') then ${tabelaUsuarios.valor} else 0 end), 0)`,
      })
      .from(tabelaUsuarios)
      .where(eq(tabelaUsuarios.admin, false));
    return row;
  }),
};
