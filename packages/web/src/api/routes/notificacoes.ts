import { z } from "zod";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { enviarWhatsappSeguro } from "../services/whatsapp";
import { notificacoes as tabelaNotificacoes, usuarios } from "../database/schema";
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
      .insert(tabelaNotificacoes)
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
      .onConflictDoNothing({ target: tabelaNotificacoes.chave })
      .returning();
    if (row && alerta.escopo === "admin") void dispararWebhook(row);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * RESOLUCAO DE ALERTAS
 * ------------------------------------------------------------------
 * "Lida" e "resolvido" sao coisas diferentes: lida = o admin viu; resolvido =
 * o problema acabou. So o resolvido tira o item da fila. A resolucao
 * automatica usa o mesmo prefixo de `chave` que o gatilho gravou, entao nao
 * precisa de cron: quem emite tambem sabe encerrar.
 */
export async function resolverPorPrefixo(prefixos: string[], origem: "auto" | "manual" = "auto") {
  const alvos = prefixos.filter(Boolean);
  if (!alvos.length) return 0;
  try {
    const resultado = await db
      .update(tabelaNotificacoes)
      .set({ resolvidoEm: new Date(), resolvidoPor: origem, lida: true })
      .where(
        and(
          sql`${tabelaNotificacoes.resolvidoEm} is null`,
          or(...alvos.map((p) => like(tabelaNotificacoes.chave, `${p}%`))),
        ),
      )
      .returning({ id: tabelaNotificacoes.id });
    return resultado.length;
  } catch {
    // encerrar alerta nunca pode derrubar o fluxo que chamou (webhook, pagamento...)
    return 0;
  }
}

/** encerra os alertas de cobranca de um cliente — usado quando o pagamento entra */
export function resolverAlertasDeCobranca(clienteId: number) {
  return resolverPorPrefixo([
    `admin-atraso:${clienteId}:`,
    `admin-venc:${clienteId}:`,
    `atraso:${clienteId}:`,
    `venc0:${clienteId}:`,
    `venc3:${clienteId}:`,
  ]);
}

/** encerra os alertas "sem vaga" de um cliente (todos os apps ou um so) */
export function resolverAlertasSemVaga(clienteId: number, servico?: string) {
  return resolverPorPrefixo([
    servico ? `sem-vaga:${clienteId}:${servico}:` : `sem-vaga:${clienteId}:`,
  ]);
}

/**
 * Webhook de saida opcional (Slack, n8n, WhatsApp API, Zapier...).
 * Configure `ALERTAS_WEBHOOK_URL` no .env para receber os alertas do admin
 * fora do painel. Falha de rede nunca quebra a operacao.
 */
async function dispararWebhook(alerta: typeof tabelaNotificacoes.$inferSelect) {
  /**
   * WHATSAPP DO ADMIN: todo alerta de admin tambem vira mensagem no WhatsApp
   * dos numeros configurados em `WHATSAPP_DESTINOS`. Independe do webhook
   * generico abaixo e nunca derruba nada (ver services/whatsapp.ts).
   */
  const marca =
    alerta.severidade === "critico"
      ? "[URGENTE]"
      : alerta.severidade === "alerta"
        ? "[ATENCAO]"
        : "[AVISO]";
  enviarWhatsappSeguro(
    [
      `${marca} PLAYPLUSNOW`,
      alerta.titulo,
      alerta.mensagem || "",
      alerta.destino ? `Painel: aba ${alerta.destino}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const url = process.env.ALERTAS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        origem: "PLAYPLUSNOW",
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

  /**
   * REDE DE SEGURANCA DOS E-MAILS DE COBRANCA.
   * O agendador externo (`/api/cron/vencimento`) continua sendo o caminho
   * principal; isto aqui garante o envio se ele falhar ou ainda nao existir.
   * Import dinamico porque lib/emails/cron.ts importa `notificar` deste
   * arquivo — o ciclo so se resolve em tempo de execucao. Nao usa `await`:
   * a varredura do painel nunca espera o Resend.
   */
  void import("../lib/emails/cron")
    .then((m) => m.dispararLembretesOportunista())
    .catch(() => {});

  const clientes = await db.select().from(usuarios).where(eq(usuarios.admin, false));
  const hojeChave = new Date().toISOString().slice(0, 10);
  let mudancas = 0;

  for (const cliente of clientes) {
    const dias = diasAteVencimento(cliente.proximaCobranca);
    if (dias === null) continue;

    /**
     * AUTO-RESOLUCAO: o cliente pagou e o vencimento foi empurrado para longe,
     * entao os alertas de atraso/vencimento daquele ciclo nao sao mais um
     * problema — somem da fila sem o admin precisar clicar em nada.
     */
    if (cliente.statusPagamento === "ativo" && dias > DIAS_AVISO_PREVIO) {
      await resolverAlertasDeCobranca(cliente.id);
    }

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
          "Os logins e o suporte ficam bloqueados até a regularização. Pague o Pix no painel e tudo volta na hora.",
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

export const notificacoes = {
  /** fila de alertas do admin (roda a varredura antes de responder) */
  listar: adminOnly
    .input(
      z
        .object({
          apenasNaoLidas: z.boolean().default(false),
          /** por padrao a fila mostra so o que ainda e problema */
          incluirResolvidos: z.boolean().default(false),
        })
        .default({ apenasNaoLidas: false, incluirResolvidos: false }),
    )
    .handler(async ({ input }) => {
      await varrerVencimentos();

      const condicoes = [eq(tabelaNotificacoes.escopo, "admin")];
      if (input.apenasNaoLidas) condicoes.push(eq(tabelaNotificacoes.lida, false));
      if (!input.incluirResolvidos)
        condicoes.push(sql`${tabelaNotificacoes.resolvidoEm} is null`);
      const filtro = and(...condicoes);

      const itens = await db
        .select({
          id: tabelaNotificacoes.id,
          tipo: tabelaNotificacoes.tipo,
          severidade: tabelaNotificacoes.severidade,
          titulo: tabelaNotificacoes.titulo,
          mensagem: tabelaNotificacoes.mensagem,
          destino: tabelaNotificacoes.destino,
          lida: tabelaNotificacoes.lida,
          resolvidoEm: tabelaNotificacoes.resolvidoEm,
          resolvidoPor: tabelaNotificacoes.resolvidoPor,
          criadoEm: tabelaNotificacoes.criadoEm,
          clienteId: tabelaNotificacoes.clienteId,
          clienteNome: usuarios.nome,
        })
        .from(tabelaNotificacoes)
        .leftJoin(usuarios, eq(tabelaNotificacoes.clienteId, usuarios.id))
        .where(filtro)
        .orderBy(desc(tabelaNotificacoes.criadoEm))
        .limit(LIMITE);

      const [contagem] = await db
        .select({
          naoLidas: sql<number>`coalesce(sum(case when ${tabelaNotificacoes.lida} = 0 then 1 else 0 end), 0)`,
          criticos: sql<number>`coalesce(sum(case when ${tabelaNotificacoes.lida} = 0 and ${tabelaNotificacoes.severidade} = 'critico' then 1 else 0 end), 0)`,
        })
        .from(tabelaNotificacoes)
        .where(
          and(
            eq(tabelaNotificacoes.escopo, "admin"),
            sql`${tabelaNotificacoes.resolvidoEm} is null`,
          ),
        );

      return { itens, naoLidas: contagem?.naoLidas ?? 0, criticos: contagem?.criticos ?? 0 };
    }),

  /**
   * Botao "resolvido" do painel: tira o alerta da fila na hora.
   * `reabrir` desfaz, caso o admin encerre por engano.
   */
  resolver: adminOnly
    .input(
      z.object({
        ids: z.array(z.number().int()).min(1),
        reabrir: z.boolean().default(false),
      }),
    )
    .handler(async ({ input }) => {
      await db
        .update(tabelaNotificacoes)
        .set(
          input.reabrir
            ? { resolvidoEm: null, resolvidoPor: null }
            : { resolvidoEm: new Date(), resolvidoPor: "manual", lida: true },
        )
        .where(inArray(tabelaNotificacoes.id, input.ids));
      return { ok: true, total: input.ids.length };
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
      .from(tabelaNotificacoes)
      .where(and(eq(tabelaNotificacoes.escopo, "cliente"), eq(tabelaNotificacoes.clienteId, id)))
      .orderBy(desc(tabelaNotificacoes.criadoEm))
      .limit(30);

    return { itens, naoLidas: itens.filter((i) => !i.lida).length };
  }),

  marcarLida: authed
    .input(z.object({ ids: z.array(z.number().int()).min(1) }))
    .handler(async ({ input, context }) => {
      // sem este filtro qualquer cliente logado marcava a notificacao de outro (IDOR)
      const [cliente] = await db
        .select({ id: usuarios.id, admin: usuarios.admin })
        .from(usuarios)
        .where(eq(usuarios.authUserId, context.user.id));
      if (!cliente) return { ok: false };

      const filtro = cliente.admin
        ? inArray(tabelaNotificacoes.id, input.ids)
        : and(
            inArray(tabelaNotificacoes.id, input.ids),
            eq(tabelaNotificacoes.clienteId, cliente.id),
          );

      await db.update(tabelaNotificacoes).set({ lida: true }).where(filtro);
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
          .update(tabelaNotificacoes)
          .set({ lida: true })
          .where(eq(tabelaNotificacoes.escopo, "admin"));
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
        .update(tabelaNotificacoes)
        .set({ lida: true })
        .where(and(eq(tabelaNotificacoes.escopo, "cliente"), eq(tabelaNotificacoes.clienteId, alvo)));
      return { ok: true };
    }),

  /** roda a varredura na hora (botão "reavaliar" do admin) */
  varrer: adminOnly.handler(() => varrerVencimentos(true)),
};
