import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * STORE DA ATIVACAO DO IPTV (app Fun Play).
 * O cliente manda o MAC e fica esperando a liberacao, e o admin precisa ver o
 * pedido na hora — polling de 15s dos dois lados (a ativacao e manual no
 * servidor, entao nao precisa ser tao curto quanto o da TV Netflix).
 */

export function useMinhaAtivacaoIptv() {
  return useQuery(
    orpc.iptv.minhaAtivacao.queryOptions({ staleTime: 5_000, refetchInterval: 15_000 }),
  );
}

export function useFilaIptv() {
  return useQuery(orpc.iptv.fila.queryOptions({ staleTime: 5_000, refetchInterval: 15_000 }));
}

function useInvalidarIptv() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.iptv.key() });
}

export function useEnviarMac() {
  const invalidar = useInvalidarIptv();
  return useMutation(orpc.iptv.enviarMac.mutationOptions({ onSuccess: invalidar }));
}

export function useCancelarMac() {
  const invalidar = useInvalidarIptv();
  return useMutation(orpc.iptv.cancelarMac.mutationOptions({ onSuccess: invalidar }));
}

export function useResponderIptv() {
  const invalidar = useInvalidarIptv();
  return useMutation(orpc.iptv.responder.mutationOptions({ onSuccess: invalidar }));
}

/**
 * Formata enquanto o cliente digita: "aabbcc" -> "AA:BB:CC".
 * Mesma normalizacao do backend (lib/iptv.ts), so que visual.
 */
export function formatarMac(bruto: string) {
  const hex = (bruto || "").toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 12);
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

export function macCompleto(mac: string) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
}

export function dataHoraCurta(data: Date | string) {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
