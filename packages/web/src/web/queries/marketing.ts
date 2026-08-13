import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** MARKETING — biblioteca de textos prontos do admin */

export function useMarketingTexts() {
  return useQuery(orpc.marketing.listar.queryOptions({ staleTime: 30_000 }));
}

export function useSalvarMarketingText() {
  const qc = useQueryClient();
  return useMutation(
    orpc.marketing.salvar.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.marketing.key() }),
    }),
  );
}

export function useRemoverMarketingText() {
  const qc = useQueryClient();
  return useMutation(
    orpc.marketing.remover.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.marketing.key() }),
    }),
  );
}
