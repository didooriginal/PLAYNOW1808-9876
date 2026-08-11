import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** FUTEBOL AO VIVO — acesso do cliente e pool do admin. */

export function useMeuAcessoJogos() {
  return useQuery(
    orpc.jogos.meuAcesso.queryOptions({ staleTime: 10_000, refetchInterval: 60_000 }),
  );
}

export function usePainelJogos() {
  return useQuery(orpc.jogos.painel.queryOptions({ staleTime: 10_000, refetchInterval: 60_000 }));
}

function useInvalidarJogos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.jogos.key() });
}

export function useContratarJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.contratar.mutationOptions({ onSuccess: invalidar }));
}

export function useCancelarJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.cancelar.mutationOptions({ onSuccess: invalidar }));
}

export function usePegarAcessoJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.pegarAcesso.mutationOptions({ onSuccess: invalidar }));
}

export function useDevolverAcessoJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.devolverAcesso.mutationOptions({ onSuccess: invalidar }));
}

export function useCadastrarContaJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.cadastrarConta.mutationOptions({ onSuccess: invalidar }));
}

export function useAlternarPoolJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.alternarPool.mutationOptions({ onSuccess: invalidar }));
}

export function useRevogarJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.revogar.mutationOptions({ onSuccess: invalidar }));
}

export function useAlternarClienteJogos() {
  const invalidar = useInvalidarJogos();
  return useMutation(orpc.jogos.alternarCliente.mutationOptions({ onSuccess: invalidar }));
}
