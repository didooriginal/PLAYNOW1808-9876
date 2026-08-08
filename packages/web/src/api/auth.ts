import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "./database";
import { usuarios } from "./database/schema";

/**
 * Autenticação e-mail + senha (Better Auth).
 * As tabelas próprias do Better Auth (user/session/account/verification) ficam em
 * ./database/auth-schema.ts. Cada conta criada é VINCULADA a uma linha de `usuarios`
 * (a base de clientes da PLAPLUSNOW) através de `usuarios.auth_user_id`.
 */
export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
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
            statusPagamento: "vencendo",
            clienteDesde: new Date().toISOString().slice(0, 10),
          });
        },
      },
    },
  },
});
