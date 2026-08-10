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

/**
 * GATEWAY PIX — adaptador plugável
 * ------------------------------------------------------------------
 * A operação hoje roda no Pix manual (cliente paga, manda print, alguém dá
 * baixa). Este módulo troca isso por cobrança com baixa automática SEM
 * amarrar o produto a um provedor específico.
 *
 * O provedor ativo vem do parâmetro `pixProvedor` (painel → Gestão de Contas):
 *
 *   simulado     → gera um BR Code válido a partir da chave em PIX_CHAVE e
 *                  aceita confirmação manual. Serve para operar já, hoje.
 *   mercadopago | efi | asaas | pagarme → basta implementar `criarCobranca`
 *                  no mapa PROVEDORES abaixo; o resto do sistema não muda.
 *
 * A baixa é sempre a mesma função (`confirmarPagamento`), venha ela do
 * webhook do provedor ou do clique do admin — um caminho só, sem divergência.
 */

/* ------------------------------------------------------------------ */
/* BR CODE (Pix copia-e-cola) — EMV padrão Bacen                       */
/* ------------------------------------------------------------------ */

function campo(id: string, valor: string) {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

/** CRC16-CCITT (polinômio 0x1021), exigido no fim do payload */
export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function semAcento(texto: string, tamanho: number) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, tamanho)
    .trim();
}

/** monta o copia-e-cola estático com valor e txid */
export function montarBrCode(opcoes: {
  chave: string;
  valor: number;
  beneficiario: string;
  cidade: string;
  txid: string;
}) {
  const merchant =
    campo("00", "br.gov.bcb.pix") + campo("01", opcoes.chave.slice(0, 77));
  const payload =
    campo("00", "01") +
    campo("26", merchant) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", opcoes.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", semAcento(opcoes.beneficiario, 25) || "PLAYPLUSNOW") +
    campo("60", semAcento(opcoes.cidade, 15) || "RIO DE JANEIRO") +
    campo("62", campo("05", opcoes.txid.slice(0, 25)));
  const comCrc = `${payload}6304`;
  return comCrc + crc16(comCrc);
}

/* ------------------------------------------------------------------ */
/* PROVEDORES                                                          */
/* ------------------------------------------------------------------ */

type PedidoCobranca = { valor: number; txid: string; descricao: string };
type RespostaCobranca = { copiaECola: string; expiraEm: Date };

const EXPIRA_MIN = 60;

const PROVEDORES: Record<string, (p: PedidoCobranca) => Promise<RespostaCobranca>> = {
  simulado: async (p) => ({
    copiaECola: montarBrCode({
      chave: process.env.PIX_CHAVE || "contato@playplusnow.com",
      valor: p.valor,
      beneficiario: process.env.PIX_BENEFICIARIO || "PLAYPLUSNOW",
      cidade: process.env.PIX_CIDADE || "RIO DE JANEIRO",
      txid: p.txid,
    }),
    expiraEm: new Date(Date.now() + EXPIRA_MIN * 60 * 1000),
  }),
};

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
  const params = await lerParametros();
  const provedor = params.pixProvedor;
  const criar = PROVEDORES[provedor] ?? PROVEDORES.simulado;
  const txid = gerarTxid(entrada.clienteId);
  const resposta = await criar({
    valor: entrada.valor,
    txid,
    descricao: entrada.descricao,
  });

  await db.insert(cobrancasPix).values({
    clienteId: entrada.clienteId,
    faturaId: entrada.faturaId ?? null,
    provedor,
    txid,
    valor: entrada.valor,
    descricao: entrada.descricao,
    pedido: entrada.pedido ?? null,
    copiaECola: resposta.copiaECola,
    status: "aguardando",
    expiraEm: resposta.expiraEm,
  });

  return {
    txid,
    valor: entrada.valor,
    descricao: entrada.descricao,
    copiaECola: resposta.copiaECola,
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
  if (!atual || !/^\d{4}-\d{2}-\d{2}$/.test(atual)) return null;
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

export async function confirmarPagamento(txid: string, origem: "webhook" | "admin") {
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

  await notificar({
    escopo: "admin",
    clienteId: cobranca.clienteId,
    tipo: "pagamento",
    severidade: "info",
    titulo: "Pagamento Pix confirmado",
    mensagem: `R$ ${cobranca.valor.toFixed(2).replace(".", ",")} confirmados via ${origem}. Acesso liberado automaticamente.`,
    destino: "faturas",
    chave: `pix:pago:${cobranca.txid}`,
  });

  return { ok: true, jaEstava: false, clienteId: cobranca.clienteId };
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
      const [cobranca] = await db
        .select()
        .from(cobrancasPix)
        .where(and(eq(cobrancasPix.txid, input.txid), eq(cobrancasPix.clienteId, cliente.id)));
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
      provedor: params.pixProvedor,
      provedoresDisponiveis: Object.keys(PROVEDORES),
      chaveConfigurada: Boolean(process.env.PIX_CHAVE),
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
