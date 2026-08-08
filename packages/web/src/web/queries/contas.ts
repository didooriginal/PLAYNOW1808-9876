import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE CONTAS MATRIZES — estoque compartilhado */

export function useContas() {
  return useQuery(orpc.contas.listar.queryOptions({ staleTime: 15_000 }));
}

export function useResumoEstoque() {
  return useQuery(orpc.contas.resumo.queryOptions({ staleTime: 15_000 }));
}

function useInvalidarContas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.contas.key() });
    qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
    qc.invalidateQueries({ queryKey: orpc.alocacoes.key() });
  };
}

export function useCriarConta() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.criar.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarConta() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.atualizar.mutationOptions({ onSuccess: invalidar }));
}

/** ocupa (+1) ou libera (-1) uma vaga da conta matriz */
export function useAjustarVagas() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.ajustarVagas.mutationOptions({ onSuccess: invalidar }));
}

/** altera o total de vagas da conta matriz */
export function useEditarVagas() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.editarVagas.mutationOptions({ onSuccess: invalidar }));
}

/** reposição: libera todas as vagas para realocação (sem apagar histórico) */
export function useReporConta() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.repor.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverConta() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.remover.mutationOptions({ onSuccess: invalidar }));
}
