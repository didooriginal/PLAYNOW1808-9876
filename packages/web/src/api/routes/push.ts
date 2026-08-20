import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { base } from "../__core/app";
import { authed } from "../middleware/auth";
import { fichaDaSessao } from "../lib/sessao";
import { db } from "../database";
import { pushInscricoes } from "../database/schema";
import { chavePublicaVapid, enviarPush, pushConfigurado } from "../lib/push";

/**
 * PUSH WEB (PWA) - inscricao dos aparelhos do cliente.
 *
 * Fluxo, do navegador ate o banco:
 *   1. a UI chama `chavePublica` (procedure publica, sem sessao);
 *   2. pede permissao e cria a inscricao no service worker;
 *   3. manda endpoint + chaves para `inscrever`, que grava a linha.
 *
 * O envio em si mora em `lib/push.ts` - ponto unico, igual ao `enviarWhats`.
 *
 * No iPhone o push so funciona com o PWA instalado na tela de inicio; a UI
 * avisa isso antes de pedir permissao.
 */

const inscricaoSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(400).optional(),
});

/** Chave publica VAPID - o navegador precisa dela antes de pedir permissao. */
const chavePublica = base.handler(() => ({
  configurado: pushConfigurado(),
  chave: pushConfigurado() ? chavePublicaVapid() : "",
}));

/** Grava (ou atualiza) a inscricao deste navegador para o cliente logado. */
const inscrever = authed.input(inscricaoSchema).handler(async ({ input, context }) => {
  if (!pushConfigurado()) return { ok: false as const, motivo: "push desligado no servidor" };

  const ficha = await fichaDaSessao(context.user);
  if (!ficha) return { ok: false as const, motivo: "ficha do cliente não encontrada" };

  const valores = {
    clienteId: ficha.id,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: (input.userAgent ?? "").slice(0, 400),
  };

  // o mesmo endpoint pode voltar depois de trocar de conta no aparelho:
  // nesse caso a linha muda de dono em vez de duplicar.
  await db
    .insert(pushInscricoes)
    .values(valores)
    .onConflictDoUpdate({
      target: pushInscricoes.endpoint,
      set: {
        clienteId: valores.clienteId,
        p256dh: valores.p256dh,
        auth: valores.auth,
        userAgent: valores.userAgent,
      },
    });

  const aparelhos = await db
    .select({ id: pushInscricoes.id })
    .from(pushInscricoes)
    .where(eq(pushInscricoes.clienteId, ficha.id));

  return { ok: true as const, aparelhos: aparelhos.length };
});

/** Remove a inscricao deste navegador (cliente desligou o aviso). */
const desinscrever = authed
  .input(z.object({ endpoint: z.string().url() }))
  .handler(async ({ input, context }) => {
    const ficha = await fichaDaSessao(context.user);
    if (!ficha) return { ok: false as const };
    await db
      .delete(pushInscricoes)
      .where(
        and(
          eq(pushInscricoes.clienteId, ficha.id),
          eq(pushInscricoes.endpoint, input.endpoint),
        ),
      );
    return { ok: true as const };
  });

/** Situacao do cliente logado: servidor ligado? quantos aparelhos inscritos? */
const situacao = authed.handler(async ({ context }) => {
  const ficha = await fichaDaSessao(context.user);
  if (!ficha) return { configurado: pushConfigurado(), aparelhos: 0 };
  const linhas = await db
    .select({ id: pushInscricoes.id })
    .from(pushInscricoes)
    .where(eq(pushInscricoes.clienteId, ficha.id));
  return { configurado: pushConfigurado(), aparelhos: linhas.length };
});

/** Dispara uma notificacao de teste para os aparelhos do proprio cliente. */
const testar = authed.handler(async ({ context }) => {
  const ficha = await fichaDaSessao(context.user);
  if (!ficha) return { enviados: 0, falhas: 0, removidos: 0 };
  return enviarPush(ficha.id, {
    titulo: "PLAYPLUSNOW",
    corpo: "Notificações ligadas. É assim que você vai receber os avisos.",
    url: "/dashboard",
    tag: "teste",
  });
});

export const push = {
  chavePublica,
  inscrever,
  desinscrever,
  situacao,
  testar,
};
