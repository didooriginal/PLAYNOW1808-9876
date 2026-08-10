import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { faturas as tabelaFaturas, usuarios } from "../database/schema";
import { recalcularProgresso } from "./recompensas";

/**
 * FATURAS
 *
 * Assim como a gamificacao, as faturas sao DERIVADAS do historico real do
 * cliente (`clienteDesde` + `ciclo` + `valor`) — ninguem cria fatura na mao.
 * `gerarFaturas()` e idempotente: a chave unica `cliente_id + competencia`
 * garante que rodar de novo a cada carga de painel nao duplica nada.
 *
 * Regras:
 *   - uma fatura por competencia (mes no ciclo mensal, ano no anual);
 *   - competencias passadas nascem `pago`;
 *   - a competencia corrente fica `aberto`, ou `vencido` se o cliente esta
 *     inadimplente e a data de vencimento ja passou;
 *   - o cupom da Jornada (ex.: PPN15OFF, 15% OFF) e aplicado sempre na fatura
 *     em aberto mais recente, e reaplicado se o cupom mudar.
 */

const DIA_MS = 86_400_000;

/** Aceita "DD/MM/YYYY" (seed antigo) e ISO "YYYY-MM-DD". */
function parseData(data: string) {
  if (!data) return null;
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
  if (!y || !m) return null;
  return { ano: y, mes: m, dia: d || 1 };
}

function iso(ano: number, mes: number, dia: number) {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const d = Math.min(dia, ultimoDia);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function competenciaDe(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function centavos(v: number) {
  return Math.round(v * 100) / 100;
}

type ClienteFatura = {
  id: number;
  nome: string;
  valor: number;
  ciclo: string;
  clienteDesde: string;
  statusPagamento: string;
  pacoteNome?: string | null;
};

/**
 * Garante que o cliente tenha a serie completa de faturas ate hoje e devolve
 * a lista ja ordenada da mais recente para a mais antiga.
 */
export async function gerarFaturas(cliente: ClienteFatura, cupom = "", desconto = 0) {
  const inicio = parseData(cliente.clienteDesde);
  const existentes = await db
    .select()
    .from(tabelaFaturas)
    .where(eq(tabelaFaturas.clienteId, cliente.id))
    .orderBy(desc(tabelaFaturas.competencia));

  if (!inicio || cliente.valor <= 0) return existentes;

  const passo = cliente.ciclo === "anual" ? 12 : 1;
  const hoje = new Date();
  const jaTem = new Set(existentes.map((f) => f.competencia));

  type Nova = typeof tabelaFaturas.$inferInsert;
  const novas: Nova[] = [];
  const serie: { competencia: string; vencimento: string }[] = [];

  let ano = inicio.ano;
  let mes = inicio.mes;
  // guarda: no maximo 10 anos de serie
  for (let i = 0; i < 120; i++) {
    const dataVenc = new Date(ano, mes - 1, Math.min(inicio.dia, new Date(ano, mes, 0).getDate()));
    if (dataVenc.getTime() > hoje.getTime() + 31 * DIA_MS) break;
    serie.push({ competencia: competenciaDe(ano, mes), vencimento: iso(ano, mes, inicio.dia) });
    mes += passo;
    while (mes > 12) {
      mes -= 12;
      ano += 1;
    }
  }

  const rotulo = cliente.pacoteNome ? `Assinatura ${cliente.pacoteNome}` : "Assinatura PLAPLUSNOW";
  const atrasadoOuSuspenso =
    cliente.statusPagamento === "atrasado" || cliente.statusPagamento === "suspenso";

  serie.forEach((item, idx) => {
    if (jaTem.has(item.competencia)) return;
    const ultima = idx === serie.length - 1;
    const vencida = new Date(`${item.vencimento}T12:00:00`).getTime() < hoje.getTime();
    let status = "pago";
    if (ultima) {
      status = atrasadoOuSuspenso && vencida ? "vencido" : "aberto";
    } else if (atrasadoOuSuspenso && idx === serie.length - 2 && vencida) {
      status = "vencido";
    }
    novas.push({
      clienteId: cliente.id,
      competencia: item.competencia,
      numero: `PPN-${item.competencia}-${String(cliente.id).padStart(4, "0")}`,
      descricao: `${rotulo} · ${item.competencia}`,
      valor: centavos(cliente.valor),
      cupom: "",
      desconto: 0,
      valorFinal: centavos(cliente.valor),
      status,
      vencimento: item.vencimento,
      pagoEm: status === "pago" ? item.vencimento : "",
    });
  });

  if (novas.length) await db.insert(tabelaFaturas).values(novas).onConflictDoNothing();

  let lista = novas.length
    ? await db
        .select()
        .from(tabelaFaturas)
        .where(eq(tabelaFaturas.clienteId, cliente.id))
        .orderBy(desc(tabelaFaturas.competencia))
    : existentes;

  /* --- cupom da Jornada na fatura em aberto ----------------------- */
  const emAberto = lista.find((f) => f.status !== "pago");
  if (emAberto) {
    const novoDesconto = cupom ? desconto : 0;
    const novoFinal = centavos(emAberto.valor * (1 - novoDesconto / 100));
    if (emAberto.cupom !== cupom || emAberto.desconto !== novoDesconto) {
      await db
        .update(tabelaFaturas)
        .set({ cupom, desconto: novoDesconto, valorFinal: novoFinal })
        .where(eq(tabelaFaturas.id, emAberto.id));
      lista = lista.map((f) =>
        f.id === emAberto.id
          ? { ...f, cupom, desconto: novoDesconto, valorFinal: novoFinal }
          : f,
      );
    }
  }

  return lista;
}

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

export const faturas = {
  /** Faturas do cliente logado, com o cupom da Jornada ja aplicado. */
  minhas: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id, context.user.email);
    if (!cliente) return null;

    const { progresso } = await recalcularProgresso(cliente.id);
    const lista = await gerarFaturas(
      cliente,
      progresso.cupomAtivo ?? "",
      progresso.cupomDesconto ?? 0,
    );

    const pagas = lista.filter((f) => f.status === "pago");
    const aberta = lista.find((f) => f.status !== "pago") ?? null;

    return {
      faturas: lista,
      aberta,
      totalPago: centavos(pagas.reduce((s, f) => s + f.valorFinal, 0)),
      quitadas: pagas.length,
      economia: centavos(lista.reduce((s, f) => s + (f.valor - f.valorFinal), 0)),
    };
  }),

  /** Visao do admin: todas as tabelaFaturas, com nome do cliente. */
  listar: adminOnly.handler(async () => {
    const clientes = await db.select().from(usuarios).where(eq(usuarios.admin, false));

    for (const c of clientes) {
      const { progresso } = await recalcularProgresso(c.id);
      await gerarFaturas(c, progresso.cupomAtivo ?? "", progresso.cupomDesconto ?? 0);
    }

    const todas = await db.select().from(tabelaFaturas).orderBy(desc(tabelaFaturas.competencia));
    const nomes = new Map(clientes.map((c) => [c.id, c.nome] as const));
    const telefones = new Map(clientes.map((c) => [c.id, c.telefone ?? ""] as const));

    return todas.map((f) => ({
      ...f,
      clienteNome: nomes.get(f.clienteId) ?? "—",
      clienteTelefone: telefones.get(f.clienteId) ?? "",
    }));
  }),

  /** KPIs de faturamento reais, calculados sobre a tabela `faturas`. */
  resumo: adminOnly.handler(async () => {
    const todas = await db.select().from(tabelaFaturas);
    const hoje = new Date();
    const limite = new Date(hoje.getTime() + 7 * DIA_MS);

    const abertas = todas.filter((f) => f.status === "aberto");
    const vencidas = todas.filter((f) => f.status === "vencido");
    const pagas = todas.filter((f) => f.status === "pago");
    const aVencer = abertas.filter((f) => {
      const d = new Date(`${f.vencimento}T12:00:00`);
      return d >= hoje && d <= limite;
    });

    return {
      emAberto: abertas.length,
      aVencer: aVencer.length,
      vencidas: vencidas.length,
      totalEmAberto: centavos(abertas.reduce((s, f) => s + f.valorFinal, 0)),
      totalVencido: centavos(vencidas.reduce((s, f) => s + f.valorFinal, 0)),
      recebido: centavos(pagas.reduce((s, f) => s + f.valorFinal, 0)),
      descontoConcedido: centavos(todas.reduce((s, f) => s + (f.valor - f.valorFinal), 0)),
    };
  }),

  /**
   * Serie historica de receita, derivada das tabelaFaturas. Devolve os ultimos N
   * meses de competencia com o valor efetivamente faturado (ja com desconto),
   * usada no grafico de MRR do painel admin.
   */
  serie: adminOnly
    .input(z.object({ meses: z.number().min(3).max(24).default(7) }).optional())
    .handler(async ({ input }) => {
      const meses = input?.meses ?? 7;
      const todas = await db.select().from(tabelaFaturas);
      const clientes = await db
        .select({ id: usuarios.id, ciclo: usuarios.ciclo })
        .from(usuarios);
      const ciclos = new Map(clientes.map((c) => [c.id, c.ciclo] as const));

      const hoje = new Date();
      const buckets: { competencia: string; rotulo: string; valor: number; faturas: number }[] = [];
      const rotulos = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

      for (let i = meses - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        buckets.push({
          competencia: competenciaDe(d.getFullYear(), d.getMonth() + 1),
          rotulo: rotulos[d.getMonth()],
          valor: 0,
          faturas: 0,
        });
      }

      const porCompetencia = new Map(buckets.map((b) => [b.competencia, b] as const));

      // Receita RECONHECIDA, nao caixa: uma fatura anual e rateada nos 12
      // meses que ela cobre, senao o mes da cobranca vira um pico e os
      // demais afundam. Assim a serie representa MRR de verdade.
      for (const f of todas) {
        const anual = ciclos.get(f.clienteId) === "anual";
        const parcelas = anual ? 12 : 1;
        const parcela = centavos(f.valorFinal / parcelas);
        const [ano, mes] = f.competencia.split("-").map(Number);
        if (!ano || !mes) continue;

        for (let k = 0; k < parcelas; k++) {
          const d = new Date(ano, mes - 1 + k, 1);
          const bucket = porCompetencia.get(competenciaDe(d.getFullYear(), d.getMonth() + 1));
          if (!bucket) continue;
          bucket.valor = centavos(bucket.valor + parcela);
          bucket.faturas += 1;
        }
      }

      const primeiro = buckets[0]?.valor ?? 0;
      const ultimo = buckets[buckets.length - 1]?.valor ?? 0;
      const variacao = primeiro > 0 ? Math.round(((ultimo - primeiro) / primeiro) * 100) : 0;

      return { serie: buckets, variacao };
    }),

  /** Baixa manual do admin: marca a fatura como paga (ou reabre). */
  registrarPagamento: adminOnly
    .input(z.object({ id: z.number(), pago: z.boolean().default(true) }))
    .handler(async ({ input }) => {
      const [fatura] = await db.select().from(tabelaFaturas).where(eq(tabelaFaturas.id, input.id));
      if (!fatura) throw new ORPCError("NOT_FOUND", { message: "Fatura não encontrada" });

      const hojeIso = new Date().toISOString().slice(0, 10);
      const vencida = new Date(`${fatura.vencimento}T12:00:00`).getTime() < Date.now();

      await db
        .update(tabelaFaturas)
        .set(
          input.pago
            ? { status: "pago", pagoEm: hojeIso }
            : { status: vencida ? "vencido" : "aberto", pagoEm: "" },
        )
        .where(eq(tabelaFaturas.id, input.id));

      // reflete no cadastro do cliente para os demais paineis
      const pendentes = await db
        .select({ id: tabelaFaturas.id })
        .from(tabelaFaturas)
        .where(and(eq(tabelaFaturas.clienteId, fatura.clienteId), inArray(tabelaFaturas.status, ["vencido"])));

      await db
        .update(usuarios)
        .set({ statusPagamento: pendentes.length ? "atrasado" : "ativo" })
        .where(eq(usuarios.id, fatura.clienteId));

      return { ok: true };
    }),
};
