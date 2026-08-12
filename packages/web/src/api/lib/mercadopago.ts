// MERCADO PAGO — cliente HTTP único do gateway de pagamento em PRODUÇÃO.
//
// Este arquivo é o ÚNICO ponto do sistema que fala com a API do Mercado Pago.
// Ninguém mais monta URL, header ou body: as rotas chamam as funções daqui.
//
// Variáveis exigidas no .env da raiz:
//   MERCADOPAGO_ACCESS_TOKEN   — token privado (APP_USR-...). Nunca vai ao front.
//   MERCADOPAGO_PUBLIC_KEY     — chave pública, exposta ao checkout do cartão.
//   MERCADOPAGO_WEBHOOK_SECRET — assinatura HMAC das notificações (opcional,
//                                mas quando existe o webhook passa a validar).
//
// Dois produtos são usados:
//   Pix        -> POST /v1/payments  (pagamento único: mensalidade avulsa,
//                 adicional, primeira compra)
//   Assinatura -> POST /preapproval  (cartão de crédito com cobrança
//                 recorrente automática, mensal ou anual)

import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.mercadopago.com";

/**
 * Periodicidades aceitas na assinatura recorrente do cartão. Espelha `CICLOS`
 * de `lib/ciclos.ts` — o Mercado Pago cobra a cada N meses, então trimestral e
 * semestral são frequência 3 e 6 em `months` (ver `recorrenciaMP`).
 */
export type CicloMP = "mensal" | "trimestral" | "semestral" | "anual";

/** traduz nosso ciclo para o par frequency/frequency_type do Mercado Pago */
function recorrenciaMP(ciclo: CicloMP) {
  if (ciclo === "anual") return { frequency: 1, frequency_type: "years" };
  const meses = ciclo === "semestral" ? 6 : ciclo === "trimestral" ? 3 : 1;
  return { frequency: meses, frequency_type: "months" };
}

/* ------------------------------------------------------------------ */
/* CONFIGURAÇÃO                                                        */
/* ------------------------------------------------------------------ */

export function tokenMP() {
  return process.env.MERCADOPAGO_ACCESS_TOKEN || "";
}

export function chavePublicaMP() {
  return process.env.MERCADOPAGO_PUBLIC_KEY || "";
}

/** true quando o gateway real está pronto para operar */
export function mercadoPagoConfigurado() {
  return Boolean(tokenMP());
}

/**
 * Distingue credencial de produção (APP_USR-) de credencial de teste (TEST-).
 * O painel mostra isso ao admin para ninguém achar que está faturando de
 * verdade rodando em sandbox.
 */
export function ambienteMP(): "producao" | "teste" | "ausente" {
  const token = tokenMP();
  if (!token) return "ausente";
  return token.startsWith("TEST-") ? "teste" : "producao";
}

/** URL pública do site, usada em back_urls e notification_url */
export function urlPublica() {
  const bruta =
    process.env.MERCADOPAGO_SITE_URL ||
    process.env.WEBSITE_URL ||
    "http://localhost:4200";
  return bruta.replace(/\/$/, "");
}

/**
 * O Mercado Pago só aceita URL pública https em `back_url` e `notification_url`
 * — localhost derruba a chamada. Aqui devolvemos `null` quando o domínio ainda
 * não foi configurado, para o chamador decidir se omite o campo ou avisa o admin.
 */
export function urlPublicaSegura(): string | null {
  const url = urlPublica();
  return url.startsWith("https://") ? url : null;
}

export function urlWebhookMP() {
  return `${urlPublica()}/api/webhooks/mercadopago`;
}

/** Webhook só quando há domínio https de verdade — senão o MP recusa o campo. */
export function urlWebhookSegura(): string | undefined {
  const base = urlPublicaSegura();
  return base ? `${base}/api/webhooks/mercadopago` : undefined;
}

/* ------------------------------------------------------------------ */
/* TRANSPORTE                                                          */
/* ------------------------------------------------------------------ */

export class ErroMercadoPago extends Error {
  constructor(
    readonly status: number,
    readonly detalhe: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroMercadoPago";
  }
}

/**
 * Vira o erro cru do gateway em uma frase que o admin entende e sabe resolver.
 * A mensagem original continua em `Error.message` para o log.
 */
function traduzirErroMP(mensagem: string, codigos: number[]): string {
  const m = mensagem.toLowerCase();
  if (codigos.includes(13253) || m.includes("without key enabled for qr")) {
    return "a conta do Mercado Pago ainda não tem chave Pix habilitada — cadastre a chave Pix no app do Mercado Pago (Seu negócio → Pix) e tente de novo";
  }
  if (m.includes("invalid access token") || m.includes("malformed access_token")) {
    return "o MERCADOPAGO_ACCESS_TOKEN está inválido ou expirado";
  }
  if (m.includes("invalid users involved")) {
    return "as credenciais são de outra conta do Mercado Pago (token de teste com dados de produção, ou o contrário)";
  }
  if (m.includes("payer") && m.includes("email")) {
    return "o e-mail do pagador está ausente ou inválido no cadastro do cliente";
  }
  if (m.includes("internal server error")) {
    // o /preapproval devolve 500 seco quando o payer_email é de domínio inexistente
    return "o Mercado Pago recusou os dados da assinatura — na prática isso quase sempre é e-mail do cliente inválido ou de domínio que não existe. Corrija o e-mail no cadastro e tente de novo";
  }
  return mensagem;
}

async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST" | "PUT"; corpo?: unknown; idempotencia?: string } = {},
): Promise<T> {
  const token = tokenMP();
  if (!token) {
    throw new ErroMercadoPago(0, "sem_credencial", "MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  if (opcoes.idempotencia) headers["x-idempotency-key"] = opcoes.idempotencia;

  const resposta = await fetch(`${BASE}${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });

  const texto = await resposta.text();
  let dados: unknown = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = texto;
  }

  if (!resposta.ok) {
    const obj = (dados ?? {}) as Record<string, unknown>;
    const cru =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.error === "string" && obj.error) ||
      texto.slice(0, 300) ||
      "erro sem corpo";
    // o Mercado Pago às vezes cola um "null" no fim da própria mensagem
    const limpa = String(cru).replace(/null$/, "").trim();
    const codigos = Array.isArray(obj.cause)
      ? (obj.cause as Array<Record<string, unknown>>).map((c) => Number(c.code)).filter(Boolean)
      : [];
    throw new ErroMercadoPago(
      resposta.status,
      traduzirErroMP(limpa, codigos),
      `Mercado Pago ${resposta.status}: ${limpa}`,
    );
  }

  return dados as T;
}

/* ------------------------------------------------------------------ */
/* PIX — pagamento único                                               */
/* ------------------------------------------------------------------ */

type PagamentoMP = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

/** ISO com offset (-03:00) — formato exigido em `date_of_expiration` */
function isoComOffset(data: Date) {
  const offsetMin = -data.getTimezoneOffset();
  const sinal = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const local = new Date(data.getTime() + offsetMin * 60_000).toISOString().slice(0, 23);
  return `${local}${sinal}${hh}:${mm}`;
}

export async function criarPagamentoPix(entrada: {
  valor: number;
  descricao: string;
  /** nosso txid — volta no webhook como external_reference */
  referencia: string;
  emailPagador: string;
  nomePagador?: string;
  expiraEmMinutos?: number;
}) {
  const minutos = entrada.expiraEmMinutos ?? 60;
  const expira = new Date(Date.now() + minutos * 60_000);
  const [primeiro, ...resto] = (entrada.nomePagador || "Cliente PLAYPLUSNOW").trim().split(/\s+/);

  const pagamento = await chamar<PagamentoMP>("/v1/payments", {
    metodo: "POST",
    idempotencia: entrada.referencia,
    corpo: {
      transaction_amount: Math.round(entrada.valor * 100) / 100,
      description: entrada.descricao.slice(0, 250),
      payment_method_id: "pix",
      external_reference: entrada.referencia,
      notification_url: urlWebhookSegura(),
      date_of_expiration: isoComOffset(expira),
      payer: {
        email: entrada.emailPagador,
        first_name: primeiro || "Cliente",
        last_name: resto.join(" ") || "PLAYPLUSNOW",
      },
    },
  });

  const dados = pagamento.point_of_interaction?.transaction_data ?? {};
  return {
    id: String(pagamento.id),
    status: pagamento.status,
    copiaECola: dados.qr_code ?? "",
    qrBase64: dados.qr_code_base64 ?? "",
    linkPagamento: dados.ticket_url ?? "",
    expiraEm: pagamento.date_of_expiration ? new Date(pagamento.date_of_expiration) : expira,
  };
}

export async function buscarPagamento(id: string) {
  return chamar<PagamentoMP>(`/v1/payments/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* ASSINATURA (cartão de crédito recorrente) — Preapproval             */
/* ------------------------------------------------------------------ */

type PreapprovalMP = {
  id: string;
  status: string;
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
  next_payment_date?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
  };
};

/**
 * Cria a assinatura no Mercado Pago e devolve o `init_point`: a URL onde o
 * cliente informa o cartão. A partir do aceite, o MP cobra sozinho a cada
 * ciclo e avisa o sistema pelo webhook — sem ninguém tocar.
 */
export async function criarAssinaturaMP(entrada: {
  titulo: string;
  valor: number;
  ciclo: CicloMP;
  emailPagador: string;
  /** nossa referência (ex.: "ASSIN-12-abc") */
  referencia: string;
  urlRetorno?: string;
}) {
  const base = urlPublicaSegura();
  if (!base) {
    throw new ErroMercadoPago(
      0,
      "assinatura no cartão exige o domínio público do site: defina MERCADOPAGO_SITE_URL=https://seudominio.com no .env (o Mercado Pago recusa localhost como URL de retorno)",
      "MERCADOPAGO_SITE_URL ausente ou sem https",
    );
  }

  const preapproval = await chamar<PreapprovalMP>("/preapproval", {
    metodo: "POST",
    corpo: {
      reason: entrada.titulo.slice(0, 255),
      external_reference: entrada.referencia,
      payer_email: entrada.emailPagador,
      back_url: entrada.urlRetorno || `${base}/dashboard?assinatura=ok`,
      notification_url: urlWebhookSegura(),
      status: "pending",
      auto_recurring: {
        ...recorrenciaMP(entrada.ciclo),
        transaction_amount: Math.round(entrada.valor * 100) / 100,
        currency_id: "BRL",
      },
    },
  });

  return {
    id: preapproval.id,
    status: preapproval.status,
    initPoint: preapproval.init_point ?? "",
  };
}

export async function buscarAssinaturaMP(id: string) {
  return chamar<PreapprovalMP>(`/preapproval/${encodeURIComponent(id)}`);
}

export async function cancelarAssinaturaMP(id: string) {
  return chamar<PreapprovalMP>(`/preapproval/${encodeURIComponent(id)}`, {
    metodo: "PUT",
    corpo: { status: "cancelled" },
  });
}

/** pausar/retomar sem perder o cartão autorizado */
export async function alterarStatusAssinaturaMP(id: string, status: "paused" | "authorized") {
  return chamar<PreapprovalMP>(`/preapproval/${encodeURIComponent(id)}`, {
    metodo: "PUT",
    corpo: { status },
  });
}

/** cobrança individual gerada por uma assinatura */
export async function buscarPagamentoAutorizado(id: string) {
  return chamar<{
    id: string | number;
    status: string;
    preapproval_id?: string;
    external_reference?: string;
    transaction_amount?: number;
    payment?: { id?: number | string; status?: string };
  }>(`/authorized_payments/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* WEBHOOK — validação da assinatura HMAC                              */
/* ------------------------------------------------------------------ */

/**
 * Confere o header `x-signature` do Mercado Pago.
 * Manifest oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *
 * Sem MERCADOPAGO_WEBHOOK_SECRET no .env devolve "sem_segredo": a notificação
 * é aceita, mas SEMPRE reconferida na API antes de dar baixa (ver o handler),
 * então nunca liberamos acesso confiando só no corpo do POST.
 */
export function validarAssinaturaWebhook(entrada: {
  assinatura: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
}): "ok" | "sem_segredo" | "invalida" {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) return "sem_segredo";
  if (!entrada.assinatura) return "invalida";

  const partes = new Map<string, string>();
  for (const bloco of entrada.assinatura.split(",")) {
    const [chave, valor] = bloco.split("=");
    if (chave && valor) partes.set(chave.trim(), valor.trim());
  }
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return "invalida";

  const manifest =
    `${entrada.dataId ? `id:${entrada.dataId.toLowerCase()};` : ""}` +
    `${entrada.requestId ? `request-id:${entrada.requestId};` : ""}` +
    `ts:${ts};`;

  const esperado = createHmac("sha256", segredo).update(manifest).digest("hex");
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return "invalida";
  return timingSafeEqual(a, b) ? "ok" : "invalida";
}
