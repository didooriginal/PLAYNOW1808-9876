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
  HORAS_CONFIANCA,
  MSG_BLOQUEIO,
  STATUS_CLIENTE,
  confiancaAtiva,
  detalheConfianca,
  estaBloqueado,
  situacaoCobranca,
  statusEsperado,
} from "../lib/cobranca";
import { direitosDoCliente, entrarNaFila, sincronizarAcessosDoCliente } from "../lib/acessos";
import { garantirFichaDaSessao } from "../lib/sessao";
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
  nivel: z.number().int().min(1).max(3).optional(),
  aparelhos: z.string().optional(),
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
      nivel: tabelaUsuarios.nivel,
      aparelhos: tabelaUsuarios.aparelhos,
      confiancaAte: tabelaUsuarios.confiancaAte,
      confiancaMotivo: tabelaUsuarios.confiancaMotivo,
      confiancaTotal: tabelaUsuarios.confiancaTotal,
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
    const linhas = await listarComPacote();
    /* o crédito de confiança viaja resolvido, então a UI não recalcula prazo */
    return linhas.map((c) => ({ ...c, confianca: detalheConfianca(c) }));
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

  /**
   * CRÉDITO DE CONFIANÇA — libera o cliente inadimplente por um prazo (48h por
   * padrão) como se ele estivesse em dia: logins, senhas, códigos, suporte e
   * jornada voltam na hora. Só o admin concede. Quando o prazo vence, o bloqueio
   * volta sozinho — nenhuma rotina precisa limpar o campo.
   *
   * Concedido de novo enquanto ainda vale: o prazo é ESTENDIDO a partir de agora
   * (não soma em cima do antigo), então "48h" sempre significa 48h reais.
   */
  concederConfianca: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        horas: z.number().int().min(1).max(720).default(HORAS_CONFIANCA),
        motivo: z.string().max(280).default(""),
      }),
    )
    .handler(async ({ input }) => {
      const [cliente] = await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.id, input.id));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const agora = new Date();
      const ate = new Date(agora.getTime() + input.horas * 3_600_000);
      /** renovar um crédito ainda ativo não conta como uma nova concessão */
      const renovando = confiancaAtiva(cliente.confiancaAte);

      const [row] = await db
        .update(tabelaUsuarios)
        .set({
          confiancaAte: ate,
          confiancaMotivo: input.motivo,
          confiancaConcedidaEm: agora,
          confiancaTotal: renovando ? cliente.confiancaTotal : cliente.confiancaTotal + 1,
        })
        .where(eq(tabelaUsuarios.id, input.id))
        .returning();

      await notificar({
        escopo: "cliente",
        clienteId: cliente.id,
        tipo: "pagamento",
        severidade: "info",
        titulo: `Liberamos seu acesso por ${input.horas}h`,
        mensagem:
          "Confiamos em você: seu acesso está normal enquanto o pagamento não cai. Regularize dentro do prazo para não bloquear de novo.",
        destino: "pagamento",
        chave: `confianca:${cliente.id}:${ate.getTime()}`,
      });

      return { ok: true, confianca: detalheConfianca(row ?? cliente) };
    }),

  /** Encerra o crédito de confiança agora — o bloqueio volta imediatamente. */
  revogarConfianca: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const [row] = await db
        .update(tabelaUsuarios)
        .set({ confiancaAte: null, confiancaMotivo: "" })
        .where(eq(tabelaUsuarios.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
      return { ok: true, confianca: detalheConfianca(row) };
    }),

  remover: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input, context }) => {
      const [alvo] = await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.id, input.id));
      if (!alvo) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
      // trava de segurança: a ficha de um administrador nunca pode ser apagada
      // pelo painel (foi assim que o acesso ao /admin já se perdeu uma vez).
      if (alvo.admin) {
        throw new ORPCError("FORBIDDEN", {
          message: "Fichas de administrador não podem ser excluídas pelo painel",
        });
      }
      if (alvo.authUserId && alvo.authUserId === context.user.id) {
        throw new ORPCError("FORBIDDEN", {
          message: "Você não pode excluir a sua própria ficha",
        });
      }
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

      /**
       * TUDO a que o cliente tem direito: os apps do pacote MAIS os avulsos,
       * combos e prêmios de `assinaturas_apps`. Antes só o pacote entrava e o
       * app avulso comprado no montador nunca aparecia no painel.
       */
      const servicos = await direitosDoCliente(cliente.id);

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
      const bloqueado = estaBloqueado(cliente.statusPagamento, cliente.confiancaAte);

      for (const servico of servicos) {
        const { alocacao } = await garantirAlocacao(cliente.id, servico);
        if (!alocacao) {
          // sem estoque: registra a espera para o admin ver e ser cobrado
          await entrarNaFila(cliente.id, servico, "compra");
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
        /** apenas referência do front — o servidor recalcula pelo pacote */
        valor: z.number().nonnegative().default(0),
        telefone: z.string().optional(),
        aparelhos: z.string().optional(),
        senha: z.string().optional(),
        confirmarSenha: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [cliente] = await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.authUserId, context.user.id));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      // confere a confirmação de senha também no servidor
      if (input.senha && input.confirmarSenha && input.senha !== input.confirmarSenha) {
        throw new ORPCError("BAD_REQUEST", { message: "As senhas informadas não coincidem." });
      }

      /**
       * PREÇO SEMPRE DO SERVIDOR. O valor que chega do front é ignorado quando
       * existe pacote — senão bastava editar o payload para pagar R$ 1.
       */
      let valorFinal = input.valor;
      if (input.pacoteId) {
        const [pacoteOficial] = await db
          .select({ preco: pacotes.preco, precoAnual: pacotes.precoAnual })
          .from(pacotes)
          .where(eq(pacotes.id, input.pacoteId));
        if (!pacoteOficial) {
          throw new ORPCError("NOT_FOUND", { message: "Pacote não encontrado" });
        }
        valorFinal =
          input.ciclo === "anual"
            ? (pacoteOficial.precoAnual ?? pacoteOficial.preco)
            : pacoteOficial.preco;
      }

      const [row] = await db
        .update(tabelaUsuarios)
        .set({
          pacoteId: input.pacoteId,
          ciclo: input.ciclo,
          valor: valorFinal,
          ...(input.telefone ? { telefone: input.telefone } : {}),
          ...(input.aparelhos ? { aparelhos: input.aparelhos } : {}),
          statusPagamento: cliente.statusPagamento === "ativo" ? "ativo" : "pendente",
        })
        .where(eq(tabelaUsuarios.id, cliente.id))
        .returning();

      /**
       * Escolher o pacote passou a ALOCAR as vagas na hora. Antes o cadastro
       * gravava o pacote e ninguém criava a alocação: o cliente entrava no
       * painel e via "aguardando" mesmo com conta matriz sobrando.
       */
      const acessos = await sincronizarAcessosDoCliente(cliente.id, "compra");
      return { ...row, acessos };
    }),

  /** Perfil da sessão atual + flag de admin, para proteger rotas no front. */
  eu: authed.handler(async ({ context }) => {
    // lookup centralizado em api/lib/sessao.ts — o mesmo que o `adminOnly` usa
    const registro = await garantirFichaDaSessao(context.user);
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
