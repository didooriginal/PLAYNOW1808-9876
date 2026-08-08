// CATÁLOGO ESTÁTICO + MOCKS RESTANTES.
// Pacotes, contas matrizes e usuários agora vêm do BANCO REAL (src/api/database/schema.ts)
// via os stores em src/web/queries/. Aqui ficam apenas:
//  - o catálogo de serviços (nome, ícone, cor, preço avulso) usado pelos ícones e comparativos
//  - conteúdo da landing (depoimentos, stats) e o que ainda não tem tabela
//    (faturas, novidades, upgrades, série histórica de MRR).

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
  /** preço avulso "de mercado" — usado no comparativo */
  retail: number;
  /** preço dentro do combo PLAPLUSNOW (mensal) */
  price: number;
  category: "Vídeo" | "Música" | "Extra";
};

export const services: Service[] = [
  { id: "netflix", name: "Netflix", mono: "N", color: "#e50914", retail: 59.9, price: 14.9, category: "Vídeo" },
  { id: "disney", name: "Disney+", mono: "D+", color: "#4f8ef7", retail: 43.9, price: 12.9, category: "Vídeo" },
  { id: "prime", name: "Prime Video", mono: "PV", color: "#00a8e1", retail: 19.9, price: 8.9, category: "Vídeo" },
  { id: "hbomax", name: "HBO Max", mono: "MAX", color: "#8b5cf6", retail: 55.9, price: 13.9, category: "Vídeo" },
  { id: "paramount", name: "Paramount+", mono: "P+", color: "#0064ff", retail: 19.9, price: 8.9, category: "Vídeo" },
  { id: "appletv", name: "Apple TV+", mono: "TV+", color: "#d4d4d8", retail: 21.9, price: 9.9, category: "Vídeo" },
  { id: "spotify", name: "Spotify", mono: "S", color: "#1db954", retail: 21.9, price: 9.9, category: "Música" },
  { id: "youtube", name: "YouTube Premium", mono: "YT", color: "#ff0033", retail: 24.9, price: 10.9, category: "Vídeo" },
  { id: "crunchyroll", name: "Crunchyroll", mono: "CR", color: "#f47521", retail: 16.9, price: 7.9, category: "Vídeo" },
  { id: "globoplay", name: "Globoplay", mono: "G", color: "#ff5722", retail: 49.9, price: 12.9, category: "Vídeo" },
  { id: "star", name: "Star+", mono: "★+", color: "#e0b04a", retail: 39.9, price: 11.9, category: "Vídeo" },
  { id: "deezer", name: "Deezer", mono: "DZ", color: "#a238ff", retail: 19.9, price: 8.9, category: "Música" },
  { id: "canva", name: "Canva Pro", mono: "C", color: "#00c4cc", retail: 34.9, price: 9.9, category: "Extra" },
  { id: "iptv", name: "IPTV + Canais ao vivo", mono: "IP", color: "#22d3ee", retail: 89.9, price: 19.9, category: "Extra" },
];

/**
 * Apps cadastrados no banco (catálogo dinâmico do admin) são registrados aqui
 * em runtime, para que ícones e comparativos funcionem com qualquer slug novo
 * sem precisar tocar neste arquivo.
 */
const dynamicServices = new Map<string, Service>();

export function registerServices(
  apps: { slug: string; nome: string; mono: string; cor: string; tipo: string; precoAvulso: number }[],
) {
  for (const app of apps) {
    if (services.some((s) => s.id === app.slug)) continue;
    dynamicServices.set(app.slug, {
      id: app.slug as ServiceId,
      name: app.nome,
      mono: app.mono || app.nome.slice(0, 2).toUpperCase(),
      color: app.cor || "#22d3ee",
      retail: app.precoAvulso || 0,
      price: 0,
      category: app.tipo === "musica" ? "Música" : app.tipo === "extra" ? "Extra" : "Vídeo",
    });
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

export type Credential = {
  service: ServiceId;
  email: string;
  password: string;
  profile: string;
  pin?: string;
  status: "ativo" | "manutencao";
  screens: string;
};

export const currentUser = {
  name: "Diego Dias Silva",
  email: "diego.silva@email.com",
  initials: "DS",
  plan: "Mega Promo",
  cycle: "Mensal",
  price: 59.9,
  memberSince: "12/03/2025",
  nextCharge: "12/09/2026",
  daysLeft: 36,
  savedPerMonth: 158.4,
  status: "Ativo" as const,
};

export const myAccess: Credential[] = [
  {
    service: "netflix",
    email: "matriz.ntf07@plaplusnow.com",
    password: "Ppn#N7x2026",
    profile: "Perfil 3 — DIEGO",
    pin: "4417",
    status: "ativo",
    screens: "1 tela · 4K HDR",
  },
  {
    service: "disney",
    email: "matriz.dsn12@plaplusnow.com",
    password: "Dsn!2026plus",
    profile: "Perfil DIEGO",
    status: "ativo",
    screens: "1 tela · Full HD",
  },
  {
    service: "hbomax",
    email: "matriz.max03@plaplusnow.com",
    password: "MaxPpn@0399",
    profile: "Perfil 2 — DIEGO",
    status: "manutencao",
    screens: "1 tela · Full HD",
  },
  {
    service: "prime",
    email: "matriz.prv21@plaplusnow.com",
    password: "Prv#2026ppn",
    profile: "Perfil DIEGO",
    status: "ativo",
    screens: "1 tela · 4K",
  },
  {
    service: "spotify",
    email: "matriz.spt09@plaplusnow.com",
    password: "Spt$Fam2026",
    profile: "Membro família 4",
    status: "ativo",
    screens: "Conta individual",
  },
  {
    service: "youtube",
    email: "matriz.ytb05@plaplusnow.com",
    password: "Ytb@Prem26!",
    profile: "Membro família 2",
    status: "ativo",
    screens: "Sem anúncios + Music",
  },
  {
    service: "crunchyroll",
    email: "matriz.crl02@plaplusnow.com",
    password: "Crl!Mega2026",
    profile: "Perfil DIEGO",
    status: "ativo",
    screens: "1 tela · Mega Fan",
  },
];

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

export type Invoice = {
  id: string;
  ref: string;
  amount: number;
  due: string;
  status: "pago" | "aberto" | "vencido";
  method: string;
};

export const myInvoices: Invoice[] = [
  { id: "#PPN-2026-0842", ref: "Setembro/2026", amount: 59.9, due: "12/09/2026", status: "aberto", method: "PIX" },
  { id: "#PPN-2026-0761", ref: "Agosto/2026", amount: 59.9, due: "12/08/2026", status: "pago", method: "PIX" },
  { id: "#PPN-2026-0688", ref: "Julho/2026", amount: 59.9, due: "12/07/2026", status: "pago", method: "Cartão ••4417" },
  { id: "#PPN-2026-0604", ref: "Junho/2026", amount: 59.9, due: "12/06/2026", status: "pago", method: "PIX" },
  { id: "#PPN-2026-0531", ref: "Maio/2026", amount: 54.9, due: "12/05/2026", status: "pago", method: "PIX" },
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
/* PAINEL ADMIN                                                        */
/* ------------------------------------------------------------------ */

export const adminStats = [
  { label: "Clientes ativos", value: "1.248", delta: "+8,4% no mês", accent: "cyan" as Accent, icon: "users" },
  { label: "Faturas a vencer", value: "37", delta: "R$ 2.412 previstos", accent: "purple" as Accent, icon: "receipt" },
  { label: "Receita mensal (MRR)", value: "R$ 74.9k", delta: "+R$ 6.1k vs. julho", accent: "cyan" as Accent, icon: "trending" },
  { label: "Contas esgotadas", value: "6", delta: "reposição pendente", accent: "red" as Accent, icon: "alert" },
];

export type MasterAccount = {
  id: string;
  service: ServiceId;
  label: string;
  login: string;
  used: number;
  total: number;
  renewal: string;
  cost: number;
  region: string;
};

export const masterAccounts: MasterAccount[] = [
  { id: "ntf-01", service: "netflix", label: "Netflix — Conta Matriz 01", login: "matriz.ntf01@plaplusnow.com", used: 5, total: 5, renewal: "18/08/2026", cost: 59.9, region: "BR" },
  { id: "ntf-07", service: "netflix", label: "Netflix — Conta Matriz 07", login: "matriz.ntf07@plaplusnow.com", used: 4, total: 5, renewal: "24/08/2026", cost: 59.9, region: "BR" },
  { id: "dsn-12", service: "disney", label: "Disney+ — Conta Matriz 12", login: "matriz.dsn12@plaplusnow.com", used: 3, total: 4, renewal: "02/09/2026", cost: 43.9, region: "BR" },
  { id: "max-03", service: "hbomax", label: "HBO Max — Conta Matriz 03", login: "matriz.max03@plaplusnow.com", used: 5, total: 5, renewal: "11/08/2026", cost: 55.9, region: "BR" },
  { id: "spt-09", service: "spotify", label: "Spotify — Família 09", login: "matriz.spt09@plaplusnow.com", used: 5, total: 6, renewal: "29/08/2026", cost: 34.9, region: "BR" },
  { id: "prv-21", service: "prime", label: "Prime Video — Matriz 21", login: "matriz.prv21@plaplusnow.com", used: 2, total: 4, renewal: "07/09/2026", cost: 19.9, region: "BR" },
  { id: "ytb-05", service: "youtube", label: "YouTube — Família 05", login: "matriz.ytb05@plaplusnow.com", used: 5, total: 5, renewal: "15/08/2026", cost: 45.9, region: "BR" },
  { id: "crl-02", service: "crunchyroll", label: "Crunchyroll — Matriz 02", login: "matriz.crl02@plaplusnow.com", used: 1, total: 4, renewal: "21/09/2026", cost: 16.9, region: "BR" },
  { id: "glb-04", service: "globoplay", label: "Globoplay — Matriz 04", login: "matriz.glb04@plaplusnow.com", used: 4, total: 5, renewal: "03/09/2026", cost: 49.9, region: "BR" },
  { id: "par-08", service: "paramount", label: "Paramount+ — Matriz 08", login: "matriz.par08@plaplusnow.com", used: 2, total: 5, renewal: "27/08/2026", cost: 19.9, region: "BR" },
  { id: "iptv-01", service: "iptv", label: "IPTV — Servidor Alpha 01", login: "srv-alpha01.ppn", used: 48, total: 60, renewal: "01/09/2026", cost: 320, region: "BR/US" },
  { id: "cnv-01", service: "canva", label: "Canva Pro — Equipe 01", login: "matriz.cnv01@plaplusnow.com", used: 5, total: 5, renewal: "19/08/2026", cost: 34.9, region: "Global" },
];

export type AdminClient = {
  name: string;
  email: string;
  plan: string;
  apps: number;
  value: number;
  status: "ativo" | "vencendo" | "inadimplente";
  next: string;
};

export const adminClients: AdminClient[] = [
  { name: "Diego Dias Silva", email: "diego.silva@email.com", plan: "Mega Promo", apps: 7, value: 59.9, status: "ativo", next: "12/09/2026" },
  { name: "Camila Ribeiro", email: "camila.rib@email.com", plan: "15 em 1", apps: 14, value: 99.9, status: "ativo", next: "20/09/2026" },
  { name: "Lucas Ferraz", email: "lucas.ferraz@email.com", plan: "Pacote 03", apps: 3, value: 34.9, status: "vencendo", next: "09/08/2026" },
  { name: "Juliana Prado", email: "ju.prado@email.com", plan: "Combo montado", apps: 4, value: 41.5, status: "ativo", next: "28/08/2026" },
  { name: "Rafael Monteiro", email: "rafa.monteiro@email.com", plan: "Mega Promo (anual)", apps: 7, value: 574.8, status: "ativo", next: "02/02/2027" },
  { name: "Beatriz Aguiar", email: "bia.aguiar@email.com", plan: "15 em 1 (anual)", apps: 14, value: 958.8, status: "ativo", next: "17/11/2026" },
  { name: "Marcos Tavares", email: "marcos.tv@email.com", plan: "Pacote 03", apps: 3, value: 34.9, status: "inadimplente", next: "26/07/2026" },
  { name: "Fernanda Lopes", email: "fer.lopes@email.com", plan: "Combo montado", apps: 6, value: 55.2, status: "vencendo", next: "10/08/2026" },
];

export const adminQueue = [
  { title: "Repor Netflix Matriz 01", detail: "5/5 vagas ocupadas · 3 clientes na fila de espera", accent: "red" as Accent },
  { title: "Trocar senha HBO Max Matriz 03", detail: "Login em manutenção desde 06/08 às 03:10", accent: "purple" as Accent },
  { title: "Cobrar Marcos Tavares", detail: "Fatura #PPN-2026-0712 vencida há 12 dias", accent: "red" as Accent },
  { title: "Renovar IPTV Servidor Alpha 01", detail: "Vence em 01/09 · 48/60 conexões ativas", accent: "cyan" as Accent },
];

export const revenueSeries = [
  { month: "Fev", value: 44 },
  { month: "Mar", value: 51 },
  { month: "Abr", value: 49 },
  { month: "Mai", value: 58 },
  { month: "Jun", value: 63 },
  { month: "Jul", value: 68.8 },
  { month: "Ago", value: 74.9 },
];

/* ------------------------------------------------------------------ */

export function brl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
