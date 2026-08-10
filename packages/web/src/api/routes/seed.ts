import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { aplicativos, contasMatrizes, pacotes, usuarios } from "../database/schema";

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
    nome: "Mega Promo",
    tagline: "O mais vendido — vídeo, música e anime",
    preco: 59.9,
    precoAnual: 47.9,
    servicos: ["netflix", "disney", "hbomax", "prime", "spotify", "youtube", "crunchyroll"],
    perks: [
      "7 apps liberados",
      "Netflix em 4K",
      "Suporte prioritário 24/7",
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
      "star",
      "deezer",
      "canva",
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
  { slug: "star", nome: "Star+", mono: "★+", cor: "#e0b04a", tipo: "video", categoria: "streaming", precoAvulso: 27.9, preco: 16.9 },
  { slug: "deezer", nome: "Deezer", mono: "DZ", cor: "#a238ff", tipo: "musica", categoria: "musica", precoAvulso: 20.9, preco: 13.9 },
  { slug: "canva", nome: "Canva Pro", mono: "C", cor: "#00c4cc", tipo: "extra", categoria: "produtividade", precoAvulso: 34.9, preco: 19.9 },
  { slug: "iptv", nome: "IPTV + Canais ao vivo", mono: "IP", cor: "#22d3ee", tipo: "video", categoria: "iptv", precoAvulso: 45, preco: 29.9 },
  { slug: "jogos", nome: "Sala de Jogos", mono: "GG", cor: "#ff1f3d", tipo: "extra", categoria: "streaming", precoAvulso: 39.9, preco: 9.9 },
];

/**
 * Sincroniza o catálogo de apps. Roda SEMPRE (mesmo em banco já povoado):
 * é o que mantém o preço de tabela do comparativo de economia atualizado.
 */
export async function semearAplicativos() {
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
  { servico: "netflix", rotulo: "Netflix — Conta Matriz 01", email: "matriz.ntf01@plaplusnow.com", senha: "Ppn#N1x2026", totalVagas: 5, vagasOcupadas: 5, renovacao: "18/08/2026", custo: 59.9, regiao: "BR", status: "ativo" },
  { servico: "netflix", rotulo: "Netflix — Conta Matriz 07", email: "matriz.ntf07@plaplusnow.com", senha: "Ppn#N7x2026", totalVagas: 5, vagasOcupadas: 4, renovacao: "24/08/2026", custo: 59.9, regiao: "BR", status: "ativo" },
  { servico: "disney", rotulo: "Disney+ — Conta Matriz 12", email: "matriz.dsn12@plaplusnow.com", senha: "Dsn!2026plus", totalVagas: 4, vagasOcupadas: 3, renovacao: "02/09/2026", custo: 43.9, regiao: "BR", status: "ativo" },
  { servico: "hbomax", rotulo: "HBO Max — Conta Matriz 03", email: "matriz.max03@plaplusnow.com", senha: "MaxPpn@0399", totalVagas: 5, vagasOcupadas: 5, renovacao: "11/08/2026", custo: 55.9, regiao: "BR", status: "manutencao" },
  { servico: "spotify", rotulo: "Spotify — Família 09", email: "matriz.spt09@plaplusnow.com", senha: "Spt$Fam2026", totalVagas: 6, vagasOcupadas: 5, renovacao: "29/08/2026", custo: 34.9, regiao: "BR", status: "ativo" },
  { servico: "prime", rotulo: "Prime Video — Matriz 21", email: "matriz.prv21@plaplusnow.com", senha: "Prv#2026ppn", totalVagas: 4, vagasOcupadas: 2, renovacao: "07/09/2026", custo: 19.9, regiao: "BR", status: "ativo" },
  { servico: "youtube", rotulo: "YouTube — Família 05", email: "matriz.ytb05@plaplusnow.com", senha: "Ytb@Prem26!", totalVagas: 5, vagasOcupadas: 5, renovacao: "15/08/2026", custo: 45.9, regiao: "BR", status: "ativo" },
  { servico: "crunchyroll", rotulo: "Crunchyroll — Matriz 02", email: "matriz.crl02@plaplusnow.com", senha: "Crl!Mega2026", totalVagas: 4, vagasOcupadas: 1, renovacao: "21/09/2026", custo: 16.9, regiao: "BR", status: "ativo" },
  { servico: "globoplay", rotulo: "Globoplay — Matriz 04", email: "matriz.glb04@plaplusnow.com", senha: "Glb@2026ppn", totalVagas: 5, vagasOcupadas: 4, renovacao: "03/09/2026", custo: 49.9, regiao: "BR", status: "ativo" },
  { servico: "paramount", rotulo: "Paramount+ — Matriz 08", email: "matriz.par08@plaplusnow.com", senha: "Par!Plus26", totalVagas: 5, vagasOcupadas: 2, renovacao: "27/08/2026", custo: 19.9, regiao: "BR", status: "ativo" },
  { servico: "appletv", rotulo: "Apple TV+ — Matriz 02", email: "matriz.atv02@plaplusnow.com", senha: "Atv#Ppn2026", totalVagas: 5, vagasOcupadas: 3, renovacao: "09/09/2026", custo: 21.9, regiao: "BR", status: "ativo" },
  { servico: "star", rotulo: "Star+ — Matriz 05", email: "matriz.str05@plaplusnow.com", senha: "Str!2026ppn", totalVagas: 4, vagasOcupadas: 2, renovacao: "13/09/2026", custo: 39.9, regiao: "BR", status: "ativo" },
  { servico: "deezer", rotulo: "Deezer — Família 03", email: "matriz.dzr03@plaplusnow.com", senha: "Dzr@Fam26", totalVagas: 6, vagasOcupadas: 2, renovacao: "22/08/2026", custo: 19.9, regiao: "BR", status: "ativo" },
  { servico: "iptv", rotulo: "IPTV — Servidor Alpha 01", email: "srv-alpha01.ppn", senha: "AlphaPpn#01", totalVagas: 60, vagasOcupadas: 48, renovacao: "01/09/2026", custo: 320, regiao: "BR/US", status: "ativo" },
  { servico: "canva", rotulo: "Canva Pro — Equipe 01", email: "matriz.cnv01@plaplusnow.com", senha: "Cnv$Pro2026", totalVagas: 5, vagasOcupadas: 5, renovacao: "19/08/2026", custo: 34.9, regiao: "Global", status: "ativo" },
];

/**
 * Pool inicial da Sala de Jogos. Fica fora de `CONTAS` porque é sincronizado
 * sempre (mesmo em banco já povoado): sem pool, o adicional não libera nada.
 */
const CONTAS_JOGOS = [
  { servico: "jogos", rotulo: "Sala de Jogos — Conta 01", email: "jogos01@plaplusnow.com", senha: "Ppn#Play01", totalVagas: 4, vagasOcupadas: 0, renovacao: "05/09/2026", custo: 39.9, regiao: "BR", status: "ativo" },
  { servico: "jogos", rotulo: "Sala de Jogos — Conta 02", email: "jogos02@plaplusnow.com", senha: "Ppn#Play02", totalVagas: 4, vagasOcupadas: 0, renovacao: "12/09/2026", custo: 39.9, regiao: "BR", status: "ativo" },
];

/** Garante o pool da Sala de Jogos sem duplicar (chave: e-mail da conta). */
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

const CLIENTES = [
  { nome: "Diego Dias Silva", email: "diego.silva@email.com", pacote: "Mega Promo", statusPagamento: "ativo", ciclo: "mensal", valor: 59.9, proximaCobranca: "12/09/2026", clienteDesde: "12/03/2025" },
  { nome: "Camila Ribeiro", email: "camila.rib@email.com", pacote: "15 em 1", statusPagamento: "ativo", ciclo: "mensal", valor: 99.9, proximaCobranca: "20/09/2026", clienteDesde: "07/08/2025" },
  { nome: "Lucas Ferraz", email: "lucas.ferraz@email.com", pacote: "Pacote 03", statusPagamento: "pendente", ciclo: "mensal", valor: 34.9, proximaCobranca: "09/08/2026", clienteDesde: "09/12/2025" },
  { nome: "Juliana Prado", email: "ju.prado@email.com", pacote: "Pacote 03", statusPagamento: "ativo", ciclo: "mensal", valor: 41.5, proximaCobranca: "28/08/2026", clienteDesde: "28/02/2026" },
  { nome: "Rafael Monteiro", email: "rafa.monteiro@email.com", pacote: "Mega Promo", statusPagamento: "ativo", ciclo: "anual", valor: 574.8, proximaCobranca: "02/02/2027", clienteDesde: "02/02/2024" },
  { nome: "Beatriz Aguiar", email: "bia.aguiar@email.com", pacote: "15 em 1", statusPagamento: "ativo", ciclo: "anual", valor: 958.8, proximaCobranca: "17/11/2026", clienteDesde: "17/11/2025" },
  { nome: "Marcos Tavares", email: "marcos.tv@email.com", pacote: "Pacote 03", statusPagamento: "atrasado", ciclo: "mensal", valor: 34.9, proximaCobranca: "26/07/2026", clienteDesde: "26/01/2026" },
  { nome: "Fernanda Lopes", email: "fer.lopes@email.com", pacote: "Mega Promo", statusPagamento: "pendente", ciclo: "mensal", valor: 55.2, proximaCobranca: "10/08/2026", clienteDesde: "10/04/2026" },
];

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

  if (!force && (antes.pacotes > 0 || antes.contas > 0 || antes.usuarios > 0)) {
    return { seeded: false, ...antes };
  }

  if (force) {
    await db.delete(usuarios);
    await db.delete(contasMatrizes);
    await db.delete(pacotes);
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
