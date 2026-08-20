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

/**
 * Slugs que disparam o fluxo de MAC: o app "iptv" (venda antiga, sem opcao
 * escolhida) e as duas opcoes de tela. Qualquer slug novo de IPTV precisa
 * entrar aqui, senao o cliente compra e nunca recebe o pedido de MAC.
 */
export const SLUGS_IPTV = ["iptv", "iptv-1-tela", "iptv-2-telas"];

/**
 * Quantos aparelhos cada opcao libera ao mesmo tempo. "Tela" no IPTV = um MAC
 * ativo, porque o servidor conta conexao por aparelho. Fica aqui em codigo (e
 * nao numa coluna) porque o numero e parte da definicao do slug: mudar o
 * limite significa vender outra opcao, nao editar a mesma.
 */
export const TELAS_POR_SLUG: Record<string, number> = {
  iptv: 1,
  "iptv-1-tela": 1,
  "iptv-2-telas": 2,
};

/**
 * Total de telas que o cliente tem direito, somando os planos de IPTV ativos
 * dele. Sem plano de IPTV cai em 1: quem esta em analise (comprou agora, a
 * alocacao ainda nao existe) nao pode ficar travado sem poder enviar o MAC.
 */
export function telasContratadas(slugsAtivos: string[]) {
  const doIptv = slugsAtivos.filter((s) => s in TELAS_POR_SLUG);
  if (doIptv.length === 0) return 1;
  return doIptv.reduce((total, s) => total + (TELAS_POR_SLUG[s] ?? 1), 0);
}

/**
 * Onde baixar o app, por aparelho. Antes existia um link unico
 * (funplays.com.br) e o cliente de iPhone caia numa pagina que nao resolvia o
 * caso dele. Agora cada aparelho tem o destino certo:
 *  - iOS: app XCloud Mobile na App Store
 *  - Android: app FUNPLAY na Play Store
 *  - TV: nao ha link; o cliente busca FUNPLAY na loja da propria TV
 */
export const LINKS_APP_IPTV = {
  ios: "https://apps.apple.com/br/app/xcloud-mobile/id6471106231",
  android: "https://play.google.com/store/apps/details?id=com.funplusplay.app&hl=pt_BR",
} as const;

/** instrucao da TV (sem link: cada fabricante tem loja propria) */
export const INSTRUCAO_TV_IPTV = "Na TV, procure o app FUNPLAY na loja da propria TV.";

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
