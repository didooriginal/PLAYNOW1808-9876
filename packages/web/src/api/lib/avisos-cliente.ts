import { eq } from "drizzle-orm";
import { db } from "../database";
import { filaWhats, usuarios } from "../database/schema";
import { enviarPush } from "./push";
import { linkWhats } from "./whats";

/**
 * AVISOS AO CLIENTE — ponto único dos 7 eventos.
 *
 * Cada evento sai por DOIS canais, com papéis diferentes:
 *
 *   1. PUSH (automático)  — o servidor entrega sozinho, na hora, sem custo.
 *      Só chega em quem ligou os avisos no painel; no iPhone exige o PWA
 *      instalado na tela de início.
 *   2. WHATSAPP (manual)  — a mensagem entra na fila do admin já pronta, com
 *      link `wa.me`. O admin dá o último clique. Assim não há custo por
 *      mensagem nem risco de banimento de número não oficial.
 *
 * A fila usa `chave` única por evento, então cron rodando várias vezes no dia
 * não gera fila duplicada.
 *
 * Nunca lança: aviso não pode derrubar cobrança, pagamento ou cron.
 */

export type EventoCliente =
  | "vencimento"
  | "pagamento"
  | "acesso"
  | "convite"
  | "atraso"
  | "winback"
  | "promocao";

export type DadosAviso = {
  /** dias que faltam (vencimento) ou dias de atraso */
  dias?: number;
  /** valor da fatura, em reais */
  valor?: number;
  /** nome do app/serviço (acesso reposto, convite liberado) */
  app?: string;
  /** cupom do winback */
  cupom?: string;
  /** desconto do winback, em % */
  desconto?: number;
  /** texto livre da promoção em massa */
  texto?: string;
  /** sufixo extra da chave de dedupe (ex.: a data do vencimento) */
  chave?: string;
};

function reais(valor?: number) {
  if (typeof valor !== "number" || Number.isNaN(valor)) return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function primeiroNome(nome: string) {
  return (nome || "").trim().split(" ")[0] || "tudo bem";
}

type Texto = { titulo: string; corpo: string; whats: string; url: string };

/** Textos dos 7 eventos, em pt-BR, prontos para push e para WhatsApp. */
function textoDoEvento(evento: EventoCliente, nome: string, d: DadosAviso): Texto {
  const p = primeiroNome(nome);
  const v = reais(d.valor);

  switch (evento) {
    case "vencimento": {
      const dias = d.dias ?? 3;
      const quando = dias === 1 ? "amanhã" : `em ${dias} dias`;
      return {
        titulo: "Sua renovação está chegando",
        corpo: `Seu plano vence ${quando}${v ? ` — ${v}` : ""}. Pague pelo Pix e não perca o acesso.`,
        whats: `Oi, ${p}! Passando para lembrar: seu plano PLAYPLUSNOW vence ${quando}${v ? ` (${v})` : ""}. É só pagar pelo Pix no painel que a renovação é automática. Qualquer coisa, me chama por aqui.`,
        url: "/dashboard?aba=faturas",
      };
    }
    case "pagamento":
      return {
        titulo: "Pagamento confirmado",
        corpo: `Recebemos${v ? ` ${v}` : " seu pagamento"}. Seu acesso está liberado e em dia.`,
        whats: `${p}, pagamento confirmado${v ? ` (${v})` : ""}! Seu acesso já está liberado e em dia. Bom proveito.`,
        url: "/dashboard?aba=faturas",
      };
    case "acesso":
      return {
        titulo: "Acesso reposto",
        corpo: `${d.app ? `${d.app}: ` : ""}sua conta já está funcionando de novo. Pode entrar.`,
        whats: `${p}, tudo certo! ${d.app ? `O acesso do ${d.app} ` : "Seu acesso "}foi reposto e já está funcionando. Se der qualquer problema, é só me chamar.`,
        url: "/dashboard?aba=acessos",
      };
    case "convite":
      return {
        titulo: "Convite liberado",
        corpo: `${d.app ? `Seu convite do ${d.app} ` : "Seu convite "}está pronto no painel.`,
        whats: `${p}, seu convite${d.app ? ` do ${d.app}` : ""} foi liberado! Entra no painel em Acessos que a credencial já está lá.`,
        url: "/dashboard?aba=acessos",
      };
    case "atraso": {
      const dias = d.dias ?? 1;
      const tempo = dias === 1 ? "1 dia" : `${dias} dias`;
      return {
        titulo: "Assinatura vencida",
        corpo: `Sua assinatura está vencida há ${tempo}${v ? ` — ${v}` : ""}. Regularize para não perder o acesso.`,
        whats: `Oi, ${p}. Sua assinatura do PLAYPLUSNOW está vencida há ${tempo}${v ? ` (${v})` : ""}. Dá para regularizar em menos de 3 minutos pelo Pix no painel — assim você não perde nenhum acesso.`,
        url: "/dashboard?aba=faturas",
      };
    }
    case "winback": {
      const desconto = d.desconto ?? 30;
      return {
        titulo: `Volta com ${desconto}% de desconto`,
        corpo: `${d.cupom ? `Cupom ${d.cupom}: ` : ""}sua vaga ainda está guardada.`,
        whats: `${p}, senti sua falta por aqui! Separei ${desconto}% de desconto na sua volta${d.cupom ? ` com o cupom ${d.cupom}` : ""}. Quer que eu reative sua conta?`,
        url: "/dashboard",
      };
    }
    case "promocao":
      return {
        titulo: "Promoção PLAYPLUSNOW",
        corpo: d.texto || "Temos uma oferta nova para você. Confira no painel.",
        whats: d.texto ? `${p}, ${d.texto}` : `${p}, temos uma oferta nova no PLAYPLUSNOW. Quer ver?`,
        url: "/dashboard",
      };
  }
}

export type ResultadoAviso = {
  /** aparelhos que receberam o push */
  push: number;
  /** true quando a mensagem entrou na fila de WhatsApp do admin */
  fila: boolean;
};

/**
 * Dispara o evento para um cliente: push agora + WhatsApp na fila do admin.
 *
 * `dados.chave` deve variar quando o mesmo evento pode acontecer de novo
 * (ex.: a data do vencimento), e ficar fixo quando ele é único por ciclo.
 */
export async function avisarCliente(
  clienteId: number,
  evento: EventoCliente,
  dados: DadosAviso = {},
): Promise<ResultadoAviso> {
  const resultado: ResultadoAviso = { push: 0, fila: false };

  try {
    const [cliente] = await db
      .select({ id: usuarios.id, nome: usuarios.nome, telefone: usuarios.telefone })
      .from(usuarios)
      .where(eq(usuarios.id, clienteId));
    if (!cliente) return resultado;

    const texto = textoDoEvento(evento, cliente.nome, dados);

    const envio = await enviarPush(cliente.id, {
      titulo: texto.titulo,
      corpo: texto.corpo,
      url: texto.url,
      tag: evento,
    });
    resultado.push = envio.enviados;

    const telefone = cliente.telefone ?? "";
    const chave = `${evento}:${cliente.id}:${dados.chave ?? new Date().toISOString().slice(0, 10)}`;

    const [linha] = await db
      .insert(filaWhats)
      .values({
        clienteId: cliente.id,
        evento,
        mensagem: texto.whats,
        link: telefone ? linkWhats(telefone, texto.whats) : "",
        telefone,
        chave,
      })
      .onConflictDoNothing({ target: filaWhats.chave })
      .returning();
    resultado.fila = Boolean(linha);
  } catch {
    /* aviso é best-effort */
  }

  return resultado;
}
