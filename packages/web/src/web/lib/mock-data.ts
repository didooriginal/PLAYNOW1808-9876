// CATÁLOGO ESTÁTICO + CONTEÚDO DE LANDING.
// Pacotes, contas matrizes, usuários, alocações, chamados, gamificação e
// faturas vêm do BANCO REAL (src/api/database/schema.ts) via os stores em
// src/web/queries/. Aqui ficam apenas:
//  - o catálogo de serviços (nome, ícone, cor, preço avulso), usado pelos
//    ícones, pelo comparativo e pelo montador à la carte da landing;
//  - conteúdo editorial da landing (depoimentos, stats) e as vitrines de
//    upgrades/novidades do painel do cliente, que ainda não têm tabela.

export const WHATSAPP_NUMBER = "5521964727746";

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export type Accent = "red" | "cyan" | "purple";

export type ServiceId =
  | "netflix"
  | "disney"
  | "prime"
  | "hbomax"
  | "paramount"
  | "appletv"
  | "spotify"
  | "youtube"
  | "crunchyroll"
  | "globoplay"
  | "star"
  | "deezer"
  | "canva"
  | "iptv";

export type Service = {
  id: ServiceId;
  name: string;
  /** monograma usado quando não existe logo de marca disponível */
  mono: string;
  /** cor da marca (usada em glow/ícone) */
  color: string;
  /** preço avulso PLAPLUSNOW (tabela oficial) — base do comparativo */
  retail: number;
  /** preço unitário dentro de um combo (mensal) */
  price: number;
  /** categoria do catálogo: Streaming | Esportes | Música | Produtividade | IPTV | Asiático */
  category: string;
};

export const services: Service[] = [
  { id: "netflix", name: "Netflix", mono: "N", color: "#e50914", retail: 20, price: 20, category: "Streaming" },
  { id: "disney", name: "Disney+", mono: "D+", color: "#4f8ef7", retail: 18.9, price: 18.9, category: "Streaming" },
  { id: "prime", name: "Amazon Prime Video", mono: "PV", color: "#00a8e1", retail: 15, price: 15, category: "Streaming" },
  { id: "hbomax", name: "HBO Max", mono: "MAX", color: "#8b5cf6", retail: 15, price: 15, category: "Streaming" },
  { id: "paramount", name: "Paramount+", mono: "P+", color: "#0064ff", retail: 15, price: 15, category: "Streaming" },
  { id: "appletv", name: "Apple TV+", mono: "TV+", color: "#d4d4d8", retail: 15, price: 15, category: "Streaming" },
  { id: "spotify", name: "Spotify", mono: "S", color: "#1db954", retail: 15, price: 15, category: "Música" },
  { id: "youtube", name: "YouTube Premium", mono: "YT", color: "#ff0033", retail: 15, price: 15, category: "Streaming" },
  { id: "crunchyroll", name: "Crunchyroll", mono: "CR", color: "#f47521", retail: 15, price: 15, category: "Asiático" },
  { id: "globoplay", name: "Globoplay", mono: "G", color: "#ff5722", retail: 20, price: 20, category: "Streaming" },
  { id: "star", name: "Star+", mono: "★+", color: "#e0b04a", retail: 15, price: 15, category: "Streaming" },
  { id: "deezer", name: "Deezer", mono: "DZ", color: "#a238ff", retail: 15, price: 15, category: "Música" },
  { id: "canva", name: "Canva Pro", mono: "C", color: "#00c4cc", retail: 15, price: 15, category: "Produtividade" },
  { id: "iptv", name: "IPTV + Canais ao vivo", mono: "IP", color: "#22d3ee", retail: 35, price: 35, category: "IPTV" },
];

/**
 * Apps cadastrados no banco (catálogo dinâmico do admin) são registrados aqui
 * em runtime, para que ícones e comparativos funcionem com qualquer slug novo
 * sem precisar tocar neste arquivo.
 */
const dynamicServices = new Map<string, Service>();

/** rotulo exibido para cada categoria do catalogo */
export const CATEGORIAS: Record<string, string> = {
  streaming: "Streaming",
  esportes: "Esportes",
  musica: "Música",
  produtividade: "Produtividade",
  iptv: "IPTV",
  asiatico: "Asiático",
};

export type AppDoCatalogo = {
  slug: string;
  nome: string;
  mono: string;
  cor: string;
  tipo: string;
  categoria?: string;
  precoAvulso: number;
  preco: number;
  ativo?: boolean;
};

/**
 * Registra o catalogo vindo do banco. O banco e a FONTE DE VERDADE de preco e
 * categoria, entao sobrescreve tambem os apps da lista estatica (que serve
 * apenas de fallback enquanto o fetch nao chega).
 */
export function registerServices(apps: AppDoCatalogo[]) {
  for (const app of apps) {
    const avulso = app.precoAvulso || app.preco || 0;
    const estatico = services.find((s) => s.id === app.slug);
    const registro: Service = {
      id: app.slug as ServiceId,
      name: app.nome,
      mono: app.mono || estatico?.mono || app.nome.slice(0, 2).toUpperCase(),
      color: app.cor || estatico?.color || "#22d3ee",
      retail: avulso,
      price: app.preco || avulso,
      category: CATEGORIAS[app.categoria ?? ""] ?? CATEGORIAS.streaming,
    };
    dynamicServices.set(app.slug, registro);
    if (estatico) Object.assign(estatico, registro);
  }
}

/** nunca lança: slug desconhecido vira um serviço genérico com monograma */
export const serviceById = (id: string): Service =>
  services.find((s) => s.id === id) ??
  dynamicServices.get(id) ?? {
    id: id as ServiceId,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    mono: id.slice(0, 2).toUpperCase(),
    color: "#22d3ee",
    retail: 0,
    price: 0,
    category: "Extra",
  };

/** soma de todos os apps comprados separadamente */
export const retailTotal = services.reduce((sum, s) => sum + s.retail, 0);

/** soma o preço avulso de uma lista de apps */
export function retailOf(items: string[]) {
  return items.reduce((sum, id) => sum + serviceById(id).retail, 0);
}

/** % de economia entre o preço avulso e o preço do combo */
export function savingsPct(retail: number, combo: number) {
  return Math.round((1 - combo / retail) * 100);
}

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  /** preço por mês quando pago no plano anual */
  yearlyMonthly: number;
  items: ServiceId[];
  accent: Accent;
  highlight?: boolean;
  badge?: string;
  perks: string[];
  slotsLeft: number;
};

export const plans: Plan[] = [
  {
    id: "pacote-03",
    name: "Pacote 03",
    tagline: "O combo essencial pra sair do zero",
    monthly: 34.9,
    yearlyMonthly: 27.9,
    items: ["netflix", "prime", "spotify"],
    accent: "cyan",
    perks: ["3 apps liberados", "1 tela por app", "Suporte no WhatsApp", "Troca de app em 24h"],
    slotsLeft: 12,
  },
  {
    id: "mega-promo",
    name: "Mega Promo",
    tagline: "O mais vendido — vídeo, música e anime",
    monthly: 59.9,
    yearlyMonthly: 47.9,
    items: ["netflix", "disney", "hbomax", "prime", "spotify", "youtube", "crunchyroll"],
    accent: "red",
    highlight: true,
    badge: "Mais vendido",
    perks: [
      "7 apps liberados",
      "Netflix em 4K",
      "Suporte prioritário 24/7",
      "Reposição automática de conta",
      "Garantia de 7 dias",
    ],
    slotsLeft: 5,
  },
  {
    id: "15-em-1",
    name: "15 em 1",
    tagline: "Tudo. Literalmente tudo.",
    monthly: 99.9,
    yearlyMonthly: 79.9,
    items: services.map((s) => s.id),
    accent: "purple",
    badge: "Completo",
    perks: [
      "Todos os apps do catálogo",
      "IPTV com canais ao vivo",
      "2 telas nos principais apps",
      "Gerente de conta dedicado",
      "Upgrades gratuitos vitalícios",
    ],
    slotsLeft: 3,
  },
];

/** descontos progressivos do montador à la carte */
export const builderTiers = [
  { min: 8, off: 0.2, label: "8+ apps · 20% OFF" },
  { min: 5, off: 0.15, label: "5+ apps · 15% OFF" },
  { min: 3, off: 0.1, label: "3+ apps · 10% OFF" },
];

export function builderDiscount(count: number) {
  return builderTiers.find((t) => count >= t.min) ?? null;
}

export type Testimonial = {
  name: string;
  handle: string;
  city: string;
  text: string;
  stars: number;
  since: string;
};

export const testimonials: Testimonial[] = [
  {
    name: "Camila Ribeiro",
    handle: "@camila.rib",
    city: "Rio de Janeiro · RJ",
    text: "Pagava quase R$ 210 por mês em assinaturas. Migrei pro combo de 7 apps e caiu pra R$ 59,90. Ainda não acredito.",
    stars: 5,
    since: "cliente há 1 ano",
  },
  {
    name: "Lucas Ferraz",
    handle: "@lucasferraz",
    city: "Belo Horizonte · MG",
    text: "Suporte responde em minutos no WhatsApp. Deu problema na conta do Max num sábado à noite e resolveram na hora.",
    stars: 5,
    since: "cliente há 8 meses",
  },
  {
    name: "Juliana Prado",
    handle: "@ju.prado",
    city: "Curitiba · PR",
    text: "Montei meu combo do jeito que eu quis: Netflix, Crunchyroll e Spotify. Painel mostra login e senha na hora.",
    stars: 5,
    since: "cliente há 5 meses",
  },
  {
    name: "Rafael Monteiro",
    handle: "@rafa.monteiro",
    city: "Recife · PE",
    text: "Já tô no segundo ano. Nunca perdi acesso, e quando a matriz cai eles repõem antes de eu reclamar.",
    stars: 5,
    since: "cliente há 2 anos",
  },
  {
    name: "Beatriz Aguiar",
    handle: "@bia.aguiar",
    city: "São Paulo · SP",
    text: "O plano anual saiu com 2 meses grátis. Melhor custo-benefício que achei em qualquer lugar.",
    stars: 5,
    since: "cliente há 11 meses",
  },
  {
    name: "Diego Nunes",
    handle: "@dieguinho.n",
    city: "Porto Alegre · RS",
    text: "Instalei o IPTV na TV da sala em 10 minutos com o tutorial deles. Canal de futebol sem travar.",
    stars: 5,
    since: "cliente há 4 meses",
  },
];

export const socialStats = [
  { value: "12.4k", label: "assinaturas ativas" },
  { value: "4.9/5", label: "nota média (2.318 avaliações)" },
  { value: "R$ 1,8M", label: "economizados pelos clientes" },
  { value: "< 3 min", label: "tempo médio de suporte" },
];

/* ------------------------------------------------------------------ */
/* PAINEL DO CLIENTE                                                   */
/* ------------------------------------------------------------------ */


export type Upgrade = {
  title: string;
  description: string;
  price: string;
  tag: string;
  accent: Accent;
};

export const upgrades: Upgrade[] = [
  {
    title: "Adicionar IPTV + Canais ao vivo",
    description: "Mais de 3.200 canais, futebol em 4K e PPV incluso. Instalação guiada em qualquer TV.",
    price: "+ R$ 19,90/mês",
    tag: "Novo",
    accent: "cyan",
  },
  {
    title: "Subir para o 15 em 1",
    description: "Libere os 14 apps do catálogo e ganhe 2 telas nos principais. Você já usa 7.",
    price: "+ R$ 40,00/mês",
    tag: "Upgrade",
    accent: "red",
  },
  {
    title: "Trocar para o plano anual",
    description: "Mesmo pacote, 2 meses grátis e preço travado contra reajuste por 12 meses.",
    price: "R$ 47,90/mês",
    tag: "Economize R$ 144",
    accent: "purple",
  },
  {
    title: "Segunda tela na Netflix",
    description: "Uma tela extra para outra pessoa da casa, com perfil e PIN separados.",
    price: "+ R$ 12,90/mês",
    tag: "Popular",
    accent: "cyan",
  },
];


export const clientNews = [
  {
    date: "05/08/2026",
    title: "Paramount+ entrou no catálogo",
    body: "Já disponível para adicionar em qualquer combo por R$ 8,90/mês.",
  },
  {
    date: "28/07/2026",
    title: "Manutenção programada nas matrizes HBO Max",
    body: "Trocas de senha das contas Max acontecem toda segunda, entre 3h e 5h.",
  },
  {
    date: "14/07/2026",
    title: "Novo app de indicação",
    body: "Indique um amigo e ganhe 30 dias grátis quando ele assinar qualquer pacote.",
  },
];


/* ------------------------------------------------------------------ */

export function brl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
