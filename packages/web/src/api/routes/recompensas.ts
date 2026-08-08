import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { recompensasEventos, recompensasProgresso, usuarios } from "../database/schema";

/**
 * GAMIFICACAO / AFILIADOS
 *
 * Tudo aqui e DERIVADO do historico real do cliente — nao existe pontuacao
 * manual. `recalcularProgresso()` roda toda vez que o painel do cliente ou o
 * painel do admin carregam, e e idempotente: cada marco vira uma linha em
 * `recompensas_eventos` com uma `chave` unica, entao rodar de novo nunca
 * duplica XP.
 *
 * Regras de pontuacao:
 *   - renovacao em dia ................. +50 XP
 *   - indicacao que vira assinante ..... +150 XP
 *
 * Premios (missoes 1 a 7):
 *   m1  1a renovacao em dia ............ +50 XP
 *   m2  3 renovacoes em dia ............ cupom 15% OFF na proxima fatura
 *   m3  5 renovacoes em dia ............ +100 XP de bonus
 *   m4  1 indicacao que assina ......... +150 XP
 *   m5  3 indicacoes que assinam ....... 1 mes de HBO Max gratis
 *   m6  10 renovacoes em dia ........... premio especial
 *   m7  12 meses ativo ................. presente surpresa (notifica o admin)
 */

export const XP_RENOVACAO = 50;
export const XP_INDICACAO = 150;
/** XP necessario para subir um nivel */
export const XP_POR_NIVEL = 250;

export const NIVEIS = [
  "Iniciante",
  "Bronze",
  "Prata",
  "Ouro",
  "Platina",
  "Diamante",
  "Lenda PPN",
] as const;

export function tituloDoNivel(nivel: number) {
  return NIVEIS[Math.min(nivel - 1, NIVEIS.length - 1)] ?? NIVEIS[0];
}

/* ------------------------------------------------------------------ */
/* CATALOGO DE MISSOES                                                 */
/* ------------------------------------------------------------------ */

type Metrica = "renovacoes" | "indicacoesAssinantes" | "mesesAtivo";

export type Missao = {
  id: string;
  ordem: number;
  titulo: string;
  metrica: Metrica;
  alvo: number;
  /** rotulo da recompensa exibido no card */
  recompensa: string;
  /** icone (nome logico resolvido no front) */
  icone: "calendario" | "calendario2" | "desconto" | "indicacao" | "grupo" | "coroa" | "diamante";
  accent: "cyan" | "purple" | "red";
  /** XP concedido ao concluir */
  xpBonus: number;
  /** premio destravado (id) — vazio quando a recompensa e so XP */
  premio: string;
  notificarAdmin: boolean;
};

export const MISSOES: Missao[] = [
  {
    id: "m1",
    ordem: 1,
    titulo: "1ª renovação em dia",
    metrica: "renovacoes",
    alvo: 1,
    recompensa: "+50 XP",
    icone: "calendario",
    accent: "cyan",
    xpBonus: 0,
    premio: "",
    notificarAdmin: false,
  },
  {
    id: "m2",
    ordem: 2,
    titulo: "3 renovações em dia",
    metrica: "renovacoes",
    alvo: 3,
    recompensa: "15% OFF",
    icone: "desconto",
    accent: "red",
    xpBonus: 0,
    premio: "cupom15",
    notificarAdmin: false,
  },
  {
    id: "m3",
    ordem: 3,
    titulo: "5 renovações em dia",
    metrica: "renovacoes",
    alvo: 5,
    recompensa: "+100 XP",
    icone: "calendario2",
    accent: "purple",
    xpBonus: 100,
    premio: "",
    notificarAdmin: false,
  },
  {
    id: "m4",
    ordem: 4,
    titulo: "1 indicação que assina",
    metrica: "indicacoesAssinantes",
    alvo: 1,
    recompensa: "+150 XP",
    icone: "indicacao",
    accent: "purple",
    xpBonus: 0,
    premio: "",
    notificarAdmin: false,
  },
  {
    id: "m5",
    ordem: 5,
    titulo: "3 indicações",
    metrica: "indicacoesAssinantes",
    alvo: 3,
    recompensa: "HBO Max grátis",
    icone: "grupo",
    accent: "purple",
    xpBonus: 0,
    premio: "hbomax_gratis",
    notificarAdmin: true,
  },
  {
    id: "m6",
    ordem: 6,
    titulo: "10 renovações",
    metrica: "renovacoes",
    alvo: 10,
    recompensa: "Prêmio especial",
    icone: "coroa",
    accent: "red",
    xpBonus: 0,
    premio: "premio_especial",
    notificarAdmin: true,
  },
  {
    id: "m7",
    ordem: 7,
    titulo: "12 meses ativo",
    metrica: "mesesAtivo",
    alvo: 12,
    recompensa: "Presente surpresa",
    icone: "diamante",
    accent: "purple",
    xpBonus: 0,
    premio: "presente_surpresa",
    notificarAdmin: true,
  },
];

export const ROTULO_PREMIO: Record<string, string> = {
  cupom15: "Cupom 15% OFF",
  hbomax_gratis: "1 mês de HBO Max grátis",
  premio_especial: "Prêmio especial (10 renovações)",
  presente_surpresa: "Presente surpresa (12 meses)",
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sufixoAleatorio(n = 4) {
  let out = "";
  for (let i = 0; i < n; i++) out += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return out;
}

function baseDoNome(nome: string) {
  const limpo = nome
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return (limpo.slice(0, 5) || "PPN").padEnd(3, "X");
}

/** gera (e persiste) o codigo de indicacao do cliente, se ainda nao existir */
export async function garantirCodigo(cliente: { id: number; nome: string; referralCode: string | null }) {
  if (cliente.referralCode) return cliente.referralCode;

  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const codigo = `${baseDoNome(cliente.nome)}${sufixoAleatorio()}`;
    const [existe] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.referralCode, codigo));
    if (existe) continue;
    await db.update(usuarios).set({ referralCode: codigo }).where(eq(usuarios.id, cliente.id));
    return codigo;
  }
  const fallback = `PPN${cliente.id}${sufixoAleatorio(3)}`;
  await db.update(usuarios).set({ referralCode: fallback }).where(eq(usuarios.id, cliente.id));
  return fallback;
}

/**
 * Meses completos entre a data de entrada e hoje.
 * Aceita os dois formatos usados na base: `DD/MM/YYYY` e ISO `YYYY-MM-DD`.
 */
function mesesDesde(data: string) {
  if (!data) return 0;
  let y = 0;
  let m = 0;
  let d = 0;
  if (data.includes("/")) {
    const [dd, mm, yy] = data.split("/").map(Number);
    y = yy;
    m = mm;
    d = dd;
  } else {
    const [yy, mm, dd] = data.slice(0, 10).split("-").map(Number);
    y = yy;
    m = mm;
    d = dd;
  }
  if (!y || !m) return 0;
  const inicio = new Date(y, m - 1, d || 1);
  const hoje = new Date();
  let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  if (hoje.getDate() < (d || 1)) meses -= 1;
  return Math.max(0, meses);
}

/**
 * Coletor de eventos pendentes. Em vez de um SELECT+INSERT por marco (dezenas
 * de round-trips por cliente), montamos a lista em memoria e gravamos os que
 * faltam num unico INSERT — a `chave` mantem a idempotencia.
 */
type EventoPendente = {
  tipo: string;
  chave: string;
  descricao: string;
  xp: number;
  notificarAdmin: boolean;
};

export type ProgressoCalculado = Awaited<ReturnType<typeof recalcularProgresso>>;

/**
 * Recalcula o progresso de um cliente a partir do historico real e persiste.
 * Seguro para rodar em toda carga de painel.
 */
export async function recalcularProgresso(clienteId: number) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

  const codigo = await garantirCodigo(cliente);

  /* --- metricas derivadas ---------------------------------------- */

  const mesesAtivo = mesesDesde(cliente.clienteDesde);

  // renovacao = cada mes de casa que ja foi cobrado. Cliente inadimplente
  // perde a ultima (nao renovou em dia).
  const renovacoes =
    cliente.statusPagamento === "inadimplente" ? Math.max(0, mesesAtivo - 1) : mesesAtivo;

  const indicados = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      statusPagamento: usuarios.statusPagamento,
      pacoteId: usuarios.pacoteId,
      clienteDesde: usuarios.clienteDesde,
    })
    .from(usuarios)
    .where(eq(usuarios.indicadoPor, clienteId));

  const assinantes = indicados.filter(
    (i) => i.pacoteId !== null && i.statusPagamento !== "inadimplente",
  );

  /* --- eventos idempotentes (livro-razao de XP) ------------------- */

  const jaRegistrados = await db
    .select({ chave: recompensasEventos.chave, xp: recompensasEventos.xp })
    .from(recompensasEventos)
    .where(eq(recompensasEventos.clienteId, clienteId));
  const chavesExistentes = new Set(jaRegistrados.map((e) => e.chave));

  const pendentes: EventoPendente[] = [];
  const empilhar = (e: EventoPendente) => {
    if (chavesExistentes.has(e.chave)) return;
    chavesExistentes.add(e.chave);
    pendentes.push(e);
  };

  for (let n = 1; n <= renovacoes; n++) {
    empilhar({
      tipo: "renovacao",
      chave: `renovacao:${n}`,
      descricao: `Renovação em dia nº ${n}`,
      xp: XP_RENOVACAO,
      notificarAdmin: false,
    });
  }

  for (const indicado of assinantes) {
    empilhar({
      tipo: "indicacao",
      chave: `indicacao:${indicado.id}`,
      descricao: `Indicação convertida: ${indicado.nome}`,
      xp: XP_INDICACAO,
      notificarAdmin: false,
    });
  }

  const metricas = { renovacoes, indicacoesAssinantes: assinantes.length, mesesAtivo };
  const missoesConcluidas: string[] = [];
  const premiosLiberados: string[] = [];

  for (const missao of MISSOES) {
    if (metricas[missao.metrica] < missao.alvo) continue;
    missoesConcluidas.push(missao.id);
    if (missao.premio) premiosLiberados.push(missao.premio);
    empilhar({
      tipo: missao.premio ? "premio" : "missao",
      chave: `missao:${missao.id}`,
      descricao: `Missão concluída: ${missao.titulo} → ${missao.recompensa}`,
      xp: missao.xpBonus,
      notificarAdmin: missao.notificarAdmin,
    });
  }

  if (pendentes.length > 0) {
    await db.insert(recompensasEventos).values(pendentes.map((e) => ({ clienteId, ...e })));
  }

  /* --- XP total = soma do livro-razao ----------------------------- */

  const xp =
    jaRegistrados.reduce((total, e) => total + e.xp, 0) +
    pendentes.reduce((total, e) => total + e.xp, 0);
  const nivel = Math.floor(xp / XP_POR_NIVEL) + 1;

  const cupomAtivo = premiosLiberados.includes("cupom15") ? "PPN15OFF" : "";
  const cupomDesconto = cupomAtivo ? 15 : 0;

  /* --- persiste --------------------------------------------------- */

  const [atual] = await db
    .select()
    .from(recompensasProgresso)
    .where(eq(recompensasProgresso.clienteId, clienteId));

  const valores = {
    xp,
    nivel,
    renovacoes,
    indicacoes: indicados.length,
    indicacoesAssinantes: assinantes.length,
    mesesAtivo,
    missoesConcluidas,
    premiosLiberados,
    cupomAtivo,
    cupomDesconto,
    atualizadoEm: new Date(),
  };

  let progresso;
  if (atual) {
    [progresso] = await db
      .update(recompensasProgresso)
      .set(valores)
      .where(eq(recompensasProgresso.id, atual.id))
      .returning();
  } else {
    [progresso] = await db
      .insert(recompensasProgresso)
      .values({ clienteId, ...valores, premiosEntregues: [] })
      .returning();
  }

  return { cliente, codigo, progresso: progresso!, indicados, assinantes };
}

/** resolve o registro de `usuarios` a partir da sessao */
async function clienteDaSessao(authUserId: string, email: string) {
  const [porVinculo] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (porVinculo) return porVinculo;
  const [porEmail] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase()));
  return porEmail ?? null;
}

/* ------------------------------------------------------------------ */
/* ROTAS                                                               */
/* ------------------------------------------------------------------ */

export const recompensasRoutes = {
  /** catalogo de missoes — publico, alimenta a trilha visual */
  missoes: base.handler(() => MISSOES),

  /**
   * JORNADA DO CLIENTE — progresso recalculado na hora + link de indicacao
   * + lista de quem ele ja indicou.
   */
  minhaJornada: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id, context.user.email);
    if (!cliente) return null;

    const { progresso, indicados, codigo } = await recalcularProgresso(cliente.id);

    const metricas = {
      renovacoes: progresso.renovacoes,
      indicacoesAssinantes: progresso.indicacoesAssinantes,
      mesesAtivo: progresso.mesesAtivo,
    } as const;

    const missoes = MISSOES.map((m) => ({
      ...m,
      progresso: Math.min(metricas[m.metrica], m.alvo),
      concluida: metricas[m.metrica] >= m.alvo,
    }));

    const eventos = await db
      .select()
      .from(recompensasEventos)
      .where(eq(recompensasEventos.clienteId, cliente.id))
      .orderBy(desc(recompensasEventos.criadoEm))
      .limit(12);

    const xpNoNivel = progresso.xp % XP_POR_NIVEL;

    return {
      codigo,
      progresso,
      missoes,
      eventos,
      nivelTitulo: tituloDoNivel(progresso.nivel),
      xpNoNivel,
      xpParaProximo: XP_POR_NIVEL - xpNoNivel,
      xpPorNivel: XP_POR_NIVEL,
      indicados: indicados.map((i) => ({
        nome: i.nome,
        email: i.email,
        assinante: i.pacoteId !== null && i.statusPagamento !== "inadimplente",
        statusPagamento: i.statusPagamento,
        desde: i.clienteDesde,
      })),
    };
  }),

  /**
   * Vincula o cadastro recem-criado a quem indicou. Chamado pela tela de
   * signup logo apos criar a conta (`/signup?ref=CODIGO`).
   */
  registrarIndicacao: authed
    .input(z.object({ codigo: z.string().min(3).max(24) }))
    .handler(async ({ input, context }) => {
      const novo = await clienteDaSessao(context.user.id, context.user.email);
      if (!novo) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
      if (novo.indicadoPor) return { ok: true, jaVinculado: true };

      const codigo = input.codigo.trim().toUpperCase();
      const [padrinho] = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.referralCode, codigo));

      if (!padrinho || padrinho.id === novo.id) return { ok: false, jaVinculado: false };

      await db.update(usuarios).set({ indicadoPor: padrinho.id }).where(eq(usuarios.id, novo.id));
      await recalcularProgresso(padrinho.id);
      return { ok: true, jaVinculado: false, padrinho: padrinho.nome };
    }),

  /** valida um codigo na tela de cadastro (sem exigir sessao) */
  validarCodigo: base
    .input(z.object({ codigo: z.string() }))
    .handler(async ({ input }) => {
      const [padrinho] = await db
        .select({ nome: usuarios.nome })
        .from(usuarios)
        .where(eq(usuarios.referralCode, input.codigo.trim().toUpperCase()));
      return { valido: Boolean(padrinho), nome: padrinho?.nome ?? null };
    }),

  /* ---------------- ADMIN ---------------- */

  /** ranking de afiliados: quem indicou quem, XP, nivel e premios */
  listar: adminOnly.handler(async () => {
    const clientes = await db.select().from(usuarios).where(eq(usuarios.admin, false));

    const linhas = [] as {
      clienteId: number;
      nome: string;
      email: string;
      telefone: string | null;
      codigo: string;
      indicadoPorNome: string | null;
      xp: number;
      nivel: number;
      nivelTitulo: string;
      renovacoes: number;
      indicacoes: number;
      indicacoesAssinantes: number;
      mesesAtivo: number;
      premiosLiberados: string[];
      premiosEntregues: string[];
      cupomAtivo: string;
      cupomDesconto: number;
    }[];

    const porId = new Map(clientes.map((c) => [c.id, c]));

    for (const cliente of clientes) {
      const { progresso, codigo } = await recalcularProgresso(cliente.id);
      linhas.push({
        clienteId: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        codigo,
        indicadoPorNome: cliente.indicadoPor
          ? (porId.get(cliente.indicadoPor)?.nome ?? null)
          : null,
        xp: progresso.xp,
        nivel: progresso.nivel,
        nivelTitulo: tituloDoNivel(progresso.nivel),
        renovacoes: progresso.renovacoes,
        indicacoes: progresso.indicacoes,
        indicacoesAssinantes: progresso.indicacoesAssinantes,
        mesesAtivo: progresso.mesesAtivo,
        premiosLiberados: progresso.premiosLiberados,
        premiosEntregues: progresso.premiosEntregues,
        cupomAtivo: progresso.cupomAtivo,
        cupomDesconto: progresso.cupomDesconto,
      });
    }

    return linhas.sort((a, b) => b.xp - a.xp);
  }),

  /** avisos que o admin precisa ver (ex.: cliente bateu 12 meses) */
  notificacoes: adminOnly.handler(() =>
    db
      .select({
        id: recompensasEventos.id,
        clienteId: recompensasEventos.clienteId,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        descricao: recompensasEventos.descricao,
        tipo: recompensasEventos.tipo,
        lidoPeloAdmin: recompensasEventos.lidoPeloAdmin,
        criadoEm: recompensasEventos.criadoEm,
      })
      .from(recompensasEventos)
      .innerJoin(usuarios, eq(recompensasEventos.clienteId, usuarios.id))
      .where(eq(recompensasEventos.notificarAdmin, true))
      .orderBy(desc(recompensasEventos.criadoEm)),
  ),

  marcarNotificacaoLida: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db
        .update(recompensasEventos)
        .set({ lidoPeloAdmin: true })
        .where(eq(recompensasEventos.id, input.id));
      return { ok: true };
    }),

  /** marca um premio como entregue ao cliente */
  entregarPremio: adminOnly
    .input(z.object({ clienteId: z.number().int(), premio: z.string() }))
    .handler(async ({ input }) => {
      const [atual] = await db
        .select()
        .from(recompensasProgresso)
        .where(eq(recompensasProgresso.clienteId, input.clienteId));
      if (!atual) throw new ORPCError("NOT_FOUND", { message: "Progresso não encontrado" });

      const entregues = new Set(atual.premiosEntregues ?? []);
      if (entregues.has(input.premio)) entregues.delete(input.premio);
      else entregues.add(input.premio);

      const [row] = await db
        .update(recompensasProgresso)
        .set({ premiosEntregues: [...entregues], atualizadoEm: new Date() })
        .where(eq(recompensasProgresso.id, atual.id))
        .returning();
      return row;
    }),

  /** KPIs da aba Afiliados/Gamificação */
  resumo: adminOnly.handler(async () => {
    const [progresso] = await db
      .select({
        clientes: sql<number>`count(*)`,
        xpTotal: sql<number>`coalesce(sum(${recompensasProgresso.xp}), 0)`,
        comIndicacao: sql<number>`coalesce(sum(case when ${recompensasProgresso.indicacoesAssinantes} > 0 then 1 else 0 end), 0)`,
        indicacoesConvertidas: sql<number>`coalesce(sum(${recompensasProgresso.indicacoesAssinantes}), 0)`,
        cupons: sql<number>`coalesce(sum(case when ${recompensasProgresso.cupomAtivo} != '' then 1 else 0 end), 0)`,
      })
      .from(recompensasProgresso);

    const [avisos] = await db
      .select({
        pendentes: sql<number>`coalesce(sum(case when ${recompensasEventos.lidoPeloAdmin} = 0 then 1 else 0 end), 0)`,
      })
      .from(recompensasEventos)
      .where(eq(recompensasEventos.notificarAdmin, true));

    return { ...progresso, avisosPendentes: Number(avisos?.pendentes ?? 0) };
  }),
};
