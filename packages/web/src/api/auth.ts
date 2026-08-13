import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "./database";
import { usuarios } from "./database/schema";
import {
  VALIDADE_RESET,
  marcarResetUsado,
  registrarReset,
  urlRedefinicao,
} from "./lib/senha";

/**
 * Autenticação e-mail + senha (Better Auth).
 * As tabelas próprias do Better Auth (user/session/account/verification) ficam em
 * ./database/auth-schema.ts. Cada conta criada é VINCULADA a uma linha de `usuarios`
 * (a base de clientes da PLAYPLUSNOW) através de `usuarios.auth_user_id`.
 */
export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    /** validade do link de "esqueci minha senha": 1 hora */
    resetPasswordTokenExpiresIn: VALIDADE_RESET,
    /**
     * Disparo AUTOMÁTICO do link de redefinição. Ignoramos a `url` padrão do
     * Better Auth e montamos a nossa (`/redefinir-senha?token=...`) na mesma
     * origem da requisição, para funcionar em dev, preview e produção.
     * O envio + a fila do /admin ficam em lib/senha.ts.
     */
    sendResetPassword: async ({ user, token }, request) => {
      const origem = request?.headers.get("origin");
      await registrarReset({
        email: user.email,
        nome: user.name,
        link: urlRedefinicao(token, origem),
        origem: "email",
      });
    },
    /** senha trocada com sucesso: encerra o pedido na fila */
    onPasswordReset: async ({ user }) => {
      await marcarResetUsado(user.email);
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  /**
   * Origens confiáveis: em produção só o domínio configurado (WEBSITE_URL) e o
   * host da própria requisição. Nunca `["*"]` — isso liberava CSRF de qualquer site.
   * Em dev libera localhost/preview para o fluxo de desenvolvimento continuar.
   */
  trustedOrigins: (request) => {
    const permitidas = new Set<string>();
    const site = process.env.WEBSITE_URL?.replace(/\/$/, "");
    if (site) permitidas.add(site);
    permitidas.add("https://playplusnow.com.br");
    permitidas.add("https://www.playplusnow.com.br");

    const origin = request?.headers.get("origin");
    const ehDev = process.env.NODE_ENV !== "production";
    if (origin && (ehDev || permitidas.has(origin.replace(/\/$/, "")))) {
      permitidas.add(origin);
    }
    if (ehDev) {
      const host = request?.headers.get("host");
      if (host) {
        permitidas.add(`http://${host}`);
        permitidas.add(`https://${host}`);
      }
    }
    return [...permitidas];
  },
  /** freio de força bruta no login/reset: 20 req por minuto por IP */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 300, max: 5 },
      "/forget-password": { window: 300, max: 4 },
      "/reset-password": { window: 300, max: 8 },
    },
  },
  plugins: [bearer()],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const email = user.email.toLowerCase();
          const [existente] = await db
            .select()
            .from(usuarios)
            .where(eq(usuarios.email, email));

          if (existente) {
            await db
              .update(usuarios)
              .set({ authUserId: user.id })
              .where(eq(usuarios.id, existente.id));
            return;
          }

          await db.insert(usuarios).values({
            nome: user.name || email.split("@")[0],
            email,
            authUserId: user.id,
            statusPagamento: "pendente",
            clienteDesde: new Date().toISOString().slice(0, 10),
          });
        },
      },
    },
  },
});
