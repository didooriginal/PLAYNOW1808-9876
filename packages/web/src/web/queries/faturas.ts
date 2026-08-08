import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE FATURAS (geradas no servidor a partir do histórico do cliente) */

export function useMinhasFaturas() {
  return useQuery(orpc.faturas.minhas.queryOptions({ staleTime: 15_000 }));
}

export function useFaturas() {
  return useQuery(orpc.faturas.listar.queryOptions({ staleTime: 15_000 }));
}

export function useResumoFaturas() {
  return useQuery(orpc.faturas.resumo.queryOptions({ staleTime: 15_000 }));
}

export function useRegistrarPagamento() {
  const qc = useQueryClient();
  return useMutation(
    orpc.faturas.registrarPagamento.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.faturas.key() });
        qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
        qc.invalidateQueries({ queryKey: orpc.recompensas.key() });
      },
    }),
  );
}

/** formata "2026-08" como "ago/2026" */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function rotuloCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return competencia;
  return `${MESES[mes - 1]}/${ano}`;
}

/** formata "2026-08-12" como "12/08/2026" */
export function dataBr(iso: string) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
