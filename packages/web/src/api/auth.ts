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
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
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
