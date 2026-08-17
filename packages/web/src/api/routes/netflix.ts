import { z } from "zod";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { MSG_BLOQUEIO, estaBloqueado } from "../lib/cobranca";
import { db } from "../database";
import {
  alocacoes,
  codigosOtp,
  contasMatrizes,
  solicitacoesTv,
  usuarios,
} from "../database/schema";
import { meusCodigosVisiveis } from "../lib/codigos-entrega";

/**
 * CENTRAL DE DESBLOQUEIO NETFLIX.
 *
 * A Netflix bloqueia a sessao de duas formas diferentes e cada uma tem um
 * caminho proprio no painel do cliente:
 *
 *   Opcao A — "Estou viajando" / verificacao por e-mail
 *     A TV mostra "Enviamos um codigo para o e-mail da conta". O codigo cai na
 *     Central de OTP (webhook de inbound email) e aqui a gente devolve o mais
 *     recente da conta matriz DAQUELE cliente, sem nunca expor o e-mail/senha
 *     da matriz.
 *
 *   Opcao B — codigo de TV (netflix.com/tv2)
 *     A TV mostra um codigo curto. Quem precisa digitar esse codigo e quem tem
 *     o controle da conta (nos). O cliente manda o codigo pelo painel, a
 *     solicitacao entra na fila prioritaria do admin e e aprovada em 1 clique.
 *
 * Regra de ouro: nada aqui devolve senha de conta matriz.
 */

const UMA_HORA_MS = 60 * 60 * 1000;
const JANELA_FILA_MS = 24 * 60 * 60 * 1000;

/** slugs tratados como "netflix" para efeito de OTP e desbloqueio */
export const SLUGS_NETFLIX = ["netflix", "netflix-individual"];

/** o codigo da TV e curto e alfanumerico — normaliza para maiusculas sem espaco */
export function normalizarCodigoTv(bruto: string) {
  return bruto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

async function clienteDaSessaoOpcional(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  return cliente ?? null;
}

async function clienteDaSessao(authUserId: string) {
  const cliente = await clienteDaSessaoOpcional(authUserId);
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

/**
 * Estado neutro da secao: usado quando o login existe mas ainda nao ha ficha de
 * cliente (ex.: conta recem-criada ou cliente removido pelo admin). Sem isso a
 * query de polling de 10s ficava batendo 404 em loop no console.
 */
const SEM_TELA = {
  temNetflix: false as const,
  conta: null,
  codigos: [] as Array<{
    id: number;
    codigo: string;
    servico: string;
    servicoSlug: string;
    assunto: string;
    recebidoEm: Date;
    expiraEm: Date | null;
  }>,
  solicitacoes: [],
  pendente: null,
};

/** vagas ativas do cliente em contas matrizes de Netflix */
async function minhasContasNetflix(clienteId: number) {
  return db
    .select({
      contaId: contasMatrizes.id,
      rotulo: contasMatrizes.rotulo,
      email: contasMatrizes.email,
      status: contasMatrizes.status,
      servico: alocacoes.servico,
    })
    .from(alocacoes)
    .innerJoin(contasMatrizes, eq(contasMatrizes.id, alocacoes.contaId))
    .where(
      and(
        eq(alocacoes.clienteId, clienteId),
        eq(alocacoes.status, "ativo"),
        inArray(alocacoes.servico, SLUGS_NETFLIX),
      ),
    );
}

/** mascara o e-mail da matriz: "mat****01@playplusnow.com" */
function mascarar(email: string) {
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return "conta da PLAYPLUSNOW";
  const visivel = usuario.slice(0, 3);
  const fim = usuario.length > 5 ? usuario.slice(-2) : "";
  return `${visivel}${"*".repeat(Math.max(2, usuario.length - visivel.length - fim.length))}${fim}@${dominio}`;
}

export const netflix = {
  /**
   * Tudo que a secao "Desbloquear Tela Netflix" precisa em uma chamada:
   * se o cliente tem Netflix, o codigo de e-mail mais recente (Opcao A) e o
   * historico/estado das solicitacoes de TV (Opcao B).
   */
  minhaTela: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessaoOpcional(context.user.id);
    // login sem ficha de cliente: devolve estado vazio em vez de 404 em loop
    if (!cliente) return SEM_TELA;
    // inadimplente nao recebe codigo nem abre pedido de TV
    if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte)) {
      return {
        bloqueado: true as const,
        motivo: MSG_BLOQUEIO,
        temNetflix: false,
        conta: null,
        codigos: [],
        solicitacoes: [],
        pendente: null,
      };
    }
    const contas = await minhasContasNetflix(cliente.id);
    const conta = contas[0] ?? null;

    /*
     * Só entra aqui o código ENTREGUE a este cliente (ele clicou em "Pedi o
     * código agora"). Numa matriz compartilhada isso é o que impede um cliente
     * de ver o código do outro.
     */
    const visiveis = await meusCodigosVisiveis(cliente.id);
    const codigos = visiveis.filter((c) => SLUGS_NETFLIX.includes(c.servicoSlug)).slice(0, 3);

    const solicitacoes = await db
      .select()
      .from(solicitacoesTv)
      .where(
        and(
          eq(solicitacoesTv.clienteId, cliente.id),
          gt(solicitacoesTv.criadoEm, new Date(Date.now() - JANELA_FILA_MS)),
        ),
      )
      .orderBy(desc(solicitacoesTv.criadoEm))
      .limit(8);

    return {
      temNetflix: contas.length > 0,
      conta: conta
        ? {
            id: conta.contaId,
            rotulo: conta.rotulo,
            emailMascarado: mascarar(conta.email),
            emManutencao: conta.status !== "ativo",
          }
        : null,
      codigos,
      contaIds: contas.map((c) => c.contaId),
      solicitacoes,
      pendente: solicitacoes.find((s) => s.status === "pendente") ?? null,
    };
  }),

  /** Opcao B — o cliente manda o codigo que apareceu na tela da TV */
  solicitarTv: authed
    .input(
      z.object({
        codigoTv: z.string().min(4, "Digite o código que aparece na TV"),
        dispositivo: z.string().max(80).default(""),
      }),
    )
    .handler(async ({ context, input }) => {
      const cliente = await clienteDaSessao(context.user.id);
      if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte)) {
        throw new ORPCError("FORBIDDEN", { message: MSG_BLOQUEIO });
      }
      const codigo = normalizarCodigoTv(input.codigoTv);
      if (codigo.length < 4) {
        throw new ORPCError("BAD_REQUEST", {
          message: "O código da TV precisa ter pelo menos 4 caracteres",
        });
      }

      const [jaExiste] = await db
        .select({ id: solicitacoesTv.id })
        .from(solicitacoesTv)
        .where(
          and(eq(solicitacoesTv.clienteId, cliente.id), eq(solicitacoesTv.status, "pendente")),
        );
      if (jaExiste) {
        throw new ORPCError("CONFLICT", {
          message: "Você já tem um código aguardando aprovação. Cancele o anterior para enviar outro.",
        });
      }

      const contas = await minhasContasNetflix(cliente.id);

      const [row] = await db
        .insert(solicitacoesTv)
        .values({
          clienteId: cliente.id,
          contaId: contas[0]?.contaId ?? null,
          servicoSlug: contas[0]?.servico ?? "netflix",
          codigoTv: codigo,
          dispositivo: input.dispositivo.trim(),
          status: "pendente",
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        })
        .returning();

      // GATILHO DE PRIORIDADE: pedido de TV avisa o admin na hora.
      await notificar({
        escopo: "admin",
        clienteId: cliente.id,
        tipo: "tv",
        severidade: "critico",
        titulo: `${cliente.nome} pediu liberação de TV Netflix`,
        mensagem: `Código ${codigo}${input.dispositivo ? ` · ${input.dispositivo.trim()}` : ""} — aprove em 1 clique.`,
        destino: "netflixtv",
        chave: `tv:${row?.id ?? Date.now()}`,
      });

      return row;
    }),

  /** o cliente desiste (digitou errado, a TV liberou sozinha, etc.) */
  cancelarTv: authed
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const cliente = await clienteDaSessao(context.user.id);
      const [row] = await db
        .update(solicitacoesTv)
        .set({ status: "cancelado", atualizadoEm: new Date(), resolvidoEm: new Date() })
        .where(
          and(
            eq(solicitacoesTv.id, input.id),
            eq(solicitacoesTv.clienteId, cliente.id),
            eq(solicitacoesTv.status, "pendente"),
          ),
        )
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Solicitação não encontrada" });
      return row;
    }),

  /* ---------------------------------------------------------------- */
  /* ADMIN                                                             */
  /* ---------------------------------------------------------------- */

  /** fila do admin — pendentes primeiro, resolvidas das ultimas 24h abaixo */
  fila: adminOnly.handler(async () => {
    const rows = await db
      .select({
        id: solicitacoesTv.id,
        codigoTv: solicitacoesTv.codigoTv,
        dispositivo: solicitacoesTv.dispositivo,
        status: solicitacoesTv.status,
        respostaAdmin: solicitacoesTv.respostaAdmin,
        servicoSlug: solicitacoesTv.servicoSlug,
        criadoEm: solicitacoesTv.criadoEm,
        resolvidoEm: solicitacoesTv.resolvidoEm,
        clienteId: solicitacoesTv.clienteId,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        contaId: solicitacoesTv.contaId,
        contaRotulo: contasMatrizes.rotulo,
        contaEmail: contasMatrizes.email,
      })
      .from(solicitacoesTv)
      .leftJoin(usuarios, eq(usuarios.id, solicitacoesTv.clienteId))
      .leftJoin(contasMatrizes, eq(contasMatrizes.id, solicitacoesTv.contaId))
      .where(gt(solicitacoesTv.criadoEm, new Date(Date.now() - JANELA_FILA_MS)))
      .orderBy(desc(solicitacoesTv.criadoEm));

    const peso = (s: string) => (s === "pendente" ? 0 : 1);
    const ordenadas = [...rows].sort((a, b) => peso(a.status) - peso(b.status));

    return {
      itens: ordenadas,
      pendentes: rows.filter((r) => r.status === "pendente").length,
      aprovadasHoje: rows.filter((r) => r.status === "aprovado").length,
    };
  }),

  /** aprovacao/recusa em 1 clique */
  responderTv: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["aprovado", "recusado"]),
        resposta: z.string().max(300).default(""),
      }),
    )
    .handler(async ({ input }) => {
      const padrao =
        input.status === "aprovado"
          ? "Código autorizado na conta. Volte para a TV, ela libera em alguns segundos."
          : "Não conseguimos autorizar este código. Gere um novo na TV e envie de novo.";

      const [row] = await db
        .update(solicitacoesTv)
        .set({
          status: input.status,
          respostaAdmin: input.resposta.trim() || padrao,
          atualizadoEm: new Date(),
          resolvidoEm: new Date(),
        })
        .where(eq(solicitacoesTv.id, input.id))
        .returning();

      if (!row) throw new ORPCError("NOT_FOUND", { message: "Solicitação não encontrada" });

      await notificar({
        escopo: "cliente",
        clienteId: row.clienteId,
        tipo: "tv",
        severidade: input.status === "aprovado" ? "info" : "alerta",
        titulo:
          input.status === "aprovado"
            ? "TV liberada! Volte para a tela da Netflix"
            : "Código da TV não autorizado",
        mensagem: row.respostaAdmin,
        destino: "netflix",
        chave: `tv-resp:${row.id}:${input.status}`,
      });

      return row;
    }),
};
