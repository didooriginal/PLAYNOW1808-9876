import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { base } from "../__core/app";
import { adminOnly, authed } from "../middleware/auth";
import { auth } from "../auth";
import { db } from "../database";
import { resetsSenha, usuarios } from "../database/schema";
import { user as contasLogin } from "../database/auth-schema";
import { emailConfigurado, remetente } from "../services/email";
import { garantirFichaDaSessao } from "../lib/sessao";

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
  /**
   * Cliente que entrou com senha provisoria (conta criada pelo ADM) confirma
   * que trocou a senha: derruba a flag e libera o painel.
   * Nao mexe na senha em si — quem troca e o Better Auth, pelo front.
   */
  confirmarTroca: authed.handler(async ({ context }) => {
    const ficha = await garantirFichaDaSessao(context.user);
    if (!ficha) return { ok: false };
    await db
      .update(usuarios)
      .set({ precisaTrocarSenha: false })
      .where(eq(usuarios.id, ficha.id));
    return { ok: true };
  }),

  /** Público: o front usa para explicar ao cliente o que vai acontecer. */
  canal: base.handler(async () => ({
    emailAtivo: emailConfigurado(),
    remetente: emailConfigurado() ? remetente() : "",
  })),

  /**
   * PEDIDO DO CLIENTE (publico, tela /esqueci-senha).
   *
   * Antes o front chamava o Better Auth direto. O problema: quando o e-mail
   * existe como CLIENTE (`usuarios`) mas ainda nao tem conta de login
   * (`user`) - caso de quem foi cadastrado pelo admin - o Better Auth nao
   * gera nada e o cliente ficava esperando um e-mail que nunca vinha.
   * Aqui a gente cria a conta de login na hora (senha aleatoria que ninguem
   * conhece) e ai dispara o link: o cliente define a senha e entra.
   *
   * A resposta nunca revela se o e-mail existe.
   */
  pedir: base
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input, context }) => {
      const email = input.email.trim().toLowerCase();
      const origem = context.headers.get("origin") ?? undefined;
      const headers = origem ? new Headers({ origin: origem }) : undefined;

      const [contaLogin] = await db
        .select({ id: contasLogin.id })
        .from(contasLogin)
        .where(eq(contasLogin.email, email))
        .limit(1);

      if (!contaLogin) {
        const [cliente] = await db
          .select({ id: usuarios.id, nome: usuarios.nome })
          .from(usuarios)
          .where(eq(usuarios.email, email))
          .limit(1);

        if (cliente) {
          try {
            await auth.api.signUpEmail({
              body: {
                email,
                name: cliente.nome || email.split("@")[0],
                password: `Prov-${crypto.randomUUID()}`,
              },
              headers,
            });
          } catch (e) {
            console.warn("[reset] falha ao criar conta de login:", e);
          }
        }
      }

      try {
        await auth.api.requestPasswordReset({ body: { email }, headers });
      } catch (e) {
        console.warn("[reset] falha ao pedir link:", e);
      }

      const [linha] = await db
        .select({ entrega: resetsSenha.entrega, criadoEm: resetsSenha.criadoEm })
        .from(resetsSenha)
        .where(eq(resetsSenha.email, email))
        .orderBy(desc(resetsSenha.id))
        .limit(1);

      const recente =
        linha && Date.now() - linha.criadoEm.getTime() < 2 * 60 * 1000;
      const falhouEnvio = Boolean(
        recente && (linha.entrega === "falhou" || linha.entrega === "sem_provedor"),
      );

      return { ok: true as const, falhouEnvio, emailAtivo: emailConfigurado() };
    }),

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
