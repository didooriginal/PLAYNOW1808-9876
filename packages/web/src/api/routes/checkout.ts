import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed, withUser } from "../middleware/auth";
import { db } from "../database";
import { cobrancasPix, usuarios } from "../database/schema";
import { abrirCobranca } from "./pix";
import {
  cobrancaViva,
  enxugar,
  faturaDoPedido,
  precificarPedido,
  type EntradaPedido,
} from "../lib/pedidos";

/**
 * CHECKOUT NA PLATAFORMA
 * ------------------------------------------------------------------
 * Substitui o "fechar no WhatsApp". O cliente escolhe o plano/combo, o
 * servidor precifica, gera o Pix e — quando o pagamento cai — ativa o pacote
 * sozinho (ver `aplicarPedido` em lib/pedidos.ts). Ninguém precisa mandar
 * print nem esperar atendimento.
 */

const entrada = z.object({
  pacoteId: z.number().int().nullable().optional(),
  comboId: z.number().int().nullable().optional(),
  apps: z.array(z.string()).optional(),
  ciclo: z.enum(["mensal", "anual"]).optional(),
  jogos: z.boolean().optional(),
});

function comoEntrada(input: z.infer<typeof entrada>): EntradaPedido {
  return {
    pacoteId: input.pacoteId ?? null,
    comboId: input.comboId ?? null,
    apps: input.apps ?? [],
    ciclo: input.ciclo ?? "mensal",
    jogos: input.jogos ?? false,
  };
}

async function clienteDaSessao(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

export const checkout = {
  /** resumo com preço fechado — visível também para quem ainda não tem conta */
  resumo: withUser.input(entrada).handler(async ({ input }) => {
    try {
      return await precificarPedido(comoEntrada(input));
    } catch (e) {
      throw new ORPCError("BAD_REQUEST", { message: (e as Error).message });
    }
  }),

  /** gera (ou reaproveita) a cobrança Pix do pedido */
  pagar: authed.input(entrada).handler(async ({ context, input }) => {
    const cliente = await clienteDaSessao(context.user.id);

    let pedido;
    try {
      pedido = await precificarPedido(comoEntrada(input));
    } catch (e) {
      throw new ORPCError("BAD_REQUEST", { message: (e as Error).message });
    }
    if (pedido.valor <= 0) throw new ORPCError("BAD_REQUEST", { message: "Nada a cobrar" });

    const viva = await cobrancaViva(cliente.id, pedido.titulo);
    if (viva && viva.expiraEm) {
      return {
        txid: viva.txid,
        valor: viva.valor,
        descricao: viva.descricao,
        copiaECola: viva.copiaECola,
        provedor: viva.provedor,
        expiraEm: viva.expiraEm.toISOString(),
        status: viva.status,
        pedido,
      };
    }

    const compacto = enxugar(pedido);
    // adicional avulso nao entra no ciclo de faturas da mensalidade
    const fatura = compacto.tipo === "assinatura" ? await faturaDoPedido(cliente.id, compacto) : null;

    const cobranca = await abrirCobranca({
      clienteId: cliente.id,
      valor: pedido.valor,
      descricao: pedido.titulo,
      faturaId: fatura?.id ?? null,
      pedido: compacto,
    });

    return { ...cobranca, pedido };
  }),

  /** o checkout consulta até virar "pago" e então libera o painel */
  status: authed.input(z.object({ txid: z.string().min(4) })).handler(async ({ context, input }) => {
    const cliente = await clienteDaSessao(context.user.id);
    const [cobranca] = await db
      .select()
      .from(cobrancasPix)
      .where(and(eq(cobrancasPix.txid, input.txid), eq(cobrancasPix.clienteId, cliente.id)));
    if (!cobranca) throw new ORPCError("NOT_FOUND", { message: "Cobrança não encontrada" });
    return {
      status: cobranca.status,
      valor: cobranca.valor,
      descricao: cobranca.descricao,
      pagoEm: cobranca.pagoEm ? cobranca.pagoEm.toISOString() : null,
    };
  }),

  /** últimos pedidos do cliente, exibidos na aba Faturas */
  meusPedidos: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    const linhas = await db
      .select()
      .from(cobrancasPix)
      .where(eq(cobrancasPix.clienteId, cliente.id))
      .orderBy(desc(cobrancasPix.criadoEm))
      .limit(20);
    return linhas.map((l) => ({
      txid: l.txid,
      descricao: l.descricao,
      valor: l.valor,
      status: l.status,
      criadoEm: l.criadoEm.toISOString(),
      pagoEm: l.pagoEm ? l.pagoEm.toISOString() : null,
    }));
  }),
};
