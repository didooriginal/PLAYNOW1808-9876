import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * FILA DE WHATSAPP — painel de disparo manual do admin.
 * Os 7 eventos entram sozinhos; aqui o admin envia e marca como enviado.
 */

type Filtro = {
  status?: "pendente" | "enviado" | "descartado" | "todos";
  evento?:
    | "vencimento"
    | "pagamento"
    | "acesso"
    | "convite"
    | "atraso"
    | "winback"
    | "promocao"
    | "todos";
  limite?: number;
};

export function useFilaWhats(filtro: Filtro = {}) {
  return useQuery(orpc.filaWhats.listar.queryOptions({ input: filtro, staleTime: 10_000 }));
}

function invalida(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: orpc.filaWhats.key() });
}

export function useMarcarEnviadoWhats() {
  const qc = useQueryClient();
  return useMutation(orpc.filaWhats.marcarEnviado.mutationOptions({ onSuccess: () => invalida(qc) }));
}

export function useDescartarWhats() {
  const qc = useQueryClient();
  return useMutation(orpc.filaWhats.descartar.mutationOptions({ onSuccess: () => invalida(qc) }));
}

export function useLimparTratadosWhats() {
  const qc = useQueryClient();
  return useMutation(orpc.filaWhats.limparTratados.mutationOptions({ onSuccess: () => invalida(qc) }));
}

export function useDispararPromocao() {
  const qc = useQueryClient();
  return useMutation(orpc.filaWhats.promocao.mutationOptions({ onSuccess: () => invalida(qc) }));
}
