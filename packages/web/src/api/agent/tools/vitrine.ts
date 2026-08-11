// Tools do VENDEDOR DA LANDING — leituras 100% PÚBLICAS.
//
// Este agente atende visitante anônimo, então nenhuma tool aqui toca em
// `usuarios`, `contas_matrizes`, `alocacoes`, `faturas`, senhas ou qualquer
// dado de cliente. Só catálogo: pacotes ativos, apps ativos e combos visíveis
// na landing — exatamente o que já aparece no site.
import { and, eq } from "drizzle-orm";
import { tool } from "ai";
import z from "zod";
import { db } from "../../database";
import { aplicativos, combos, pacotes } from "../../database/schema";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

async function nomesDosApps(slugs: string[]) {
  if (slugs.length === 0) return [];
  const rows = await db.select().from(aplicativos);
  const mapa = new Map(rows.map((a) => [a.slug, a.nome]));
  return slugs.map((s) => mapa.get(s) ?? s);
}

export function ferramentasDaVitrine() {
  return {
    /* ---------------------------------------------------------------- */
    pacotesDisponiveis: tool({
      description:
        "Lista os pacotes à venda com preço mensal, preço no anual, apps inclusos, benefícios e vagas restantes. Use sempre que a pergunta envolver plano, preço, quanto custa ou o que vem incluso.",
      inputSchema: z.object({}),
      async execute() {
        const rows = await db.select().from(pacotes).where(eq(pacotes.ativo, true));
        if (rows.length === 0) return "Nenhum pacote publicado no momento.";

        const lista = await Promise.all(
          rows.map(async (p) => {
            const apps = await nomesDosApps(p.servicos ?? []);
            return [
              `Pacote: ${p.nome}${p.badge ? ` (${p.badge})` : ""}`,
              p.tagline ? `Chamada: ${p.tagline}` : null,
              `Mensal: ${brl(p.preco)}`,
              p.precoAnual ? `No anual: ${brl(p.precoAnual)} por mês` : null,
              `Apps (${apps.length}): ${apps.join(", ") || "a definir"}`,
              (p.perks ?? []).length > 0 ? `Benefícios: ${(p.perks ?? []).join(" · ")}` : null,
              p.vagasRestantes > 0 ? `Vagas restantes: ${p.vagasRestantes}` : null,
            ]
              .filter(Boolean)
              .join("\n");
          }),
        );
        return lista.join("\n\n---\n\n");
      },
    }),

    /* ---------------------------------------------------------------- */
    appsDisponiveis: tool({
      description:
        "Lista os aplicativos/streamings disponíveis com categoria, preço avulso de mercado e preço na PLAYPLUSNOW. Use quando perguntarem se um app específico existe (ex.: 'tem Netflix?') ou quanto custa um app sozinho.",
      inputSchema: z.object({
        categoria: z
          .string()
          .optional()
          .describe("filtro opcional: streaming, esportes, musica, iptv, produtividade, asiatico"),
      }),
      async execute({ categoria }) {
        const rows = await db
          .select()
          .from(aplicativos)
          .where(
            categoria
              ? and(eq(aplicativos.ativo, true), eq(aplicativos.categoria, categoria))
              : eq(aplicativos.ativo, true),
          );
        if (rows.length === 0) return "Nenhum app encontrado com esse filtro.";
        return rows
          .map(
            (a) =>
              `${a.nome} — categoria ${a.categoria} · avulso no mercado ${brl(a.precoAvulso)} · na PLAYPLUSNOW ${brl(a.preco)}`,
          )
          .join("\n");
      },
    }),

    /* ---------------------------------------------------------------- */
    combosDisponiveis: tool({
      description:
        "Lista os combos promocionais visíveis na landing, com apps, preço promocional e preço cheio somado. Use quando o visitante quiser montar mais de um app ou pedir a melhor oferta.",
      inputSchema: z.object({}),
      async execute() {
        const rows = await db
          .select()
          .from(combos)
          .where(and(eq(combos.ativo, true), eq(combos.visivelLanding, true)));
        if (rows.length === 0) return "Nenhum combo publicado no momento.";

        const lista = await Promise.all(
          rows.map(async (c) => {
            const apps = await nomesDosApps(c.apps ?? []);
            const economia = Math.max(0, c.precoCheio - c.preco);
            return [
              `Combo: ${c.nome}${c.destaque ? " (destaque)" : ""}`,
              c.descricao ? `Descrição: ${c.descricao}` : null,
              `Apps: ${apps.join(", ") || "a definir"}`,
              `Preço: ${brl(c.preco)} por ${c.ciclo === "anual" ? "ano" : "mês"}`,
              economia > 0 ? `Preço cheio somado: ${brl(c.precoCheio)} (economia de ${brl(economia)})` : null,
            ]
              .filter(Boolean)
              .join("\n");
          }),
        );
        return lista.join("\n\n---\n\n");
      },
    }),
  };
}
