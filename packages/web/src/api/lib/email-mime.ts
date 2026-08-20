/**
 * PARSER DE E-MAIL BRUTO (MIME)
 *
 * Por que isto existe: o Cloudflare Email Worker deveria mandar o corpo JA
 * limpo, mas quando a versao antiga do Worker esta publicada (ou quando o
 * admin cola o e-mail inteiro no painel) o que chega aqui e o e-mail CRU:
 * cabecalhos Received/DKIM, partes multipart, quoted-printable e CSS. Nesse
 * cenario o extrator lia numeros de UUID de cabecalho (X-AppInfo, links de
 * rastreio) e devolvia um codigo que nao existia no e-mail.
 *
 * Aqui o corpo e reduzido ao texto que o humano leria: parte text/plain
 * decodificada (ou o HTML sem tags), sem cabecalhos, sem URLs.
 */

/** decodifica quoted-printable: "c=C3=B3digo" -> "codigo", soft breaks "=\n" */
export function decodificarQuotedPrintable(texto: string): string {
  const semSoftBreak = texto.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
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
export function decodificarBase64(texto: string): string {
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
export function decodificarAssunto(assunto: string): string {
  if (!assunto.includes("=?")) return assunto;
  return assunto.replace(
    /=\?[^?]+\?([QqBb])\?([^?]*)\?=/g,
    (_todo, tipo: string, dado: string) =>
      tipo.toUpperCase() === "B"
        ? decodificarBase64(dado)
        : decodificarQuotedPrintable(dado.replace(/_/g, " ")),
  );
}

/** tira tags, style/script e entidades de um corpo HTML */
export function removerHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_t, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_t, n: string) => String.fromCharCode(Number.parseInt(n, 16)))
    // invisiveis: zero-width, joiner, soft hyphen, BOM. O preheader do Disney+
    // enche o topo do e-mail com centenas deles e empurrava o codigo para longe
    // do rotulo ("seu codigo de acesso unico"), estourando a janela de busca.
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, " ")
    // qualquer entidade nomeada que sobrou (&nbsp; &zwnj; &zwj; &ensp; ...)
    .replace(/&[a-z][a-z0-9]{1,10};/gi, " ")
    .replace(/[ \t]+/g, " ");
}

/** separa cabecalhos do payload de um bloco MIME */
function separarBloco(bloco: string) {
  const corte = bloco.search(/\r?\n\r?\n/);
  if (corte === -1) return { cabecalhos: "", payload: bloco };
  const fim = bloco.slice(corte).match(/^\r?\n\r?\n/)?.[0].length ?? 2;
  return { cabecalhos: bloco.slice(0, corte), payload: bloco.slice(corte + fim) };
}

/** desdobra cabecalhos continuados (linha comecando com espaco) */
function dobrar(cabecalhos: string) {
  return cabecalhos.replace(/\r?\n[ \t]+/g, " ");
}

const valorCabecalho = (cabecalhos: string, nome: string) =>
  dobrar(cabecalhos).match(new RegExp(`^${nome}\\s*:\\s*(.*)$`, "im"))?.[1]?.trim() ?? "";

/** parece e-mail cru (com cabecalhos de transporte) e nao texto ja limpo? */
export function pareceEmailBruto(texto: string) {
  const inicio = texto.slice(0, 4000);
  return (
    /^(received|dkim-signature|arc-seal|arc-message-signature|return-path|message-id|mime-version|content-type)\s*:/im.test(
      inicio,
    ) && /^content-type\s*:/im.test(texto)
  );
}

type Parte = { tipo: string; texto: string };

/** percorre o MIME e devolve as partes de texto decodificadas */
function coletarPartes(bloco: string, profundidade = 0): Parte[] {
  if (profundidade > 6) return [];
  const { cabecalhos, payload } = separarBloco(bloco);
  // ATENCAO: o boundary sai do valor ORIGINAL — ele diferencia maiuscula de
  // minuscula ("----=_Part_123"), e comparar em caixa baixa nao acha a divisao.
  const contentTypeBruto = valorCabecalho(cabecalhos, "content-type");
  const contentType = contentTypeBruto.toLowerCase();
  const encoding = valorCabecalho(cabecalhos, "content-transfer-encoding").toLowerCase();

  if (contentType.startsWith("multipart/")) {
    const boundary = contentTypeBruto.match(/boundary\s*=\s*"?([^";]+)"?/i)?.[1]?.trim();
    if (boundary) {
      const pedacos = payload.split(`--${boundary}`).slice(1);
      return pedacos
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

/**
 * Reduz qualquer entrada (e-mail cru, HTML ou texto) ao texto legivel.
 * Remove URLs e tokens hexadecimais longos, que sao a fonte dos falsos
 * positivos (uuid de rastreio com "8261" no meio).
 */
export function limparCorpoEmail(bruto: string): string {
  let texto = bruto ?? "";

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
