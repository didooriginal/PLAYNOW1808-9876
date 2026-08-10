import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** GATEWAY PIX — cobrança do cliente e conciliação do admin. */

export function useCobrancasPix() {
  return useQuery(orpc.pix.listar.queryOptions({ staleTime: 10_000, refetchInterval: 30_000 }));
}

export function useConsultarPix(txid: string | null) {
  return useQuery(
    orpc.pix.consultar.queryOptions({
      input: { txid: txid ?? "" },
      enabled: Boolean(txid),
      refetchInterval: 5_000,
    }),
  );
}

function useInvalidarPix() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.pix.key() });
}

export function useGerarCobrancaPix() {
  const invalidar = useInvalidarPix();
  return useMutation(orpc.pix.cobrar.mutationOptions({ onSuccess: invalidar }));
}

export function useConfirmarPix() {
  const invalidar = useInvalidarPix();
  return useMutation(orpc.pix.confirmar.mutationOptions({ onSuccess: invalidar }));
}

export function useCancelarPix() {
  const invalidar = useInvalidarPix();
  return useMutation(orpc.pix.cancelar.mutationOptions({ onSuccess: invalidar }));
}
