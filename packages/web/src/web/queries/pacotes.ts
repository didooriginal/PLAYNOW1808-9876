import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE PACOTES — leitura e escrita da tabela `pacotes` */

export function usePacotes() {
  return useQuery(orpc.pacotes.listar.queryOptions({ staleTime: 30_000 }));
}

export function usePacote(id: number | null) {
  return useQuery(
    orpc.pacotes.obter.queryOptions({ input: { id: id ?? 0 }, enabled: id !== null }),
  );
}

export function useCriarPacote() {
  const qc = useQueryClient();
  return useMutation(
    orpc.pacotes.criar.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.pacotes.key() }),
    }),
  );
}

export function useAtualizarPacote() {
  const qc = useQueryClient();
  return useMutation(
    orpc.pacotes.atualizar.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.pacotes.key() }),
    }),
  );
}

export function useRemoverPacote() {
  const qc = useQueryClient();
  return useMutation(
    orpc.pacotes.remover.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.pacotes.key() });
        qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
      },
    }),
  );
}
