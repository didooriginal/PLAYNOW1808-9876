import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { registerServices } from "../lib/mock-data";

/** STORE DO CATÁLOGO DE APLICATIVOS — fonte dos apps que compõem pacotes */

export function useAplicativos() {
  const query = useQuery(
    orpc.aplicativos.listar.queryOptions({
      staleTime: 60_000,
    }),
  );
  // registra apps novos no catálogo em runtime, para que ícones/nomes
  // funcionem com qualquer slug cadastrado pelo admin
  if (query.data) registerServices(query.data);
  return query;
}

function useInvalidarAplicativos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.aplicativos.key() });
    qc.invalidateQueries({ queryKey: orpc.pacotes.key() });
  };
}

export function useCriarAplicativo() {
  const invalidar = useInvalidarAplicativos();
  return useMutation(orpc.aplicativos.criar.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarAplicativo() {
  const invalidar = useInvalidarAplicativos();
  return useMutation(orpc.aplicativos.atualizar.mutationOptions({ onSuccess: invalidar }));
}

/**
 * Salva a ordem da grade de aplicativos (a mesma que a landing exibe).
 * Manda só os ids na ordem desejada; o servidor grava a posição de cada um.
 */
export function useReordenarAplicativos() {
  const invalidar = useInvalidarAplicativos();
  return useMutation(orpc.aplicativos.reordenar.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverAplicativo() {
  const invalidar = useInvalidarAplicativos();
  return useMutation(orpc.aplicativos.remover.mutationOptions({ onSuccess: invalidar }));
}
