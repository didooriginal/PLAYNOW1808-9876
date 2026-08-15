import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";
import { ehAdmin } from "../lib/sessao";

/** Auth opcional — `context.user` é o usuário da sessão ou null. */
export const withUser = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  return next({
    context: { user: session?.user ?? null, session: session?.session ?? null },
  });
});

/** Procedures protegidas — recusa chamadas sem sessão; `context.user` nunca é null. */
export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { user: session.user, session: session.session } });
});

/**
 * Procedures do painel administrativo — exige sessão E a flag `usuarios.admin`.
 * Protege leituras sensíveis (senhas das contas matrizes, base de clientes) e
 * todas as escritas.
 */
export const adminOnly = authed.use(async ({ context, next }) => {
  // mesmo lookup do `usuarios.eu` (api/lib/sessao.ts) — nunca duas versões
  if (!(await ehAdmin(context.user))) {
    throw new ORPCError("FORBIDDEN", { message: "Acesso restrito ao administrador" });
  }
  return next();
});
