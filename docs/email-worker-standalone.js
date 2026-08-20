/**
 * PLAYPLUSNOW - Cloudflare Email Worker (VERSAO STANDALONE, ZERO DEPENDENCIA)
 *
 * POR QUE ESTA VERSAO EXISTE
 *   O email-worker.js usa `import PostalMime from "postal-mime"`, que NAO
 *   funciona colando no editor do painel da Cloudflare (o editor nao instala
 *   pacote npm). Era por isso que o Worker antigo continuava publicado: o
 *   deploy da versao com PostalMime falhava.
 *
 *   Este arquivo faz o mesmo parse de MIME com codigo proprio, sem import
 *   nenhum. Pode colar direto no painel e dar Deploy.
 *
 * COMO PUBLICAR (painel, sem terminal)
 *   1. Workers & Pages -> abrir o Worker de e-mail que ja existe
 *   2. Edit code -> apagar TODO o conteudo -> colar este arquivo inteiro
 *   3. Deploy
 *   4. Settings -> Variables and Secrets, confirmar que existem:
 *        WEBHOOK_URL   = https://playplusnow.com.br/api/webhooks/email
 *        WEBHOOK_TOKEN = mesmo valor de EMAIL_WEBHOOK_TOKEN no .env do servidor
 *        ADMIN_EMAIL   = seu e-mail, JA VERIFICADO em "Destination addresses"
 *   5. Email Routing -> a rota catch-all deve estar em "Send to a Worker" ->
 *      este Worker
 *
 * COMO SABER QUE DEU CERTO
 *   Pedir um codigo no Disney+ e olhar a Caixa de Entrada no /admin: o corpo
 *   salvo deve vir como TEXTO LIMPO (comecando em "Seu codigo de acesso
 *   unico..."), e nao em "Received: from ...". E o codigo deve aparecer.
 *
 * O QUE MUDOU EM RELACAO AO WORKER ANTIGO
 *   - antigo: mandava o MIME CRU cortado em 20.000 caracteres. O e-mail do
 *     Disney+ e HTML puro com ~6 mil caracteres de preheader invisivel
 *     (&nbsp;&zwnj; repetido) antes do conteudo, entao o codigo ficava DEPOIS
 *     do corte e nunca era encontrado.
 *   - agora: extrai a parte de texto (ou o HTML sem tags), decodifica
 *     quoted-printable/base64, remove os invisiveis e corta em 50.000.
 */

export default {
  async email(message, env, ctx) {
    const url = env.WEBHOOK_URL;
    if (!url) {
      console.error("WEBHOOK_URL nao configurada");
      return;
    }

    let assunto = decodificarAssunto(message.headers.get("subject") || "");

    // DESVIO PARA O HUMANO: confirmacao de encaminhamento nao e codigo.
    // Precisa vir antes de tudo, senao a confirmacao do Gmail morre aqui e
    // voce nunca consegue concluir o encaminhamento da matriz.
    if (env.ADMIN_EMAIL && precisaDeHumano(message.from, assunto)) {
      try {
        await message.forward(env.ADMIN_EMAIL);
        console.log("reenviado para o admin:", assunto);
        return;
      } catch (e) {
        // destino nao verificado na Cloudflare: segue o fluxo normal
        console.error("nao consegui reenviar para ADMIN_EMAIL", e);
      }
    }

    let corpo = "";
    try {
      const bruto = await new Response(message.raw).text();
      corpo = limparCorpoEmail(bruto);
      const doMime = assuntoDoMime(bruto);
      if (doMime) assunto = doMime;
    } catch (e) {
      console.error("falha ao parsear o e-mail", e);
      corpo = assunto; // pior caso: tenta achar o codigo no assunto
    }

    const payload = {
      remetente: message.from,
      // e o endereco de captura da matriz - e ele que casa a conta no backend
      destinatario: message.to,
      assunto,
      corpo: corpo.slice(0, 50000),
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

    // nao bloqueia a entrega do e-mail: o POST termina em background
    ctx.waitUntil(envio);
  },
};

/* ------------------------------------------------------------------ *
 * PARSER DE MIME
 * Espelha packages/web/src/api/lib/email-mime.ts. Se mexer aqui, mexa la.
 * ------------------------------------------------------------------ */

/** decodifica quoted-printable: "c=C3=B3digo" -> "codigo", soft breaks "=\n" */
function decodificarQuotedPrintable(texto) {
  const semSoftBreak = texto.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < semSoftBreak.length; i++) {
    const c = semSoftBreak[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(semSoftBreak.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(semSoftBreak.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    const ponto = semSoftBreak.charCodeAt(i);
    if (ponto < 128) {
      bytes.push(ponto);
    } else {
      for (const b of new TextEncoder().encode(c)) bytes.push(b);
    }
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return semSoftBreak;
  }
}

/** decodifica base64 tolerando quebras de linha */
function decodificarBase64(texto) {
  try {
    const limpo = texto.replace(/[^A-Za-z0-9+/=]/g, "");
    const bin = atob(limpo);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return texto;
  }
}

/** decodifica assunto RFC 2047: "=?UTF-8?Q?Netflix:_seu_c=C3=B3digo?=" */
function decodificarAssunto(assunto) {
  if (!assunto.includes("=?")) return assunto;
  return assunto.replace(/=\?[^?]+\?([QqBb])\?([^?]*)\?=/g, (_todo, tipo, dado) =>
    tipo.toUpperCase() === "B"
      ? decodificarBase64(dado)
      : decodificarQuotedPrintable(dado.replace(/_/g, " ")),
  );
}

/** tira tags, style/script e entidades de um corpo HTML */
function removerHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_t, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_t, n) => String.fromCharCode(Number.parseInt(n, 16)))
    // invisiveis: zero-width, joiner, soft hyphen, BOM. O preheader do Disney+
    // enche o topo do e-mail com centenas deles.
    .replace(/[​-‍⁠﻿­]/g, " ")
    // qualquer entidade nomeada que sobrou (&nbsp; &zwnj; &zwj; &ensp; ...)
    .replace(/&[a-z][a-z0-9]{1,10};/gi, " ")
    .replace(/[ \t]+/g, " ");
}

/** separa cabecalhos do payload de um bloco MIME */
function separarBloco(bloco) {
  const corte = bloco.search(/\r?\n\r?\n/);
  if (corte === -1) return { cabecalhos: "", payload: bloco };
  const casou = bloco.slice(corte).match(/^\r?\n\r?\n/);
  const fim = casou ? casou[0].length : 2;
  return { cabecalhos: bloco.slice(0, corte), payload: bloco.slice(corte + fim) };
}

/** desdobra cabecalhos continuados (linha comecando com espaco) */
function dobrar(cabecalhos) {
  return cabecalhos.replace(/\r?\n[ \t]+/g, " ");
}

function valorCabecalho(cabecalhos, nome) {
  const m = dobrar(cabecalhos).match(new RegExp(`^${nome}\\s*:\\s*(.*)$`, "im"));
  return m && m[1] ? m[1].trim() : "";
}

/** assunto tirado do proprio MIME, ja decodificado */
function assuntoDoMime(bruto) {
  const { cabecalhos } = separarBloco(bruto.slice(0, 100000));
  const cru = valorCabecalho(cabecalhos, "subject");
  return cru ? decodificarAssunto(cru) : "";
}

/** parece e-mail cru (com cabecalhos de transporte) e nao texto ja limpo? */
function pareceEmailBruto(texto) {
  const inicio = texto.slice(0, 4000);
  return (
    /^(received|dkim-signature|arc-seal|arc-message-signature|return-path|message-id|mime-version|content-type)\s*:/im.test(
      inicio,
    ) && /^content-type\s*:/im.test(texto)
  );
}

/** percorre o MIME e devolve as partes de texto decodificadas */
function coletarPartes(bloco, profundidade = 0) {
  if (profundidade > 6) return [];
  const { cabecalhos, payload } = separarBloco(bloco);
  // ATENCAO: o boundary sai do valor ORIGINAL - ele diferencia maiuscula de
  // minuscula ("----=_Part_123"), e comparar em caixa baixa nao acha a divisao.
  const contentTypeBruto = valorCabecalho(cabecalhos, "content-type");
  const contentType = contentTypeBruto.toLowerCase();
  const encoding = valorCabecalho(cabecalhos, "content-transfer-encoding").toLowerCase();

  if (contentType.startsWith("multipart/")) {
    const m = contentTypeBruto.match(/boundary\s*=\s*"?([^";]+)"?/i);
    const boundary = m && m[1] ? m[1].trim() : "";
    if (boundary) {
      return payload
        .split(`--${boundary}`)
        .slice(1)
        .filter((p) => !/^\s*--/.test(p))
        .flatMap((p) => coletarPartes(p.replace(/^\r?\n/, ""), profundidade + 1));
    }
  }

  const bruto =
    encoding === "quoted-printable"
      ? decodificarQuotedPrintable(payload)
      : encoding === "base64"
        ? decodificarBase64(payload)
        : payload;

  const tipo = contentType.startsWith("text/html")
    ? "html"
    : contentType.startsWith("text/") || contentType === ""
      ? "plain"
      : "outro";

  if (tipo === "outro") return [];
  return [{ tipo, texto: tipo === "html" ? removerHtml(bruto) : bruto }];
}

/** Reduz qualquer entrada (e-mail cru, HTML ou texto) ao texto legivel. */
function limparCorpoEmail(bruto) {
  let texto = bruto || "";

  if (pareceEmailBruto(texto)) {
    const partes = coletarPartes(texto);
    const plain = partes.filter((p) => p.tipo === "plain").map((p) => p.texto);
    const html = partes.filter((p) => p.tipo === "html").map((p) => p.texto);
    const escolhido = (plain.join("\n").trim() || html.join("\n").trim()).trim();
    // sem nenhuma parte legivel: joga fora os cabecalhos e segue com o resto
    texto = escolhido || separarBloco(texto).payload;
  }

  if (/<[a-z!/][^>]*>/i.test(texto)) texto = removerHtml(texto);
  if (/=[0-9A-F]{2}/.test(texto) && /=\r?\n/.test(texto)) {
    texto = decodificarQuotedPrintable(texto);
  }

  return texto
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ")
    .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/gi, " ")
    .replace(/\b[0-9a-f]{4,}(?:-[0-9a-f]{4,})+\b/gi, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * true quando o e-mail e um pedido de confirmacao/verificacao de endereco, e
 * nao um codigo de acesso.
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
    "confirmacao de encaminhamento",
    "confirmação de encaminhamento",
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
