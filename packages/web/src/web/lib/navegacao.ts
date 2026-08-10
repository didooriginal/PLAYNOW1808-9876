/**
 * NAVEGAÇÃO INTERNA DO PAINEL.
 * Componentes filhos (contador, bloqueio, avisos) pedem para o dashboard trocar
 * de aba sem precisar de prop drilling: disparam um evento que o dashboard ouve.
 */

export const EVENTO_ABA = "ppn:tab";

export type AbaPainel =
  | "acessos"
  | "netflix"
  | "jornada"
  | "jogos"
  | "carteira"
  | "novidades"
  | "faturas"
  | "suporte";

/** manda o painel abrir a aba pedida e sobe a página */
export function irParaAba(aba: AbaPainel) {
  window.dispatchEvent(new CustomEvent<AbaPainel>(EVENTO_ABA, { detail: aba }));
}

/**
 * Leva o cliente ao pagamento por Pix: se o bloco já estiver na tela (ex.: tela
 * de bloqueio), rola até ele; senão abre a aba de faturas, onde ele vive.
 */
export function irParaPagamento() {
  const bloco = document.getElementById("pagar-pix");
  if (bloco) {
    bloco.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  irParaAba("faturas");
}
