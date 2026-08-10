import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** GESTÃO DE CONTAS — saldo de gift card das matrizes e parâmetros do negócio. */

export function useGiftcards() {
  return useQuery(orpc.giftcards.listar.queryOptions({ staleTime: 10_000 }));
}

export function useExtratoGift(contaId: number | null) {
  return useQuery(
    orpc.giftcards.extrato.queryOptions({
      input: { contaId: contaId ?? 0 },
      enabled: contaId !== null,
      staleTime: 10_000,
    }),
  );
}

export function useParametros() {
  return useQuery(orpc.giftcards.parametros.queryOptions({ staleTime: 30_000 }));
}

function useInvalidarGift() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.giftcards.key() });
}

export function useLancarSaldo() {
  const invalidar = useInvalidarGift();
  return useMutation(orpc.giftcards.lancar.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarConta() {
  const invalidar = useInvalidarGift();
  return useMutation(orpc.giftcards.atualizar.mutationOptions({ onSuccess: invalidar }));
}

export function useVarrerSaldos() {
  const invalidar = useInvalidarGift();
  return useMutation(orpc.giftcards.varrer.mutationOptions({ onSuccess: invalidar }));
}

export function useSalvarParametro() {
  const invalidar = useInvalidarGift();
  return useMutation(orpc.giftcards.salvarParametro.mutationOptions({ onSuccess: invalidar }));
}
