import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { base } from "../__core/app";
import { adminOnly } from "../middleware/auth";
import { auth } from "../auth";
import { db } from "../database";
import { resetsSenha, usuarios } from "../database/schema";
import { emailConfigurado, remetente } from "../services/email";

/**
 * RECUPERAÇÃO DE SENHA
 *
 * O pedido do cliente é feito direto no Better Auth pelo front
 * (`authClient.requestPasswordReset`), que dispara o e-mail automaticamente
 * pelo hook `sendResetPassword` em ../auth.ts.
 *
 * Aqui ficam:
 *   - `canal`: público, diz ao front se o envio por e-mail está ativo;
 *   - `fila` / `gerarLink` / `descartar`: visão do admin, para acompanhar os
 *     pedidos e conseguir mandar o link por WhatsApp quando o e-mail não sai
 *     (ex.: domínio ainda não verificado no provedor).
 */

/** só o e-mail já revela demais numa lista — mostramos parcialmente mascarado */
function mascarar(email: string) {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return email;
  const visivel = usuario.slice(0, 2);
  return `${visivel}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}

export const senha = {
  /** Público: o front usa para explicar ao cliente o que vai acontecer. */
  canal: base.handler(async () => ({
    emailAtivo: emailConfigurado(),
    remetente: emailConfigurado() ? remetente() : "",
  })),

  /** Fila de pedidos para o admin acompanhar. */
  fila: adminOnly.handler(async () => {
    const linhas = await db
      .select({
        id: resetsSenha.id,
        email: resetsSenha.email,
        clienteId: resetsSenha.clienteId,
        link: resetsSenha.link,
        status: resetsSenha.status,
        origem: resetsSenha.origem,
        entrega: resetsSenha.entrega,
        erroEntrega: resetsSenha.erroEntrega,
        criadoEm: resetsSenha.criadoEm,
        expiraEm: resetsSenha.expiraEm,
        usadoEm: resetsSenha.usadoEm,
        nome: usuarios.nome,
      })
      .from(resetsSenha)
      .leftJoin(usuarios, eq(usuarios.id, resetsSenha.clienteId))
      .orderBy(desc(resetsSenha.id))
      .limit(60);

    const agora = Date.now();
    const itens = linhas.map((l) => ({
      ...l,
      emailMascarado: mascarar(l.email),
      /** status efetivo: pendente que passou da validade já conta como expirado */
      situacao:
        l.status === "pendente" && l.expiraEm.getTime() < agora
          ? "expirado"
          : l.status,
    }));

    return {
      itens,
      pendentes: itens.filter((i) => i.situacao === "pendente").length,
      falhas: itens.filter(
        (i) => i.entrega === "falhou" || i.entrega === "sem_provedor",
      ).length,
      emailAtivo: emailConfigurado(),
    };
  }),

  /**
   * Admin gera um link novo para um cliente (cliente ligou, não recebeu o
   * e-mail etc.). Passa pelo mesmo fluxo do Better Auth, então o link é
   * legítimo e de uso único.
   */
  gerarLink: adminOnly
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input, context }) => {
      const email = input.email.trim().toLowerCase();
      const origem = context.headers.get("origin") ?? undefined;

      await auth.api.requestPasswordReset({
        body: { email },
        headers: origem ? new Headers({ origin: origem }) : undefined,
      });

      const [linha] = await db
        .select()
        .from(resetsSenha)
        .where(eq(resetsSenha.email, email))
        .orderBy(desc(resetsSenha.id))
        .limit(1);

      // e-mail inexistente: o Better Auth não gera nada (proteção anti-enumeração)
      if (!linha) {
        return {
          ok: false as const,
          motivo: "Não existe conta de login com esse e-mail.",
          link: "",
          entrega: "",
        };
      }

      await db
        .update(resetsSenha)
        .set({ origem: "admin" })
        .where(eq(resetsSenha.id, linha.id));

      return {
        ok: true as const,
        motivo: "",
        link: linha.link,
        entrega: linha.entrega,
      };
    }),

  /** Invalida um pedido (cliente desistiu / pedido suspeito). */
  descartar: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db
        .update(resetsSenha)
        .set({ status: "expirado" })
        .where(eq(resetsSenha.id, input.id));
      return { ok: true };
    }),
};
