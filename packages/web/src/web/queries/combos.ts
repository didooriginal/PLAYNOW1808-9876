import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DOS COMBOS INTELIGENTES — vitrine da landing, upgrades do cliente e CRUD do admin */

export function useVitrineCombos() {
  return useQuery(orpc.combos.vitrine.queryOptions({ staleTime: 60_000 }));
}

export function useCombosCliente() {
  return useQuery(orpc.combos.paraCliente.queryOptions({ staleTime: 60_000 }));
}

export function useCombosAdmin() {
  return useQuery(orpc.combos.listar.queryOptions({ staleTime: 15_000 }));
}

function useInvalidarCombos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.combos.key() });
}

export function useCriarCombo() {
  const invalidar = useInvalidarCombos();
  return useMutation(orpc.combos.criar.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarCombo() {
  const invalidar = useInvalidarCombos();
  return useMutation(orpc.combos.atualizar.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverCombo() {
  const invalidar = useInvalidarCombos();
  return useMutation(orpc.combos.remover.mutationOptions({ onSuccess: invalidar }));
}
