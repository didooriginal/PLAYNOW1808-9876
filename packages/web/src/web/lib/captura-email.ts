/**
 * Endereço de captura de códigos.
 *
 * Cada conta matriz ganha um endereço do NOSSO domínio (catch-all no
 * Cloudflare Email Routing). O e-mail do streaming chega nele, o Email Worker
 * chama POST /api/webhooks/email e o código entra na central sem ninguém
 * precisar abrir caixa de entrada.
 */
export const DOMINIO_CAPTURA = "mail.playplusnow.com.br";

/** "netflix" + conta 7 → "netflix07@mail.playplusnow.com.br" */
export function sugerirCaptura(servico: string, id: number | null) {
  const base = (servico || "conta")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const numero = id ? String(id).padStart(2, "0") : String(Date.now()).slice(-4);
  return `${base}${numero}@${DOMINIO_CAPTURA}`;
}
