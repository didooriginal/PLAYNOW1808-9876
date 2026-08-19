import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * RECUPERAÇÃO DE SENHA — o pedido do cliente vai direto pelo Better Auth
 * (`authClient.requestPasswordReset`). Aqui ficam o canal de entrega (para o
 * texto da tela) e a fila que o admin acompanha.
 */

export function usePedirResetSenha() {
  return useMutation(orpc.senha.pedir.mutationOptions());
}

export function useCanalSenha() {
  return useQuery(orpc.senha.canal.queryOptions({ staleTime: 5 * 60_000 }));
}

export function useFilaSenha() {
  return useQuery(orpc.senha.fila.queryOptions({ staleTime: 10_000 }));
}

export function useGerarLinkSenha() {
  const qc = useQueryClient();
  return useMutation(
    orpc.senha.gerarLink.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.senha.key() });
      },
    }),
  );
}

export function useDescartarResetSenha() {
  const qc = useQueryClient();
  return useMutation(
    orpc.senha.descartar.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.senha.key() });
      },
    }),
  );
}
