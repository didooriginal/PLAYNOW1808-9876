import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import type { Ciclo } from "./ciclos";

/**
 * CHECKOUT NA PLATAFORMA — resumo com preço do servidor, Pix e liberação
 * automática. Nenhum botão de compra manda o cliente para o WhatsApp.
 */

export type PedidoInput = {
  pacoteId?: number | null;
  comboId?: number | null;
  apps?: string[];
  /** periodicidade escolhida — o desconto de cada ciclo é aplicado no servidor */
  ciclo?: Ciclo;
  jogos?: boolean;
};

export function useResumoCheckout(pedido: PedidoInput, habilitado = true) {
  return useQuery(
    orpc.checkout.resumo.queryOptions({
      input: pedido,
      enabled: habilitado,
      retry: false,
      staleTime: 30_000,
    }),
  );
}

export function usePagarCheckout() {
  const qc = useQueryClient();
  return useMutation(
    orpc.checkout.pagar.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.checkout.key() });
        void qc.invalidateQueries({ queryKey: orpc.faturas.key() });
      },
    }),
  );
}

export function useStatusCheckout(txid: string | null) {
  return useQuery(
    orpc.checkout.status.queryOptions({
      input: { txid: txid ?? "" },
      enabled: Boolean(txid),
      refetchInterval: 4_000,
    }),
  );
}

export function useMeusPedidos() {
  return useQuery(orpc.checkout.meusPedidos.queryOptions({ staleTime: 15_000 }));
}
