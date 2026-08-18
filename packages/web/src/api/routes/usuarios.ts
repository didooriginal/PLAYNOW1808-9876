import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import {
  assinaturasApps,
  contasMatrizes,
  convitesApps,
  historicoVencimento,
  pacotes,
  usuarios as tabelaUsuarios,
} from "../database/schema";
import { resolverServicos, slugsDePacote, type ServicoResolvido } from "../lib/planos";
import {
  CICLOS,
  mesesDoCiclo,
  normalizarCiclo,
  paraIso,
  precificarCiclo,
  somarMeses,
} from "../lib/ciclos";
import { garantirAlocacao } from "./alocacoes";
import { extrasEmAberto, recalcularValorCliente } from "../lib/cobranca-apps";
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
import {
  direitosDoCliente,
  encerrarAssinaturaApp,
  entrarNaFila,
  liberarAlocacoesDoServico,
  registrarAssinaturaApp,
  sairDaFila,
  sincronizarAcessosDoCliente,
} from "../lib/acessos";
import { garantirFichaDaSessao } from "../lib/sessao";
import { SLUGS_IPTV } from "../lib/iptv";
import { notificar, varrerVencimentos } from "./notificacoes";
import { auth } from "../auth";

/**
 * Senha provisoria legivel: sem 0/O/1/l/I para o ADM conseguir ditar por
 * telefone sem confusao. 10 caracteres, com letra maiuscula, minuscula,
 * numero e simbolo para passar em qualquer politica de senha.
 */
function gerarSenhaProvisoria() {
  const maiusculas = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minusculas = "abcdefghijkmnpqrstuvwxyz";
  const numeros = "23456789";
  const simbolos = "@#$%&*";
  const todos = maiusculas + minusculas + numeros + simbolos;
  const sorteia = (fonte: string) => fonte[Math.floor(Math.random() * fonte.length)];
  const base = [sorteia(maiusculas), sorteia(minusculas), sorteia(numeros), sorteia(simbolos)];
  while (base.length < 10) base.push(sorteia(todos));
  return base.sort(() => Math.random() - 0.5).join("");
}

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
  nivel: z.number().int().min(1).max(7).optional(),
  aparelhos: z.string().optional(),
  endereco: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
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
      endereco: tabelaUsuarios.endereco,
      cidade: tabelaUsuarios.cidade,
      estado: tabelaUsuarios.estado,
      cep: tabelaUsuarios.cep,
      avatarUrl: tabelaUsuarios.avatarUrl,
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

  /**
   * Cria o cliente E a conta de login (Better Auth) numa tacada so.
   * A senha provisoria e gerada aqui, devolvida UMA UNICA VEZ para o ADM
   * repassar e nunca fica gravada em claro. O cliente cai na troca
   * obrigatoria no primeiro acesso (`precisaTrocarSenha`).
   */
  criar: adminOnly.input(usuarioInput).handler(async ({ input }) => {
    const email = input.email.trim().toLowerCase();
    const [jaExiste] = await db
      .select({ id: tabelaUsuarios.id })
      .from(tabelaUsuarios)
      .where(eq(tabelaUsuarios.email, email));
    if (jaExiste) {
      throw new ORPCError("CONFLICT", {
        message: `Já existe um cliente cadastrado com o e-mail ${email}.`,
      });
    }

    const senhaProvisoria = gerarSenhaProvisoria();
    let loginCriado = true;
    let avisoLogin = "";

    // O hook `user.create.after` (api/auth.ts) vincula a ficha pelo e-mail —
    // por isso a ficha entra primeiro e o Better Auth so amarra o authUserId.
    const [row] = await db
      .insert(tabelaUsuarios)
      // `clienteDesde` alimenta ordenação e comparação em SQL: sempre ISO.
      .values({
        ...input,
        email,
        clienteDesde: paraIso(input.clienteDesde) || input.clienteDesde,
        precisaTrocarSenha: true,
      })
      .returning();

    try {
      await auth.api.signUpEmail({
        body: { email, password: senhaProvisoria, name: input.nome },
      });
    } catch (erro) {
      loginCriado = false;
      avisoLogin =
        erro instanceof Error && erro.message
          ? erro.message
          : "Não foi possível criar o login automaticamente.";
      // ficha criada mesmo assim: o cliente ainda pode se cadastrar com o
      // mesmo e-mail que o hook vincula tudo.
      await db
        .update(tabelaUsuarios)
        .set({ precisaTrocarSenha: false })
        .where(eq(tabelaUsuarios.id, row.id));
    }

    return {
      ...row,
      /** aparece uma unica vez na tela do ADM — nao e gravada em claro */
      senhaProvisoria: loginCriado ? senhaProvisoria : "",
      loginCriado,
      avisoLogin,
    };
  }),

  /**
   * Perfil do proprio cliente. So dados de contato — nada de valor, pacote,
   * vencimento ou e-mail (isso continua sendo do ADM).
   */
  atualizarMeuPerfil: authed
    .input(
      z.object({
        telefone: z.string().max(30).nullable().optional(),
        endereco: z.string().max(180).nullable().optional(),
        cidade: z.string().max(80).nullable().optional(),
        estado: z.string().max(40).nullable().optional(),
        cep: z.string().max(12).nullable().optional(),
        avatarUrl: z.string().url().nullable().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const ficha = await garantirFichaDaSessao(context.user);
      if (!ficha) throw new ORPCError("NOT_FOUND", { message: "Ficha do cliente não encontrada." });

      const patch = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ) as Partial<typeof input>;
      if (Object.keys(patch).length === 0) return ficha;

      const [row] = await db
        .update(tabelaUsuarios)
        .set(patch)
        .where(eq(tabelaUsuarios.id, ficha.id))
        .returning();
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

      // `clienteDesde` é comparado/ordenado em SQL: normaliza dd/mm/aaaa para ISO.
      if (patch.clienteDesde) patch.clienteDesde = paraIso(patch.clienteDesde) || patch.clienteDesde;

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

      /* TRAVA DA MENSALIDADE: o valor normalmente é derivado
         (`valorBase` + apps avulsos). Quando o admin digita o valor na mão,
         a trava liga e o recálculo automático para de mexer no número dele
         até alguém clicar em "voltar ao automático". */
      if (patch.valor !== undefined) {
        const [atual] = await db
          .select({ valor: tabelaUsuarios.valor })
          .from(tabelaUsuarios)
          .where(eq(tabelaUsuarios.id, id));
        if (atual && patch.valor !== atual.valor) {
          (patch as Record<string, unknown>).valorManual = true;
        }
      }

      const [row] = await db.update(tabelaUsuarios).set(patch).where(eq(tabelaUsuarios.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
      return row;
    }),

  /**
   * Desliga a trava manual e devolve a mensalidade para o cálculo automático
   * (`valorBase` + apps avulsos ativos).
   */
  valorAutomatico: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db
        .update(tabelaUsuarios)
        .set({ valorManual: false })
        .where(eq(tabelaUsuarios.id, input.id));

      const detalhe = await recalcularValorCliente(input.id);
      if (!detalhe) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
      return detalhe;
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
        /** nome completo já resolvido ("Netflix · Individual") */
        nome: string;
        /** slug do app pai — ícone, cor e guia continuam vindo dele */
        appSlug: string;
        /** como o acesso chega: login e senha (vaga) ou convite do provedor */
        entrega: "vaga" | "convite";
        /** só para `entrega = "convite"`: andamento do pedido */
        convite: { status: string; email: string; observacao: string } | null;
      }[];

      // BLOQUEIO POR INADIMPLENCIA: cliente atrasado/suspenso nao ve senha
      // nem e-mail das contas matrizes — so a tela de regularizacao.
      const bloqueado = estaBloqueado(cliente.statusPagamento, cliente.confiancaAte);

      /**
       * Resolve app x opção de uma vez: precisamos saber quais serviços são
       * entregues por CONVITE (ex.: Netflix individual = membro extra), porque
       * esses não consomem vaga nem entram na fila de estoque.
       */
      const infos = await resolverServicos(servicos).catch(() => [] as ServicoResolvido[]);
      const infoPorSlug = new Map(infos.map((i) => [i.slug, i]));
      const meusConvites = await db
        .select()
        .from(convitesApps)
        .where(eq(convitesApps.clienteId, cliente.id));

      for (const servico of servicos) {
        const info = infoPorSlug.get(servico) ?? null;
        const nomeServico = info?.nome ?? servico;

        // ENTREGA POR CONVITE: o acesso é o e-mail do próprio cliente, cadastrado
        // pelo admin no painel do provedor. Não há conta matriz para mostrar.
        if (info?.entrega === "convite") {
          const convite =
            meusConvites.find((c) => c.servico === servico && c.status !== "recusado") ??
            meusConvites.find((c) => c.servico === servico) ??
            null;
          acessos.push({
            servico,
            contaId: convite?.contaId ?? null,
            email: convite?.email ?? "",
            senha: "",
            status: convite?.status ?? "sem-email",
            regiao: "BR",
            aguardando: convite?.status !== "ativo",
            nome: nomeServico,
            appSlug: info.appSlug,
            entrega: "convite",
            convite: {
              status: convite?.status ?? "sem-email",
              email: convite?.email ?? "",
              observacao: convite?.observacao ?? "",
            },
          });
          continue;
        }

        /**
         * IPTV (app Fun Play): nao existe conta matriz nem vaga para alocar —
         * o acesso e liberado pelo ENDERECO MAC do aparelho (routes/iptv.ts).
         * Por isso ele nunca fica "aguardando estoque" nem entra na fila: o
         * card do painel mostra o passo a passo e o campo do MAC.
         */
        if (SLUGS_IPTV.includes(servico)) {
          acessos.push({
            servico,
            contaId: null,
            email: "",
            senha: "",
            status: "ativo",
            regiao: "BR",
            aguardando: false,
            nome: nomeServico,
            appSlug: info?.appSlug ?? servico,
            entrega: "vaga",
            convite: null,
          });
          continue;
        }

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
            nome: nomeServico,
            appSlug: info?.appSlug ?? servico,
            entrega: "vaga",
            convite: null,
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
          nome: nomeServico,
          appSlug: info?.appSlug ?? servico,
          entrega: "vaga",
          convite: null,
        });
      }

      /**
       * APPS PRESOS NO PAGAMENTO — o admin adicionou como "liberar após o
       * pagamento". Eles não entram em `direitosDoCliente` (direito preso não
       * ocupa vaga), então o cliente precisa vê-los aqui, com o valor, para
       * saber exatamente o que pagar para destravar o acesso.
       */
      const presos = await db
        .select()
        .from(assinaturasApps)
        .where(
          and(
            eq(assinaturasApps.clienteId, cliente.id),
            eq(assinaturasApps.status, "aguardando_pagamento"),
          ),
        );
      const infosPresos = presos.length
        ? await resolverServicos(presos.map((p) => p.servico)).catch(
            () => [] as ServicoResolvido[],
          )
        : [];
      const abertos = presos.length ? await extrasEmAberto(cliente.id) : [];
      const aguardandoPagamento = presos.map((p) => {
        const info = infosPresos.find((i) => i.slug === p.servico) ?? null;
        const extra = abertos.find((c) => c.servico === p.servico) ?? null;
        return {
          servico: p.servico,
          nome: info?.nome ?? p.servico,
          appSlug: info?.appSlug ?? p.servico,
          /** mensalidade do app */
          valor: p.valor,
          /** o que está pendurado na fatura em aberto por causa dele */
          aPagar: extra?.valor ?? 0,
        };
      });

      return {
        cliente,
        pacote: pacote ?? null,
        acessos,
        /** apps contratados que só liberam quando a fatura for paga */
        aguardandoPagamento,
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


  /**
   * DEFINIR PACOTE (admin).
   *
   * Caminho manual para dizer "esse cliente e do pacote X" e ja deixar tudo
   * pronto: grava pacote/ciclo, recalcula o preco NO SERVIDOR (o admin so pode
   * sobrescrever com `valorManual` explicito), encerra o que sobrou do pacote
   * anterior, registra um direito por app (com a variacao padrao de cada um) e
   * chama a sincronizacao de acessos. Devolve o que foi alocado e o que caiu
   * na fila por falta de vaga.
   */
  definirPacote: adminOnly
    .input(
      z.object({
        clienteId: z.number().int(),
        pacoteId: z.number().int(),
        ciclo: z.enum(CICLOS).default("mensal"),
        /** sobrescreve a mensalidade calculada (negociacao pontual) */
        valorManual: z.number().nonnegative().nullable().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const [cliente] = await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.id, input.clienteId));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente nao encontrado." });

      const [pacote] = await db.select().from(pacotes).where(eq(pacotes.id, input.pacoteId));
      if (!pacote) throw new ORPCError("NOT_FOUND", { message: "Pacote nao encontrado." });

      const ciclo = normalizarCiclo(input.ciclo);
      const preco = precificarCiclo(
        pacote.preco,
        ciclo,
        ciclo === "anual" ? pacote.precoAnual : null,
      );
      // mensalidade equivalente: e sempre isso que fica em `valorBase`
      const mensalidade =
        input.valorManual != null && input.valorManual > 0
          ? Math.round(input.valorManual * 100) / 100
          : preco.mensal;

      // variacao padrao de cada app do pacote (pacote e fechado: cliente nao escolhe)
      const servicos = await slugsDePacote(pacote.servicos ?? []);

      /**
       * Limpa o pacote anterior: tudo que veio de pacote e nao esta na lista
       * nova perde o direito, a vaga e o lugar na fila. Avulsos e premios
       * (outras origens) nao sao tocados.
       */
      const anteriores = await db
        .select({ servico: assinaturasApps.servico })
        .from(assinaturasApps)
        .where(
          and(
            eq(assinaturasApps.clienteId, cliente.id),
            eq(assinaturasApps.origem, "pacote"),
            eq(assinaturasApps.status, "ativo"),
          ),
        );
      const encerrados: string[] = [];
      for (const { servico } of anteriores) {
        if (servicos.includes(servico)) continue;
        await encerrarAssinaturaApp(cliente.id, servico, "cancelado");
        await liberarAlocacoesDoServico(cliente.id, servico, 0);
        await sairDaFila(cliente.id, servico);
        encerrados.push(servico);
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const venceEm = somarMeses(cliente.proximaCobranca || hoje, mesesDoCiclo(ciclo));

      await db
        .update(tabelaUsuarios)
        .set({
          pacoteId: pacote.id,
          ciclo,
          valorBase: mensalidade,
          valor: mensalidade,
          clienteDesde: cliente.clienteDesde || hoje,
          proximaCobranca: cliente.proximaCobranca || venceEm,
        })
        .where(eq(tabelaUsuarios.id, cliente.id));

      // direito por app; o valor fica zerado porque quem cobra e o pacote
      for (const servico of servicos) {
        await registrarAssinaturaApp({
          clienteId: cliente.id,
          servico,
          origem: "pacote",
          ciclo,
          valor: 0,
          proximaCobranca: cliente.proximaCobranca || venceEm,
        });
      }

      // `valor` e derivado: pacote + avulsos ativos convertidos ao ciclo
      await recalcularValorCliente(cliente.id);

      const acessos = await sincronizarAcessosDoCliente(cliente.id, "troca_de_pacote");

      const [atualizado] = await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.id, cliente.id));

      return {
        cliente: atualizado ?? cliente,
        pacote: { id: pacote.id, nome: pacote.nome },
        ciclo,
        mensalidade,
        totalDoCiclo: preco.total,
        meses: preco.meses,
        servicos,
        encerrados,
        alocados: acessos.alocados.map((a) => a.servico),
        jaTinham: acessos.jaTinham,
        semVaga: acessos.semVaga,
        convites: acessos.convites,
      };
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
