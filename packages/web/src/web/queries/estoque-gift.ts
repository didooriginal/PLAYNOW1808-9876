import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** ESTOQUE DE GIFT CARDS — códigos comprados, saldo por provedor e aplicação. */

export function useResumoEstoqueGift() {
  return useQuery(orpc.estoqueGift.resumo.queryOptions({ staleTime: 10_000 }));
}

export function useCodigosGift(filtro: {
  provider?: string;
  status?: "disponivel" | "em_uso" | "utilizado";
  enabled?: boolean;
}) {
  const { provider, status, enabled = true } = filtro;
  return useQuery(
    orpc.estoqueGift.listar.queryOptions({
      input: { provider, status, limite: 120 },
      enabled,
      staleTime: 5_000,
    }),
  );
}

/** invalida estoque + saldo das matrizes (a aplicação mexe nos dois) */
function useInvalidarEstoque() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: orpc.estoqueGift.key() });
    void qc.invalidateQueries({ queryKey: orpc.giftcards.key() });
  };
}

/** liga/desliga um app na aba de gift cards */
export function useAlternarAppGift() {
  const invalidar = useInvalidarEstoque();
  const qc = useQueryClient();
  return useMutation(
    orpc.estoqueGift.alternarApp.mutationOptions({
      onSuccess: () => {
        invalidar();
        void qc.invalidateQueries({ queryKey: orpc.aplicativos.key() });
      },
    }),
  );
}

export function useCadastrarLoteGift() {
  const invalidar = useInvalidarEstoque();
  return useMutation(orpc.estoqueGift.cadastrarLote.mutationOptions({ onSuccess: invalidar }));
}

export function useRevelarGift() {
  return useMutation(orpc.estoqueGift.revelar.mutationOptions({}));
}

export function useMarcarGiftEmUso() {
  const invalidar = useInvalidarEstoque();
  return useMutation(orpc.estoqueGift.marcarEmUso.mutationOptions({ onSuccess: invalidar }));
}

export function useConfirmarUsoGift() {
  const invalidar = useInvalidarEstoque();
  return useMutation(orpc.estoqueGift.confirmarUso.mutationOptions({ onSuccess: invalidar }));
}

export function useDevolverGift() {
  const invalidar = useInvalidarEstoque();
  return useMutation(orpc.estoqueGift.devolver.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverGift() {
  const invalidar = useInvalidarEstoque();
  return useMutation(orpc.estoqueGift.remover.mutationOptions({ onSuccess: invalidar }));
}
