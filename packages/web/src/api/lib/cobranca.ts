/**
 * REGRAS DE COBRANCA, FIDELIDADE E BLOQUEIO
 * ------------------------------------------------------------------
 * Fonte unica de verdade sobre o ciclo de vida financeiro do cliente.
 * Usado pelas rotas (painel, suporte, netflix, codigos) e pela varredura
 * automatica de vencimentos.
 *
 * Status canonico do cliente:
 *   ativo     -> "Finalizado": pagamento em dia, acesso total
 *   pendente  -> vencimento chegando (<= 3 dias) ou aguardando confirmacao
 *   atrasado  -> passou do vencimento -> ACESSO BLOQUEADO
 *   suspenso  -> mais de 7 dias em atraso -> acesso bloqueado + fila de corte
 */

export const STATUS_CLIENTE = ["ativo", "pendente", "atrasado", "suspenso"] as const;
export type StatusCliente = (typeof STATUS_CLIENTE)[number];

export const ROTULO_STATUS: Record<StatusCliente, string> = {
  ativo: "Finalizado",
  pendente: "Pendente",
  atrasado: "Atrasado",
  suspenso: "Suspenso",
};

export const FORMAS_PAGAMENTO = [
  "pix",
  "cartao",
  "dinheiro",
  "boleto",
  "transferencia",
  "outro",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
};

/** dias em atraso a partir dos quais a conta vira `suspenso` */
export const DIAS_PARA_SUSPENDER = 7;
/** janela de aviso preventivo antes do vencimento */
export const DIAS_AVISO_PREVIO = 3;

/** `dd/mm/aaaa` (ou ISO) -> Date no fuso local, meia-noite. `null` se invalido. */
export function parseDataBr(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const texto = valor.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

export function formatarDataBr(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

/** meia-noite de hoje, para contas de dias sem ruido de horario */
function hoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Dias ate o vencimento. Positivo = ainda falta, 0 = vence hoje,
 * negativo = dias em atraso. `null` quando nao ha data cadastrada.
 */
export function diasAteVencimento(proximaCobranca: string | null | undefined): number | null {
  const alvo = parseDataBr(proximaCobranca);
  if (!alvo) return null;
  return Math.round((alvo.getTime() - hoje().getTime()) / 86_400_000);
}

/**
 * Status que o cliente DEVERIA ter, considerando apenas a data de vencimento.
 * `ativo` manual nunca e rebaixado antes da data — a regra so aperta.
 */
export function statusEsperado(
  proximaCobranca: string | null | undefined,
  atual: string,
): StatusCliente {
  const dias = diasAteVencimento(proximaCobranca);
  if (dias === null) return (atual as StatusCliente) ?? "ativo";
  if (dias < -DIAS_PARA_SUSPENDER) return "suspenso";
  if (dias < 0) return "atrasado";
  if (dias <= DIAS_AVISO_PREVIO) return "pendente";
  // ainda longe do vencimento: destrava quem estava atrasado e preserva
  // o "pendente" manual (aguardando confirmacao do pagamento).
  if (atual === "atrasado" || atual === "suspenso") return "ativo";
  return (atual as StatusCliente) || "ativo";
}

/** Duração padrão do crédito de confiança concedido pelo admin. */
export const HORAS_CONFIANCA = 48;

/**
 * CRÉDITO DE CONFIANÇA — o admin dá um prazo extra para o cliente inadimplente
 * continuar usando tudo normalmente. Enquanto o prazo está de pé, o bloqueio é
 * ignorado em toda a aplicação; quando expira, o bloqueio volta sozinho, sem
 * precisar de nenhuma rotina limpando campo.
 */
export function confiancaAtiva(confiancaAte?: Date | number | null) {
  if (!confiancaAte) return false;
  const ate = confiancaAte instanceof Date ? confiancaAte.getTime() : Number(confiancaAte);
  return Number.isFinite(ate) && ate > Date.now();
}

/** Detalhe do crédito para a UI: quanto falta, em horas e minutos. */
export function detalheConfianca(cliente: {
  confiancaAte?: Date | number | null;
  confiancaMotivo?: string | null;
  confiancaTotal?: number | null;
}) {
  const ativa = confiancaAtiva(cliente.confiancaAte);
  const ate = cliente.confiancaAte
    ? cliente.confiancaAte instanceof Date
      ? cliente.confiancaAte
      : new Date(Number(cliente.confiancaAte))
    : null;
  const restanteMs = ativa && ate ? ate.getTime() - Date.now() : 0;
  return {
    ativa,
    /** ISO para o contador do front */
    ate: ate ? ate.toISOString() : null,
    horasRestantes: Math.floor(restanteMs / 3_600_000),
    minutosRestantes: Math.floor((restanteMs % 3_600_000) / 60_000),
    motivo: cliente.confiancaMotivo ?? "",
    vezes: cliente.confiancaTotal ?? 0,
  };
}

/**
 * Cliente atrasado/suspenso perde acesso aos dados sensiveis e ao suporte humano
 * — a menos que esteja com crédito de confiança dentro do prazo.
 */
export function estaBloqueado(status: string, confiancaAte?: Date | number | null) {
  if (status !== "atrasado" && status !== "suspenso") return false;
  return !confiancaAtiva(confiancaAte);
}

/** Resumo pronto para a UI do cliente (contador regressivo + estado do bloqueio). */
export function situacaoCobranca(cliente: {
  statusPagamento: string;
  proximaCobranca: string | null;
  valor: number;
  ciclo: string;
  formaPagamento?: string | null;
  confiancaAte?: Date | number | null;
  confiancaMotivo?: string | null;
  confiancaTotal?: number | null;
}) {
  const dias = diasAteVencimento(cliente.proximaCobranca);
  const confianca = detalheConfianca(cliente);
  const bloqueado = estaBloqueado(cliente.statusPagamento, cliente.confiancaAte);
  const vencimento = parseDataBr(cliente.proximaCobranca);
  return {
    status: cliente.statusPagamento as StatusCliente,
    rotulo: ROTULO_STATUS[cliente.statusPagamento as StatusCliente] ?? cliente.statusPagamento,
    bloqueado,
    diasRestantes: dias,
    diasEmAtraso: dias !== null && dias < 0 ? Math.abs(dias) : 0,
    /** ISO para o contador regressivo do front (vence no fim do dia) */
    venceEm: vencimento ? new Date(vencimento.getTime() + 86_399_000).toISOString() : null,
    vencimento: cliente.proximaCobranca ?? "",
    valor: cliente.valor,
    ciclo: cliente.ciclo,
    formaPagamento: (cliente.formaPagamento ?? "pix") as FormaPagamento,
    /** crédito de confiança concedido pelo admin, se estiver valendo agora */
    confianca,
  };
}

/** Mensagem padrao devolvida quando uma acao e barrada pela inadimplencia. */
export const MSG_BLOQUEIO =
  "Seu plano está em atraso. Regularize o pagamento no painel para liberar novamente os acessos e o suporte.";
