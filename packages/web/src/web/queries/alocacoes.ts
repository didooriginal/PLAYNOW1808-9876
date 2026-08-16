import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE ALOCAÇÕES — vínculo cliente ↔ conta matriz */

/** mapa contaId → clientes ativos (todas as contas de uma vez) */
export function useMapaAlocacoes() {
  return useQuery(orpc.alocacoes.mapa.queryOptions({ staleTime: 10_000 }));
}

export function useHistoricoConta(contaId: number, enabled = true) {
  return useQuery(
    orpc.alocacoes.historico.queryOptions({ input: { contaId }, enabled, staleTime: 10_000 }),
  );
}

export function useClientesDisponiveis(contaId: number, enabled = true) {
  return useQuery(
    orpc.alocacoes.disponiveis.queryOptions({ input: { contaId }, enabled, staleTime: 10_000 }),
  );
}

function useInvalidarAlocacoes() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.alocacoes.key() });
    qc.invalidateQueries({ queryKey: orpc.contas.key() });
    qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
    // mexer em app avulso mexe em dinheiro: mensalidade e fatura em aberto
    qc.invalidateQueries({ queryKey: orpc.faturas.key() });
  };
}

export function useAlocarCliente() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(orpc.alocacoes.alocar.mutationOptions({ onSuccess: invalidar }));
}

export function useLiberarVaga() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(orpc.alocacoes.liberar.mutationOptions({ onSuccess: invalidar }));
}

/** aloca o cliente em qualquer vaga livre do serviço escolhido (admin) */
export function useAlocarPorServico() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(orpc.alocacoes.alocarPorServico.mutationOptions({ onSuccess: invalidar }));
}

/** apps que o cliente tem direito + onde cada um está alocado (popup do admin) */
export function useAppsDoCliente(clienteId: number | null, enabled = true) {
  return useQuery(
    orpc.alocacoes.appsDoCliente.queryOptions({
      input: { clienteId: clienteId ?? 0 },
      enabled: enabled && Boolean(clienteId),
      staleTime: 10_000,
    }),
  );
}

/** grava o direito do app E aloca a vaga (sem vaga: entra na fila e avisa) */
export function useAdicionarAppAoCliente() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(
    orpc.alocacoes.adicionarAppAoCliente.mutationOptions({ onSuccess: invalidar }),
  );
}

/** tira o app do cliente e devolve a vaga ao estoque */
export function useRemoverAppDoCliente() {
  const invalidar = useInvalidarAlocacoes();
  return useMutation(orpc.alocacoes.removerAppDoCliente.mutationOptions({ onSuccess: invalidar }));
}
