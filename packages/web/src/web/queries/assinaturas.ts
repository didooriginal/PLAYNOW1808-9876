import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * ASSINATURA NO CARTÃO — cobrança recorrente automática (Mercado Pago).
 * O cartão é informado no ambiente do Mercado Pago (`initPoint`); aqui só
 * criamos, consultamos e cancelamos a recorrência.
 */

export type PedidoAssinatura = {
  pacoteId?: number | null;
  comboId?: number | null;
  apps?: string[];
  ciclo?: "mensal" | "anual";
  jogos?: boolean;
};

export function useMinhaAssinatura(habilitado = true) {
  return useQuery(
    orpc.assinaturas.minha.queryOptions({
      enabled: habilitado,
      retry: false,
      staleTime: 10_000,
    }),
  );
}

export function useCriarAssinatura() {
  const qc = useQueryClient();
  return useMutation(
    orpc.assinaturas.criar.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.assinaturas.key() });
        void qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
      },
    }),
  );
}

export function useCancelarAssinatura() {
  const qc = useQueryClient();
  return useMutation(
    orpc.assinaturas.cancelar.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.assinaturas.key() });
      },
    }),
  );
}

export function useAssinaturasAdmin() {
  return useQuery(orpc.assinaturas.listar.queryOptions({ staleTime: 15_000 }));
}
