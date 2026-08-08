import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * STORE DA CENTRAL DE CÓDIGOS.
 * Códigos OTP são efêmeros (morrem em 1 hora), então aqui o refetch é curto e
 * automático — a central precisa reagir ao e-mail que acabou de chegar.
 */

export function useCodigos() {
  return useQuery(
    orpc.codigos.listar.queryOptions({ staleTime: 5_000, refetchInterval: 15_000 }),
  );
}

export function useMeuCodigo() {
  return useQuery(
    orpc.codigos.meuCodigo.queryOptions({ staleTime: 5_000, refetchInterval: 20_000 }),
  );
}

function useInvalidarCodigos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.codigos.key() });
}

export function useRegistrarEmailManual() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.registrarManual.mutationOptions({ onSuccess: invalidar }));
}

export function useVincularCodigo() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.vincular.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverCodigo() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.remover.mutationOptions({ onSuccess: invalidar }));
}

/** "há 3 min" — os códigos vivem 1 hora, então minutos bastam */
export function haQuantoTempo(data: Date | string) {
  const ms = Date.now() - new Date(data).getTime();
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "agora mesmo";
  if (min === 1) return "há 1 minuto";
  return `há ${min} minutos`;
}

/** minutos restantes antes da purga automática (1 hora) */
export function minutosRestantes(data: Date | string) {
  const passados = Math.floor((Date.now() - new Date(data).getTime()) / 60_000);
  return Math.max(0, 60 - passados);
}

export function horaBr(data: Date | string) {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
