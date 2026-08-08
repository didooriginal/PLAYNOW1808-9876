import { useMemo } from "react";
import { plans as planosFallback, services, type Plan, type ServiceId } from "@/lib/mock-data";
import { usePacotes } from "./pacotes";

/**
 * PONTE BANCO → LANDING
 * A landing foi escrita contra o tipo `Plan` (mock). Aqui os registros da tabela
 * `pacotes` são traduzidos para esse mesmo formato, então hero/economia/pacotes
 * passam a renderizar dados reais sem reescrever os componentes.
 * Enquanto a query carrega (ou se a tabela estiver vazia) cai no catálogo estático.
 */

const idsValidos = new Set<string>(services.map((s) => s.id));

const slug = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type PacoteRow = NonNullable<ReturnType<typeof usePacotes>["data"]>[number];

export function pacoteParaPlano(p: PacoteRow): Plan {
  const items = (p.servicos ?? []).filter((s): s is ServiceId => idsValidos.has(s));
  return {
    id: slug(p.nome) || `pacote-${p.id}`,
    name: p.nome,
    tagline: p.tagline,
    monthly: p.preco,
    // sem preço anual cadastrado: 20% off equivale aos "2 meses grátis" do site
    yearlyMonthly: p.precoAnual ?? Number((p.preco * 0.8).toFixed(2)),
    items,
    accent: (p.accent as Plan["accent"]) ?? "cyan",
    highlight: p.destaque,
    badge: p.badge ?? undefined,
    perks: p.perks?.length ? p.perks : [`${items.length} apps liberados`, "Suporte no WhatsApp"],
    slotsLeft: p.vagasRestantes,
  };
}

/** pacotes ativos do banco no formato da landing (com fallback estático) */
export function usePlanos() {
  const query = usePacotes();

  const planos = useMemo<Plan[]>(() => {
    const ativos = (query.data ?? []).filter((p) => p.ativo);
    if (!ativos.length) return planosFallback;
    return ativos.map(pacoteParaPlano);
  }, [query.data]);

  return { planos, isPending: query.isPending, isError: query.isError };
}

/** pacote em destaque — base dos comparativos do hero e da seção de economia */
export function usePlanoDestaque() {
  const { planos } = usePlanos();
  return useMemo(
    () => planos.find((p) => p.highlight) ?? planos[planos.length > 1 ? 1 : 0] ?? planosFallback[1],
    [planos],
  );
}
