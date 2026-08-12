import { ANTECIPACAO, CICLOS, DEFINICOES } from "../lib/ciclos";
import { base } from "../__core/app";

/**
 * TABELA DE CICLOS — leitura pública.
 *
 * Existe para o front NUNCA ter percentual escrito na mão. A landing, o
 * checkout e a área de pagamento do cliente pedem esta tabela para montar os
 * botões ("Anual · 20% off"); quem fecha o valor continua sendo o servidor em
 * `checkout.resumo` / `renovacao.opcoes`.
 */
export const ciclos = {
  tabela: base.handler(() => ({
    ciclos: CICLOS.map((ciclo) => ({
      ciclo,
      meses: DEFINICOES[ciclo].meses,
      /** fração: 0.2 = 20% off sobre a mensalidade */
      desconto: DEFINICOES[ciclo].desconto,
      rotulo: DEFINICOES[ciclo].rotulo,
      periodo: DEFINICOES[ciclo].periodo,
      chamada: DEFINICOES[ciclo].chamada,
    })),
    antecipacao: {
      vigente: { ...ANTECIPACAO.vigente },
      proximo: { ...ANTECIPACAO.proximo },
    },
  })),
};
