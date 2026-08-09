import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * STORE DO DESBLOQUEIO NETFLIX.
 * O cliente fica olhando a tela esperando resposta, entao o polling e curto
 * dos dois lados: 10s no painel do cliente, 10s na fila do admin.
 */

export function useMinhaTelaNetflix() {
  return useQuery(
    orpc.netflix.minhaTela.queryOptions({ staleTime: 4_000, refetchInterval: 10_000 }),
  );
}

export function useFilaTvNetflix() {
  return useQuery(orpc.netflix.fila.queryOptions({ staleTime: 4_000, refetchInterval: 10_000 }));
}

function useInvalidarNetflix() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.netflix.key() });
}

export function useSolicitarTv() {
  const invalidar = useInvalidarNetflix();
  return useMutation(orpc.netflix.solicitarTv.mutationOptions({ onSuccess: invalidar }));
}

export function useCancelarTv() {
  const invalidar = useInvalidarNetflix();
  return useMutation(orpc.netflix.cancelarTv.mutationOptions({ onSuccess: invalidar }));
}

export function useResponderTv() {
  const invalidar = useInvalidarNetflix();
  return useMutation(orpc.netflix.responderTv.mutationOptions({ onSuccess: invalidar }));
}

/** "há 3 min" — a fila e de curtissimo prazo, minutos bastam */
export function haQuantoTempoTv(data: Date | string) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60_000));
  if (min < 1) return "agora mesmo";
  if (min === 1) return "há 1 minuto";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.floor(min / 60);
  return h === 1 ? "há 1 hora" : `há ${h} horas`;
}

export function horaCurta(data: Date | string) {
  return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
