import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { ping } from "./routes/ping";
import { pacotes } from "./routes/pacotes";
import { contas } from "./routes/contas";
import { usuarios } from "./routes/usuarios";
import { renovacao } from "./routes/renovacao";
import { seed } from "./routes/seed";
import { aplicativos } from "./routes/aplicativos";
import { planosDeApps } from "./routes/planos-apps";
import { alocacoes } from "./routes/alocacoes";
import { suporte } from "./routes/suporte";
import { recompensas } from "./routes/recompensas";
import { faturas } from "./routes/faturas";
import { combos } from "./routes/combos";
import { codigos, registrarEmail } from "./routes/codigos";
import { netflix } from "./routes/netflix";
import { notificacoes } from "./routes/notificacoes";
import { afiliados } from "./routes/afiliados";
import { giftcards } from "./routes/giftcards";
import { estoqueGift } from "./routes/estoque-gift";
import { jogos } from "./routes/jogos";
import { saude } from "./routes/saude";
import { winback } from "./routes/winback";
import { pix, confirmarPagamento } from "./routes/pix";
import { assinaturasRota } from "./routes/assinaturas";
import { processarNotificacaoMP } from "./lib/webhook-mercadopago";
import { validarAssinaturaWebhook } from "./lib/mercadopago";
import { checkout } from "./routes/checkout";
import { ciclos } from "./routes/ciclos";
import { senha } from "./routes/senha";
import { upload } from "./routes/upload";
import { marketing } from "./routes/marketing";
import { gerarBackupExcel } from "./lib/backup";
import { processarLembretesVencimento } from "./lib/emails/cron";
import { auth } from "./auth";
import { criarAssistente } from "./agent";
import { criarCopiloto } from "./agent/admin";
import { criarVendedor } from "./agent/vitrine";
import { createAgentUIStreamResponse } from "ai";
import { eq } from "drizzle-orm";
import { db } from "./database";
import { usuarios as tabelaUsuarios } from "./database/schema";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
// Patterns and examples: skills/app/references/api.md
export const router = {
  ping,
  pacotes,
  contas,
  usuarios,
  aplicativos,
  planosDeApps,
  alocacoes,
  suporte,
  recompensas,
  faturas,
  combos,
  codigos,
  netflix,
  notificacoes,
  afiliados,
  giftcards,
  estoqueGift,
  jogos,
  saude,
  winback,
  pix,
  assinaturas: assinaturasRota,
  checkout,
  ciclos,
  senha,
  upload,
  renovacao,
  marketing,
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

  /*
   * 200 mesmo sem código: o e-mail já foi salvo na caixa de entrada do admin
   * (`emails_recebidos`), então não há nada para o provedor reenviar. Devolver
   * 422 fazia a Cloudflare marcar a entrega como falha e o conteúdo se perdia.
   */
  return resultado.ok
    ? c.json({ ok: true, codigo: resultado.registro.codigo }, 200)
    : c.json({ ok: true, codigo: null, salvo: true, aviso: resultado.motivo }, 200);
});

/**
 * BACKUP DO BANCO EM EXCEL — rota HTTP pura porque devolve um arquivo binário
 * para download direto (oRPC serializa JSON, não .xlsx).
 *
 * Só administrador baixa: exige sessão E `usuarios.admin`. As senhas das contas
 * matrizes só entram com `?senhas=1` — sem isso a coluna sai como "(oculta)",
 * porque planilha vazada com senha de matriz derruba a operação inteira.
 */
app.get("/api/admin/backup.xlsx", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ erro: "sessão obrigatória" }, 401);

  const [registro] = await db
    .select({ admin: tabelaUsuarios.admin })
    .from(tabelaUsuarios)
    .where(eq(tabelaUsuarios.authUserId, session.user.id));
  if (!registro?.admin) return c.json({ erro: "acesso restrito ao administrador" }, 403);

  const senhas = c.req.query("senhas");
  const incluirSenhas = senhas === "1" || senhas === "true";

  try {
    const { buffer, nomeArquivo } = await gerarBackupExcel({ incluirSenhas });
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    });
  } catch (e) {
    return c.json({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * ASSISTENTE DE IA DO PAINEL — resposta em streaming, por isso rota HTTP pura.
 * O cliente e resolvido pela SESSAO (nunca pelo corpo da requisicao), e o
 * agente e montado com tools restritas a esse cliente.
 */
app.post("/api/agent/messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ erro: "sessão obrigatória" }, 401);

  const [porVinculo] = await db
    .select()
    .from(tabelaUsuarios)
    .where(eq(tabelaUsuarios.authUserId, session.user.id));
  const cliente =
    porVinculo ??
    (
      await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.email, session.user.email.toLowerCase()))
    )[0];

  if (!cliente) return c.json({ erro: "cliente não encontrado" }, 404);

  let messages: unknown = [];
  try {
    ({ messages } = (await c.req.json()) as { messages: unknown });
  } catch {
    return c.json({ erro: "corpo inválido" }, 400);
  }

  const agent = criarAssistente({ clienteId: cliente.id, nome: cliente.nome });
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages as Parameters<typeof createAgentUIStreamResponse>[0]["uiMessages"],
  });
});

/**
 * VENDEDOR DA LANDING — chat PÚBLICO, sem sessão (visitante anônimo).
 *
 * Como qualquer pessoa alcança esta rota, ela tem dois freios:
 *  1) tamanho: no máximo 20 mensagens por conversa e 1.200 caracteres na última.
 *  2) volume: 30 requisições por IP a cada 10 minutos (janela em memória).
 * As tools do agente são somente de catálogo público — nada de dados de cliente.
 */
const JANELA_VITRINE = 10 * 60 * 1000;
const TETO_VITRINE = 30;
const usoVitrine = new Map<string, { desde: number; total: number }>();

function liberarVitrine(ip: string) {
  const agora = Date.now();
  const atual = usoVitrine.get(ip);
  if (!atual || agora - atual.desde > JANELA_VITRINE) {
    usoVitrine.set(ip, { desde: agora, total: 1 });
    if (usoVitrine.size > 5_000) {
      for (const [chave, valor] of usoVitrine) {
        if (agora - valor.desde > JANELA_VITRINE) usoVitrine.delete(chave);
      }
    }
    return true;
  }
  atual.total += 1;
  return atual.total <= TETO_VITRINE;
}

app.post("/api/agent/vitrine", async (c) => {
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido";
  if (!liberarVitrine(ip)) {
    return c.json({ erro: "muitas perguntas seguidas — tente de novo em alguns minutos" }, 429);
  }

  let messages: unknown = [];
  try {
    ({ messages } = (await c.req.json()) as { messages: unknown });
  } catch {
    return c.json({ erro: "corpo inválido" }, 400);
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return c.json({ erro: "conversa fora do limite" }, 422);
  }

  const ultima = messages[messages.length - 1] as {
    parts?: Array<{ type?: string; text?: string }>;
  };
  const tamanho = (ultima?.parts ?? [])
    .filter((p) => p?.type === "text")
    .reduce((soma, p) => soma + (p.text?.length ?? 0), 0);
  if (tamanho > 1_200) return c.json({ erro: "pergunta muito longa" }, 422);

  const agent = criarVendedor({ whatsapp: process.env.WHATSAPP_NUMERO ?? "5521964727746" });
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages as Parameters<typeof createAgentUIStreamResponse>[0]["uiMessages"],
  });
});

/**
 * COPILOTO ADMIN — streaming de chat exclusivo do painel administrativo.
 * Exige sessão E `usuarios.admin = true`; qualquer outro caso recebe 401/403/404
 * antes de o agente ser montado.
 */
app.post("/api/agent/admin-messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ erro: "sessão obrigatória" }, 401);

  const [porVinculo] = await db
    .select()
    .from(tabelaUsuarios)
    .where(eq(tabelaUsuarios.authUserId, session.user.id));
  const eu =
    porVinculo ??
    (
      await db
        .select()
        .from(tabelaUsuarios)
        .where(eq(tabelaUsuarios.email, session.user.email.toLowerCase()))
    )[0];

  if (!eu) return c.json({ erro: "usuário não encontrado" }, 404);
  if (!eu.admin) return c.json({ erro: "acesso restrito a administradores" }, 403);

  let messages: unknown = [];
  try {
    ({ messages } = (await c.req.json()) as { messages: unknown });
  } catch {
    return c.json({ erro: "corpo inválido" }, 400);
  }

  const agent = criarCopiloto({ nome: eu.nome });
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages as Parameters<typeof createAgentUIStreamResponse>[0]["uiMessages"],
  });
});

/**
 * WEBHOOK DO GATEWAY PIX — baixa automática.
 * Aceita os formatos mais comuns ({ txid }, { pix: [{ txid }] }, { data: { id } }).
 * Protegido por `PIX_WEBHOOK_TOKEN` quando a variável existir no .env.
 */
app.post("/api/webhooks/pix", async (c) => {
  const esperado = process.env.PIX_WEBHOOK_TOKEN;
  if (esperado && c.req.header("x-webhook-token") !== esperado) {
    return c.json({ ok: false, erro: "token inválido" }, 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ ok: false, erro: "corpo inválido" }, 400);
  }

  const lista = Array.isArray(payload.pix) ? (payload.pix as Record<string, unknown>[]) : [];
  const dados = (payload.data ?? {}) as Record<string, unknown>;
  const txid =
    (typeof payload.txid === "string" && payload.txid) ||
    (typeof lista[0]?.txid === "string" && (lista[0].txid as string)) ||
    (typeof dados.txid === "string" && dados.txid) ||
    (typeof dados.id === "string" && dados.id) ||
    "";

  if (!txid) return c.json({ ok: false, erro: "txid ausente" }, 400);

  const resultado = await confirmarPagamento(txid, "webhook");
  return resultado.ok ? c.json({ ok: true }, 200) : c.json(resultado, 404);
});

/**
 * WEBHOOK DO MERCADO PAGO — PRODUÇÃO.
 * ------------------------------------------------------------------
 * Cadastre esta URL em Mercado Pago → Suas integrações → Webhooks:
 *
 *   https://SEU-DOMINIO/api/webhooks/mercadopago
 *
 * Eventos: "Pagamentos" e "Planos e assinaturas".
 *
 * Segurança em duas camadas:
 *  1. assinatura HMAC do header `x-signature` conferida contra
 *     MERCADOPAGO_WEBHOOK_SECRET (quando configurado);
 *  2. o status do pagamento é SEMPRE reconsultado na API do Mercado Pago —
 *     o corpo do POST nunca libera acesso por si só.
 *
 * Responde 200 em qualquer caso tratável para o Mercado Pago não ficar
 * reenviando a notificação eternamente; o que não deu certo fica registrado
 * na resposta e na Central de Alertas.
 */
app.post("/api/webhooks/mercadopago", async (c) => {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await c.req.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const dados = (payload.data ?? {}) as Record<string, unknown>;
  const query = c.req.query();
  const dataId = String(
    dados.id ?? query["data.id"] ?? query.id ?? payload.id ?? "",
  );
  const tipo = String(payload.type ?? payload.topic ?? query.type ?? query.topic ?? "");

  const assinaturaOk = validarAssinaturaWebhook({
    assinatura: c.req.header("x-signature"),
    requestId: c.req.header("x-request-id"),
    dataId,
  });
  if (assinaturaOk === "invalida") {
    return c.json({ ok: false, erro: "assinatura inválida" }, 401);
  }

  try {
    const resultado = await processarNotificacaoMP({ tipo, dataId });
    return c.json({ ...resultado, assinatura: assinaturaOk }, 200);
  } catch (e) {
    // erro nosso ou do gateway: devolve 500 para o MP tentar de novo
    return c.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * CRON de lembrete de vencimento (avisa quem vence em 3 dias).
 * Chamado por um scheduler externo com `Authorization: Bearer $CRON_SECRET`.
 * Sem CRON_SECRET no .env o endpoint fica DESLIGADO (503) — nunca aberto.
 */
app.get("/api/cron/vencimento", async (c) => {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return c.json({ ok: false, erro: "CRON_SECRET não configurado" }, 503);
  }
  if (c.req.header("authorization") !== `Bearer ${segredo}`) {
    return c.json({ ok: false, erro: "não autorizado" }, 401);
  }
  try {
    const resultado = await processarLembretesVencimento();
    return c.json({ ok: true, ...resultado }, 200);
  } catch (e) {
    return c.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});

export default app;
