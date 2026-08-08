import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** STORE DE GAMIFICAÇÃO / AFILIADOS */

export const ROTULO_PREMIO: Record<string, string> = {
  cupom15: "Cupom 15% OFF",
  hbomax_gratis: "1 mês de HBO Max grátis",
  premio_especial: "Prêmio especial",
  presente_surpresa: "Presente surpresa",
};

export const rotuloPremio = (id: string) => ROTULO_PREMIO[id] ?? id;

/** jornada do cliente logado (progresso recalculado no servidor) */
export function useMinhaJornada() {
  return useQuery(orpc.recompensas.minhaJornada.queryOptions({ staleTime: 15_000 }));
}

/** ranking de afiliados no admin */
export function useAfiliados() {
  return useQuery(orpc.recompensas.listar.queryOptions({ staleTime: 15_000 }));
}

export function useResumoRecompensas() {
  return useQuery(orpc.recompensas.resumo.queryOptions({ staleTime: 15_000 }));
}

export function useNotificacoesRecompensas() {
  return useQuery(orpc.recompensas.notificacoes.queryOptions({ staleTime: 15_000 }));
}

function useInvalidarRecompensas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.recompensas.key() });
}

export function useEntregarPremio() {
  const invalidar = useInvalidarRecompensas();
  return useMutation(orpc.recompensas.entregarPremio.mutationOptions({ onSuccess: invalidar }));
}

export function useMarcarNotificacaoLida() {
  const invalidar = useInvalidarRecompensas();
  return useMutation(
    orpc.recompensas.marcarNotificacaoLida.mutationOptions({ onSuccess: invalidar }),
  );
}
