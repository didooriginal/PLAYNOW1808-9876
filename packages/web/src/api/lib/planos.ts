import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { aplicativos, planosApps } from "../database/schema";

/** dinheiro sempre com 2 casas — evita 19.999999 virar preco */
const cent = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * RESOLVEDOR DE SERVIÇOS (app x opção).
 *
 * Depois que um app passou a ter versões com preços diferentes (Globoplay
 * comum / Premium / Premium+Telecine), o resto do sistema não pode mais
 * assumir que todo slug vendido está em `aplicativos`. Um slug vendido pode
 * ser:
 *  - o slug do app        → "globoplay"                (app sem opções)
 *  - o slug de uma opção  → "globoplay-premium-telecine"
 *
 * Tudo que precifica, aloca vaga ou mostra o nome do serviço passa por aqui,
 * então nenhum outro arquivo precisa saber que a tabela `planos_apps` existe.
 *
 * O slug da opção também é o identificador de ESTOQUE: cada opção tem a sua
 * conta matriz, porque na prática cada combinação é um login diferente.
 */

export type ServicoResolvido = {
  /** slug vendido/estocado — é o que vai para alocações e assinaturas */
  slug: string;
  /** nome completo mostrado ao cliente ("Globoplay · Premium + Telecine") */
  nome: string;
  /** preço de venda mensal */
  preco: number;
  /** preço de mercado, base do comparativo de economia */
  precoAvulso: number;
  /** vaga | convite — como o acesso chega ao cliente */
  entrega: "vaga" | "convite";
  /** slug do app "pai" (serve para ícone, cor e agrupamento na vitrine) */
  appSlug: string;
  /** id da opção, quando o slug vendido for uma opção */
  planoId: number | null;
  /** rótulo curto da opção ("Premium + Telecine"), null quando é o app puro */
  planoNome: string | null;
};

/**
 * Traduz uma lista de slugs (apps e/ou opções) em serviços completos.
 * Lança erro se algum slug não existir ou estiver inativo — o chamador nunca
 * deve seguir cobrando por um item que saiu do catálogo.
 */
export async function resolverServicos(slugs: string[]): Promise<ServicoResolvido[]> {
  const unicos = [...new Set(slugs)].filter(Boolean);
  if (unicos.length === 0) return [];

  const [apps, planos] = await Promise.all([
    db.select().from(aplicativos).where(inArray(aplicativos.slug, unicos)),
    db.select().from(planosApps).where(inArray(planosApps.slug, unicos)),
  ]);

  // os planos precisam do app pai para montar nome/ícone
  const idsPais = [...new Set(planos.map((p) => p.aplicativoId))];
  const pais = idsPais.length
    ? await db.select().from(aplicativos).where(inArray(aplicativos.id, idsPais))
    : [];
  const paiPorId = new Map(pais.map((a) => [a.id, a]));

  const resolvidos = new Map<string, ServicoResolvido>();

  for (const app of apps) {
    if (!app.ativo) continue;
    resolvidos.set(app.slug, {
      slug: app.slug,
      nome: app.nome,
      preco: app.preco || app.precoAvulso,
      precoAvulso: app.precoAvulso || app.preco,
      entrega: "vaga",
      appSlug: app.slug,
      planoId: null,
      planoNome: null,
    });
  }

  for (const plano of planos) {
    if (!plano.ativo) continue;
    const pai = paiPorId.get(plano.aplicativoId);
    if (!pai) continue;
    resolvidos.set(plano.slug, {
      slug: plano.slug,
      nome: `${pai.nome} · ${plano.nome}`,
      /**
       * O preco da OPCAO e a verdade absoluta, inclusive quando e 0.
       * Nunca cair no preco do app pai: era isso que fazia a Netflix
       * Individual (preco 0) ser cobrada com o valor da Compartilhada.
       */
      preco: cent(plano.preco),
      precoAvulso: cent(plano.precoAvulso || plano.preco),
      entrega: plano.entrega === "convite" ? "convite" : "vaga",
      appSlug: pai.slug,
      planoId: plano.id,
      planoNome: plano.nome,
    });
  }

  const faltando = unicos.filter((s) => !resolvidos.has(s));
  if (faltando.length)
    throw new Error(
      faltando.length === 1
        ? `O item "${faltando[0]}" saiu do catálogo — refaça a escolha.`
        : `Alguns itens saíram do catálogo (${faltando.join(", ")}) — refaça a escolha.`,
    );

  // devolve na ordem em que os slugs chegaram
  return unicos.map((s) => resolvidos.get(s)!);
}

/** versão de 1 slug só; devolve null em vez de lançar */
export async function resolverServico(slug: string): Promise<ServicoResolvido | null> {
  try {
    const [row] = await resolverServicos([slug]);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Opção que os PACOTES entregam para um app.
 * Pacote é fechado: o cliente não escolhe versão dentro dele. Se o app tiver
 * opções cadastradas, vale a marcada como `padrao`; sem padrão explícito, a
 * primeira da ordem. App sem opções devolve o próprio slug.
 */
export async function slugDePacote(appSlug: string): Promise<string> {
  const [app] = await db.select().from(aplicativos).where(eq(aplicativos.slug, appSlug));
  if (!app) return appSlug;

  const opcoes = await db
    .select()
    .from(planosApps)
    .where(and(eq(planosApps.aplicativoId, app.id), eq(planosApps.ativo, true)))
    .orderBy(asc(planosApps.ordem), asc(planosApps.id));

  if (opcoes.length === 0) return appSlug;
  const padrao = opcoes.find((o) => o.padrao) ?? opcoes[0];
  return padrao.slug;
}

/** aplica `slugDePacote` numa lista inteira (serviços de um pacote/combo) */
export async function slugsDePacote(appSlugs: string[]): Promise<string[]> {
  const saida: string[] = [];
  for (const s of appSlugs) saida.push(await slugDePacote(s));
  return [...new Set(saida)];
}

/**
 * Catálogo agrupado para a vitrine: cada app com as suas opções.
 * A vitrine continua mostrando UM card por app; as opções aparecem só quando
 * o cliente clica para contratar avulso.
 */
export async function catalogoComOpcoes() {
  const [apps, opcoes] = await Promise.all([
    db
      .select()
      .from(aplicativos)
      .orderBy(asc(aplicativos.ordem), asc(aplicativos.nome)),
    db.select().from(planosApps).orderBy(asc(planosApps.ordem), asc(planosApps.id)),
  ]);

  return apps.map((app) => {
    const minhas = opcoes.filter((o) => o.aplicativoId === app.id);
    const ativas = minhas.filter((o) => o.ativo);
    const padrao = ativas.find((o) => o.padrao) ?? ativas[0] ?? null;
    return {
      ...app,
      opcoes: minhas,
      /** preço exibido na vitrine: o da opção padrão quando o app tem opções */
      precoVitrine: padrao ? cent(padrao.preco) : app.preco,
      /** slug que o botão "contratar" usa quando ninguém escolhe nada */
      slugPadrao: padrao ? padrao.slug : app.slug,
      temOpcoes: ativas.length > 1,
    };
  });
}
