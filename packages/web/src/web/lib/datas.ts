/** Utilitários de data do front — `dd/mm/aaaa` é o formato que vem da API. */

/** converte "dd/mm/aaaa" (ou ISO) em Date local; null quando inválido */
export function parseDataBrClient(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const texto = valor.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

/**
 * Exibe uma data em `dd/mm/aaaa` para o usuário, aceitando ISO ou BR na entrada.
 * O banco guarda `clienteDesde` em ISO (ordenação/comparação em SQL); a tela mostra BR.
 */
export function exibirData(valor: string | null | undefined, vazio = "—") {
  const d = parseDataBrClient(valor);
  return d ? d.toLocaleDateString("pt-BR") : valor?.trim() || vazio;
}
