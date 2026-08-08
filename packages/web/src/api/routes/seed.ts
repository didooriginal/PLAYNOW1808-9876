import { z } from "zod";
import { sql } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { contasMatrizes, pacotes, usuarios } from "../database/schema";

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
      "Garantia de 7 dias",
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

const CLIENTES = [
  { nome: "Diego Dias Silva", email: "diego.silva@email.com", pacote: "Mega Promo", statusPagamento: "ativo", ciclo: "mensal", valor: 59.9, proximaCobranca: "12/09/2026", clienteDesde: "12/03/2025" },
  { nome: "Camila Ribeiro", email: "camila.rib@email.com", pacote: "15 em 1", statusPagamento: "ativo", ciclo: "mensal", valor: 99.9, proximaCobranca: "20/09/2026", clienteDesde: "07/08/2025" },
  { nome: "Lucas Ferraz", email: "lucas.ferraz@email.com", pacote: "Pacote 03", statusPagamento: "vencendo", ciclo: "mensal", valor: 34.9, proximaCobranca: "09/08/2026", clienteDesde: "09/12/2025" },
  { nome: "Juliana Prado", email: "ju.prado@email.com", pacote: "Pacote 03", statusPagamento: "ativo", ciclo: "mensal", valor: 41.5, proximaCobranca: "28/08/2026", clienteDesde: "28/02/2026" },
  { nome: "Rafael Monteiro", email: "rafa.monteiro@email.com", pacote: "Mega Promo", statusPagamento: "ativo", ciclo: "anual", valor: 574.8, proximaCobranca: "02/02/2027", clienteDesde: "02/02/2024" },
  { nome: "Beatriz Aguiar", email: "bia.aguiar@email.com", pacote: "15 em 1", statusPagamento: "ativo", ciclo: "anual", valor: 958.8, proximaCobranca: "17/11/2026", clienteDesde: "17/11/2025" },
  { nome: "Marcos Tavares", email: "marcos.tv@email.com", pacote: "Pacote 03", statusPagamento: "inadimplente", ciclo: "mensal", valor: 34.9, proximaCobranca: "26/07/2026", clienteDesde: "26/01/2026" },
  { nome: "Fernanda Lopes", email: "fer.lopes@email.com", pacote: "Mega Promo", statusPagamento: "vencendo", ciclo: "mensal", valor: 55.2, proximaCobranca: "10/08/2026", clienteDesde: "10/04/2026" },
];

async function contar() {
  const [p] = await db.select({ n: sql<number>`count(*)` }).from(pacotes);
  const [c] = await db.select({ n: sql<number>`count(*)` }).from(contasMatrizes);
  const [u] = await db.select({ n: sql<number>`count(*)` }).from(usuarios);
  return { pacotes: Number(p?.n ?? 0), contas: Number(c?.n ?? 0), usuarios: Number(u?.n ?? 0) };
}

export const seed = {
  status: adminOnly.handler(() => contar()),

  run: adminOnly
    .input(z.object({ force: z.boolean().default(false) }).optional())
    .handler(async ({ input }) => {
      const force = input?.force ?? false;
      const antes = await contar();

      if (!force && (antes.pacotes > 0 || antes.contas > 0 || antes.usuarios > 0)) {
        return { seeded: false, ...antes };
      }

      if (force) {
        await db.delete(usuarios);
        await db.delete(contasMatrizes);
        await db.delete(pacotes);
      }

      const criados = await db.insert(pacotes).values(PACOTES).returning();
      await db.insert(contasMatrizes).values(CONTAS);
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
    }),
};
