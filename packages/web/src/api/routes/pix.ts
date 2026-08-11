import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { lerParametros } from "../lib/config";
import { db } from "../database";
import { cobrancasPix, faturas, usuarios } from "../database/schema";
import { aplicarPedido, type Pedido } from "../lib/pedidos";
import { apurarComissoes } from "./afiliados";
import {
  ambienteMP,
  buscarPagamento,
  criarPagamentoPix,
  ErroMercadoPago,
  mercadoPagoConfigurado,
  urlWebhookMP,
  urlPublicaSegura,
} from "../lib/mercadopago";
import { avisarAdminPagamento } from "../lib/aviso-pagamento";

/**
 * GATEWAY PIX — PRODUÇÃO (Mercado Pago)
 * ------------------------------------------------------------------
 * O modo simulado foi REMOVIDO: toda cobrança Pix nasce na API do Mercado
 * Pago (`POST /v1/payments`, `payment_method_id: pix`) e a baixa chega pelo
 * webhook `/api/webhooks/mercadopago`. Dinheiro real, QR real.
 *
 * O provedor ativo vem do parâmetro `pixProvedor` (painel → Gestão de Contas).
 * Hoje existe um: `mercadopago`. Plugar outro (efi, asaas, pagarme) é escrever
 * uma função no mapa PROVEDORES — nada mais no sistema muda.
 *
 * PLANO B (mantido de propósito): o admin ainda dá baixa manual em
 * `pix.confirmar`, para quem pagou em dinheiro, transferência ou fora do
 * gateway. É o mesmo `confirmarPagamento`, então não existe caminho divergente.
 */

/* ------------------------------------------------------------------ */
/* PROVEDORES                                                          */
/* ------------------------------------------------------------------ */

type PedidoCobranca = {
  valor: number;
  txid: string;
  descricao: string;
  emailPagador: string;
  nomePagador: string;
};

type RespostaCobranca = {
  copiaECola: string;
  expiraEm: Date;
  provedorId: string;
  qrBase64: string;
  linkPagamento: string;
};

const EXPIRA_MIN = 60;

const PROVEDORES: Record<string, (p: PedidoCobranca) => Promise<RespostaCobranca>> = {
  mercadopago: async (p) => {
    const pagamento = await criarPagamentoPix({
      valor: p.valor,
      descricao: p.descricao,
      referencia: p.txid,
      emailPagador: p.emailPagador,
      nomePagador: p.nomePagador,
      expiraEmMinutos: EXPIRA_MIN,
    });
    if (!pagamento.copiaECola && !pagamento.linkPagamento) {
      throw new ORPCError("BAD_GATEWAY", {
        message: "Mercado Pago não devolveu o QR do Pix. Tente novamente.",
      });
    }
    return {
      copiaECola: pagamento.copiaECola,
      expiraEm: pagamento.expiraEm,
      provedorId: pagamento.id,
      qrBase64: pagamento.qrBase64,
      linkPagamento: pagamento.linkPagamento,
    };
  },
};

const PROVEDOR_PADRAO = "mercadopago";

/**
 * Cria uma cobrança Pix para qualquer coisa: fatura em aberto ou pedido novo
 * do checkout. É o único ponto que fala com o provedor.
 */
export async function abrirCobranca(entrada: {
  clienteId: number;
  valor: number;
  descricao: string;
  faturaId?: number | null;
  pedido?: Pedido | null;
}) {
  if (!mercadoPagoConfigurado()) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message:
        "Pagamento indisponível: MERCADOPAGO_ACCESS_TOKEN não está configurado no servidor.",
    });
  }

  const params = await lerParametros();
  const provedor = PROVEDORES[params.pixProvedor] ? params.pixProvedor : PROVEDOR_PADRAO;
  const criar = PROVEDORES[provedor];
  const txid = gerarTxid(entrada.clienteId);

  const [pagador] = await db
    .select({ nome: usuarios.nome, email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.id, entrada.clienteId));

  let resposta: RespostaCobranca;
  try {
    resposta = await criar({
      valor: entrada.valor,
      txid,
      descricao: entrada.descricao,
      emailPagador: pagador?.email || "cliente@playplusnow.com",
      nomePagador: pagador?.nome || "Cliente PLAYPLUSNOW",
    });
  } catch (e) {
    if (e instanceof ErroMercadoPago) {
      // o admin precisa saber que o gateway recusou — senão o cliente
      // simplesmente "não consegue pagar" e ninguém descobre por quê
      await notificar({
        escopo: "admin",
        clienteId: entrada.clienteId,
        tipo: "pagamento",
        severidade: "critico",
        titulo: "Falha ao gerar cobrança no Mercado Pago",
        mensagem: `${e.detalhe} (HTTP ${e.status}). Confira as credenciais em Gestão de Contas.`,
        destino: "pix",
        chave: `mp:falha:${txid}`,
      });
      throw new ORPCError("BAD_GATEWAY", {
        message: `Não foi possível gerar o Pix agora (${e.detalhe}). Tente novamente em instantes.`,
      });
    }
    throw e;
  }

  await db.insert(cobrancasPix).values({
    clienteId: entrada.clienteId,
    faturaId: entrada.faturaId ?? null,
    provedor,
    txid,
    valor: entrada.valor,
    descricao: entrada.descricao,
    pedido: entrada.pedido ?? null,
    copiaECola: resposta.copiaECola,
    provedorId: resposta.provedorId,
    qrBase64: resposta.qrBase64,
    linkPagamento: resposta.linkPagamento,
    status: "aguardando",
    expiraEm: resposta.expiraEm,
  });

  return {
    txid,
    valor: entrada.valor,
    descricao: entrada.descricao,
    copiaECola: resposta.copiaECola,
    qrBase64: resposta.qrBase64,
    linkPagamento: resposta.linkPagamento,
    provedor,
    expiraEm: resposta.expiraEm.toISOString(),
    status: "aguardando" as const,
  };
}

function gerarTxid(clienteId: number) {
  const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PPN${String(clienteId).padStart(4, "0")}${Date.now().toString(36).toUpperCase()}${aleatorio}`.slice(
    0,
    25,
  );
}

async function clienteDaSessao(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

/**
 * BAIXA DO PAGAMENTO — caminho único, use webhook ou clique do admin.
 * Marca a cobrança como paga, quita a fatura e devolve o cliente para "ativo".
 */
/**
 * Empurra a data de cobrança para o próximo ciclo enquanto ela estiver no
 * passado, preservando o dia escolhido pelo cliente.
 */
function avancarVencimento(atual: string | null, ciclo: "mensal" | "anual") {
  // sem data válida no cadastro (ou cliente novo): conta a partir de hoje —
  // mensal = +30 dias, anual = +1 ano
  if (!atual || !/^\d{4}-\d{2}-\d{2}$/.test(atual)) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    if (ciclo === "anual") base.setFullYear(base.getFullYear() + 1);
    else base.setDate(base.getDate() + 30);
    return base.toISOString().slice(0, 10);
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${atual}T00:00:00`);
  let voltas = 0;
  while (data <= hoje && voltas < 60) {
    if (ciclo === "anual") data.setFullYear(data.getFullYear() + 1);
    else data.setMonth(data.getMonth() + 1);
    voltas += 1;
  }
  return data.toISOString().slice(0, 10);
}

export async function confirmarPagamento(
  txid: string,
  origem: "webhook" | "admin" | "assinatura",
) {
  const [cobranca] = await db.select().from(cobrancasPix).where(eq(cobrancasPix.txid, txid));
  if (!cobranca) return { ok: false, motivo: "cobrança não encontrada" };
  if (cobranca.status === "pago") return { ok: true, jaEstava: true };

  const agora = new Date();
  await db
    .update(cobrancasPix)
    .set({ status: "pago", pagoEm: agora })
    .where(eq(cobrancasPix.id, cobranca.id));

  if (cobranca.faturaId) {
    await db
      .update(faturas)
      .set({ status: "pago", pagoEm: agora.toISOString().slice(0, 10) })
      .where(eq(faturas.id, cobranca.faturaId));
  }

  await db
    .update(usuarios)
    .set({ statusPagamento: "ativo" })
    .where(eq(usuarios.id, cobranca.clienteId));

  // pagamento de fatura simples: empurra o vencimento para o próximo ciclo,
  // senão o cliente pago continuaria aparecendo como atrasado
  if (!cobranca.pedido) {
    const [dono] = await db.select().from(usuarios).where(eq(usuarios.id, cobranca.clienteId));
    if (dono) {
      const proxima = avancarVencimento(dono.proximaCobranca, dono.ciclo === "anual" ? "anual" : "mensal");
      if (proxima && proxima !== dono.proximaCobranca) {
        await db
          .update(usuarios)
          .set({ proximaCobranca: proxima })
          .where(eq(usuarios.id, cobranca.clienteId));
      }
    }
  }

  // pedido do checkout: ativa o pacote/adicional comprado na hora
  if (cobranca.pedido) {
    await aplicarPedido(cobranca.clienteId, cobranca.pedido);
  }

  // pagamento confirmado gera comissao para quem indicou este cliente
  const [pagante] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, cobranca.clienteId));
  if (pagante?.indicadoPor) {
    try {
      await apurarComissoes(pagante.indicadoPor);
    } catch {
      /* comissao nao pode derrubar a baixa do pagamento */
    }
  }

  // aviso ao admin: alerta no painel + e-mail (quando o Resend está ligado)
  const [atualizado] = await db
    .select({ nome: usuarios.nome, proximaCobranca: usuarios.proximaCobranca })
    .from(usuarios)
    .where(eq(usuarios.id, cobranca.clienteId));

  await avisarAdminPagamento({
    clienteId: cobranca.clienteId,
    clienteNome: atualizado?.nome,
    valor: cobranca.valor,
    descricao: cobranca.descricao || "Mensalidade PLAYPLUSNOW",
    origem,
    referencia: cobranca.txid,
    proximaCobranca: atualizado?.proximaCobranca || null,
  });

  // aviso ao cliente: some do painel a faixa de bloqueio e confirma a liberação
  await notificar({
    escopo: "cliente",
    clienteId: cobranca.clienteId,
    tipo: "pagamento",
    severidade: "info",
    titulo: "Pagamento confirmado",
    mensagem: `Recebemos R$ ${cobranca.valor.toFixed(2).replace(".", ",")}. Seu acesso está liberado.`,
    destino: "faturas",
    chave: `pago:cliente:${cobranca.txid}`,
  });

  return { ok: true, jaEstava: false, clienteId: cobranca.clienteId };
}

/**
 * RECONFERÊNCIA ATIVA — pergunta ao Mercado Pago se a cobrança já foi paga.
 *
 * O webhook é o caminho principal, mas ele depende de o site estar publicado
 * e alcançável. Esta função é a rede de segurança: o painel do cliente e o
 * checkout chamam a cada consulta, então o pagamento cai mesmo se a
 * notificação atrasar, falhar ou o ambiente ser local.
 */
export async function sincronizarCobranca(txid: string) {
  const [cobranca] = await db.select().from(cobrancasPix).where(eq(cobrancasPix.txid, txid));
  if (!cobranca) return null;
  if (cobranca.status !== "aguardando" || !cobranca.provedorId) return cobranca;

  try {
    const pagamento = await buscarPagamento(cobranca.provedorId);
    if (pagamento.status === "approved") {
      await confirmarPagamento(txid, "webhook");
    } else if (["cancelled", "rejected", "refunded"].includes(pagamento.status)) {
      await db
        .update(cobrancasPix)
        .set({ status: "cancelado" })
        .where(eq(cobrancasPix.id, cobranca.id));
    } else if (cobranca.expiraEm && cobranca.expiraEm < new Date()) {
      await db
        .update(cobrancasPix)
        .set({ status: "expirado" })
        .where(eq(cobrancasPix.id, cobranca.id));
    }
  } catch {
    /* indisponibilidade do gateway não pode quebrar a tela do cliente */
  }

  const [fresca] = await db.select().from(cobrancasPix).where(eq(cobrancasPix.txid, txid));
  return fresca ?? cobranca;
}

export const pix = {
  /** cliente gera a cobrança da própria fatura em aberto */
  cobrar: authed
    .input(z.object({ faturaId: z.number().int().optional() }))
    .handler(async ({ context, input }) => {
      const cliente = await clienteDaSessao(context.user.id);

      let fatura: typeof faturas.$inferSelect | undefined;
      if (input.faturaId) {
        [fatura] = await db
          .select()
          .from(faturas)
          .where(and(eq(faturas.id, input.faturaId), eq(faturas.clienteId, cliente.id)));
      } else {
        [fatura] = await db
          .select()
          .from(faturas)
          .where(and(eq(faturas.clienteId, cliente.id), eq(faturas.status, "aberto")))
          .orderBy(desc(faturas.competencia))
          .limit(1);
      }

      const valor = fatura ? fatura.valorFinal || fatura.valor : cliente.valor;
      if (valor <= 0) throw new ORPCError("BAD_REQUEST", { message: "Nada a cobrar" });

      // reaproveita cobrança viva da mesma fatura em vez de gerar QR novo
      const [viva] = await db
        .select()
        .from(cobrancasPix)
        .where(
          and(eq(cobrancasPix.clienteId, cliente.id), eq(cobrancasPix.status, "aguardando")),
        )
        .orderBy(desc(cobrancasPix.criadoEm))
        .limit(1);

      if (viva && viva.faturaId === (fatura?.id ?? null) && viva.expiraEm && viva.expiraEm > new Date()) {
        return {
          txid: viva.txid,
          valor: viva.valor,
          descricao: viva.descricao,
          copiaECola: viva.copiaECola,
          qrBase64: viva.qrBase64,
          linkPagamento: viva.linkPagamento,
          provedor: viva.provedor,
          expiraEm: viva.expiraEm.toISOString(),
          status: viva.status,
        };
      }

      return abrirCobranca({
        clienteId: cliente.id,
        valor,
        descricao: fatura?.descricao || "Mensalidade PLAYPLUSNOW",
        faturaId: fatura?.id ?? null,
      });
    }),

  /** o painel consulta em intervalos até virar "pago" */
  consultar: authed
    .input(z.object({ txid: z.string().min(4) }))
    .handler(async ({ context, input }) => {
      const cliente = await clienteDaSessao(context.user.id);
      const [dono] = await db
        .select({ id: cobrancasPix.id })
        .from(cobrancasPix)
        .where(and(eq(cobrancasPix.txid, input.txid), eq(cobrancasPix.clienteId, cliente.id)));
      if (!dono) throw new ORPCError("NOT_FOUND", { message: "Cobrança não encontrada" });

      const cobranca = await sincronizarCobranca(input.txid);
      if (!cobranca) throw new ORPCError("NOT_FOUND", { message: "Cobrança não encontrada" });
      return {
        status: cobranca.status,
        valor: cobranca.valor,
        pagoEm: cobranca.pagoEm ? cobranca.pagoEm.toISOString() : null,
      };
    }),

  /* ---------------- admin ---------------- */

  /** últimas cobranças geradas */
  listar: adminOnly.handler(async () => {
    const params = await lerParametros();
    const linhas = await db
      .select({
        id: cobrancasPix.id,
        txid: cobrancasPix.txid,
        cliente: usuarios.nome,
        clienteId: cobrancasPix.clienteId,
        valor: cobrancasPix.valor,
        status: cobrancasPix.status,
        provedor: cobrancasPix.provedor,
        criadoEm: cobrancasPix.criadoEm,
        pagoEm: cobrancasPix.pagoEm,
      })
      .from(cobrancasPix)
      .innerJoin(usuarios, eq(usuarios.id, cobrancasPix.clienteId))
      .orderBy(desc(cobrancasPix.criadoEm))
      .limit(60);

    return {
      provedor: PROVEDORES[params.pixProvedor] ? params.pixProvedor : PROVEDOR_PADRAO,
      provedoresDisponiveis: Object.keys(PROVEDORES),
      chaveConfigurada: mercadoPagoConfigurado(),
      ambiente: ambienteMP(),
      urlWebhook: urlWebhookMP(),
      dominioPublico: urlPublicaSegura(),
      cobrancas: linhas.map((l) => ({
        ...l,
        criadoEm: l.criadoEm.toISOString(),
        pagoEm: l.pagoEm ? l.pagoEm.toISOString() : null,
      })),
    };
  }),

  /** baixa manual (modo simulado ou pagamento fora do gateway) */
  confirmar: adminOnly
    .input(z.object({ txid: z.string().min(4) }))
    .handler(async ({ input }) => confirmarPagamento(input.txid, "admin")),

  /** cancela uma cobrança aguardando */
  cancelar: adminOnly
    .input(z.object({ txid: z.string().min(4) }))
    .handler(async ({ input }) => {
      await db
        .update(cobrancasPix)
        .set({ status: "cancelado" })
        .where(eq(cobrancasPix.txid, input.txid));
      return { ok: true };
    }),
};
