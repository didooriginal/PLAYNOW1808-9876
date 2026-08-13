// PEDIDOS DO CHECKOUT — preço calculado no servidor e ativação automática.
//
// Todo botão de compra do site cai aqui: plano da landing, combo pronto, combo
// montado na calculadora e o adicional Futebol Ao Vivo. O front NUNCA manda o
// valor — ele manda o que o cliente escolheu e o servidor precifica com a
// tabela do banco. Depois que o Pix é confirmado, `aplicarPedido()` liga tudo
// sozinho: pacote trocado, apps alocados, próxima cobrança e status ativo.
import { and, eq, inArray } from "drizzle-orm";
import { enviarEmail } from "../services/email";
import { templates } from "./emails/templates";
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
import {
  type Ciclo,
  DEFINICOES,
  mesesDoCiclo,
  normalizarCiclo,
  periodoDoCiclo,
  precificarCiclo,
  somarMeses,
} from "./ciclos";

export type EntradaPedido = {
  /** slug do pacote da landing (ex.: "combo-total") ou id numérico */
  pacoteId?: number | null;
  /** combo pronto cadastrado no admin */
  comboId?: number | null;
  /** combo montado na calculadora — slugs de `aplicativos` */
  apps?: string[];
  ciclo?: Ciclo;
  /** adicional Futebol Ao Vivo (sozinho ou junto da assinatura) */
  jogos?: boolean;
};

export type Pedido = {
  tipo: "assinatura" | "jogos";
  titulo: string;
  pacoteId: number | null;
  comboId: number | null;
  apps: string[];
  ciclo: Ciclo;
  valor: number;
};

export type PedidoPrecificado = Pedido & {
  /** linhas exibidas no resumo do checkout */
  itens: { rotulo: string; valor: number }[];
  /** soma dos preços avulsos, para mostrar a economia */
  precoCheio: number;
  desconto: number;
  /** rótulo do ciclo cobrado */
  periodo: string;
  /** quantos meses estão sendo pagos nesta compra */
  meses: number;
  /** valor equivalente por mês, para exibir "R$ X/mês" */
  mensal: number;
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
  const ciclo: Ciclo = normalizarCiclo(entrada.ciclo);

  /* ---------------- adicional Futebol Ao Vivo ---------------- */
  if (entrada.jogos && !entrada.pacoteId && !entrada.comboId && !entrada.apps?.length) {
    const valor = cent(params.precoSalaJogos);
    return {
      tipo: "jogos",
      titulo: "Adicional Futebol Ao Vivo",
      pacoteId: null,
      comboId: null,
      apps: [],
      ciclo: "mensal",
      valor,
      itens: [{ rotulo: "Futebol Ao Vivo — acesso liberado na hora", valor }],
      precoCheio: valor,
      desconto: 0,
      periodo: "mês",
      meses: 1,
      mensal: valor,
    };
  }

  /* ---------------- pacote da landing ---------------- */
  if (entrada.pacoteId) {
    const [pacote] = await db
      .select()
      .from(pacotes)
      .where(and(eq(pacotes.id, entrada.pacoteId), eq(pacotes.ativo, true)));
    if (!pacote) throw new Error("Pacote indisponível");

    // `precoAnual` cadastrado na mão manda no lugar do percentual da tabela
    const promocional = ciclo === "anual" ? pacote.precoAnual : null;
    const preco = precificarCiclo(pacote.preco, ciclo, promocional);
    const avulso = await somaAvulsos(pacote.servicos ?? []);
    const cheio = cent(avulso * preco.meses);

    return {
      tipo: "assinatura",
      titulo: `${rotularPacote(pacote.nome)}${ciclo === "mensal" ? "" : ` · ${preco.rotulo.toLowerCase()}`}`,
      pacoteId: pacote.id,
      comboId: null,
      apps: pacote.servicos ?? [],
      ciclo,
      valor: preco.total,
      itens: [
        {
          rotulo: `${pacote.nome} · ${(pacote.servicos ?? []).length} apps`,
          valor: cent(pacote.preco * preco.meses),
        },
        ...(preco.economia > 0 && ciclo !== "mensal"
          ? [
              {
                rotulo: `Desconto ${preco.rotulo.toLowerCase()} (${Math.round(
                  (1 - preco.mensal / pacote.preco) * 100,
                )}%)`,
                valor: -cent(pacote.preco * preco.meses - preco.total),
              },
            ]
          : []),
      ],
      precoCheio: cheio,
      desconto: cent(Math.max(0, cheio - preco.total)),
      periodo: preco.periodo,
      meses: preco.meses,
      mensal: preco.mensal,
    };
  }

  /* ---------------- combo pronto ---------------- */
  if (entrada.comboId) {
    const [combo] = await db
      .select()
      .from(combos)
      .where(and(eq(combos.id, entrada.comboId), eq(combos.ativo, true)));
    if (!combo) throw new Error("Combo indisponível");

    const cicloCombo = normalizarCiclo(combo.ciclo);
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
      periodo: periodoDoCiclo(cicloCombo),
      meses: mesesDoCiclo(cicloCombo),
      mensal: cent(valor / mesesDoCiclo(cicloCombo)),
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
  /** mensalidade do combo montado, já com o desconto por volume */
  const mensalMontado = cent(subtotal - desconto);
  // o ciclo escolhido incide DEPOIS do desconto por volume: os dois se somam
  const preco = precificarCiclo(mensalMontado, ciclo);
  const avulso = cent(catalogo.reduce((s, a) => s + (a.precoAvulso || a.preco), 0));
  const cheio = cent(avulso * preco.meses);

  return {
    tipo: "assinatura",
    titulo: `Combo personalizado · ${catalogo.length} apps${
      ciclo === "mensal" ? "" : ` · ${preco.rotulo.toLowerCase()}`
    }`,
    pacoteId: null,
    comboId: null,
    apps: catalogo.map((a) => a.slug),
    ciclo,
    valor: preco.total,
    itens: [
      ...catalogo.map((a) => ({ rotulo: a.nome, valor: cent(a.preco || a.precoAvulso) })),
      ...(desconto > 0
        ? [{ rotulo: `Desconto por volume (${Math.round((faixa?.off ?? 0) * 100)}%)`, valor: -desconto }]
        : []),
      ...(preco.meses > 1
        ? [
            { rotulo: `× ${preco.meses} meses`, valor: cent(mensalMontado * preco.meses - mensalMontado) },
            {
              rotulo: `Desconto ${preco.rotulo.toLowerCase()} (${Math.round(
                DEFINICOES[ciclo].desconto * 100,
              )}%)`,
              valor: -cent(mensalMontado * preco.meses - preco.total),
            },
          ]
        : []),
    ],
    precoCheio: cheio,
    desconto: cent(Math.max(0, cheio - preco.total)),
    periodo: preco.periodo,
    meses: preco.meses,
    mensal: preco.mensal,
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

function proximaData(ciclo: Ciclo, base?: string) {
  // a partir do vencimento atual quando ele existe, para renovação não
  // "perder" dias já pagos pelo cliente
  return somarMeses(base || iso(new Date()), mesesDoCiclo(ciclo));
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

  const hoje = iso(new Date());
  /**
   * Pagar adiantado NÃO pode encurtar o que o cliente já pagou: quando o
   * vencimento atual ainda está no futuro, o novo período começa a contar dele,
   * não de hoje. É o que faz o desconto de antecipação ser honesto.
   */
  const base =
    cliente.proximaCobranca && cliente.proximaCobranca > hoje ? cliente.proximaCobranca : hoje;

  /**
   * Adiantamento de mensalidade não troca o plano nem o ciclo do cliente: ele
   * só empurra o vencimento. Por isso preserva `pacoteId`/`ciclo`/`valor`.
   */
  const soAdiantamento = /^Adiantamento da mensalidade/i.test(pedido.titulo);

  await db
    .update(usuarios)
    .set({
      ...(soAdiantamento
        ? {}
        : {
            pacoteId: pedido.pacoteId,
            ciclo: pedido.ciclo,
            // `valor` no cadastro é sempre a MENSALIDADE equivalente
            valor: cent(pedido.valor / mesesDoCiclo(pedido.ciclo)),
          }),
      statusPagamento: "ativo",
      proximaCobranca: proximaData(soAdiantamento ? "mensal" : pedido.ciclo, base),
      clienteDesde: cliente.clienteDesde || hoje,
    })
    .where(eq(usuarios.id, clienteId));

  if (soAdiantamento) return;

  // libera uma vaga de cada app comprado (silencioso quando o estoque acabou —
  // o admin vê o cliente aguardando vaga na aba Saúde & Estoque)
  for (const servico of pedido.apps) {
    await garantirAlocacao(clienteId, servico);
  }

  // e-mail de entrega de acesso — nunca derruba a ativação se o envio falhar
  try {
    const linkPainel = `${process.env.WEBSITE_URL || "https://playplusnow.com.br"}/dashboard`;
    const email = templates.entregaAcesso({
      nome: cliente.nome,
      email: cliente.email,
      linkPainel,
    });
    await enviarEmail({
      para: cliente.email,
      assunto: email.assunto,
      texto: email.texto,
      html: email.html,
    });
  } catch (e) {
    console.error("[Email] falha ao enviar a entrega de acesso:", e);
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
