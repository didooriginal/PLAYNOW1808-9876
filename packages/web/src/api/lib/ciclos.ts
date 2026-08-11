/**
 * CICLOS DE COBRANÇA E ANTECIPAÇÃO — fonte única de verdade.
 *
 * Todo desconto de periodicidade e de antecipação sai daqui. Nenhum outro
 * arquivo deve ter percentual escrito na mão: preço divergente entre a landing,
 * o checkout e a renovação é a principal causa de cliente cobrado errado.
 *
 * Regras de negócio definidas pelo dono da operação:
 *  - trimestral 5% off · semestral 10% off · anual 20% off (sobre a mensalidade)
 *  - antecipar a fatura do mês vigente no Pix: 5% off
 *  - antecipar um mês futuro no Pix: 10% off (dinheiro em caixa antes da hora)
 *
 * Descontos de antecipação valem SÓ no Pix. No cartão a cobrança é recorrente
 * pelo Mercado Pago e antecipar não gera ganho de caixa, então não há desconto.
 */

export const CICLOS = ["mensal", "trimestral", "semestral", "anual"] as const;
export type Ciclo = (typeof CICLOS)[number];

type DefinicaoCiclo = {
  /** quantos meses o cliente paga de uma vez */
  meses: number;
  /** desconto aplicado sobre a mensalidade cheia */
  desconto: number;
  /** rótulo curto para botões e selos */
  rotulo: string;
  /** substantivo do período cobrado, usado em "R$ X / <periodo>" */
  periodo: string;
  /** frase de venda exibida junto do preço */
  chamada: string;
};

export const DEFINICOES: Record<Ciclo, DefinicaoCiclo> = {
  mensal: {
    meses: 1,
    desconto: 0,
    rotulo: "Mensal",
    periodo: "mês",
    chamada: "Sem compromisso, cancela quando quiser",
  },
  trimestral: {
    meses: 3,
    desconto: 0.05,
    rotulo: "Trimestral",
    periodo: "trimestre",
    chamada: "5% de desconto — 3 meses de uma vez",
  },
  semestral: {
    meses: 6,
    desconto: 0.1,
    rotulo: "Semestral",
    periodo: "semestre",
    chamada: "10% de desconto — 6 meses de uma vez",
  },
  anual: {
    meses: 12,
    desconto: 0.2,
    rotulo: "Anual",
    periodo: "ano",
    chamada: "20% de desconto — equivale a 2 meses grátis",
  },
};

/** desconto por antecipação, só no Pix */
export const ANTECIPACAO = {
  /** fatura do mês corrente, ainda dentro do prazo */
  vigente: { desconto: 0.05, rotulo: "Antecipar este mês", chamada: "5% de desconto no Pix" },
  /** mês que ainda nem foi faturado */
  proximo: { desconto: 0.1, rotulo: "Adiantar o próximo mês", chamada: "10% de desconto no Pix" },
} as const;

export type TipoAntecipacao = keyof typeof ANTECIPACAO;

const cent = (v: number) => Math.round(v * 100) / 100;

/** Normaliza qualquer entrada externa (query string, body antigo) em um ciclo válido. */
export function normalizarCiclo(valor: unknown): Ciclo {
  return CICLOS.includes(valor as Ciclo) ? (valor as Ciclo) : "mensal";
}

export function mesesDoCiclo(ciclo: Ciclo) {
  return DEFINICOES[ciclo].meses;
}

export function periodoDoCiclo(ciclo: Ciclo) {
  return DEFINICOES[ciclo].periodo;
}

/**
 * Preço fechado de um ciclo a partir da mensalidade cheia.
 * `mensalPromocional` cobre o caso do pacote com `precoAnual` cadastrado na
 * mão: quando existe, ele manda no lugar do percentual da tabela.
 */
export function precificarCiclo(
  mensalCheio: number,
  ciclo: Ciclo,
  mensalPromocional?: number | null,
) {
  const def = DEFINICOES[ciclo];
  const mensal =
    mensalPromocional != null && mensalPromocional > 0
      ? mensalPromocional
      : cent(mensalCheio * (1 - def.desconto));
  const total = cent(mensal * def.meses);
  const cheio = cent(mensalCheio * def.meses);
  return {
    ciclo,
    meses: def.meses,
    /** valor equivalente por mês, para exibir "R$ X/mês" */
    mensal: cent(mensal),
    /** valor realmente cobrado nesta compra */
    total,
    /** quanto sairia pagando mês a mês */
    cheio,
    economia: cent(Math.max(0, cheio - total)),
    periodo: def.periodo,
    rotulo: def.rotulo,
  };
}

/** Aplica o desconto de antecipação (Pix) sobre um valor já fechado. */
export function precificarAntecipacao(valor: number, tipo: TipoAntecipacao) {
  const { desconto, rotulo } = ANTECIPACAO[tipo];
  const abatimento = cent(valor * desconto);
  return {
    tipo,
    rotulo,
    percentual: desconto,
    original: cent(valor),
    desconto: abatimento,
    total: cent(valor - abatimento),
  };
}

/** Soma meses a uma data ISO `YYYY-MM-DD` preservando o fim do mês. */
export function somarMeses(iso: string, meses: number) {
  const base = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date();
  const dia = base.getUTCDate();
  const d = new Date(base);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  // 31/01 + 1 mês = 28/02, não 03/03
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return d.toISOString().slice(0, 10);
}
