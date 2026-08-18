/**
 * PLAYPLUSNOW — Cloudflare Email Worker
 * Captura automática dos códigos de verificação dos streamings.
 *
 * COMO FUNCIONA
 *   1. Cloudflare Email Routing recebe tudo que chega em @mail.playplusnow.com.br
 *      (regra catch-all) e entrega para este Worker.
 *   2. O Worker lê remetente, destinatário, assunto e corpo do e-mail.
 *   3. Faz POST em https://playplusnow.com.br/api/webhooks/email.
 *   4. O backend extrai o código, identifica o serviço pelo remetente e entrega
 *      ao cliente que clicou em "Pedi o código agora" naquela conta matriz.
 *
 * PASSOS NO CLOUDFLARE
 *   a) Painel → Compute → Email Service → Email Routing → escolher o domínio
      playplusnow.com.br → Enable / Get started (cria os registros MX e SPF).
 *   b) Em "Destination addresses", verifique um e-mail seu (para os avisos).
 *   c) Crie a rota catch-all: Action = "Send to a Worker" → este Worker.
 *   d) Workers & Pages → criar Worker → colar este arquivo → Deploy.
 *   e) Settings → Variables:
 *        WEBHOOK_URL   = https://playplusnow.com.br/api/webhooks/email
 *        WEBHOOK_TOKEN = mesmo valor de EMAIL_WEBHOOK_TOKEN no .env do servidor
 *        ADMIN_EMAIL   = seu e-mail pessoal, JA VERIFICADO em "Destination
 *                        addresses". Serve para o Worker te reenviar os e-mails
 *                        que precisam de acao humana (ver abaixo).
 *   f) No admin, preencha "E-mail de captura de códigos" em cada conta matriz
 *      (ex.: netflix01@mail.playplusnow.com.br) e configure o streaming/Gmail
 *      da matriz para encaminhar os e-mails para esse endereço.
 *
 * CONFIRMACOES DE ENCAMINHAMENTO (o caso do Gmail)
 *   Quando voce cadastra netflix01@mail.playplusnow.com.br como endereco de
 *   encaminhamento no Gmail da matriz, o Gmail manda um e-mail de confirmacao
 *   para esse endereco. Como o catch-all entrega tudo aqui, essa confirmacao
 *   morreria no Worker e voce nunca conseguiria concluir o encaminhamento.
 *   Por isso o Worker detecta esses e-mails (Gmail, Outlook, Yahoo, iCloud e
 *   os proprios streamings pedindo "verifique seu e-mail") e os REENVIA para
 *   ADMIN_EMAIL, sem tentar extrair codigo nenhum. Assim voce nunca precisa
 *   trocar o catch-all para "Send to an email" e voltar depois.
 *
 * DEPENDÊNCIA
 *   npm i postal-mime   (parser de MIME; roda dentro do Worker)
 */

import PostalMime from "postal-mime";

export default {
  async email(message, env, ctx) {
    const url = env.WEBHOOK_URL;
    if (!url) {
      console.error("WEBHOOK_URL não configurada");
      return;
    }

    let corpo = "";
    let assunto = message.headers.get("subject") || "";

    /**
     * DESVIO PARA O HUMANO — antes de qualquer coisa.
     * Confirmacao de encaminhamento / verificacao de endereco nao e codigo de
     * streaming: ela precisa chegar numa caixa que voce le. O reenvio so
     * funciona para um endereco JA VERIFICADO em "Destination addresses".
     */
    if (env.ADMIN_EMAIL && precisaDeHumano(message.from, assunto)) {
      try {
        await message.forward(env.ADMIN_EMAIL);
        console.log("reenviado para o admin:", assunto);
        return;
      } catch (e) {
        // destino nao verificado na Cloudflare: segue o fluxo normal e loga
        console.error("nao consegui reenviar para ADMIN_EMAIL", e);
      }
    }

    try {
      // o raw do e-mail vem como stream; o parser devolve texto limpo
      const bruto = new Response(message.raw);
      const parsed = await PostalMime.parse(await bruto.arrayBuffer());
      corpo = parsed.text || striptags(parsed.html || "");
      assunto = parsed.subject || assunto;
    } catch (e) {
      console.error("falha ao parsear o e-mail", e);
      corpo = assunto; // pior caso: tenta achar o código no assunto
    }

    const payload = {
      remetente: message.from,
      // é o endereço de captura da matriz — é ele que casa a conta no backend
      destinatario: message.to,
      assunto,
      corpo: corpo.slice(0, 20000),
    };

    const envio = fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.WEBHOOK_TOKEN ? { "x-webhook-token": env.WEBHOOK_TOKEN } : {}),
      },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        if (!r.ok) console.error("webhook respondeu", r.status, await r.text());
      })
      .catch((e) => console.error("webhook falhou", e));

    // não bloqueia a entrega do e-mail: o POST termina em background
    ctx.waitUntil(envio);
  },
};

/** remove tags de um corpo HTML quando não há versão texto */
function striptags(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * true quando o e-mail e um pedido de confirmacao/verificacao de endereco, e
 * nao um codigo de acesso. Casa pelo remetente (mais confiavel) e, como rede
 * de seguranca, por frases tipicas no assunto — em portugues e em ingles.
 */
function precisaDeHumano(remetente, assunto) {
  const de = (remetente || "").toLowerCase();
  const titulo = (assunto || "").toLowerCase();

  const remetentesDeConfirmacao = [
    "forwarding-noreply@google.com", // Gmail: confirmacao de encaminhamento
    "noreply-forwarding@google.com",
    "mail-noreply@google.com",
    "no-reply@microsoft.com",
    "account-security-noreply@accountprotection.microsoft.com",
    "verify@icloud.com",
  ];
  if (remetentesDeConfirmacao.some((r) => de.includes(r))) return true;

  const frases = [
    "confirmação de encaminhamento",
    "confirmacao de encaminhamento",
    "verificação de encaminhamento",
    "forwarding confirmation",
    "verify your forwarding",
    "confirm your forwarding",
    "verifique seu e-mail",
    "verifique seu endereço de e-mail",
    "confirme seu e-mail",
    "confirm your email",
    "verify your email",
  ];
  return frases.some((f) => titulo.includes(f));
}
