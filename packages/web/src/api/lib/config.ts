// PARÂMETROS DO NEGÓCIO — defaults no código, overrides na tabela `configuracoes`.
//
// Nada de número mágico espalhado pelas rotas: comissão, taxa de saque, bônus,
// margem de saldo crítico e a régua de win-back saem daqui. O admin ajusta pelo
// painel (aba Gestão de Contas → Parâmetros) e o valor passa a valer na hora.
import { db } from "../database";
import { configuracoes } from "../database/schema";

export const PARAMETROS_PADRAO = {
  /** % de comissão sobre cada pagamento de um indicado */
  comissaoPercentual: 5,
  /** bônus ao reinvestir a comissão como desconto na mensalidade */
  bonusCredito: 25,
  /** bônus extra quando a rede do afiliado se mantém em dia */
  bonusPerformance: 1,
  /** % mínimo da rede em dia para liberar o bônus de performance */
  metaRedeEmDia: 90,
  /** valor mínimo para pedir saque em Pix */
  saqueMinimo: 10,
  /** custo fixo do saque em Pix */
  saqueTaxa: 3.5,
  /** margem de segurança sobre o custo mensal no alerta de gift card */
  margemSaldoCritico: 20,
  /** ocupação (%) que dispara o alerta de estoque no admin */
  alertaOcupacao: 95,
  /** falhas em 30 dias que pausam a entrada de novos clientes numa conta */
  falhasParaPausar: 3,
  /** dias de inatividade para a 1ª mensagem de win-back */
  winbackDias: 15,
  /** desconto do cupom de win-back */
  winbackDesconto: 30,
  /** preço mensal do adicional Sala de Jogos */
  precoSalaJogos: 9.9,
  /** horas que uma liberação da Sala de Jogos permanece válida */
  horasLiberacaoJogos: 12,
  /** provedor de Pix ativo: simulado | mercadopago | efi | asaas | pagarme */
  pixProvedor: "simulado",
} as const;

export type Parametros = { [K in keyof typeof PARAMETROS_PADRAO]: (typeof PARAMETROS_PADRAO)[K] };
export type ChaveParametro = keyof typeof PARAMETROS_PADRAO;

/** lê todos os parâmetros, aplicando os overrides salvos no banco */
export async function lerParametros(): Promise<Parametros> {
  const salvos = await db.select().from(configuracoes);
  const mapa = new Map(salvos.map((c) => [c.chave, c.valor]));
  const saida = { ...PARAMETROS_PADRAO } as Record<string, string | number>;

  for (const [chave, padrao] of Object.entries(PARAMETROS_PADRAO)) {
    const bruto = mapa.get(chave);
    if (bruto === undefined || bruto === "") continue;
    saida[chave] = typeof padrao === "number" ? Number(bruto) || padrao : bruto;
  }
  return saida as Parametros;
}

/** grava (ou sobrescreve) um parâmetro */
export async function salvarParametro(chave: ChaveParametro, valor: string | number) {
  await db
    .insert(configuracoes)
    .values({ chave, valor: String(valor), atualizadoEm: new Date() })
    .onConflictDoUpdate({
      target: configuracoes.chave,
      set: { valor: String(valor), atualizadoEm: new Date() },
    });
}
