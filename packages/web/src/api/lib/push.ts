import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { pushInscricoes } from "../database/schema";

/**
 * PUSH WEB (PWA) — camada única de envio.
 *
 * Este é o canal AUTOMÁTICO do cliente: o servidor entrega a notificação
 * sozinho, sem clique humano e sem custo por mensagem (diferente do
 * WhatsApp, que hoje é fila de disparo manual no painel — ver `lib/whats.ts`).
 *
 * Depende de três variáveis no .env (geradas com `bunx web-push
 * generate-vapid-keys`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.
 * Sem elas o módulo fica DESLIGADO e todo envio devolve 0 — nunca quebra.
 *
 * Limite conhecido: no iPhone só chega se o cliente instalar o PWA na tela de
 * início. Safari em aba não recebe push. Por isso o aviso na UI de permissão.
 */

let configurado: boolean | null = null;

/** `true` quando as chaves VAPID estão no .env e o web-push foi inicializado. */
export function pushConfigurado() {
  if (configurado !== null) return configurado;

  const publica = process.env.VAPID_PUBLIC_KEY ?? "";
  const privada = process.env.VAPID_PRIVATE_KEY ?? "";
  const assunto = process.env.VAPID_SUBJECT ?? "mailto:contato@playplusnow.com.br";

  if (!publica || !privada) {
    configurado = false;
    return configurado;
  }

  try {
    webpush.setVapidDetails(assunto, publica, privada);
    configurado = true;
  } catch {
    configurado = false;
  }
  return configurado;
}

/** Chave pública que o navegador usa para criar a inscrição. */
export function chavePublicaVapid() {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export type PayloadPush = {
  titulo: string;
  corpo: string;
  /** caminho aberto no clique — sempre relativo, dentro do app */
  url?: string;
  /** agrupa notificações do mesmo assunto: a nova substitui a anterior */
  tag?: string;
};

export type ResultadoPush = {
  /** quantas inscrições aceitaram a mensagem */
  enviados: number;
  /** quantas falharam sem ser inscrição morta */
  falhas: number;
  /** quantas inscrições mortas foram removidas do banco */
  removidos: number;
};

const VAZIO: ResultadoPush = { enviados: 0, falhas: 0, removidos: 0 };

/**
 * Dispara o payload para TODOS os aparelhos inscritos do cliente.
 *
 * Nunca lança: aviso não pode derrubar cobrança, pagamento nem cron. Quando o
 * serviço de push responde 404/410 a inscrição morreu (PWA desinstalado,
 * permissão revogada) e a linha é apagada na hora, senão a tabela vira lixo.
 */
export async function enviarPush(
  clienteId: number,
  payload: PayloadPush,
): Promise<ResultadoPush> {
  if (!pushConfigurado()) return { ...VAZIO };

  let inscricoes: (typeof pushInscricoes.$inferSelect)[] = [];
  try {
    inscricoes = await db
      .select()
      .from(pushInscricoes)
      .where(eq(pushInscricoes.clienteId, clienteId));
  } catch {
    return { ...VAZIO };
  }
  if (inscricoes.length === 0) return { ...VAZIO };

  const corpo = JSON.stringify({
    titulo: payload.titulo,
    corpo: payload.corpo,
    url: payload.url ?? "/dashboard",
    tag: payload.tag ?? "playplusnow",
  });

  let enviados = 0;
  let falhas = 0;
  const mortas: number[] = [];

  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          corpo,
          { TTL: 60 * 60 * 24 },
        );
        enviados += 1;
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) mortas.push(i.id);
        else falhas += 1;
      }
    }),
  );

  if (mortas.length > 0) {
    try {
      await db.delete(pushInscricoes).where(inArray(pushInscricoes.id, mortas));
    } catch {
      /* limpeza é best-effort */
    }
  }

  if (enviados > 0) {
    try {
      await db
        .update(pushInscricoes)
        .set({ ultimoEnvioEm: new Date() })
        .where(eq(pushInscricoes.clienteId, clienteId));
    } catch {
      /* marca de último envio é informativa */
    }
  }

  return { enviados, falhas, removidos: mortas.length };
}

/** Quantos aparelhos o cliente tem inscritos hoje. */
export async function aparelhosInscritos(clienteId: number) {
  try {
    const linhas = await db
      .select({ id: pushInscricoes.id })
      .from(pushInscricoes)
      .where(eq(pushInscricoes.clienteId, clienteId));
    return linhas.length;
  } catch {
    return 0;
  }
}
