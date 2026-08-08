import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { ping } from "./routes/ping";
import { pacotesRoutes } from "./routes/pacotes";
import { contasRoutes } from "./routes/contas";
import { usuariosRoutes } from "./routes/usuarios";
import { seed } from "./routes/seed";
import { aplicativosRoutes } from "./routes/aplicativos";
import { alocacoesRoutes } from "./routes/alocacoes";
import { suporteRoutes } from "./routes/suporte";
import { recompensasRoutes } from "./routes/recompensas";
import { faturasRoutes } from "./routes/faturas";
import { combosRoutes } from "./routes/combos";
import { codigosRoutes, registrarEmail } from "./routes/codigos";
import { auth } from "./auth";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
// Patterns and examples: skills/app/references/api.md
export const router = {
  ping,
  pacotes: pacotesRoutes,
  contas: contasRoutes,
  usuarios: usuariosRoutes,
  aplicativos: aplicativosRoutes,
  alocacoes: alocacoesRoutes,
  suporte: suporteRoutes,
  recompensas: recompensasRoutes,
  faturas: faturasRoutes,
  combos: combosRoutes,
  codigos: codigosRoutes,
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

export default app;
