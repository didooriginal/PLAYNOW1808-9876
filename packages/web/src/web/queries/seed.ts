import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE SEED — popula o banco com o catálogo inicial */

export function useSeedStatus() {
  return useQuery(orpc.seed.status.queryOptions({ staleTime: 5_000 }));
}

export function useRodarSeed() {
  const qc = useQueryClient();
  return useMutation(
    orpc.seed.run.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.pacotes.key() });
        qc.invalidateQueries({ queryKey: orpc.contas.key() });
        qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
        qc.invalidateQueries({ queryKey: orpc.seed.key() });
      },
    }),
  );
}
