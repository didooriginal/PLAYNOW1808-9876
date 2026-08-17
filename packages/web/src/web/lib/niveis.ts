/**
 * NIVEIS DO CLIENTE (front).
 *
 * Espelha o catalogo de niveis do servidor (`api/routes/recompensas.ts`) para
 * que a UI consiga escrever o titulo do nivel sem precisar de mais uma query.
 * O nivel efetivo continua sendo calculado no servidor pelo XP — aqui so
 * traduzimos numero -> nome e respondemos quem ja pode virar afiliado.
 */

export const NIVEIS = [
  "Iniciante",
  "Bronze",
  "Prata",
  "Ouro",
  "Platina",
  "Diamante",
  "Lenda PPN",
] as const;

/** Menor nivel que destrava a carteira de afiliado (saque em Pix / creditos). */
export const NIVEL_AFILIADO = 3;

export function tituloDoNivel(nivel: number) {
  return NIVEIS[Math.min(Math.max(nivel, 1) - 1, NIVEIS.length - 1)] ?? NIVEIS[0];
}

export function podeSerAfiliado(nivel: number) {
  return nivel >= NIVEL_AFILIADO;
}

/** Lista pronta para o `<select>` do admin: 1..7 com o titulo ao lado. */
export const OPCOES_NIVEL = NIVEIS.map((titulo, i) => ({
  valor: i + 1,
  rotulo: `Nível ${i + 1} — ${titulo}`,
}));
