// WEBHOOK DO MERCADO PAGO — tradução de notificação em baixa de pagamento.
//
// O corpo da notificação NUNCA é usado como fonte de verdade: o Mercado Pago
// manda apenas o tipo e o id do recurso, e nós consultamos a API para saber o
// status real antes de liberar qualquer acesso. Assim nem uma requisição
// forjada nem um replay conseguem ativar um cliente sem pagamento.

import { desc, eq } from "drizzle-orm";
import { db } from "../database";
import { assinaturas, cobrancasPix } from "../database/schema";
import {
  buscarAssinaturaMP,
  buscarPagamento,
  buscarPagamentoAutorizado,
} from "./mercadopago";
import { confirmarPagamento } from "../routes/pix";
import {
  avisarCancelamentoAssinatura,
  baixarCobrancaAssinatura,
} from "../routes/assinaturas";

export type ResultadoWebhook = {
  ok: boolean;
  tratado: string;
  detalhe?: string;
};

/** normaliza os vários nomes de evento que o MP usa */
function tipoDoEvento(bruto: string) {
  const t = bruto.toLowerCase();
  if (t.includes("authorized_payment")) return "cobranca_assinatura";
  if (t.includes("preapproval") || t === "subscription") return "assinatura";
  if (t.includes("payment") || t === "merchant_order") return "pagamento";
  return "desconhecido";
}

/* ------------------------------------------------------------------ */

/** pagamento avulso (Pix, ou primeira cobrança do cartão) */
async function tratarPagamento(id: string): Promise<ResultadoWebhook> {
  const pagamento = await buscarPagamento(id);

  if (pagamento.status !== "approved") {
    return { ok: true, tratado: "pagamento", detalhe: `status ${pagamento.status}, ignorado` };
  }

  const referencia = pagamento.external_reference || "";
  let [cobranca] = referencia
    ? await db.select().from(cobrancasPix).where(eq(cobrancasPix.txid, referencia))
    : [];

  if (!cobranca) {
    [cobranca] = await db
      .select()
      .from(cobrancasPix)
      .where(eq(cobrancasPix.provedorId, String(pagamento.id)))
      .orderBy(desc(cobrancasPix.criadoEm))
      .limit(1);
  }

  // pagamento gerado por uma assinatura chega aqui também: nesse caso o
  // vínculo é pelo preapproval, não por uma cobrança nossa
  if (!cobranca) {
    const preapprovalId =
      (pagamento as { metadata?: { preapproval_id?: string } }).metadata?.preapproval_id || "";
    if (preapprovalId) {
      const [assinatura] = await db
        .select()
        .from(assinaturas)
        .where(eq(assinaturas.provedorId, preapprovalId));
      if (assinatura) {
        await baixarCobrancaAssinatura({
          assinatura,
          pagamentoId: String(pagamento.id),
          valor: pagamento.transaction_amount,
        });
        return { ok: true, tratado: "cobranca_assinatura" };
      }
    }
    return { ok: false, tratado: "pagamento", detalhe: "cobrança não encontrada" };
  }

  const resultado = await confirmarPagamento(cobranca.txid, "webhook");
  return { ok: resultado.ok, tratado: "pagamento", detalhe: resultado.ok ? "baixado" : "falhou" };
}

/** mudança de status da assinatura (autorizada, pausada, cancelada) */
async function tratarAssinatura(id: string): Promise<ResultadoWebhook> {
  const remota = await buscarAssinaturaMP(id);
  const [assinatura] = await db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.provedorId, id));

  if (!assinatura) {
    return { ok: false, tratado: "assinatura", detalhe: "assinatura não encontrada" };
  }

  /**
   * Já estava cancelada antes desta notificação? Então o aviso ao cliente já
   * saiu (pelo painel ou por um webhook anterior) e não repetimos nada — o
   * Mercado Pago reenvia a mesma notificação várias vezes.
   */
  const jaCancelada = assinatura.status === "cancelled" || Boolean(assinatura.canceladaEm);
  const cancelouAgora = remota.status === "cancelled" && !jaCancelada;

  await db
    .update(assinaturas)
    .set({
      status: remota.status || assinatura.status,
      proximaCobranca: remota.next_payment_date
        ? remota.next_payment_date.slice(0, 10)
        : assinatura.proximaCobranca,
      canceladaEm: remota.status === "cancelled" ? new Date() : assinatura.canceladaEm,
      atualizadoEm: new Date(),
    })
    .where(eq(assinaturas.id, assinatura.id));

  /**
   * Cancelamento que NÃO passou pelo nosso painel (cliente cancelou no app do
   * Mercado Pago, cartão recusado várias vezes, assinatura expirada) agora
   * também avisa: e-mail de confirmação ao cliente e alerta ao admin.
   */
  if (cancelouAgora) {
    try {
      await avisarCancelamentoAssinatura(
        { ...assinatura, status: "cancelled", canceladaEm: new Date() },
        "webhook",
      );
    } catch (e) {
      console.error("[Webhook MP] falha ao avisar o cancelamento:", e);
    }
  }

  return {
    ok: true,
    tratado: "assinatura",
    detalhe: `status ${remota.status}${cancelouAgora ? ", cliente avisado" : ""}`,
  };
}

/** cobrança individual gerada pela recorrência do cartão */
async function tratarCobrancaAssinatura(id: string): Promise<ResultadoWebhook> {
  const autorizado = await buscarPagamentoAutorizado(id);
  const statusPagamento = autorizado.payment?.status || autorizado.status;

  if (statusPagamento !== "approved" && autorizado.status !== "processed") {
    return {
      ok: true,
      tratado: "cobranca_assinatura",
      detalhe: `status ${statusPagamento}, ignorado`,
    };
  }

  const preapprovalId = autorizado.preapproval_id || "";
  const [assinatura] = preapprovalId
    ? await db.select().from(assinaturas).where(eq(assinaturas.provedorId, preapprovalId))
    : [];

  if (!assinatura) {
    return { ok: false, tratado: "cobranca_assinatura", detalhe: "assinatura não encontrada" };
  }

  const resultado = await baixarCobrancaAssinatura({
    assinatura,
    pagamentoId: String(autorizado.payment?.id ?? autorizado.id),
    valor: autorizado.transaction_amount,
  });

  return { ok: resultado.ok !== false, tratado: "cobranca_assinatura" };
}

/* ------------------------------------------------------------------ */

/**
 * Ponto de entrada do webhook. Recebe o tipo do evento e o id do recurso;
 * consulta a API do Mercado Pago e aplica a baixa quando for o caso.
 */
export async function processarNotificacaoMP(entrada: {
  tipo: string;
  dataId: string;
}): Promise<ResultadoWebhook> {
  const tipo = tipoDoEvento(entrada.tipo);
  if (!entrada.dataId) return { ok: false, tratado: tipo, detalhe: "id ausente" };

  switch (tipo) {
    case "pagamento":
      return tratarPagamento(entrada.dataId);
    case "assinatura":
      return tratarAssinatura(entrada.dataId);
    case "cobranca_assinatura":
      return tratarCobrancaAssinatura(entrada.dataId);
    default:
      return { ok: true, tratado: "ignorado", detalhe: `evento ${entrada.tipo}` };
  }
}
