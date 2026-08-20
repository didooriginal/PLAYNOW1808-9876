import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * STORE DAS OPÇÕES DE APLICATIVO (variantes) E DA FILA DE CONVITES.
 *
 * Um app pode ter versões com preços diferentes (Globoplay comum / Premium /
 * Premium + Telecine). A vitrine continua com um card por app; as opções
 * aparecem no momento de contratar avulso.
 */

/** catálogo agrupado: cada app já vem com as opções dele */
export function useCatalogoOpcoes() {
  return useQuery(orpc.planosDeApps.catalogo.queryOptions({ staleTime: 60_000 }));
}

function useInvalidarPlanos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.planosDeApps.key() });
    qc.invalidateQueries({ queryKey: orpc.aplicativos.key() });
  };
}

export function useCriarOpcaoApp() {
  const invalidar = useInvalidarPlanos();
  return useMutation(orpc.planosDeApps.criar.mutationOptions({ onSuccess: invalidar }));
}

export function useAtualizarOpcaoApp() {
  const invalidar = useInvalidarPlanos();
  return useMutation(orpc.planosDeApps.atualizar.mutationOptions({ onSuccess: invalidar }));
}

export function useRemoverOpcaoApp() {
  const invalidar = useInvalidarPlanos();
  return useMutation(orpc.planosDeApps.remover.mutationOptions({ onSuccess: invalidar }));
}

/* ------------------------------------------------------------------ */
/* CONVITES (membro extra)                                             */
/* ------------------------------------------------------------------ */

/** fila do admin: quem pediu cadastro por convite e ainda não foi atendido */
export function useFilaConvites() {
  return useQuery(orpc.planosDeApps.filaConvites.queryOptions({ staleTime: 15_000 }));
}

/** status dos convites do próprio cliente (painel) */
export function useMeusConvites() {
  return useQuery(orpc.planosDeApps.meusConvites.queryOptions({ staleTime: 15_000 }));
}

/** cliente informa o e-mail que quer usar no provedor */
export function usePedirConvite() {
  const qc = useQueryClient();
  return useMutation(
    orpc.planosDeApps.pedirConvite.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.planosDeApps.key() });
        qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
      },
    }),
  );
}

/** contas liberadas para convite individual, com as vagas e quem está em cada */
export function useContasDeConvite() {
  return useQuery(orpc.planosDeApps.contasDeConvite.queryOptions({ staleTime: 15_000 }));
}

/** admin lança o convite na mão (cliente mandou o e-mail por fora) */
export function useCriarConvite() {
  const qc = useQueryClient();
  return useMutation(
    orpc.planosDeApps.criarConvite.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.planosDeApps.key() });
        qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
      },
    }),
  );
}

/** admin move o convite: pendente → enviado → ativo (ou recusado) */
export function useAtualizarConvite() {
  const qc = useQueryClient();
  return useMutation(
    orpc.planosDeApps.atualizarConvite.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.planosDeApps.key() }),
    }),
  );
}
