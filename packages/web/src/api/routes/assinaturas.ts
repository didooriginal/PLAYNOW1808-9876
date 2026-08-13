import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { assinaturas as tabelaAssinaturas, cobrancasPix, usuarios } from "../database/schema";
import { enxugar, precificarPedido, type EntradaPedido, type Pedido } from "../lib/pedidos";
import { enviarEmail } from "../services/email";
import { templates } from "../lib/emails/templates";
import {
  buscarAssinaturaMP,
  cancelarAssinaturaMP,
  chavePublicaMP,
  criarAssinaturaMP,
  ErroMercadoPago,
  mercadoPagoConfigurado,
  urlPublica,
} from "../lib/mercadopago";
import { confirmarPagamento } from "./pix";
import { notificar } from "./notificacoes";

/**
 * ASSINATURA NO CARTÃO DE CRÉDITO — cobrança recorrente automática.
 * ------------------------------------------------------------------
 * Usa a API de Assinaturas do Mercado Pago (Preapproval). O cliente informa o
 * cartão UMA vez no `init_point` do MP; a partir daí o próprio Mercado Pago
 * cobra a cada ciclo e avisa o sistema pelo webhook. Não guardamos número de
 * cartão em nenhum momento — o dado sensível nunca passa pelo nosso servidor.
 *
 * Cada cobrança aprovada é registrada como uma linha em `cobrancas_pix` e
 * baixada por `confirmarPagamento`, exatamente como um Pix. Um caminho só:
 * mesma quitação de fatura, mesma ativação de pacote, mesma comissão de
 * afiliado, mesmo aviso ao admin.
 */

const entrada = z.object({
  pacoteId: z.number().int().nullable().optional(),
  comboId: z.number().int().nullable().optional(),
  apps: z.array(z.string()).optional(),
  ciclo: z.enum(["mensal", "anual"]).optional(),
  jogos: z.boolean().optional(),
});

function comoEntrada(input: z.infer<typeof entrada>): EntradaPedido {
  return {
    pacoteId: input.pacoteId ?? null,
    comboId: input.comboId ?? null,
    apps: input.apps ?? [],
    ciclo: input.ciclo ?? "mensal",
    jogos: input.jogos ?? false,
  };
}

async function clienteDaSessao(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

function gerarReferencia(clienteId: number) {
  const aleatorio = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ASSIN${String(clienteId).padStart(4, "0")}${Date.now().toString(36).toUpperCase()}${aleatorio}`;
}

/* ------------------------------------------------------------------ */
/* BAIXA DE UMA COBRANÇA DA ASSINATURA                                 */
/* ------------------------------------------------------------------ */

/**
 * Registra e baixa uma cobrança recorrente aprovada. Idempotente pela
 * `txid` (única): o mesmo evento reenviado pelo Mercado Pago não cobra,
 * não duplica fatura e não notifica duas vezes.
 */
export async function baixarCobrancaAssinatura(entradaBaixa: {
  assinatura: typeof tabelaAssinaturas.$inferSelect;
  /** id do pagamento no Mercado Pago (payment ou authorized_payment) */
  pagamentoId: string;
  valor?: number;
}) {
  const { assinatura } = entradaBaixa;
  const txid = `MPSUB-${entradaBaixa.pagamentoId}`.slice(0, 60);

  const [existente] = await db
    .select({ status: cobrancasPix.status })
    .from(cobrancasPix)
    .where(eq(cobrancasPix.txid, txid));

  if (!existente) {
    // o pedido só entra na PRIMEIRA cobrança: é ele que liga o pacote.
    // nas renovações a cobrança é "fatura simples" e só empurra o vencimento.
    const primeira = assinatura.cobrancasPagas === 0;
    await db.insert(cobrancasPix).values({
      clienteId: assinatura.clienteId,
      faturaId: null,
      provedor: assinatura.provedor,
      txid,
      provedorId: entradaBaixa.pagamentoId,
      valor: entradaBaixa.valor ?? assinatura.valor,
      descricao: `${assinatura.titulo} — cartão de crédito (recorrente)`,
      pedido: primeira ? ((assinatura.pedido ?? null) as Pedido | null) : null,
      copiaECola: "",
      status: "aguardando",
    });
  } else if (existente.status === "pago") {
    return { ok: true, jaEstava: true };
  }

  const resultado = await confirmarPagamento(txid, "assinatura");

  const agora = new Date();
  const [dono] = await db
    .select({ proximaCobranca: usuarios.proximaCobranca })
    .from(usuarios)
    .where(eq(usuarios.id, assinatura.clienteId));

  await db
    .update(tabelaAssinaturas)
    .set({
      status: "authorized",
      cobrancasPagas: assinatura.cobrancasPagas + 1,
      ultimoPagamentoEm: agora,
      proximaCobranca: dono?.proximaCobranca ?? "",
      atualizadoEm: agora,
    })
    .where(eq(tabelaAssinaturas.id, assinatura.id));

  // e-mail de confirmação só nas RENOVAÇÕES (a primeira cobrança já recebe a
  // entrega de acesso em lib/pedidos.ts) — falha de envio não afeta a baixa
  if (assinatura.cobrancasPagas > 0) {
    try {
      const [cliente] = await db
        .select({ nome: usuarios.nome, email: usuarios.email })
        .from(usuarios)
        .where(eq(usuarios.id, assinatura.clienteId));
      if (cliente) {
        const email = templates.confirmacaoRenovacao({
          nome: cliente.nome,
          valor: `R$ ${(entradaBaixa.valor ?? assinatura.valor).toFixed(2).replace(".", ",")}`,
          validade: dono?.proximaCobranca
            ? dono.proximaCobranca.split("-").reverse().join("/")
            : "—",
        });
        await enviarEmail({
          para: cliente.email,
          assunto: email.assunto,
          texto: email.texto,
          html: email.html,
        });
      }
    } catch (e) {
      console.error("[Email] falha ao enviar a confirmação de renovação:", e);
    }
  }

  return resultado;
}

/** sincroniza o status da assinatura com o Mercado Pago */
export async function sincronizarAssinatura(id: number) {
  const [assinatura] = await db
    .select()
    .from(tabelaAssinaturas)
    .where(eq(tabelaAssinaturas.id, id));
  if (!assinatura || !assinatura.provedorId) return assinatura ?? null;

  try {
    const remota = await buscarAssinaturaMP(assinatura.provedorId);
    if (remota.status && remota.status !== assinatura.status) {
      await db
        .update(tabelaAssinaturas)
        .set({ status: remota.status, atualizadoEm: new Date() })
        .where(eq(tabelaAssinaturas.id, assinatura.id));
    }
  } catch {
    /* gateway fora do ar não pode quebrar a tela */
  }

  const [fresca] = await db
    .select()
    .from(tabelaAssinaturas)
    .where(eq(tabelaAssinaturas.id, id));
  return fresca ?? assinatura;
}

function paraFront(a: typeof tabelaAssinaturas.$inferSelect) {
  return {
    id: a.id,
    status: a.status,
    ciclo: a.ciclo as "mensal" | "anual",
    valor: a.valor,
    titulo: a.titulo,
    initPoint: a.initPoint,
    provedorId: a.provedorId,
    referencia: a.referencia,
    cobrancasPagas: a.cobrancasPagas,
    proximaCobranca: a.proximaCobranca,
    ultimoPagamentoEm: a.ultimoPagamentoEm ? a.ultimoPagamentoEm.toISOString() : null,
    criadoEm: a.criadoEm.toISOString(),
  };
}

export const assinaturasRota = {
  /** o cliente vê se já existe cartão recorrente ativo */
  minha: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    const [atual] = await db
      .select()
      .from(tabelaAssinaturas)
      .where(eq(tabelaAssinaturas.clienteId, cliente.id))
      .orderBy(desc(tabelaAssinaturas.criadoEm))
      .limit(1);
    if (!atual) return { assinatura: null, chavePublica: chavePublicaMP() };
    const fresca = await sincronizarAssinatura(atual.id);
    return {
      assinatura: fresca ? paraFront(fresca) : null,
      chavePublica: chavePublicaMP(),
    };
  }),

  /**
   * Cria a assinatura e devolve o `initPoint`: o front redireciona o cliente
   * para lá, ele informa o cartão e o Mercado Pago passa a cobrar sozinho.
   */
  criar: authed.input(entrada).handler(async ({ context, input }) => {
    if (!mercadoPagoConfigurado()) {
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Cartão indisponível: credenciais do Mercado Pago ausentes no servidor.",
      });
    }
    const cliente = await clienteDaSessao(context.user.id);

    let pedido;
    try {
      pedido = await precificarPedido(comoEntrada(input));
    } catch (e) {
      throw new ORPCError("BAD_REQUEST", { message: (e as Error).message });
    }
    if (pedido.valor <= 0) throw new ORPCError("BAD_REQUEST", { message: "Nada a cobrar" });

    // já existe cartão autorizado? reaproveita em vez de criar assinatura dupla
    const [viva] = await db
      .select()
      .from(tabelaAssinaturas)
      .where(eq(tabelaAssinaturas.clienteId, cliente.id))
      .orderBy(desc(tabelaAssinaturas.criadoEm))
      .limit(1);
    if (viva && viva.status === "pending" && viva.valor === pedido.valor && viva.initPoint) {
      return { ...paraFront(viva), pedido, reaproveitada: true };
    }
    if (viva && viva.status === "authorized") {
      throw new ORPCError("CONFLICT", {
        message:
          "Já existe uma assinatura ativa no cartão. Cancele a atual antes de contratar outra.",
      });
    }

    const referencia = gerarReferencia(cliente.id);
    const compacto = enxugar(pedido);

    let remota;
    try {
      remota = await criarAssinaturaMP({
        titulo: `PLAYPLUSNOW — ${pedido.titulo}`,
        valor: pedido.valor,
        ciclo: pedido.ciclo,
        emailPagador: cliente.email,
        referencia,
        urlRetorno: `${urlPublica()}/dashboard?assinatura=ok`,
      });
    } catch (e) {
      if (e instanceof ErroMercadoPago) {
        await notificar({
          escopo: "admin",
          clienteId: cliente.id,
          tipo: "pagamento",
          severidade: "critico",
          titulo: "Falha ao criar assinatura no cartão",
          mensagem: `${e.detalhe} (HTTP ${e.status}). Cliente: ${cliente.nome}.`,
          destino: "pix",
          chave: `mp:assin:falha:${referencia}`,
        });
        throw new ORPCError("BAD_GATEWAY", {
          message: `O Mercado Pago recusou a criação da assinatura (${e.detalhe}).`,
        });
      }
      throw e;
    }

    const [criada] = await db
      .insert(tabelaAssinaturas)
      .values({
        clienteId: cliente.id,
        provedor: "mercadopago",
        provedorId: remota.id,
        referencia,
        status: remota.status || "pending",
        ciclo: pedido.ciclo,
        valor: pedido.valor,
        titulo: pedido.titulo,
        pedido: compacto,
        initPoint: remota.initPoint,
      })
      .returning();

    // cartão passa a ser a forma de pagamento registrada do cliente
    await db
      .update(usuarios)
      .set({ formaPagamento: "cartao" })
      .where(eq(usuarios.id, cliente.id));

    return { ...paraFront(criada), pedido, reaproveitada: false };
  }),

  /** cliente cancela a recorrência (acesso segue até o vencimento pago) */
  cancelar: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id);
    const [atual] = await db
      .select()
      .from(tabelaAssinaturas)
      .where(eq(tabelaAssinaturas.clienteId, cliente.id))
      .orderBy(desc(tabelaAssinaturas.criadoEm))
      .limit(1);
    if (!atual) throw new ORPCError("NOT_FOUND", { message: "Nenhuma assinatura encontrada" });

    if (atual.provedorId) {
      try {
        await cancelarAssinaturaMP(atual.provedorId);
      } catch (e) {
        if (!(e instanceof ErroMercadoPago)) throw e;
      }
    }

    await db
      .update(tabelaAssinaturas)
      .set({ status: "cancelled", canceladaEm: new Date(), atualizadoEm: new Date() })
      .where(eq(tabelaAssinaturas.id, atual.id));

    await notificar({
      escopo: "admin",
      clienteId: cliente.id,
      tipo: "pagamento",
      severidade: "alerta",
      titulo: "Assinatura no cartão cancelada",
      mensagem: `${cliente.nome} cancelou a recorrência de ${atual.titulo}.`,
      destino: "clientes",
      chave: `assin:cancelada:${atual.referencia}`,
    });

    return { ok: true };
  }),

  /* ---------------- admin ---------------- */

  listar: adminOnly.handler(async () => {
    const linhas = await db
      .select({
        id: tabelaAssinaturas.id,
        cliente: usuarios.nome,
        clienteId: tabelaAssinaturas.clienteId,
        status: tabelaAssinaturas.status,
        ciclo: tabelaAssinaturas.ciclo,
        valor: tabelaAssinaturas.valor,
        titulo: tabelaAssinaturas.titulo,
        cobrancasPagas: tabelaAssinaturas.cobrancasPagas,
        proximaCobranca: tabelaAssinaturas.proximaCobranca,
        ultimoPagamentoEm: tabelaAssinaturas.ultimoPagamentoEm,
        criadoEm: tabelaAssinaturas.criadoEm,
      })
      .from(tabelaAssinaturas)
      .innerJoin(usuarios, eq(usuarios.id, tabelaAssinaturas.clienteId))
      .orderBy(desc(tabelaAssinaturas.criadoEm))
      .limit(60);

    return linhas.map((l) => ({
      ...l,
      ultimoPagamentoEm: l.ultimoPagamentoEm ? l.ultimoPagamentoEm.toISOString() : null,
      criadoEm: l.criadoEm.toISOString(),
    }));
  }),
};
