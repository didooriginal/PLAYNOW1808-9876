import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE ALOCAÇÕES — vínculo cliente ↔ conta matriz */

/** mapa contaId → clientes ativos (todas as contas de uma vez) */
export function useMapaAlocacoes() {
  return useQuery(orpc.alocacoes.mapa.queryOptions({ staleTime: 10_000 }));
}

export function useHistoricoConta(contaId: number, enabled = true) {
  return useQuery(
    orpc.alocacoes.historico.queryOptions({ input: { contaId }, enabled, staleTime: 10_000 }),
  );
}

export function useClientesDisponiveis(contaId: number, enabled = true) {
  return useQuery(
    orpc.alocacoes.disponiveis.queryOptions({ input: { contaId }, enabled, staleTime: 10_000 }),
  );
}

function useInvalidarAlocacoes() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.alocacoes.key() });
    qc.invalidateQueries({ queryKey: orpc.contas.key() });
    qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
  };
}

export function useAlocarCliente() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(orpc.alocacoes.alocar.mutationOptions({ onSuccess: invalidar }));
}

export function useLiberarVaga() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(orpc.alocacoes.liberar.mutationOptions({ onSuccess: invalidar }));
}
