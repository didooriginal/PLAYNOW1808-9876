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
 * Uma varredura cobre os dois momentos do ciclo:
 *
 *  1. AVISO PRÉVIO    — de 3 a 1 dia ANTES do vencimento (`avisoVencimento`)
 *  2. FATURA ATRASADA — marcos de 1, 3 e 7 dias DEPOIS  (`faturaAtrasada`)
 *  3. (o cancelamento não é cron: sai na hora, em routes/assinaturas.ts)
 *
 * POR QUE "MARCOS" E NÃO "DIA EXATO"
 * Se a varredura falhar num dia (servidor fora do ar, agendador atrasado), um
 * teste de igualdade (`atraso === 1`) perderia aquele e-mail para sempre. Aqui
 * o critério é `atraso >= marco`: na primeira execução depois do prazo o
 * e-mail sai do mesmo jeito. Quando vários marcos são alcançados de uma vez
 * (ex.: primeira execução no dia +9), só o MAIOR vira e-mail — os menores são
 * marcados como consumidos para o cliente não receber três cobranças juntas.
 *
 * DEDUPLICAÇÃO
 * Cada marco grava um alerta em `notificacoes` com `chave` única
 * (`email:atraso:<clienteId>:<vencimento>:<marco>`). `notificar` ignora chave
 * repetida e devolve `null`, então rodar a varredura 10x no mesmo dia manda
 * o e-mail UMA vez. Bônus: o aviso também aparece no painel do cliente.
 */

/** marcos, em dias DEPOIS do vencimento, em que a cobrança é reenviada */
export const MARCOS_ATRASO = [1, 3, 7] as const;

/** janela do aviso prévio: de 3 dias antes até 1 dia antes */
export const DIAS_AVISO_PREVIO_EMAIL = 3;

function dinheiro(valor: number) {
  return `R$ ${(valor || 0).toFixed(2).replace(".", ",")}`;
}

function paraBr(iso: string) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

/** diferença em dias inteiros entre duas datas ISO (b - a) */
function diffDias(aIso: string, bIso: string) {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export type ResultadoCron = {
  processados: number;
  enviados: number;
  falhas: number;
  avisoPrevio: number;
  atrasados: number;
  repetidos: number;
};

/**
 * Varredura de vencimentos: aviso prévio + cobrança de atraso.
 * Nunca lança por causa de um cliente — erro individual vira `falhas`.
 */
export async function processarLembretesVencimento(): Promise<ResultadoCron> {
  const hoje = new Date().toISOString().slice(0, 10);
  const base = (process.env.WEBSITE_URL || "https://playplusnow.com.br").replace(/\/$/, "");
  const linkPagamento = `${base}/checkout`;

  // só quem paga alguma coisa; admin nunca recebe cobrança
  const clientes = await db
    .select()
    .from(usuarios)
    .where(and(gte(usuarios.valor, 1), eq(usuarios.admin, false)));

  const r: ResultadoCron = {
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
      /* ---------- 1. aviso prévio (3 a 1 dia antes) ---------- */
      if (atraso >= -DIAS_AVISO_PREVIO_EMAIL && atraso <= -1) {
        const dias = Math.abs(atraso);
        const criado = await notificar({
          escopo: "cliente",
          clienteId: cliente.id,
          tipo: "vencimento",
          severidade: "info",
          titulo: `Sua assinatura vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
          mensagem: `Renove ${dinheiro(cliente.valor)} até ${paraBr(vencimento)} para não perder o acesso.`,
          destino: "faturas",
          chave: `email:previo:${cliente.id}:${vencimento}`,
        });
        if (!criado) {
          r.repetidos++;
          continue;
        }

        const modelo = templates.avisoVencimento({
          nome: cliente.nome,
          dias,
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

      /* ---------- 2. fatura atrasada (marcos +1, +3, +7) ---------- */
      if (atraso >= MARCOS_ATRASO[0]) {
        // reivindica do maior marco alcançado para o menor; só o primeiro
        // marco livre vira e-mail, os demais ficam apenas registrados
        let marcoDoEmail: number | null = null;
        for (const marco of [...MARCOS_ATRASO].reverse()) {
          if (atraso < marco) continue;
          const diasParaBloqueio = Math.max(0, DIAS_PARA_SUSPENDER - atraso);
          const criado = await notificar({
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
            chave: `email:atraso:${cliente.id}:${vencimento}:${marco}`,
          });
          if (criado && marcoDoEmail === null) marcoDoEmail = marco;
        }

        if (marcoDoEmail === null) {
          r.repetidos++;
          continue;
        }

        const diasParaBloqueio = Math.max(0, DIAS_PARA_SUSPENDER - atraso);
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

/* ------------------------------------------------------------------ */
/* REDE DE SEGURANÇA — disparo oportunista                             */
/* ------------------------------------------------------------------ */

let ultimoDisparo = 0;
/** no máximo uma varredura de e-mail por hora fora do agendador */
const INTERVALO_OPORTUNISTA = 60 * 60 * 1000;

/**
 * Roda a varredura "de carona" quando alguém abre o painel, no máximo 1x por
 * hora. Serve de rede de segurança para o caso do agendador externo falhar ou
 * ainda não estar configurado: como a dedup é por marco (e não por dia), o
 * e-mail continua saindo mesmo que o disparo aconteça com atraso.
 *
 * Nunca lança e nunca bloqueia quem chamou — é disparado sem `await`.
 */
export function dispararLembretesOportunista() {
  const agora = Date.now();
  if (agora - ultimoDisparo < INTERVALO_OPORTUNISTA) return;
  ultimoDisparo = agora;
  void processarLembretesVencimento().catch((e) =>
    console.error("[Cron] varredura oportunista falhou:", e),
  );
}
