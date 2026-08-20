import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * PUSH WEB — chave pública, inscrição do aparelho e teste.
 * O trabalho do navegador (permissão, PushManager) fica em ../lib/push-cliente.
 */

export function useChavePush() {
  return useQuery(orpc.push.chavePublica.queryOptions({ staleTime: 60 * 60_000 }));
}

export function useSituacaoPush() {
  return useQuery(orpc.push.situacao.queryOptions({ staleTime: 30_000 }));
}

export function useInscreverPush() {
  const qc = useQueryClient();
  return useMutation(
    orpc.push.inscrever.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.push.key() });
      },
    }),
  );
}

export function useDesinscreverPush() {
  const qc = useQueryClient();
  return useMutation(
    orpc.push.desinscrever.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.push.key() });
      },
    }),
  );
}

export function useTestarPush() {
  return useMutation(orpc.push.testar.mutationOptions());
}
