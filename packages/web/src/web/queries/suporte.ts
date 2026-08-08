import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE SUPORTE — chamados abertos pelo cliente e fila do admin */

export const TIPOS_PROBLEMA = [
  { id: "senha_incorreta", label: "Senha incorreta" },
  { id: "sem_credito", label: "Conta sem crédito" },
  { id: "erro_login", label: "Erro de login" },
  { id: "tela_ocupada", label: "Tela ocupada / limite atingido" },
  { id: "outro", label: "Outro problema" },
] as const;

export const rotuloTipo = (tipo: string) =>
  TIPOS_PROBLEMA.find((t) => t.id === tipo)?.label ?? "Outro problema";

export const rotuloStatusChamado: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

/** chamados do cliente logado */
export function useMeusChamados() {
  return useQuery(orpc.suporte.meus.queryOptions({ staleTime: 10_000 }));
}

/** fila completa do admin */
export function useChamados() {
  return useQuery(orpc.suporte.listar.queryOptions({ staleTime: 10_000 }));
}

export function useResumoSuporte() {
  return useQuery(orpc.suporte.resumo.queryOptions({ staleTime: 10_000 }));
}

function useInvalidarSuporte() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.suporte.key() });
}

export function useAbrirChamado() {
  const invalidar = useInvalidarSuporte();
  return useMutation(orpc.suporte.abrir.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarChamado() {
  const invalidar = useInvalidarSuporte();
  return useMutation(orpc.suporte.atualizar.mutationOptions({ onSuccess: invalidar }));
}
