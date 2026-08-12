import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * RENOVAÇÃO E ANTECIPAÇÃO — área de pagamento do cliente.
 * O front só diz QUAL opção o cliente escolheu (ciclo ou tipo de antecipação);
 * quem calcula e devolve o valor é sempre o servidor.
 */

export function useOpcoesRenovacao(habilitado = true) {
  return useQuery(
    orpc.renovacao.opcoes.queryOptions({
      enabled: habilitado,
      staleTime: 30_000,
    }),
  );
}

/** invalida tudo que muda de valor depois de gerar/pagar uma cobrança */
function useInvalidarPagamento() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: orpc.renovacao.key() });
    void qc.invalidateQueries({ queryKey: orpc.faturas.key() });
    void qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
  };
}

export function useRenovar() {
  const invalidar = useInvalidarPagamento();
  return useMutation(orpc.renovacao.renovar.mutationOptions({ onSuccess: invalidar }));
}

export function useAntecipar() {
  const invalidar = useInvalidarPagamento();
  return useMutation(orpc.renovacao.antecipar.mutationOptions({ onSuccess: invalidar }));
}
