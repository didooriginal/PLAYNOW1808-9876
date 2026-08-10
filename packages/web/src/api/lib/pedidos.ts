// PEDIDOS DO CHECKOUT — preço calculado no servidor e ativação automática.
//
// Todo botão de compra do site cai aqui: plano da landing, combo pronto, combo
// montado na calculadora e o adicional Sala de Jogos. O front NUNCA manda o
// valor — ele manda o que o cliente escolheu e o servidor precifica com a
// tabela do banco. Depois que o Pix é confirmado, `aplicarPedido()` liga tudo
// sozinho: pacote trocado, apps alocados, próxima cobrança e status ativo.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import {
  aplicativos,
  combos,
  cobrancasPix,
  faturas,
  pacotes,
  usuarios,
} from "../database/schema";
import { lerParametros } from "./config";
import { garantirAlocacao } from "../routes/alocacoes";

export type EntradaPedido = {
  /** slug do pacote da landing (ex.: "combo-total") ou id numérico */
  pacoteId?: number | null;
  /** combo pronto cadastrado no admin */
  comboId?: number | null;
  /** combo montado na calculadora — slugs de `aplicativos` */
  apps?: string[];
  ciclo?: "mensal" | "anual";
  /** adicional Sala de Jogos (sozinho ou junto da assinatura) */
  jogos?: boolean;
};

export type Pedido = {
  tipo: "assinatura" | "jogos";
  titulo: string;
  pacoteId: number | null;
  comboId: number | null;
  apps: string[];
  ciclo: "mensal" | "anual";
  valor: number;
};

export type PedidoPrecificado = Pedido & {
  /** linhas exibidas no resumo do checkout */
  itens: { rotulo: string; valor: number }[];
  /** soma dos preços avulsos, para mostrar a economia */
  precoCheio: number;
  desconto: number;
  /** rótulo do ciclo cobrado */
  periodo: "mês" | "ano";
};

/** faixas de desconto do montador — espelham `builderTiers` da landing */
const FAIXAS = [
  { min: 8, off: 0.2 },
  { min: 5, off: 0.15 },
  { min: 3, off: 0.1 },
];

const cent = (v: number) => Math.round(v * 100) / 100;

/**
 * Transforma a escolha do cliente em um pedido com preço fechado.
 * Lança erro quando a escolha não existe mais (pacote desativado, app fora do
 * catálogo), evitando cobrança de algo que a operação não entrega.
 */
export async function precificarPedido(entrada: EntradaPedido): Promise<PedidoPrecificado> {
  const params = await lerParametros();
  const ciclo: "mensal" | "anual" = entrada.ciclo === "anual" ? "anual" : "mensal";

  /* ---------------- adicional Sala de Jogos ---------------- */
  if (entrada.jogos && !entrada.pacoteId && !entrada.comboId && !entrada.apps?.length) {
    const valor = cent(params.precoSalaJogos);
    return {
      tipo: "jogos",
      titulo: "Adicional Sala de Jogos",
      pacoteId: null,
      comboId: null,
      apps: [],
      ciclo: "mensal",
      valor,
      itens: [{ rotulo: "Sala de Jogos — acesso liberado na hora", valor }],
      precoCheio: valor,
      desconto: 0,
      periodo: "mês",
    };
  }

  /* ---------------- pacote da landing ---------------- */
  if (entrada.pacoteId) {
    const [pacote] = await db
      .select()
      .from(pacotes)
      .where(and(eq(pacotes.id, entrada.pacoteId), eq(pacotes.ativo, true)));
    if (!pacote) throw new Error("Pacote indisponível");

    // sem preço anual cadastrado, o site anuncia 20% off (2 meses grátis)
    const mensal =
      ciclo === "anual" ? (pacote.precoAnual ?? cent(pacote.preco * 0.8)) : pacote.preco;
    const valor = cent(ciclo === "anual" ? mensal * 12 : mensal);
    const cheio = await somaAvulsos(pacote.servicos ?? []);

    return {
      tipo: "assinatura",
      titulo: `${rotularPacote(pacote.nome)}${ciclo === "anual" ? " · anual" : ""}`,
      pacoteId: pacote.id,
      comboId: null,
      apps: pacote.servicos ?? [],
      ciclo,
      valor,
      itens: [
        {
          rotulo: `${pacote.nome} · ${(pacote.servicos ?? []).length} apps`,
          valor,
        },
      ],
      precoCheio: cent(ciclo === "anual" ? cheio * 12 : cheio),
      desconto: cent(Math.max(0, (ciclo === "anual" ? cheio * 12 : cheio) - valor)),
      periodo: ciclo === "anual" ? "ano" : "mês",
    };
  }

  /* ---------------- combo pronto ---------------- */
  if (entrada.comboId) {
    const [combo] = await db
      .select()
      .from(combos)
      .where(and(eq(combos.id, entrada.comboId), eq(combos.ativo, true)));
    if (!combo) throw new Error("Combo indisponível");

    const cicloCombo: "mensal" | "anual" = combo.ciclo === "anual" ? "anual" : "mensal";
    const valor = cent(combo.preco);
    const cheio = cent(combo.precoCheio || (await somaAvulsos(combo.apps ?? [])));

    return {
      tipo: "assinatura",
      titulo: `Combo ${combo.nome}`,
      pacoteId: null,
      comboId: combo.id,
      apps: combo.apps ?? [],
      ciclo: cicloCombo,
      valor,
      itens: [{ rotulo: `${combo.nome} · ${(combo.apps ?? []).length} apps`, valor }],
      precoCheio: cheio,
      desconto: cent(Math.max(0, cheio - valor)),
      periodo: cicloCombo === "anual" ? "ano" : "mês",
    };
  }

  /* ---------------- combo montado na calculadora ---------------- */
  const slugs = [...new Set(entrada.apps ?? [])].filter(Boolean);
  if (slugs.length === 0) throw new Error("Escolha pelo menos um app para continuar");

  const catalogo = await db
    .select()
    .from(aplicativos)
    .where(and(inArray(aplicativos.slug, slugs), eq(aplicativos.ativo, true)));
  if (catalogo.length !== slugs.length) throw new Error("Um dos apps escolhidos saiu do catálogo");

  const subtotal = cent(catalogo.reduce((s, a) => s + (a.preco || a.precoAvulso), 0));
  const faixa = FAIXAS.find((f) => catalogo.length >= f.min);
  const desconto = cent(faixa ? subtotal * faixa.off : 0);
  const valor = cent(subtotal - desconto);
  const cheio = cent(catalogo.reduce((s, a) => s + (a.precoAvulso || a.preco), 0));

  return {
    tipo: "assinatura",
    titulo: `Combo personalizado · ${catalogo.length} apps`,
    pacoteId: null,
    comboId: null,
    apps: catalogo.map((a) => a.slug),
    ciclo: "mensal",
    valor,
    itens: [
      ...catalogo.map((a) => ({ rotulo: a.nome, valor: cent(a.preco || a.precoAvulso) })),
      ...(desconto > 0
        ? [{ rotulo: `Desconto por volume (${Math.round((faixa?.off ?? 0) * 100)}%)`, valor: -desconto }]
        : []),
    ],
    precoCheio: cheio,
    desconto: cent(Math.max(0, cheio - valor)),
    periodo: "mês",
  };
}

async function somaAvulsos(slugs: string[]) {
  if (slugs.length === 0) return 0;
  const linhas = await db.select().from(aplicativos).where(inArray(aplicativos.slug, slugs));
  return cent(linhas.reduce((s, a) => s + (a.precoAvulso || a.preco), 0));
}

/** guarda o pedido na cobrança (JSON) sem as linhas de exibição */
/** evita "Pacote Pacote 03" quando o nome cadastrado já traz a palavra */
function rotularPacote(nome: string) {
  return /^pacote\b/i.test(nome.trim()) ? nome.trim() : `Pacote ${nome.trim()}`;
}

export function enxugar(p: PedidoPrecificado): Pedido {
  return {
    tipo: p.tipo,
    titulo: p.titulo,
    pacoteId: p.pacoteId,
    comboId: p.comboId,
    apps: p.apps,
    ciclo: p.ciclo,
    valor: p.valor,
  };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function proximaData(ciclo: "mensal" | "anual") {
  const d = new Date();
  if (ciclo === "anual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return iso(d);
}

/**
 * ATIVAÇÃO AUTOMÁTICA — roda quando o Pix do pedido é confirmado.
 * Idempotente: rodar duas vezes com a mesma cobrança não duplica nada.
 */
export async function aplicarPedido(clienteId: number, pedido: Pedido) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
  if (!cliente) return;

  if (pedido.tipo === "jogos") {
    await db
      .update(usuarios)
      .set({ salaJogos: true, salaJogosDesde: cliente.salaJogosDesde || iso(new Date()) })
      .where(eq(usuarios.id, clienteId));
    return;
  }

  await db
    .update(usuarios)
    .set({
      pacoteId: pedido.pacoteId,
      ciclo: pedido.ciclo,
      valor: pedido.ciclo === "anual" ? Math.round((pedido.valor / 12) * 100) / 100 : pedido.valor,
      statusPagamento: "ativo",
      proximaCobranca: proximaData(pedido.ciclo),
      clienteDesde: cliente.clienteDesde || iso(new Date()),
    })
    .where(eq(usuarios.id, clienteId));

  // libera uma vaga de cada app comprado (silencioso quando o estoque acabou —
  // o admin vê o cliente aguardando vaga na aba Saúde & Estoque)
  for (const servico of pedido.apps) {
    await garantirAlocacao(clienteId, servico);
  }
}

/**
 * Fatura correspondente ao pedido, para o pagamento entrar no financeiro e na
 * apuração de comissões. Reaproveita a fatura da competência atual em vez de
 * violar a chave única `cliente_id + competencia`.
 */
export async function faturaDoPedido(clienteId: number, pedido: Pedido) {
  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const [existente] = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.clienteId, clienteId), eq(faturas.competencia, competencia)));

  if (existente) {
    // competência já quitada: o pedido novo vira só cobrança avulsa, sem
    // reabrir nem sobrescrever a fatura paga do mês
    if (existente.status === "pago") return null;
    const [row] = await db
      .update(faturas)
      .set({ descricao: pedido.titulo, valor: pedido.valor, valorFinal: pedido.valor })
      .where(eq(faturas.id, existente.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(faturas)
    .values({
      clienteId,
      competencia,
      numero: `PPN-${competencia}-${String(clienteId).padStart(4, "0")}`,
      descricao: pedido.titulo,
      valor: pedido.valor,
      valorFinal: pedido.valor,
      status: "aberto",
      vencimento: iso(hoje),
    })
    .returning();
  return row;
}

/** cobrança viva (aguardando e não expirada) do mesmo pedido, se houver */
export async function cobrancaViva(clienteId: number, titulo: string) {
  const linhas = await db
    .select()
    .from(cobrancasPix)
    .where(and(eq(cobrancasPix.clienteId, clienteId), eq(cobrancasPix.status, "aguardando")));
  return linhas.find(
    (c) => c.descricao === titulo && c.expiraEm instanceof Date && c.expiraEm > new Date(),
  );
}
