import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** WIN-BACK — régua automática de recuperação de clientes inativos. */

export function usePainelWinback() {
  return useQuery(orpc.winback.painel.queryOptions({ staleTime: 20_000 }));
}

function useInvalidarWinback() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.winback.key() });
}

export function useVarrerWinback() {
  const invalidar = useInvalidarWinback();
  return useMutation(orpc.winback.varrer.mutationOptions({ onSuccess: invalidar }));
}

export function useMarcarWinbackEnviado() {
  const invalidar = useInvalidarWinback();
  return useMutation(orpc.winback.marcarEnviado.mutationOptions({ onSuccess: invalidar }));
}

export function useEncerrarWinback() {
  const invalidar = useInvalidarWinback();
  return useMutation(orpc.winback.encerrar.mutationOptions({ onSuccess: invalidar }));
}
