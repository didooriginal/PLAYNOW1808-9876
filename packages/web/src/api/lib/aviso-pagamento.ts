// AVISO AO ADMIN — todo pagamento aprovado gera rastro em dois canais.
//
// 1) Painel: alerta na Central de Alertas (aba Alertas), deduplicado pela
//    `chave`, sempre gravado — não depende de internet nem de provedor.
// 2) E-mail: enviado quando `RESEND_API_KEY` existe. O destinatário é
//    `ADMIN_EMAIL` do .env; sem ele, cai para o e-mail do primeiro admin
//    cadastrado no banco. Falha de e-mail NUNCA derruba a baixa do pagamento.

import { eq } from "drizzle-orm";
import { db } from "../database";
import { usuarios } from "../database/schema";
import { emailConfigurado, enviarEmail, layoutEmail } from "../services/email";
import { notificar } from "../routes/notificacoes";
import { urlPublica } from "./mercadopago";

export type OrigemPagamento = "webhook" | "admin" | "assinatura";

const ROTULO_ORIGEM: Record<OrigemPagamento, string> = {
  webhook: "Pix (Mercado Pago)",
  admin: "baixa manual no painel",
  assinatura: "cartão de crédito (assinatura recorrente)",
};

function dinheiro(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/** e-mail que recebe os avisos operacionais */
export async function emailDoAdmin(): Promise<string> {
  const configurado = process.env.ADMIN_EMAIL?.trim();
  if (configurado) return configurado;
  const [admin] = await db
    .select({ email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.admin, true))
    .limit(1);
  return admin?.email ?? "";
}

/**
 * Dispara o aviso de pagamento aprovado. Chamada de dentro de
 * `confirmarPagamento`, ou seja: vale para Pix, cartão recorrente e baixa
 * manual, sem caminho paralelo.
 */
export async function avisarAdminPagamento(entrada: {
  clienteId: number;
  clienteNome?: string;
  valor: number;
  descricao: string;
  origem: OrigemPagamento;
  referencia: string;
  /** nova data de vencimento registrada (YYYY-MM-DD), quando houver */
  proximaCobranca?: string | null;
}) {
  const nome =
    entrada.clienteNome ??
    (
      await db
        .select({ nome: usuarios.nome })
        .from(usuarios)
        .where(eq(usuarios.id, entrada.clienteId))
        .limit(1)
    )[0]?.nome ??
    `cliente #${entrada.clienteId}`;

  const via = ROTULO_ORIGEM[entrada.origem];
  const vencimento = entrada.proximaCobranca
    ? entrada.proximaCobranca.split("-").reverse().join("/")
    : "";

  await notificar({
    escopo: "admin",
    clienteId: entrada.clienteId,
    tipo: "pagamento",
    severidade: "info",
    titulo: `Pagamento aprovado — ${dinheiro(entrada.valor)}`,
    mensagem:
      `${nome} pagou ${dinheiro(entrada.valor)} (${entrada.descricao}) via ${via}. ` +
      `Acesso liberado automaticamente${vencimento ? `, próxima cobrança ${vencimento}` : ""}.`,
    destino: "faturas",
    chave: `pagamento:aprovado:${entrada.referencia}`,
  });

  if (!emailConfigurado()) return { painel: true, email: false as const };

  const para = await emailDoAdmin();
  if (!para) return { painel: true, email: false as const };

  const linhas = [
    ["Cliente", nome],
    ["Valor", dinheiro(entrada.valor)],
    ["Referente a", entrada.descricao],
    ["Forma", via],
    ["Referência", entrada.referencia],
    ["Próxima cobrança", vencimento || "—"],
  ]
    .map(
      ([rotulo, valor]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#94a3b8;font-size:14px">${rotulo}</td>` +
        `<td style="padding:6px 0;color:#f8fafc;font-size:14px;font-weight:600">${valor}</td></tr>`,
    )
    .join("");

  const resultado = await enviarEmail({
    para,
    assunto: `PLAYPLUSNOW — pagamento de ${dinheiro(entrada.valor)} aprovado (${nome})`,
    texto:
      `Pagamento aprovado.\n\nCliente: ${nome}\nValor: ${dinheiro(entrada.valor)}\n` +
      `Referente a: ${entrada.descricao}\nForma: ${via}\nReferência: ${entrada.referencia}\n` +
      `Próxima cobrança: ${vencimento || "—"}\n\nAcesso liberado automaticamente.`,
    html: layoutEmail({
      titulo: "Pagamento aprovado",
      corpo:
        `<p style="margin:0 0 16px;color:#cbd5e1;font-size:15px">O acesso já foi liberado automaticamente.</p>` +
        `<table style="border-collapse:collapse">${linhas}</table>`,
      botao: { texto: "Abrir o painel", url: `${urlPublica()}/admin` },
      rodape: "Aviso automático do gateway de pagamentos.",
    }),
  });

  return { painel: true, email: resultado.ok };
}
