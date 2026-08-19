/**
 * CANAIS DE ALERTA DO ADMIN
 * ------------------------------------------------------------------
 * Ponto unico que espalha um alerta de admin para fora do painel. Hoje sao
 * tres canais INDEPENDENTES, e o alerta vai para todos que estiverem
 * configurados:
 *
 *   1) WhatsApp (CallMeBot)  -> WHATSAPP_DESTINOS
 *   2) Telegram (CallMeBot)  -> TELEGRAM_GRUPO_APIKEY e/ou TELEGRAM_DESTINOS
 *   3) E-mail  (Resend)      -> ADMIN_EMAIL (ou o primeiro admin do banco)
 *
 * POR QUE TRES: o WhatsApp do CallMeBot aceita a mensagem na API ("queued") e
 * as vezes nao entrega - o bot deles cai/e bloqueado pelo WhatsApp sem aviso.
 * Como alerta operacional que nao chega e pior do que alerta nenhum, o mesmo
 * texto sai em paralelo por Telegram (estavel, aceita grupo) e por e-mail
 * (entrega auditavel no Resend). Redundancia proposital: e normal receber o
 * mesmo aviso em mais de um canal.
 *
 * NIVEL DO E-MAIL: o padrao e "todos" — TODA solicitacao de cliente e todo
 * alerta de admin saem por e-mail, WhatsApp e Telegram ao mesmo tempo. Isso e
 * decisao de operacao: perder um pedido custa mais caro do que uma caixa de
 * entrada cheia. `ALERTAS_EMAIL_NIVEL` no .env permite apertar o filtro
 * ("alerta" ou "critico") ou desligar o canal de e-mail ("off").
 *
 * Regra de ouro: nada aqui pode lancar. O alerta ja esta gravado no painel.
 */

import { emailConfigurado, enviarEmail, layoutEmail } from "../services/email";
import { enviarWhatsapp, whatsappConfigurado } from "../services/whatsapp";
import { enviarTelegram, telegramConfigurado } from "../services/telegram";
import { emailDoAdmin } from "./aviso-pagamento";

export type AlertaParaCanais = {
  tipo: string;
  severidade: string | null;
  titulo: string;
  mensagem: string | null;
  /** aba do painel onde se resolve */
  destino: string | null;
  /** link extra (ex.: painel do IPTV) */
  link?: string;
  linkRotulo?: string;
};

const MARCA: Record<string, string> = {
  critico: "[URGENTE]",
  alerta: "[ATENCAO]",
  info: "[AVISO]",
};

/** texto plano usado no WhatsApp, no Telegram e no corpo do e-mail */
export function textoDoAlerta(alerta: AlertaParaCanais) {
  const marca = MARCA[alerta.severidade ?? "info"] ?? MARCA.info;
  return [
    `${marca} PLAYPLUSNOW`,
    alerta.titulo,
    alerta.mensagem || "",
    alerta.destino ? `Painel: aba ${alerta.destino}` : "",
    alerta.link ? `${alerta.linkRotulo || "Link"}:\n${alerta.link}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function nivelEmail() {
  return (process.env.ALERTAS_EMAIL_NIVEL || "todos").trim().toLowerCase();
}

/** true quando este alerta deve virar e-mail */
export function alertaViraEmail(severidade: string | null) {
  const nivel = nivelEmail();
  if (nivel === "off") return false;
  if (nivel === "todos") return true;
  if (nivel === "alerta") return severidade === "critico" || severidade === "alerta";
  return severidade === "critico";
}

type ResultadoCanal = { canal: string; ok: boolean; detalhe: string };

async function porEmail(alerta: AlertaParaCanais): Promise<ResultadoCanal> {
  if (!emailConfigurado()) {
    return { canal: "email", ok: false, detalhe: "RESEND_API_KEY ausente" };
  }
  if (!alertaViraEmail(alerta.severidade)) {
    return {
      canal: "email",
      ok: true,
      detalhe: `ignorado por nivel (ALERTAS_EMAIL_NIVEL=${nivelEmail()})`,
    };
  }
  const para = await emailDoAdmin();
  if (!para) return { canal: "email", ok: false, detalhe: "sem ADMIN_EMAIL nem admin no banco" };

  const marca = MARCA[alerta.severidade ?? "info"] ?? MARCA.info;
  const r = await enviarEmail({
    para,
    assunto: `${marca} ${alerta.titulo}`,
    texto: textoDoAlerta(alerta),
    html: layoutEmail({
      titulo: alerta.titulo,
      corpo: [
        alerta.mensagem ? `<p>${alerta.mensagem}</p>` : "",
        alerta.destino
          ? `<p>Resolva na aba <strong>${alerta.destino}</strong> do painel admin.</p>`
          : "",
        alerta.link
          ? `<p>${alerta.linkRotulo || "Link"}: <a href="${alerta.link}">${alerta.link}</a></p>`
          : "",
      ]
        .filter(Boolean)
        .join(""),
      botao: { texto: "Abrir o painel admin", url: `${process.env.WEBSITE_URL || ""}/admin` },
      rodape: "Alerta automatico da Central de Alertas do PLAYPLUSNOW.",
    }),
  });
  return r.ok
    ? { canal: "email", ok: true, detalhe: `enviado para ${mascarar(para)}` }
    : { canal: "email", ok: false, detalhe: r.erro };
}

function mascarar(email: string) {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return "***";
  return `${(usuario || "").slice(0, 2)}***@${dominio}`;
}

/**
 * Espalha o alerta pelos canais configurados. Cada canal e isolado: um que
 * falha nao impede os outros. Nunca lanca.
 */
export async function espalharAlerta(alerta: AlertaParaCanais) {
  const texto = textoDoAlerta(alerta);
  const resultados: ResultadoCanal[] = [];

  const [zap, tele, mail] = await Promise.allSettled([
    whatsappConfigurado()
      ? enviarWhatsapp(texto)
      : Promise.resolve({ enviados: 0, falhas: 0, configurado: false as const, limite: false }),
    telegramConfigurado()
      ? enviarTelegram(texto)
      : Promise.resolve({ enviados: 0, falhas: 0, configurado: false as const, detalhes: [] }),
    porEmail(alerta),
  ]);

  if (zap.status === "fulfilled") {
    const v = zap.value;
    resultados.push({
      canal: "whatsapp",
      ok: v.configurado && v.enviados > 0,
      detalhe: !v.configurado
        ? "WHATSAPP_DESTINOS nao configurado"
        : `${v.enviados} aceitos, ${v.falhas} falhas${v.limite ? " (cota do CallMeBot)" : ""}`,
    });
  } else {
    resultados.push({ canal: "whatsapp", ok: false, detalhe: String(zap.reason) });
  }

  if (tele.status === "fulfilled") {
    const v = tele.value;
    resultados.push({
      canal: "telegram",
      ok: v.configurado && v.enviados > 0,
      detalhe: !v.configurado
        ? "TELEGRAM_GRUPO_APIKEY / TELEGRAM_DESTINOS nao configurado"
        : `${v.enviados} aceitos, ${v.falhas} falhas${v.detalhes.length ? ` - ${v.detalhes.join("; ")}` : ""}`,
    });
  } else {
    resultados.push({ canal: "telegram", ok: false, detalhe: String(tele.reason) });
  }

  resultados.push(
    mail.status === "fulfilled"
      ? mail.value
      : { canal: "email", ok: false, detalhe: String(mail.reason) },
  );

  return resultados;
}

/** dispara sem esperar e sem nunca lancar - para usar dentro de mutations */
export function espalharAlertaSeguro(alerta: AlertaParaCanais) {
  void espalharAlerta(alerta).catch(() => {});
}

/** situacao de cada canal, para o painel de alertas mostrar */
export function statusCanais() {
  return {
    whatsapp: whatsappConfigurado(),
    telegram: telegramConfigurado(),
    telegramGrupo: (process.env.TELEGRAM_GRUPO_APIKEY || "").trim().length > 0,
    email: emailConfigurado(),
    nivelEmail: nivelEmail(),
  };
}
