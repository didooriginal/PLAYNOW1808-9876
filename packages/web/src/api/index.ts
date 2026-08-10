import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { ping } from "./routes/ping";
import { pacotes } from "./routes/pacotes";
import { contas } from "./routes/contas";
import { usuarios } from "./routes/usuarios";
import { seed } from "./routes/seed";
import { aplicativos } from "./routes/aplicativos";
import { alocacoes } from "./routes/alocacoes";
import { suporte } from "./routes/suporte";
import { recompensas } from "./routes/recompensas";
import { faturas } from "./routes/faturas";
import { combos } from "./routes/combos";
import { codigos, registrarEmail } from "./routes/codigos";
import { netflix } from "./routes/netflix";
import { notificacoes } from "./routes/notificacoes";
import { afiliados } from "./routes/afiliados";
import { giftcards } from "./routes/giftcards";
import { jogos } from "./routes/jogos";
import { saude } from "./routes/saude";
import { winback } from "./routes/winback";
import { pix, confirmarPagamento } from "./routes/pix";
import { checkout } from "./routes/checkout";
import { senha } from "./routes/senha";
import { auth } from "./auth";
import { criarAssistente } from "./agent";
import { criarCopiloto } from "./agent/admin";
import { createAgentUIStreamResponse } from "ai";
import { eq } from "drizzle-orm";
import { db } from "./database";
import { usuarios as tabelaUsuarios } from "./database/schema";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
// Patterns and examples: skills/app/references/api.md
export const router = {
  ping,
  pacotes,
  contas,
  usuarios,
  aplicativos,
  alocacoes,
  suporte,
  recompensas,
  faturas,
  combos,
  codigos,
  netflix,
  notificacoes,
  afiliados,
  giftcards,
  jogos,
  saude,
  winback,
  pix,
  checkout,
  senha,
  seed,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);
// Rare plain-HTTP endpoints (webhooks, streaming, the Better Auth handler)
// register here with full paths, e.g. app.post("/api/webhooks/example", ...)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/**
 * Webhook genérico de inbound email da Central de Códigos.
 * Aceita qualquer provedor: basta mandar JSON com os campos abaixo (nomes
 * alternativos comuns também são aceitos). Se `EMAIL_WEBHOOK_TOKEN` estiver
 * no .env, o header `x-webhook-token` passa a ser obrigatório.
 */
app.post("/api/webhooks/email", async (c) => {
  const esperado = process.env.EMAIL_WEBHOOK_TOKEN;
  if (esperado && c.req.header("x-webhook-token") !== esperado) {
    return c.json({ ok: false, erro: "token inválido" }, 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    const tipo = c.req.header("content-type") ?? "";
    payload = tipo.includes("application/json")
      ? ((await c.req.json()) as Record<string, unknown>)
      : ((await c.req.parseBody()) as Record<string, unknown>);
  } catch {
    return c.json({ ok: false, erro: "corpo inválido" }, 400);
  }

  const texto = (...chaves: string[]) => {
    for (const k of chaves) {
      const v = payload[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  const corpo = texto("corpo", "text", "body", "plain", "html", "TextBody", "HtmlBody");
  if (!corpo) return c.json({ ok: false, erro: "e-mail sem corpo" }, 400);

  const resultado = await registrarEmail({
    remetente: texto("remetente", "from", "sender", "From"),
    destinatario: texto("destinatario", "to", "recipient", "To"),
    assunto: texto("assunto", "subject", "Subject"),
    corpo,
    origem: "webhook",
  });

  return resultado.ok
    ? c.json({ ok: true, codigo: resultado.registro.codigo }, 200)
    : c.json({ ok: false, erro: resultado.motivo }, 422);
});

/**
 * ASSISTENTE DE IA DO PAINEL — resposta em streaming, por isso rota HTTP pura.
 * O cliente e resolvido pela SESSAO (nunca pelo corpo da requisicao), e o
 * agente e montado com tools restritas a esse cliente.
 */
app.post("/api/agent/messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ erro: "sessão obrigatória" }, 401);

  const [porVinculo] = await db
    .select()
    .from(tabelaUsuarios)
    .where(eq(tabelaUsuarios.authUserId, session.user.id));
  const cliente =
    porVinculo ??
    (
      await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.email, session.user.email.toLowerCase()))
    )[0];

  if (!cliente) return c.json({ erro: "cliente não encontrado" }, 404);

  let messages: unknown = [];
  try {
    ({ messages } = (await c.req.json()) as { messages: unknown });
  } catch {
    return c.json({ erro: "corpo inválido" }, 400);
  }

  const agent = criarAssistente({ clienteId: cliente.id, nome: cliente.nome });
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages as Parameters<typeof createAgentUIStreamResponse>[0]["uiMessages"],
  });
});

/**
 * COPILOTO ADMIN — streaming de chat exclusivo do painel administrativo.
 * Exige sessão E `usuarios.admin = true`; qualquer outro caso recebe 401/403/404
 * antes de o agente ser montado.
 */
app.post("/api/agent/admin-messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ erro: "sessão obrigatória" }, 401);

  const [porVinculo] = await db
    .select()
    .from(tabelaUsuarios)
    .where(eq(tabelaUsuarios.authUserId, session.user.id));
  const eu =
    porVinculo ??
    (
      await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.email, session.user.email.toLowerCase()))
    )[0];

  if (!eu) return c.json({ erro: "usuário não encontrado" }, 404);
  if (!eu.admin) return c.json({ erro: "acesso restrito a administradores" }, 403);

  let messages: unknown = [];
  try {
    ({ messages } = (await c.req.json()) as { messages: unknown });
  } catch {
    return c.json({ erro: "corpo inválido" }, 400);
  }

  const agent = criarCopiloto({ nome: eu.nome });
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages as Parameters<typeof createAgentUIStreamResponse>[0]["uiMessages"],
  });
});

/**
 * WEBHOOK DO GATEWAY PIX — baixa automática.
 * Aceita os formatos mais comuns ({ txid }, { pix: [{ txid }] }, { data: { id } }).
 * Protegido por `PIX_WEBHOOK_TOKEN` quando a variável existir no .env.
 */
app.post("/api/webhooks/pix", async (c) => {
  const esperado = process.env.PIX_WEBHOOK_TOKEN;
  if (esperado && c.req.header("x-webhook-token") !== esperado) {
    return c.json({ ok: false, erro: "token inválido" }, 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ ok: false, erro: "corpo inválido" }, 400);
  }

  const lista = Array.isArray(payload.pix) ? (payload.pix as Record<string, unknown>[]) : [];
  const dados = (payload.data ?? {}) as Record<string, unknown>;
  const txid =
    (typeof payload.txid === "string" && payload.txid) ||
    (typeof lista[0]?.txid === "string" && (lista[0].txid as string)) ||
    (typeof dados.txid === "string" && dados.txid) ||
    (typeof dados.id === "string" && dados.id) ||
    "";

  if (!txid) return c.json({ ok: false, erro: "txid ausente" }, 400);

  const resultado = await confirmarPagamento(txid, "webhook");
  return resultado.ok ? c.json({ ok: true }, 200) : c.json(resultado, 404);
});

export default app;
