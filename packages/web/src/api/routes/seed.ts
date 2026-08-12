import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { aplicativos, bannersAfiliados, combos, contasMatrizes, pacotes, usuarios } from "../database/schema";

/**
 * Popula o banco com o catálogo inicial da operação.
 * Idempotente: só roda quando as tabelas estão vazias (use `force: true` para recriar).
 */

const PACOTES = [
  {
    nome: "Pacote 03",
    tagline: "O combo essencial pra sair do zero",
    preco: 34.9,
    precoAnual: 27.9,
    servicos: ["netflix", "prime", "spotify"],
    perks: ["3 apps liberados", "1 tela por app", "Suporte no WhatsApp", "Troca de app em 24h"],
    accent: "cyan",
    badge: null as string | null,
    destaque: false,
    vagasRestantes: 12,
  },
  {
    nome: "Turbo",
    tagline: "O mais vendido — 10 apps por um preço só",
    preco: 49,
    precoAnual: 39.2,
    servicos: ["disney", "hbomax", "paramount", "prime", "looke", "globoplay", "youtube", "recordplus", "crunchyroll", "spotify"],
    perks: [
      "10 apps liberados",
      "Disney+, HBO Max e Prime inclusos",
      "Globoplay com os canais Telecine e Looke pra cinema em casa",
      "Suporte prioritário 24/7 no WhatsApp",
      "Reposição automática de conta",
      "Sem fidelidade: cancele quando quiser",
    ],
    accent: "red",
    badge: "Mais vendido",
    destaque: true,
    vagasRestantes: 5,
  },
  {
    nome: "15 em 1",
    tagline: "Tudo. Literalmente tudo.",
    preco: 99.9,
    precoAnual: 79.9,
    servicos: [
      "netflix",
      "disney",
      "prime",
      "hbomax",
      "paramount",
      "appletv",
      "spotify",
      "youtube",
      "crunchyroll",
      "globoplay",
      "deezer",
      "canva",
      "looke",
      "recordplus",
      "iptv",
    ],
    perks: [
      "Todos os apps do catálogo",
      "IPTV com canais ao vivo",
      "2 telas nos principais apps",
      "Gerente de conta dedicado",
      "Upgrades gratuitos vitalícios",
    ],
    accent: "purple",
    badge: "Completo",
    destaque: false,
    vagasRestantes: 3,
  },
];

/**
 * CATÁLOGO OFICIAL DE APPS.
 * `precoAvulso` é o preço de tabela cobrado pelo próprio serviço em agosto/2026 —
 * é ele que alimenta o comparativo "Do jeito tradicional" da landing e o cálculo
 * de economia do painel. `preco` é quanto a PLAYPLUSNOW cobra pelo app avulso.
 */
const APLICATIVOS = [
  { slug: "netflix", nome: "Netflix", mono: "N", cor: "#e50914", tipo: "video", categoria: "streaming", precoAvulso: 59.9, preco: 24.9 },
  { slug: "disney", nome: "Disney+", mono: "D+", cor: "#4f8ef7", tipo: "video", categoria: "streaming", precoAvulso: 43.9, preco: 19.9 },
  { slug: "hbomax", nome: "HBO Max", mono: "MAX", cor: "#8b5cf6", tipo: "video", categoria: "streaming", precoAvulso: 55.9, preco: 22.9 },
  { slug: "prime", nome: "Amazon Prime Video", mono: "PV", cor: "#00a8e1", tipo: "video", categoria: "streaming", precoAvulso: 20, preco: 12.9 },
  { slug: "spotify", nome: "Spotify", mono: "S", cor: "#1db954", tipo: "musica", categoria: "musica", precoAvulso: 21.9, preco: 14.9 },
  { slug: "youtube", nome: "YouTube Premium", mono: "YT", cor: "#ff0033", tipo: "video", categoria: "streaming", precoAvulso: 25.9, preco: 16.9 },
  { slug: "crunchyroll", nome: "Crunchyroll", mono: "CR", cor: "#f47521", tipo: "video", categoria: "asiatico", precoAvulso: 24.9, preco: 14.9 },
  { slug: "paramount", nome: "Paramount+", mono: "P+", cor: "#0064ff", tipo: "video", categoria: "streaming", precoAvulso: 19.9, preco: 12.9 },
  { slug: "appletv", nome: "Apple TV+", mono: "TV+", cor: "#d4d4d8", tipo: "video", categoria: "streaming", precoAvulso: 21.9, preco: 13.9 },
  { slug: "globoplay", nome: "Globoplay", mono: "G", cor: "#ff5722", tipo: "video", categoria: "streaming", precoAvulso: 24.9, preco: 16.9 },
  { slug: "deezer", nome: "Deezer", mono: "DZ", cor: "#a238ff", tipo: "musica", categoria: "musica", precoAvulso: 20.9, preco: 13.9 },
  { slug: "canva", nome: "Canva Pro", mono: "C", cor: "#00c4cc", tipo: "extra", categoria: "produtividade", precoAvulso: 34.9, preco: 19.9 },
  { slug: "looke", nome: "Looke", mono: "LK", cor: "#e8112d", tipo: "video", categoria: "streaming", precoAvulso: 19.9, preco: 12.9 },
  { slug: "recordplus", nome: "Record Plus", mono: "R+", cor: "#00a3e0", tipo: "video", categoria: "streaming", precoAvulso: 14.9, preco: 9.9 },
  { slug: "iptv", nome: "IPTV + Canais ao vivo", mono: "IP", cor: "#22d3ee", tipo: "video", categoria: "iptv", precoAvulso: 45, preco: 29.9 },
  { slug: "jogos", nome: "Futebol Ao Vivo", mono: "FV", cor: "#ff1f3d", tipo: "extra", categoria: "streaming", precoAvulso: 39.9, preco: 9.9 },
];

/**
 * Apps que saíram do ar e não são mais vendidos. Ficam listados aqui para que o
 * seed limpe as sobras do banco (catálogo, contas matrizes e itens de pacote).
 * Star+ foi encerrado no Brasil — o acervo virou a aba Star dentro do Disney+.
 * Hulu não existe como assinatura separada: o catálogo é entregue dentro do
 * Disney+. Telecine encerrou o streaming próprio e virou área do Globoplay.
 * Em todos os casos o app "some" do catálogo porque quem entrega é outro app,
 * que já está nos pacotes — o cliente não perde acervo.
 */
const DESCONTINUADOS = ["star", "hulu", "telecine"];

/**
 * Sincroniza o catálogo de apps. Roda SEMPRE (mesmo em banco já povoado):
 * é o que mantém o preço de tabela do comparativo de economia atualizado e o
 * que remove os serviços descontinuados de bancos antigos.
 */
export async function semearAplicativos() {
  for (const slug of DESCONTINUADOS) {
    await db.delete(aplicativos).where(eq(aplicativos.slug, slug));
    await db.delete(contasMatrizes).where(eq(contasMatrizes.servico, slug));
  }

  // limpa as sobras dentro dos pacotes e combos já cadastrados: sem isso o
  // card do site continuaria listando um app que não existe mais no catálogo.
  const pacotesSalvos = await db.select().from(pacotes);
  for (const p of pacotesSalvos) {
    const limpos = (p.servicos ?? []).filter((slug) => !DESCONTINUADOS.includes(slug));
    if (limpos.length !== (p.servicos ?? []).length) {
      await db.update(pacotes).set({ servicos: limpos }).where(eq(pacotes.id, p.id));
    }
  }
  const combosSalvos = await db.select().from(combos);
  for (const c of combosSalvos) {
    const limpos = (c.apps ?? []).filter((slug) => !DESCONTINUADOS.includes(slug));
    if (limpos.length !== (c.apps ?? []).length) {
      await db.update(combos).set({ apps: limpos }).where(eq(combos.id, c.id));
    }
  }

  for (const app of APLICATIVOS) {
    await db
      .insert(aplicativos)
      .values(app)
      .onConflictDoUpdate({
        target: aplicativos.slug,
        set: {
          nome: app.nome,
          mono: app.mono,
          cor: app.cor,
          tipo: app.tipo,
          categoria: app.categoria,
          precoAvulso: app.precoAvulso,
          preco: app.preco,
        },
      });
  }
  return APLICATIVOS.length;
}

const CONTAS = [
  { servico: "netflix", rotulo: "Netflix — Conta Matriz 01", email: "matriz.ntf01@playplusnow.com", senha: "Ppn#N1x2026", totalVagas: 5, vagasOcupadas: 5, renovacao: "18/08/2026", custo: 59.9, regiao: "BR", status: "ativo" },
  { servico: "netflix", rotulo: "Netflix — Conta Matriz 07", email: "matriz.ntf07@playplusnow.com", senha: "Ppn#N7x2026", totalVagas: 5, vagasOcupadas: 4, renovacao: "24/08/2026", custo: 59.9, regiao: "BR", status: "ativo" },
  { servico: "disney", rotulo: "Disney+ — Conta Matriz 12", email: "matriz.dsn12@playplusnow.com", senha: "Dsn!2026plus", totalVagas: 4, vagasOcupadas: 3, renovacao: "02/09/2026", custo: 43.9, regiao: "BR", status: "ativo" },
  { servico: "hbomax", rotulo: "HBO Max — Conta Matriz 03", email: "matriz.max03@playplusnow.com", senha: "MaxPpn@0399", totalVagas: 5, vagasOcupadas: 5, renovacao: "11/08/2026", custo: 55.9, regiao: "BR", status: "manutencao" },
  { servico: "spotify", rotulo: "Spotify — Família 09", email: "matriz.spt09@playplusnow.com", senha: "Spt$Fam2026", totalVagas: 6, vagasOcupadas: 5, renovacao: "29/08/2026", custo: 34.9, regiao: "BR", status: "ativo" },
  { servico: "prime", rotulo: "Prime Video — Matriz 21", email: "matriz.prv21@playplusnow.com", senha: "Prv#2026ppn", totalVagas: 4, vagasOcupadas: 2, renovacao: "07/09/2026", custo: 19.9, regiao: "BR", status: "ativo" },
  { servico: "youtube", rotulo: "YouTube — Família 05", email: "matriz.ytb05@playplusnow.com", senha: "Ytb@Prem26!", totalVagas: 5, vagasOcupadas: 5, renovacao: "15/08/2026", custo: 45.9, regiao: "BR", status: "ativo" },
  { servico: "crunchyroll", rotulo: "Crunchyroll — Matriz 02", email: "matriz.crl02@playplusnow.com", senha: "Crl!Mega2026", totalVagas: 4, vagasOcupadas: 1, renovacao: "21/09/2026", custo: 16.9, regiao: "BR", status: "ativo" },
  { servico: "globoplay", rotulo: "Globoplay — Matriz 04", email: "matriz.glb04@playplusnow.com", senha: "Glb@2026ppn", totalVagas: 5, vagasOcupadas: 4, renovacao: "03/09/2026", custo: 49.9, regiao: "BR", status: "ativo" },
  { servico: "paramount", rotulo: "Paramount+ — Matriz 08", email: "matriz.par08@playplusnow.com", senha: "Par!Plus26", totalVagas: 5, vagasOcupadas: 2, renovacao: "27/08/2026", custo: 19.9, regiao: "BR", status: "ativo" },
  { servico: "appletv", rotulo: "Apple TV+ — Matriz 02", email: "matriz.atv02@playplusnow.com", senha: "Atv#Ppn2026", totalVagas: 5, vagasOcupadas: 3, renovacao: "09/09/2026", custo: 21.9, regiao: "BR", status: "ativo" },
  { servico: "deezer", rotulo: "Deezer — Família 03", email: "matriz.dzr03@playplusnow.com", senha: "Dzr@Fam26", totalVagas: 6, vagasOcupadas: 2, renovacao: "22/08/2026", custo: 19.9, regiao: "BR", status: "ativo" },
  { servico: "iptv", rotulo: "IPTV — Servidor Alpha 01", email: "srv-alpha01.ppn", senha: "AlphaPpn#01", totalVagas: 60, vagasOcupadas: 48, renovacao: "01/09/2026", custo: 320, regiao: "BR/US", status: "ativo" },
  { servico: "canva", rotulo: "Canva Pro — Equipe 01", email: "matriz.cnv01@playplusnow.com", senha: "Cnv$Pro2026", totalVagas: 5, vagasOcupadas: 5, renovacao: "19/08/2026", custo: 34.9, regiao: "Global", status: "ativo" },
];

/**
 * Pool inicial da Futebol Ao Vivo. Fica fora de `CONTAS` porque é sincronizado
 * sempre (mesmo em banco já povoado): sem pool, o adicional não libera nada.
 */
const CONTAS_JOGOS = [
  { servico: "jogos", rotulo: "Futebol Ao Vivo — Conta 01", email: "jogos01@playplusnow.com", senha: "Ppn#Play01", totalVagas: 4, vagasOcupadas: 0, renovacao: "05/09/2026", custo: 39.9, regiao: "BR", status: "ativo" },
  { servico: "jogos", rotulo: "Futebol Ao Vivo — Conta 02", email: "jogos02@playplusnow.com", senha: "Ppn#Play02", totalVagas: 4, vagasOcupadas: 0, renovacao: "12/09/2026", custo: 39.9, regiao: "BR", status: "ativo" },
];

/** Garante o pool da Futebol Ao Vivo sem duplicar (chave: e-mail da conta). */
export async function semearPoolJogos() {
  for (const c of CONTAS_JOGOS) {
    const [existe] = await db
      .select({ id: contasMatrizes.id })
      .from(contasMatrizes)
      .where(eq(contasMatrizes.email, c.email));
    if (existe) continue;
    await db.insert(contasMatrizes).values({
      ...c,
      nomeConta: c.rotulo,
      custoMensal: c.custo,
      saldoGiftCard: Math.round(c.custo * 2.4 * 100) / 100,
      poolJogos: true,
    });
  }
  return CONTAS_JOGOS.length;
}

/** Clientes de demonstração (também usados para restaurar a base depois de migrações). */
export const CLIENTES = [
  { nome: "Diego Dias Silva", email: "diego.silva@email.com", pacote: "Turbo", statusPagamento: "ativo", ciclo: "mensal", valor: 49, proximaCobranca: "12/09/2026", clienteDesde: "12/03/2025", nivel: 1 },
  { nome: "Camila Ribeiro", email: "camila.rib@email.com", pacote: "15 em 1", statusPagamento: "ativo", ciclo: "mensal", valor: 99.9, proximaCobranca: "20/09/2026", clienteDesde: "07/08/2025", nivel: 2 },
  { nome: "Lucas Ferraz", email: "lucas.ferraz@email.com", pacote: "Pacote 03", statusPagamento: "pendente", ciclo: "mensal", valor: 34.9, proximaCobranca: "09/08/2026", clienteDesde: "09/12/2025", nivel: 3 },
  { nome: "Juliana Prado", email: "ju.prado@email.com", pacote: "Pacote 03", statusPagamento: "ativo", ciclo: "mensal", valor: 41.5, proximaCobranca: "28/08/2026", clienteDesde: "28/02/2026", nivel: 3 },
  { nome: "Rafael Monteiro", email: "rafa.monteiro@email.com", pacote: "Turbo", statusPagamento: "ativo", ciclo: "anual", valor: 470.4, proximaCobranca: "02/02/2027", clienteDesde: "02/02/2024", nivel: 3 },
  { nome: "Beatriz Aguiar", email: "bia.aguiar@email.com", pacote: "15 em 1", statusPagamento: "ativo", ciclo: "anual", valor: 958.8, proximaCobranca: "17/11/2026", clienteDesde: "17/11/2025", nivel: 1 },
  { nome: "Marcos Tavares", email: "marcos.tv@email.com", pacote: "Pacote 03", statusPagamento: "atrasado", ciclo: "mensal", valor: 34.9, proximaCobranca: "26/07/2026", clienteDesde: "26/01/2026", nivel: 2 },
  { nome: "Fernanda Lopes", email: "fer.lopes@email.com", pacote: "Turbo", statusPagamento: "pendente", ciclo: "mensal", valor: 49, proximaCobranca: "10/08/2026", clienteDesde: "10/04/2026", nivel: 3 },
];

const BANNERS_AFILIADOS = [
  {
    titulo: "Torne-se um Afiliado PPN",
    subtitulo: "Ganhe até 10% de comissão recorrente por cada amigo indicado.",
    imagemUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop",
    linkDestino: "/dashboard",
  },
  {
    titulo: "Vantagens do Nível 3",
    subtitulo: "Como afiliado nível 3, você tem acesso a saques via Pix e bônus exclusivos.",
    imagemUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop",
    linkDestino: "/dashboard",
  },
];

/** Banners do convite de afiliado — só insere quando a tabela está vazia. */
async function semearBannersAfiliados() {
  const [b] = await db.select({ n: sql<number>`count(*)` }).from(bannersAfiliados);
  if (Number(b?.n ?? 0) > 0) return 0;
  await db.insert(bannersAfiliados).values(BANNERS_AFILIADOS);
  return BANNERS_AFILIADOS.length;
}

async function contar() {
  const [p] = await db.select({ n: sql<number>`count(*)` }).from(pacotes);
  const [c] = await db.select({ n: sql<number>`count(*)` }).from(contasMatrizes);
  const [u] = await db.select({ n: sql<number>`count(*)` }).from(usuarios);
  return { pacotes: Number(p?.n ?? 0), contas: Number(c?.n ?? 0), usuarios: Number(u?.n ?? 0) };
}

/**
 * Executa o seed. Compartilhado entre a procedure `seed.run` (admin) e o
 * script `bun scripts/seed.ts`, usado no bootstrap de um banco novo.
 */
export async function executarSeed({ force = false }: { force?: boolean } = {}) {
  const antes = await contar();
  // catálogo de apps é sincronizado sempre — preço de tabela muda com o tempo
  await semearAplicativos();
  await semearPoolJogos();
  // banners do convite de afiliado: idempotente, roda mesmo em banco já populado
  await semearBannersAfiliados();

  if (!force && (antes.pacotes > 0 || antes.contas > 0 || antes.usuarios > 0)) {
    return { seeded: false, ...antes };
  }

  if (force) {
    await db.delete(usuarios);
    await db.delete(contasMatrizes);
    await db.delete(pacotes);
    await db.delete(bannersAfiliados);
    await semearBannersAfiliados();
  }

  const criados = await db.insert(pacotes).values(PACOTES).returning();
  await db.insert(contasMatrizes).values(
    CONTAS.map((c) => ({
      ...c,
      // gestão de contas: nome comercial, custo mensal e saldo inicial do gift card
      nomeConta: c.rotulo,
      custoMensal: c.custo,
      saldoGiftCard: Math.round(c.custo * 2.4 * 100) / 100,
    })),
  );
  await db.insert(usuarios).values(
    CLIENTES.map((c) => ({
      nome: c.nome,
      email: c.email,
      statusPagamento: c.statusPagamento,
      ciclo: c.ciclo,
      valor: c.valor,
      proximaCobranca: c.proximaCobranca,
      clienteDesde: c.clienteDesde,
      nivel: c.nivel,
      pacoteId: criados.find((p) => p.nome === c.pacote)?.id ?? null,
    })),
  );

  const depois = await contar();
  return { seeded: true, ...depois };
}

export const seed = {
  status: adminOnly.handler(() => contar()),

  run: adminOnly
    .input(z.object({ force: z.boolean().default(false) }).optional())
    .handler(({ input }) => executarSeed({ force: input?.force ?? false })),
};
