import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** CENTRAL DE ALERTAS — fila do admin e avisos do cliente */

export function useAlertasAdmin(apenasNaoLidas = false, incluirResolvidos = false) {
  return useQuery(
    orpc.notificacoes.listar.queryOptions({
      input: { apenasNaoLidas, incluirResolvidos },
      staleTime: 15_000,
      refetchInterval: 30_000,
    }),
  );
}

export function useMeusAvisos() {
  return useQuery(
    orpc.notificacoes.minhas.queryOptions({ staleTime: 15_000, refetchInterval: 30_000 }),
  );
}

function useInvalidarAlertas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.notificacoes.key() });
}

export function useMarcarLida() {
  const invalidar = useInvalidarAlertas();
  return useMutation(orpc.notificacoes.marcarLida.mutationOptions({ onSuccess: invalidar }));
}

export function useMarcarTodasLidas() {
  const invalidar = useInvalidarAlertas();
  return useMutation(orpc.notificacoes.marcarTodas.mutationOptions({ onSuccess: invalidar }));
}

/** Botao "resolvido": encerra (ou reabre) um alerta da fila do admin. */
export function useResolverAlerta() {
  const invalidar = useInvalidarAlertas();
  return useMutation(orpc.notificacoes.resolver.mutationOptions({ onSuccess: invalidar }));
}

export function useVarrerVencimentos() {
  const qc = useQueryClient();
  return useMutation(
    orpc.notificacoes.varrer.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.notificacoes.key() });
        qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
      },
    }),
  );
}

/** "há 4 min", "há 2 h", "ontem" */
export function haQuantoTempo(data: Date | string) {
  const d = typeof data === "string" ? new Date(data) : data;
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}
