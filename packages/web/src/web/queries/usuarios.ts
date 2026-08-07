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
 * Painel do cliente: usuário + pacote contratado + credenciais das contas matrizes.
 * Sem e-mail, devolve o primeiro cliente cadastrado (modo demo).
 */
export function usePainelCliente(email?: string) {
  return useQuery(
    orpc.usuarios.painel.queryOptions({ input: email ? { email } : {}, staleTime: 10_000 }),
  );
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
