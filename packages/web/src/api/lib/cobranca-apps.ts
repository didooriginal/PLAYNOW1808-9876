import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import {
  assinaturasApps,
  cobrancasExtras,
  faturas,
  pacotes,
  usuarios,
} from "../database/schema";
import { sincronizarAcessosDoCliente } from "./acessos";

/**
 * DINHEIRO DOS APPS AVULSOS
 * ------------------------------------------------------------------
 * Regra do negócio, fechada com o dono:
 *
 *  1. A mensalidade do cliente é DERIVADA: `valor = valorBase + apps avulsos`.
 *     `valorBase` é o pacote (ou o que ele já pagava antes dos avulsos).
 *  2. O admin pode digitar a mensalidade à mão. Nesse caso `valorManual`
 *     liga e o recálculo automático não encosta mais no número dele, até
 *     alguém voltar para o automático.
 *  3. App entrando no meio do ciclo cobra 1 mês cheio à parte (cobrança
 *     extra, somada à fatura em aberto). Do mês seguinte em diante ele já
 *     está dentro da mensalidade.
 *  4. App removido só abate na próxima fatura — nada de estorno do que já
 *     foi pago.
 *  5. Se o app foi adicionado como "liberar após o pagamento", quem solta o
 *     acesso é o pagamento da fatura que carrega a cobrança extra.
 */

const MESES_POR_CICLO: Record<string, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export function centavos(v: number) {
  return Math.round(v * 100) / 100;
}

export function competenciaAtual(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

/** apps avulsos que já valem e entram na conta da mensalidade */
async function avulsosAtivos(clienteId: number) {
  return db
    .select()
    .from(assinaturasApps)
    .where(
      and(
        eq(assinaturasApps.clienteId, clienteId),
        eq(assinaturasApps.status, "ativo"),
        inArray(assinaturasApps.origem, ["avulso", "combo"]),
      ),
    );
}

/**
 * Recalcula `usuarios.valor` a partir do pacote + apps avulsos ativos.
 * Não faz nada quando a mensalidade está travada em manual.
 * Devolve o detalhamento para a tela mostrar de onde veio cada real.
 */
export async function recalcularValorCliente(clienteId: number) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
  if (!cliente) return null;

  const meses = MESES_POR_CICLO[cliente.ciclo] ?? 1;

  const apps = await avulsosAtivos(clienteId);
  const somaApps = centavos(apps.reduce((s, a) => s + a.valor * meses, 0));

  /* base: o que o cliente pagava antes dos avulsos. Na primeira passada o
     campo está zerado (banco antigo), então adotamos o preço do pacote e,
     na falta dele, o valor atual MENOS os avulsos que já estão dentro dele —
     senão o segundo recálculo somaria os mesmos apps de novo (a mensalidade
     dobrava a cada chamada). */
  let base = cliente.valorBase;
  if (base <= 0) {
    const [pacote] = cliente.pacoteId
      ? await db.select().from(pacotes).where(eq(pacotes.id, cliente.pacoteId))
      : [];
    const mensalPacote = pacote
      ? cliente.ciclo === "anual" && pacote.precoAnual
        ? pacote.precoAnual * 12
        : pacote.preco * meses
      : 0;
    base = centavos(mensalPacote || Math.max(0, cliente.valor - somaApps));
    await db.update(usuarios).set({ valorBase: base }).where(eq(usuarios.id, cliente.id));
  }

  const total = centavos(base + somaApps);

  const detalhe = {
    base,
    somaApps,
    total,
    manual: cliente.valorManual,
    valorAtual: cliente.valor,
    apps: apps.map((a) => ({ servico: a.servico, valor: a.valor })),
  };

  if (cliente.valorManual || total === cliente.valor) return detalhe;

  await db.update(usuarios).set({ valor: total }).where(eq(usuarios.id, cliente.id));
  return { ...detalhe, valorAtual: total };
}

/**
 * Cria a cobrança do primeiro mês de um app adicionado no meio do ciclo.
 * Idempotente por app: se já existe uma cobrança em aberto para o mesmo
 * serviço, ela é atualizada em vez de duplicar.
 */
export async function cobrarAppExtra(entrada: {
  clienteId: number;
  servico: string;
  descricao: string;
  valor: number;
  liberaAcesso: boolean;
}) {
  if (entrada.valor <= 0) return null;
  const competencia = competenciaAtual();

  const [existente] = await db
    .select()
    .from(cobrancasExtras)
    .where(
      and(
        eq(cobrancasExtras.clienteId, entrada.clienteId),
        eq(cobrancasExtras.servico, entrada.servico),
        eq(cobrancasExtras.status, "aberto"),
      ),
    );

  if (existente) {
    const [row] = await db
      .update(cobrancasExtras)
      .set({
        valor: centavos(entrada.valor),
        descricao: entrada.descricao,
        competencia,
        liberaAcesso: entrada.liberaAcesso,
      })
      .where(eq(cobrancasExtras.id, existente.id))
      .returning();
    return row ?? existente;
  }

  const [row] = await db
    .insert(cobrancasExtras)
    .values({
      clienteId: entrada.clienteId,
      servico: entrada.servico,
      descricao: entrada.descricao,
      valor: centavos(entrada.valor),
      competencia,
      status: "aberto",
      liberaAcesso: entrada.liberaAcesso,
    })
    .returning();
  return row;
}

/** some com a cobrança em aberto de um app que o admin removeu antes de pagar */
export async function cancelarExtrasDoApp(clienteId: number, servico: string) {
  await db
    .update(cobrancasExtras)
    .set({ status: "cancelado" })
    .where(
      and(
        eq(cobrancasExtras.clienteId, clienteId),
        eq(cobrancasExtras.servico, servico),
        eq(cobrancasExtras.status, "aberto"),
      ),
    );
}

/** soma dos adicionais em aberto que entram na fatura desta competência */
export async function extrasEmAberto(clienteId: number) {
  return db
    .select()
    .from(cobrancasExtras)
    .where(
      and(eq(cobrancasExtras.clienteId, clienteId), eq(cobrancasExtras.status, "aberto")),
    );
}

/**
 * PAGAMENTO CONFIRMADO — quita os adicionais e solta o que estava preso.
 * Chamado tanto pela baixa manual do admin quanto pelo Pix/webhook, então o
 * caminho é um só: nenhum app fica esperando liberação manual.
 */
export async function liberarAppsPagos(clienteId: number) {
  const abertos = await extrasEmAberto(clienteId);
  const hoje = new Date().toISOString().slice(0, 10);

  if (abertos.length) {
    await db
      .update(cobrancasExtras)
      .set({ status: "pago", pagoEm: hoje })
      .where(
        and(eq(cobrancasExtras.clienteId, clienteId), eq(cobrancasExtras.status, "aberto")),
      );
  }

  const presos = await db
    .select()
    .from(assinaturasApps)
    .where(
      and(
        eq(assinaturasApps.clienteId, clienteId),
        eq(assinaturasApps.status, "aguardando_pagamento"),
      ),
    );

  if (!presos.length) {
    await recalcularValorCliente(clienteId);
    return { liberados: [] as string[], alocados: [] as string[], semVaga: [] as string[] };
  }

  await db
    .update(assinaturasApps)
    .set({ status: "ativo" })
    .where(
      and(
        eq(assinaturasApps.clienteId, clienteId),
        eq(assinaturasApps.status, "aguardando_pagamento"),
      ),
    );

  await recalcularValorCliente(clienteId);
  const sincronia = await sincronizarAcessosDoCliente(clienteId, "compra");

  return {
    liberados: presos.map((p) => p.servico),
    alocados: sincronia.alocados.map((a) => a.servico),
    semVaga: sincronia.semVaga,
  };
}

/**
 * Aplica os adicionais em aberto na fatura em aberto do cliente. A fatura
 * continua sendo derivada (`gerarFaturas`), então isto roda depois dela e só
 * ajusta valor/descrição — o extra nunca vira uma segunda fatura no mês,
 * que quebraria a chave única `cliente + competência`.
 */
export async function aplicarExtrasNaFatura(clienteId: number) {
  const abertos = await extrasEmAberto(clienteId);

  const [aberta] = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.clienteId, clienteId), eq(faturas.status, "aberto")));

  const alvo =
    aberta ??
    (
      await db
        .select()
        .from(faturas)
        .where(and(eq(faturas.clienteId, clienteId), eq(faturas.status, "vencido")))
    )[0];

  if (!alvo) return null;

  /* mensalidade limpa: tira o que já tinha sido somado de extras antes, para
     rodar isto mil vezes sem inflar a fatura. */
  const base = centavos(alvo.valor - alvo.extras);
  const somaExtras = centavos(abertos.reduce((s, c) => s + c.valor, 0));
  const valor = centavos(base + somaExtras);
  if (valor === alvo.valor && somaExtras === alvo.extras) return alvo;

  const valorFinal = centavos(valor * (1 - alvo.desconto / 100));
  const rotuloBase = alvo.descricao.split(" + ")[0];
  const descricao = somaExtras
    ? `${rotuloBase} + ${abertos.map((c) => c.descricao).join(" · ")}`
    : rotuloBase;

  const [row] = await db
    .update(faturas)
    .set({ valor, valorFinal, extras: somaExtras, descricao })
    .where(eq(faturas.id, alvo.id))
    .returning();

  return row ?? alvo;
}
