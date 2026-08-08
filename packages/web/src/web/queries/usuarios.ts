import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE USUÁRIOS — base de clientes e painel do cliente */

export function useUsuarios() {
  return useQuery(orpc.usuarios.listar.queryOptions({ staleTime: 15_000 }));
}

export function useResumoClientes() {
  return useQuery(orpc.usuarios.resumo.queryOptions({ staleTime: 15_000 }));
}

/**
 * Painel do cliente LOGADO: usuário + pacote contratado + credenciais das contas
 * matrizes. Resolvido no servidor pela sessão (Better Auth) — exige login.
 */
export function usePainelCliente() {
  return useQuery(orpc.usuarios.painel.queryOptions({ staleTime: 10_000 }));
}

/** Perfil da sessão atual (nome, e-mail, flag admin). */
export function useEu() {
  return useQuery(orpc.usuarios.eu.queryOptions({ staleTime: 30_000 }));
}

function useInvalidarUsuarios() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
}

export function useCriarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation(orpc.usuarios.criar.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation(orpc.usuarios.atualizar.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation(orpc.usuarios.remover.mutationOptions({ onSuccess: invalidar }));
}
