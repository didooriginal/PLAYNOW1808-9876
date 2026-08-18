import { and, eq, gte } from "drizzle-orm";
import { db } from "../../database";
import { usuarios } from "../../database/schema";
import { enviarEmail } from "../../services/email";
import { templates } from "./templates";
import { paraIso } from "../ciclos";
import { DIAS_PARA_SUSPENDER } from "../cobranca";
import { notificar } from "../../routes/notificacoes";

/**
 * CRON DE COBRANÇA POR E-MAIL
 * ------------------------------------------------------------------
 * Uma varredura diária cobre os três momentos do ciclo:
 *
 *  1. AVISO PRÉVIO   — 3 dias ANTES do vencimento (`avisoVencimento`)
 *  2. FATURA ATRASADA — 1, 3 e 7 dias DEPOIS do vencimento (`faturaAtrasada`)
 *  3. (o cancelamento não é cron: sai na hora, em routes/assinaturas.ts)
 *
 * DEDUPLICAÇÃO: cada envio grava um alerta em `notificacoes` com uma `chave`
 * única (`email:<tipo>:<clienteId>:<vencimento>:<dia>`). Como `notificar`
 * ignora chave repetida e devolve `null`, rodar o cron duas vezes no mesmo dia
 * NÃO manda o e-mail duas vezes — e o cliente ainda vê o aviso no painel.
 */

/** dias DEPOIS do vencimento em que a cobrança é reenviada */
export const DIAS_DE_ATRASO = [1, 3, 7];

function dinheiro(valor: number) {
  return `R$ ${(valor || 0).toFixed(2).replace(".", ",")}`;
}

function paraBr(iso: string) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/** diferença em dias inteiros entre duas datas ISO (b - a) */
function diffDias(aIso: string, bIso: string) {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

type Resultado = {
  processados: number;
  enviados: number;
  falhas: number;
  avisoPrevio: number;
  atrasados: number;
  repetidos: number;
};

/**
 * Varredura diária de vencimentos: aviso prévio + cobrança de atraso.
 * Nunca lança por causa de um cliente — erro individual vira `falhas`.
 */
export async function processarLembretesVencimento(): Promise<Resultado> {
  const hoje = hojeIso();
  const base = (process.env.WEBSITE_URL || "https://playplusnow.com.br").replace(/\/$/, "");
  const linkPagamento = `${base}/checkout`;

  // quem paga alguma coisa e ainda não foi arquivado
  const clientes = await db
    .select()
    .from(usuarios)
    .where(and(gte(usuarios.valor, 1), eq(usuarios.admin, false)));

  const r: Resultado = {
    processados: clientes.length,
    enviados: 0,
    falhas: 0,
    avisoPrevio: 0,
    atrasados: 0,
    repetidos: 0,
  };

  for (const cliente of clientes) {
    const vencimento = paraIso(cliente.proximaCobranca);
    if (!vencimento) continue;

    // negativo = ainda vai vencer; positivo = já venceu há N dias
    const atraso = diffDias(vencimento, hoje);
    if (atraso === null) continue;

    try {
      /* ---------- 1. aviso prévio (3 dias antes) ---------- */
      if (atraso === -3 && cliente.statusPagamento === "ativo") {
        const chave = `email:vencimento:${cliente.id}:${vencimento}:3`;
        if (!(await notificar({
          escopo: "cliente",
          clienteId: cliente.id,
          tipo: "vencimento",
          severidade: "info",
          titulo: "Sua assinatura vence em 3 dias",
          mensagem: `Renove ${dinheiro(cliente.valor)} até ${paraBr(vencimento)} para não perder o acesso.`,
          destino: "faturas",
          chave,
        }))) {
          r.repetidos++;
          continue;
        }

        const modelo = templates.avisoVencimento({
          nome: cliente.nome,
          dias: 3,
          valor: dinheiro(cliente.valor),
          linkPagamento,
        });
        const res = await enviarEmail({
          para: cliente.email,
          assunto: modelo.assunto,
          texto: modelo.texto,
          html: modelo.html,
        });
        if (res.ok) {
          r.enviados++;
          r.avisoPrevio++;
        } else {
          r.falhas++;
        }
        continue;
      }

      /* ---------- 2. fatura atrasada (1, 3 e 7 dias depois) ---------- */
      if (DIAS_DE_ATRASO.includes(atraso)) {
        const diasParaBloqueio = Math.max(0, DIAS_PARA_SUSPENDER - atraso);
        const chave = `email:atraso:${cliente.id}:${vencimento}:${atraso}`;
        if (!(await notificar({
          escopo: "cliente",
          clienteId: cliente.id,
          tipo: "pagamento",
          severidade: diasParaBloqueio === 0 ? "critico" : "alerta",
          titulo:
            diasParaBloqueio === 0
              ? "Acesso suspenso por falta de pagamento"
              : `Fatura atrasada há ${atraso} ${atraso === 1 ? "dia" : "dias"}`,
          mensagem: `${dinheiro(cliente.valor)} venceu em ${paraBr(vencimento)}.`,
          destino: "faturas",
          chave,
        }))) {
          r.repetidos++;
          continue;
        }

        const modelo = templates.faturaAtrasada({
          nome: cliente.nome,
          dias: atraso,
          valor: dinheiro(cliente.valor),
          vencimento: paraBr(vencimento),
          linkPagamento,
          diasParaBloqueio,
        });
        const res = await enviarEmail({
          para: cliente.email,
          assunto: modelo.assunto,
          texto: modelo.texto,
          html: modelo.html,
        });
        if (res.ok) {
          r.enviados++;
          r.atrasados++;
        } else {
          r.falhas++;
        }
      }
    } catch (e) {
      console.error(`[Cron] erro ao processar ${cliente.email}:`, e);
      r.falhas++;
    }
  }

  console.log(
    `[Cron] ${hoje} — ${r.processados} clientes, ${r.avisoPrevio} avisos prévios, ${r.atrasados} cobranças de atraso, ${r.repetidos} já enviados antes, ${r.falhas} falhas.`,
  );
  return r;
}
