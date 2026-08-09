import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { notificacoes, usuarios } from "../database/schema";
import {
  DIAS_AVISO_PREVIO,
  diasAteVencimento,
  statusEsperado,
} from "../lib/cobranca";

/**
 * CENTRAL DE ALERTAS
 * ------------------------------------------------------------------
 * Um registro por gatilho, deduplicado pela `chave`. Dois escopos:
 *  - admin   -> fila de alertas operacionais (OTP importante, pedido de TV,
 *               cliente vencendo/atrasado)
 *  - cliente -> avisos no painel do cliente (lembrete de vencimento, bloqueio,
 *               resposta do admin)
 *
 * Nao existe cron no ambiente: a varredura roda (com throttle) sempre que
 * alguem abre o painel. Isso mantem o sistema automatico sem depender de
 * agendador externo.
 */

export type EscopoAlerta = "admin" | "cliente";

type NovoAlerta = {
  escopo: EscopoAlerta;
  clienteId?: number | null;
  tipo: "otp" | "tv" | "vencimento" | "pagamento" | "sistema";
  severidade?: "info" | "alerta" | "critico";
  titulo: string;
  mensagem?: string;
  destino?: string;
  chave: string;
};

/**
 * Cria o alerta se a `chave` ainda nao existir. Sempre seguro de chamar:
 * nunca lanca, para nao derrubar o fluxo principal (webhook, mutation...).
 */
export async function notificar(alerta: NovoAlerta) {
  try {
    const [row] = await db
      .insert(notificacoes)
      .values({
        escopo: alerta.escopo,
        clienteId: alerta.clienteId ?? null,
        tipo: alerta.tipo,
        severidade: alerta.severidade ?? "info",
        titulo: alerta.titulo,
        mensagem: alerta.mensagem ?? "",
        destino: alerta.destino ?? "",
        chave: alerta.chave,
      })
      .onConflictDoNothing({ target: notificacoes.chave })
      .returning();
    if (row && alerta.escopo === "admin") void dispararWebhook(row);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Webhook de saida opcional (Slack, n8n, WhatsApp API, Zapier...).
 * Configure `ALERTAS_WEBHOOK_URL` no .env para receber os alertas do admin
 * fora do painel. Falha de rede nunca quebra a operacao.
 */
async function dispararWebhook(alerta: typeof notificacoes.$inferSelect) {
  const url = process.env.ALERTAS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        origem: "PLAPLUSNOW",
        tipo: alerta.tipo,
        severidade: alerta.severidade,
        titulo: alerta.titulo,
        mensagem: alerta.mensagem,
        destino: alerta.destino,
        criadoEm: alerta.criadoEm,
      }),
    });
  } catch {
    /* alerta continua no painel mesmo se o webhook cair */
  }
}

/* ------------------------------------------------------------------ */
/* VARREDURA AUTOMATICA DE VENCIMENTOS                                 */
/* ------------------------------------------------------------------ */

let ultimaVarredura = 0;
const INTERVALO_VARREDURA = 60_000; // 1 min

/**
 * Reavalia o status de todos os clientes pela data de vencimento e emite os
 * lembretes: 3 dias antes, no dia, e depois do vencimento (a cada dia).
 * Idempotente por dia via `chave`.
 */
export async function varrerVencimentos(forcar = false) {
  const agora = Date.now();
  if (!forcar && agora - ultimaVarredura < INTERVALO_VARREDURA) return { avaliados: 0 };
  ultimaVarredura = agora;

  const clientes = await db.select().from(usuarios).where(eq(usuarios.admin, false));
  const hojeChave = new Date().toISOString().slice(0, 10);
  let mudancas = 0;

  for (const cliente of clientes) {
    const dias = diasAteVencimento(cliente.proximaCobranca);
    if (dias === null) continue;

    const alvo = statusEsperado(cliente.proximaCobranca, cliente.statusPagamento);
    if (alvo !== cliente.statusPagamento) {
      await db
        .update(usuarios)
        .set({ statusPagamento: alvo })
        .where(eq(usuarios.id, cliente.id));
      mudancas++;
    }

    // ---- lembretes do cliente -------------------------------------
    if (dias === DIAS_AVISO_PREVIO) {
      await notificar({
        escopo: "cliente",
        clienteId: cliente.id,
        tipo: "vencimento",
        severidade: "info",
        titulo: `Seu plano vence em ${DIAS_AVISO_PREVIO} dias`,
        mensagem: `Vencimento em ${cliente.proximaCobranca}. Pague antes para não perder o acesso aos apps.`,
        destino: "faturas",
        chave: `venc3:${cliente.id}:${cliente.proximaCobranca}`,
      });
    }
    if (dias === 0) {
      await notificar({
        escopo: "cliente",
        clienteId: cliente.id,
        tipo: "vencimento",
        severidade: "alerta",
        titulo: "Seu plano vence hoje",
        mensagem: "Faça o pagamento hoje para manter os acessos liberados sem interrupção.",
        destino: "faturas",
        chave: `venc0:${cliente.id}:${cliente.proximaCobranca}`,
      });
    }
    if (dias < 0) {
      await notificar({
        escopo: "cliente",
        clienteId: cliente.id,
        tipo: "pagamento",
        severidade: "critico",
        titulo: `Pagamento em atraso há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`,
        mensagem:
          "Os logins e o suporte ficam bloqueados até a regularização. Envie o comprovante para liberar na hora.",
        destino: "faturas",
        chave: `atraso:${cliente.id}:${hojeChave}`,
      });
      await notificar({
        escopo: "admin",
        clienteId: cliente.id,
        tipo: "pagamento",
        severidade: dias < -7 ? "critico" : "alerta",
        titulo: `${cliente.nome} está ${dias < -7 ? "suspenso" : "atrasado"}`,
        mensagem: `Vencimento ${cliente.proximaCobranca} · ${Math.abs(dias)} dias em atraso · ${cliente.email}`,
        destino: "clientes",
        chave: `admin-atraso:${cliente.id}:${hojeChave}`,
      });
    }
    if (dias >= 0 && dias <= DIAS_AVISO_PREVIO) {
      await notificar({
        escopo: "admin",
        clienteId: cliente.id,
        tipo: "vencimento",
        severidade: "info",
        titulo: `Cobrança de ${cliente.nome} vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
        mensagem: `${cliente.proximaCobranca} · R$ ${cliente.valor.toFixed(2)} · ${cliente.formaPagamento}`,
        destino: "clientes",
        chave: `admin-venc:${cliente.id}:${cliente.proximaCobranca}:${dias}`,
      });
    }
  }

  return { avaliados: clientes.length, mudancas };
}

/* ------------------------------------------------------------------ */

const LIMITE = 80;

export const notificacoesRoutes = {
  /** fila de alertas do admin (roda a varredura antes de responder) */
  listar: adminOnly
    .input(
      z
        .object({ apenasNaoLidas: z.boolean().default(false) })
        .default({ apenasNaoLidas: false }),
    )
    .handler(async ({ input }) => {
      await varrerVencimentos();

      const filtro = input.apenasNaoLidas
        ? and(eq(notificacoes.escopo, "admin"), eq(notificacoes.lida, false))
        : eq(notificacoes.escopo, "admin");

      const itens = await db
        .select({
          id: notificacoes.id,
          tipo: notificacoes.tipo,
          severidade: notificacoes.severidade,
          titulo: notificacoes.titulo,
          mensagem: notificacoes.mensagem,
          destino: notificacoes.destino,
          lida: notificacoes.lida,
          criadoEm: notificacoes.criadoEm,
          clienteId: notificacoes.clienteId,
          clienteNome: usuarios.nome,
        })
        .from(notificacoes)
        .leftJoin(usuarios, eq(notificacoes.clienteId, usuarios.id))
        .where(filtro)
        .orderBy(desc(notificacoes.criadoEm))
        .limit(LIMITE);

      const [contagem] = await db
        .select({
          naoLidas: sql<number>`coalesce(sum(case when ${notificacoes.lida} = 0 then 1 else 0 end), 0)`,
          criticos: sql<number>`coalesce(sum(case when ${notificacoes.lida} = 0 and ${notificacoes.severidade} = 'critico' then 1 else 0 end), 0)`,
        })
        .from(notificacoes)
        .where(eq(notificacoes.escopo, "admin"));

      return { itens, naoLidas: contagem?.naoLidas ?? 0, criticos: contagem?.criticos ?? 0 };
    }),

  /** avisos do cliente logado */
  minhas: authed.handler(async ({ context }) => {
    await varrerVencimentos();

    const [cliente] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.authUserId, context.user.id));

    const [porEmail] = cliente
      ? []
      : await db
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(eq(usuarios.email, context.user.email.toLowerCase()));

    const id = cliente?.id ?? porEmail?.id ?? null;
    if (!id) return { itens: [], naoLidas: 0 };

    const itens = await db
      .select()
      .from(notificacoes)
      .where(and(eq(notificacoes.escopo, "cliente"), eq(notificacoes.clienteId, id)))
      .orderBy(desc(notificacoes.criadoEm))
      .limit(30);

    return { itens, naoLidas: itens.filter((i) => !i.lida).length };
  }),

  marcarLida: authed
    .input(z.object({ ids: z.array(z.number().int()).min(1) }))
    .handler(async ({ input }) => {
      await db
        .update(notificacoes)
        .set({ lida: true })
        .where(inArray(notificacoes.id, input.ids));
      return { ok: true };
    }),

  marcarTodas: authed
    .input(z.object({ escopo: z.enum(["admin", "cliente"]) }))
    .handler(async ({ input, context }) => {
      if (input.escopo === "admin") {
        // so o admin limpa a fila do admin
        const [registro] = await db
          .select({ admin: usuarios.admin })
          .from(usuarios)
          .where(eq(usuarios.authUserId, context.user.id));
        if (!registro?.admin) return { ok: false };
        await db
          .update(notificacoes)
          .set({ lida: true })
          .where(eq(notificacoes.escopo, "admin"));
        return { ok: true };
      }

      const [cliente] = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.authUserId, context.user.id));
      const [porEmail] = cliente
        ? []
        : await db
            .select({ id: usuarios.id })
            .from(usuarios)
            .where(eq(usuarios.email, context.user.email.toLowerCase()));
      const alvo = cliente?.id ?? porEmail?.id ?? null;
      if (!alvo) return { ok: false };
      await db
        .update(notificacoes)
        .set({ lida: true })
        .where(and(eq(notificacoes.escopo, "cliente"), eq(notificacoes.clienteId, alvo)));
      return { ok: true };
    }),

  /** roda a varredura na hora (botão "reavaliar" do admin) */
  varrer: adminOnly.handler(() => varrerVencimentos(true)),
};
