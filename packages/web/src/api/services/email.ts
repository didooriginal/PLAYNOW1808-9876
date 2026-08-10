import { Resend } from "resend";

/**
 * Envio de e-mail transacional (Resend).
 *
 * O sistema NÃO quebra sem provedor configurado: quando `RESEND_API_KEY`
 * está ausente, `enviarEmail` devolve `{ ok: false, motivo: "sem_provedor" }`
 * e quem chamou decide o plano B (ex.: deixar o link na fila do /admin).
 *
 * Remetente: enquanto o domínio próprio não estiver verificado no Resend,
 * usamos o remetente de teste `onboarding@resend.dev` — ele só entrega para
 * o e-mail da conta dona da API key. Depois de verificar o domínio, basta
 * preencher EMAIL_REMETENTE no .env (ex.: "PLAYPLUSNOW <nao-responda@seudominio.com>").
 */

const REMETENTE_PADRAO = "PLAYPLUSNOW <onboarding@resend.dev>";

export type ResultadoEmail =
  | { ok: true; id: string }
  | { ok: false; motivo: "sem_provedor" | "falha"; erro: string };

export function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function remetente() {
  return process.env.EMAIL_REMETENTE || REMETENTE_PADRAO;
}

export async function enviarEmail(opcoes: {
  para: string | string[];
  assunto: string;
  texto: string;
  html?: string;
  responderPara?: string;
}): Promise<ResultadoEmail> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    return {
      ok: false,
      motivo: "sem_provedor",
      erro: "RESEND_API_KEY não configurada",
    };
  }

  try {
    const resend = new Resend(chave);
    const { data, error } = await resend.emails.send({
      from: remetente(),
      to: Array.isArray(opcoes.para) ? opcoes.para : [opcoes.para],
      subject: opcoes.assunto,
      text: opcoes.texto,
      html: opcoes.html,
      replyTo: opcoes.responderPara,
    });

    if (error) {
      return { ok: false, motivo: "falha", erro: error.message };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (e) {
    return {
      ok: false,
      motivo: "falha",
      erro: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Layout escuro simples, no visual da marca, para e-mails transacionais. */
export function layoutEmail(opcoes: {
  titulo: string;
  corpo: string;
  botao?: { texto: string; url: string };
  rodape?: string;
}) {
  const botao = opcoes.botao
    ? `<tr><td style="padding:28px 0 8px">
         <a href="${opcoes.botao.url}" style="display:inline-block;background:#22d3ee;color:#04141a;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:15px">${opcoes.botao.texto}</a>
       </td></tr>`
    : "";

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#07070c;font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07070c;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0e0e17;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:32px">
        <tr><td style="color:#22d3ee;font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700">PLAYPLUSNOW</td></tr>
        <tr><td style="color:#ffffff;font-size:22px;font-weight:800;padding-top:10px">${opcoes.titulo}</td></tr>
        <tr><td style="color:rgba(255,255,255,.68);font-size:15px;line-height:1.6;padding-top:14px">${opcoes.corpo}</td></tr>
        ${botao}
        <tr><td style="color:rgba(255,255,255,.35);font-size:12px;line-height:1.6;padding-top:24px;border-top:1px solid rgba(255,255,255,.08);margin-top:16px">
          ${opcoes.rodape ?? "Você recebeu este e-mail porque tem uma conta na PLAYPLUSNOW."}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
