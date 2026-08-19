import { eq } from "drizzle-orm";
import { db } from "../database";
import { pacotes, usuarios } from "../database/schema";
import { templates } from "./emails/templates";
import { enviarEmail } from "../services/email";

/**
 * E-MAIL DE REATIVAÇÃO DO SERVIÇO.
 *
 * Chamado sempre que um cliente que NÃO estava ativo (pendente, atrasado,
 * suspenso ou cancelado) volta para o status "ativo" — pagamento do Pix,
 * fatura quitada ou liberação manual do admin.
 *
 * Regras:
 *   - quem já estava ativo não recebe nada (renovação normal tem e-mail próprio);
 *   - nunca lança: falha de envio só vira log, o cliente continua reativado.
 */
export async function enviarEmailReativacao(
  clienteId: number,
  statusAnterior: string | null | undefined,
) {
  if (!statusAnterior || statusAnterior === "ativo") return { enviado: false };

  try {
    const [cliente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, clienteId));
    if (!cliente || !cliente.email) return { enviado: false };

    let plano = "";
    if (cliente.pacoteId) {
      const [pacote] = await db
        .select({ nome: pacotes.nome })
        .from(pacotes)
        .where(eq(pacotes.id, cliente.pacoteId));
      plano = pacote?.nome ?? "";
    }

    const base = (process.env.WEBSITE_URL || "https://playplusnow.com.br").replace(
      /\/$/,
      "",
    );
    const modelo = templates.reativacao({
      nome: cliente.nome.split(" ")[0] || cliente.nome,
      plano,
      // banco guarda AAAA-MM-DD; o cliente lê DD/MM/AAAA
      proximaCobranca: cliente.proximaCobranca
        ? cliente.proximaCobranca.split("-").reverse().join("/")
        : "",
      linkPainel: `${base}/dashboard`,
    });

    const r = await enviarEmail({
      para: cliente.email,
      assunto: modelo.assunto,
      texto: modelo.texto,
      html: modelo.html,
    });
    if (!r.ok) console.warn("[reativacao] e-mail nao enviado:", r.motivo, r.erro);
    return { enviado: r.ok };
  } catch (e) {
    console.error("[reativacao] falha ao enviar o e-mail:", e);
    return { enviado: false };
  }
}
