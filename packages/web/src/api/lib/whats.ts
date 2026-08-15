/**
 * WHATSAPP — camada única de envio.
 *
 * Hoje roda no modo gratuito: o sistema NÃO dispara mensagem sozinho, ele
 * monta o link `wa.me` com o texto pronto e devolve junto do alerta do painel.
 * O admin clica e a conversa abre preenchida.
 *
 * Quando houver provedor (API oficial da Meta, Evolution, Z-API), basta
 * implementar o envio dentro de `enviarWhats` — nenhum chamador muda.
 */

/** Só dígitos, com DDI 55 quando o número vem em formato local. */
export function normalizarNumero(numero: string) {
  const so = (numero || "").replace(/\D/g, "");
  if (!so) return "";
  return so.startsWith("55") ? so : `55${so}`;
}

/** Link wa.me com a mensagem já preenchida. */
export function linkWhats(numero: string, mensagem: string) {
  const n = normalizarNumero(numero);
  if (!n) return "";
  return `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`;
}

/** Número do WhatsApp da operação, do `.env`. */
export function numeroAdmin() {
  return normalizarNumero(process.env.WHATSAPP_NUMERO || "5521964727746");
}

export type EnvioWhats = {
  /** true quando um provedor real entregou a mensagem */
  enviado: boolean;
  /** sempre preenchido — é o fallback clicável do painel */
  link: string;
};

/**
 * Ponto único de envio. Sem provedor configurado, devolve o link para o painel
 * (`enviado: false`). Nunca lança: aviso não pode derrubar operação.
 */
export async function enviarWhats(numero: string, mensagem: string): Promise<EnvioWhats> {
  const link = linkWhats(numero, mensagem);
  // TODO(provedor): quando WHATSAPP_API_URL existir, POSTar aqui e devolver
  // { enviado: true, link }. O resto do sistema não precisa saber.
  return { enviado: false, link };
}

/** Aviso para o próprio admin (usa o número da operação). */
export function avisoAdmin(mensagem: string) {
  return enviarWhats(numeroAdmin(), mensagem);
}
