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
  seed,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);
// Rare plain-HTTP endpoints (webhooks, streaming, the Better Auth handler)
// register here with full paths, e.g. app.post("/api/webhooks/example", ...)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export default app;
