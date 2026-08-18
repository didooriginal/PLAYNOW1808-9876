/**
 * IPTV / FUN PLAY — regras compartilhadas
 * ------------------------------------------------------------------
 * O IPTV nao e entregue por login/senha como os streamings: o app Fun Play e
 * travado pelo ENDERECO MAC do aparelho. Por isso o cliente precisa mandar o
 * MAC de volta para a gente depois da compra.
 *
 * Este arquivo fica em `lib/` (e nao no routes) porque tanto a entrega do
 * pedido (`lib/pedidos.ts`) quanto as procedures (`routes/iptv.ts`) precisam
 * das mesmas constantes — importar o routes de dentro do lib criaria ciclo.
 */

/** slugs que disparam o fluxo de MAC. Hoje so o plano de canais ao vivo. */
export const SLUGS_IPTV = ["iptv"];

/** pagina oficial de download do app (Android/TV Box, Fire Stick, lojas) */
export const LINK_APP_IPTV = "https://funplays.com.br/";

/** o cliente pode ter varios aparelhos, mas nao pode inundar a fila */
export const MAX_PENDENTES_IPTV = 3;

/**
 * Normaliza qualquer coisa que o cliente digitar para AA:BB:CC:DD:EE:FF.
 * Aceita minusculas, hifen, ponto ou nada separando: "aa-bb-cc-dd-ee-ff",
 * "AABBCCDDEEFF" e "aa:bb:cc:dd:ee:ff" viram todos a mesma string.
 * Devolve "" quando nao sobram exatamente 12 digitos hexadecimais.
 */
export function normalizarMac(bruto: string) {
  const hex = (bruto || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  if (hex.length !== 12) return "";
  return hex.match(/.{2}/g)!.join(":");
}

/** true quando a string ja esta no formato final AA:BB:CC:DD:EE:FF */
export function macValido(mac: string) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
}
