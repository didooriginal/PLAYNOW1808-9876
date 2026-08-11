import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import { cobrancasPix, faturas, pacotes, usuarios } from "../database/schema";
import { abrirCobranca } from "./pix";
import {
  ANTECIPACAO,
  CICLOS,
  DEFINICOES,
  type Ciclo,
  normalizarCiclo,
  precificarAntecipacao,
  precificarCiclo,
  somarMeses,
} from "../lib/ciclos";

/**
 * RENOVAÇÃO E ANTECIPAÇÃO — área de pagamento do cliente.
 *
 * Três coisas o cliente pode fazer aqui, todas via Pix:
 *  1. renovar escolhendo a periodicidade (mensal/trimestral/semestral/anual);
 *  2. antecipar a fatura do mês vigente que está aberta → 5% off;
 *  3. adiantar o próximo mês, que nem foi faturado → 10% off.
 *
 * Os descontos de antecipação só existem no Pix: no cartão a cobrança é
 * recorrente pelo Mercado Pago e antecipar não gera ganho de caixa.
 *
 * Regra de ouro: quem manda no valor é o servidor. O front só diz QUAL opção o
 * cliente escolheu; nunca envia preço.
 */

const cent = (v: number) => Math.round(v * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const competenciaDe = (data: string) => data.slice(0, 7);

async function clienteDaSessao(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

/** mensalidade de referência: o que o cliente paga hoje, ou o preço do pacote */
async function mensalidadeBase(cliente: { valor: number; pacoteId: number | null }) {
  if (cliente.valor > 0) return cent(cliente.valor);
  if (cliente.pacoteId) {
    const [pacote] = await db.select().from(pacotes).where(eq(pacotes.id, cliente.pacoteId));
    if (pacote) return cent(pacote.preco);
  }
  return 0;
}

/** fatura em aberto da competência atual, se existir */
async function faturaAberta(clienteId: number) {
  const competencia = competenciaDe(iso(new Date()));
  const [fatura] = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.clienteId, clienteId), eq(faturas.competencia, competencia)));
  return fatura && fatura.status !== "pago" ? fatura : null;
}

export const renovacao = {
  /**
   * Vitrine de opções da área de pagamento: as 4 periodicidades já
   * precificadas + os dois cartões de antecipação quando fazem sentido.
   */
  opcoes: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    const mensal = await mensalidadeBase(cliente);
    const aberta = await faturaAberta(cliente.id);

    const ciclos = CICLOS.map((ciclo) => {
      const preco = precificarCiclo(mensal, ciclo);
      return {
        ciclo,
        rotulo: DEFINICOES[ciclo].rotulo,
        chamada: DEFINICOES[ciclo].chamada,
        meses: preco.meses,
        mensal: preco.mensal,
        total: preco.total,
        economia: preco.economia,
        periodo: preco.periodo,
        atual: cliente.ciclo === ciclo,
      };
    });

    // antecipar o mês vigente só existe se houver fatura aberta
    const vigente = aberta
      ? {
          ...precificarAntecipacao(aberta.valorFinal || aberta.valor, "vigente"),
          chamada: ANTECIPACAO.vigente.chamada,
          competencia: aberta.competencia,
          vencimento: aberta.vencimento,
          faturaId: aberta.id,
        }
      : null;

    // adiantar o próximo mês está sempre disponível para quem tem mensalidade
    const proximo =
      mensal > 0
        ? {
            ...precificarAntecipacao(mensal, "proximo"),
            chamada: ANTECIPACAO.proximo.chamada,
            competencia: competenciaDe(somarMeses(iso(new Date()), 1)),
            novoVencimento: somarMeses(cliente.proximaCobranca || iso(new Date()), 1),
          }
        : null;

    return {
      mensalidade: mensal,
      cicloAtual: normalizarCiclo(cliente.ciclo),
      proximaCobranca: cliente.proximaCobranca,
      ciclos,
      antecipacao: { vigente, proximo },
    };
  }),

  /**
   * Gera o Pix da renovação no ciclo escolhido.
   * O ciclo só é gravado no cadastro quando o pagamento é confirmado — quem
   * faz isso é `aplicarPedido`, então uma renovação abandonada não muda nada.
   */
  renovar: authed
    .input(z.object({ ciclo: z.enum(CICLOS) }))
    .handler(async ({ input, context }) => {
      const cliente = await clienteDaSessao(context.user.id);
      const mensal = await mensalidadeBase(cliente);
      if (mensal <= 0)
        throw new ORPCError("BAD_REQUEST", {
          message: "Você ainda não tem um plano ativo para renovar. Escolha um pacote primeiro.",
        });

      const ciclo: Ciclo = input.ciclo;
      const preco = precificarCiclo(mensal, ciclo);
      const titulo = `Renovação ${DEFINICOES[ciclo].rotulo.toLowerCase()} — PLAYPLUSNOW`;

      const cobranca = await abrirCobranca({
        clienteId: cliente.id,
        valor: preco.total,
        descricao: titulo,
        pedido: {
          tipo: "assinatura",
          titulo,
          pacoteId: cliente.pacoteId,
          comboId: null,
          apps: [],
          ciclo,
          valor: preco.total,
        },
      });

      return { cobranca, preco };
    }),

  /**
   * Gera o Pix com desconto de antecipação.
   *
   * `vigente`: quita a fatura aberta do mês com 5% off.
   * `proximo`: paga adiantado o mês seguinte com 10% off e empurra
   *  `proximaCobranca` em 1 mês quando o pagamento cair.
   *
   * Trava de idempotência: se já existe cobrança viva de antecipação para a
   * mesma competência, devolve a mesma em vez de criar uma segunda — evita o
   * cliente pagar duas vezes o mesmo mês.
   */
  antecipar: authed
    .input(z.object({ tipo: z.enum(["vigente", "proximo"]) }))
    .handler(async ({ input, context }) => {
      const cliente = await clienteDaSessao(context.user.id);

      if (input.tipo === "vigente") {
        const aberta = await faturaAberta(cliente.id);
        if (!aberta)
          throw new ORPCError("BAD_REQUEST", {
            message: "Você não tem fatura aberta neste mês — nada a antecipar.",
          });

        const preco = precificarAntecipacao(aberta.valorFinal || aberta.valor, "vigente");
        const titulo = `Antecipação da fatura ${aberta.competencia} (${Math.round(
          preco.percentual * 100,
        )}% off no Pix)`;

        const viva = await antecipacaoViva(cliente.id, titulo);
        if (viva) return { cobranca: viva, preco, reaproveitada: true };

        const cobranca = await abrirCobranca({
          clienteId: cliente.id,
          valor: preco.total,
          descricao: titulo,
          faturaId: aberta.id,
        });
        return { cobranca, preco, reaproveitada: false };
      }

      const mensal = await mensalidadeBase(cliente);
      if (mensal <= 0)
        throw new ORPCError("BAD_REQUEST", {
          message: "Você ainda não tem uma mensalidade definida para adiantar.",
        });

      const competencia = competenciaDe(somarMeses(iso(new Date()), 1));
      const preco = precificarAntecipacao(mensal, "proximo");
      const titulo = `Adiantamento da mensalidade ${competencia} (${Math.round(
        preco.percentual * 100,
      )}% off no Pix)`;

      const viva = await antecipacaoViva(cliente.id, titulo);
      if (viva) return { cobranca: viva, preco, reaproveitada: true };

      // já pago? não deixa pagar o mesmo mês duas vezes
      const [jaPaga] = await db
        .select()
        .from(faturas)
        .where(and(eq(faturas.clienteId, cliente.id), eq(faturas.competencia, competencia)));
      if (jaPaga?.status === "pago")
        throw new ORPCError("CONFLICT", {
          message: `A mensalidade de ${competencia} já está paga. Nada a adiantar.`,
        });

      const cobranca = await abrirCobranca({
        clienteId: cliente.id,
        valor: preco.total,
        descricao: titulo,
        pedido: {
          tipo: "assinatura",
          titulo,
          pacoteId: cliente.pacoteId,
          comboId: null,
          apps: [],
          ciclo: normalizarCiclo(cliente.ciclo),
          valor: preco.total,
        },
      });
      return { cobranca, preco, reaproveitada: false };
    }),
};

/** cobrança de antecipação ainda válida para o mesmo título */
async function antecipacaoViva(clienteId: number, titulo: string) {
  const linhas = await db
    .select()
    .from(cobrancasPix)
    .where(
      and(
        eq(cobrancasPix.clienteId, clienteId),
        eq(cobrancasPix.descricao, titulo),
        eq(cobrancasPix.status, "aguardando"),
      ),
    );
  const agora = Date.now();
  return linhas.find((c) => !c.expiraEm || c.expiraEm.getTime() > agora) ?? null;
}
