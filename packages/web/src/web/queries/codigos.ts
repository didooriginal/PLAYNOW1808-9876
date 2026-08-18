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
    // polling curto: depois de pedir, o codigo chega em segundos
    orpc.codigos.meuCodigo.queryOptions({ staleTime: 2_000, refetchInterval: 5_000 }),
  );
}

/** fila de pedidos em aberto (admin) */
export function usePedidosAbertos() {
  return useQuery(
    orpc.codigos.pedidosAbertos.queryOptions({ staleTime: 5_000, refetchInterval: 15_000 }),
  );
}

/**
 * Caixa de entrada do webhook (admin): e-mails brutos com o corpo completo,
 * inclusive os que não tinham código nenhum.
 */
export function useCaixaEntrada(busca: string) {
  return useQuery(
    orpc.codigos.caixaEntrada.queryOptions({
      input: { busca: busca || undefined, limite: 60 },
      staleTime: 5_000,
      refetchInterval: 20_000,
    }),
  );
}

export function useFixarEmail() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.fixarEmail.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverEmail() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.removerEmail.mutationOptions({ onSuccess: invalidar }));
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

/** "Pedi o código agora" — abre a janela de entrega para ESTE cliente */
export function usePedirCodigo() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.pedirCodigo.mutationOptions({ onSuccess: invalidar }));
}

export function useCancelarPedido() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.cancelarPedido.mutationOptions({ onSuccess: invalidar }));
}

/** "já usei este código" — tira o código da tela na hora */
export function useMarcarUsado() {
  const invalidar = useInvalidarCodigos();
  return useMutation(orpc.codigos.marcarUsado.mutationOptions({ onSuccess: invalidar }));
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

/** "04:37" — contagem regressiva até a data informada */
export function contagem(ate: Date | string | null | undefined) {
  if (!ate) return "00:00";
  const ms = new Date(ate).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const seg = String(total % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

export function horaBr(data: Date | string) {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
