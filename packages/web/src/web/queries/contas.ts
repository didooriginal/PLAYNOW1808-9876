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

/**
 * TRAVA DAS VAGAS — com a trava ligada nada automático recalcula as vagas
 * daquela conta (era o que fazia o número mudar sozinho depois de salvar).
 */
export function useAlternarTravaVagas() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.alternarTravaVagas.mutationOptions({ onSuccess: invalidar }));
}

/** recalcula as vagas de UMA conta (aviso de divergência no card) */
export function useSincronizarUmaConta() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.sincronizarUma.mutationOptions({ onSuccess: invalidar }));
}

/** contas em que o número gravado e as alocações ativas não batem */
export function useDivergenciasVagas() {
  return useQuery(orpc.contas.divergencias.queryOptions({ staleTime: 15_000 }));
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

/** liga/desliga a conta matriz — desligar remaneja os clientes automaticamente */
export function useAlternarContaAtiva() {
  const invalidar = useInvalidarContas();
  return useMutation(orpc.contas.alternarAtiva.mutationOptions({ onSuccess: invalidar }));
}

/** clientes aguardando vaga (fila de espera do estoque) */
export function useFilaVagas() {
  return useQuery(orpc.contas.fila.queryOptions({ staleTime: 15_000 }));
}

/** botao "Resolvido"/"Cancelar" da fila de vagas */
export function useResolverFila() {
  const invalidar = useInvalidarContas();
  const qc = useQueryClient();
  return useMutation(
    orpc.contas.resolverFila.mutationOptions({
      onSuccess: () => {
        invalidar();
        qc.invalidateQueries({ queryKey: orpc.notificacoes.key() });
      },
    }),
  );
}
