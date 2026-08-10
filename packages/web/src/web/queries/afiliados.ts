import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** MÓDULO AFILIADO — carteira do cliente e fila de saques do admin. */

export function useMeuPainelAfiliado() {
  return useQuery(orpc.afiliados.meuPainel.queryOptions({ staleTime: 15_000 }));
}

export function useResumoAfiliados() {
  return useQuery(orpc.afiliados.resumo.queryOptions({ staleTime: 15_000 }));
}

function useInvalidarAfiliados() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.afiliados.key() });
}

export function useSimularResgate() {
  return useMutation(orpc.afiliados.simularResgate.mutationOptions());
}

export function useResgatar() {
  const invalidar = useInvalidarAfiliados();
  return useMutation(orpc.afiliados.resgatar.mutationOptions({ onSuccess: invalidar }));
}

export function useLiberarComissao() {
  const invalidar = useInvalidarAfiliados();
  return useMutation(orpc.afiliados.liberarComissao.mutationOptions({ onSuccess: invalidar }));
}

export function useProcessarSaque() {
  const invalidar = useInvalidarAfiliados();
  return useMutation(orpc.afiliados.processarSaque.mutationOptions({ onSuccess: invalidar }));
}

export function useReapurarComissoes() {
  const invalidar = useInvalidarAfiliados();
  return useMutation(orpc.afiliados.reapurar.mutationOptions({ onSuccess: invalidar }));
}

export const brlCarteira = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
