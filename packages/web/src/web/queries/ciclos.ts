import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * TABELA DE CICLOS — rótulos e percentuais vindos do servidor.
 * Nenhuma tela do front escreve "20% off" na mão: tudo sai daqui, que espelha
 * `api/lib/ciclos.ts`. Assim landing, checkout e painel nunca divergem.
 */

export type Ciclo = "mensal" | "trimestral" | "semestral" | "anual";

export function useTabelaCiclos() {
  return useQuery(
    orpc.ciclos.tabela.queryOptions({
      staleTime: 10 * 60_000,
    }),
  );
}
