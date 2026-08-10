import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** MONITOR DE SAÚDE DAS CONTAS + ESTOQUE INTELIGENTE. */

export function usePainelSaude() {
  return useQuery(orpc.saude.painel.queryOptions({ staleTime: 20_000 }));
}

export function useFalhasRecentes() {
  return useQuery(orpc.saude.falhas.queryOptions({ staleTime: 20_000 }));
}

function useInvalidarSaude() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.saude.key() });
}

export function useVarrerSaude() {
  const invalidar = useInvalidarSaude();
  return useMutation(orpc.saude.varrer.mutationOptions({ onSuccess: invalidar }));
}

export function useAlternarReserva() {
  const invalidar = useInvalidarSaude();
  return useMutation(orpc.saude.alternarReserva.mutationOptions({ onSuccess: invalidar }));
}

export function useLiberarEntrada() {
  const invalidar = useInvalidarSaude();
  return useMutation(orpc.saude.liberarEntrada.mutationOptions({ onSuccess: invalidar }));
}

export function useRemanejarConta() {
  const invalidar = useInvalidarSaude();
  return useMutation(orpc.saude.remanejar.mutationOptions({ onSuccess: invalidar }));
}
