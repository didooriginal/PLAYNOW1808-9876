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

/** Aceite do checklist de boas-vindas (regras de uso). */
export function useAceitarTermos() {
  const qc = useQueryClient();
  return useMutation(
    orpc.usuarios.aceitarTermos.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.usuarios.key() }),
    }),
  );
}

/** Trava de vencimento: unica forma de mudar a data de cobranca. */
export function useAlterarVencimento() {
  const invalidar = useInvalidarUsuarios();
  return useMutation(orpc.usuarios.alterarVencimento.mutationOptions({ onSuccess: invalidar }));
}

export function useHistoricoVencimento(clienteId: number | null) {
  return useQuery(
    orpc.usuarios.historicoVencimento.queryOptions({
      input: { clienteId: clienteId ?? 0 },
      enabled: clienteId !== null,
      staleTime: 15_000,
    }),
  );
}

/** rotulos de negocio compartilhados pela UI */
export const ROTULO_STATUS_CLIENTE: Record<string, string> = {
  ativo: "Finalizado",
  pendente: "Pendente",
  atrasado: "Atrasado",
  suspenso: "Suspenso",
};

export const FORMAS_PAGAMENTO = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "cartao", rotulo: "Cartão" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "transferencia", rotulo: "Transferência" },
  { valor: "outro", rotulo: "Outro" },
] as const;
