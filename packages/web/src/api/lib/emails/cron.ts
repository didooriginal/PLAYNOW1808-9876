import { eq, and, gte } from "drizzle-orm";
import { db } from "../../database";
import { usuarios } from "../../database/schema";
import { enviarEmail } from "../../services/email";
import { templates } from "./templates";
import { paraIso } from "../ciclos";

/**
 * CRON JOB: Lembrete de Vencimento
 * Roda diariamente para avisar quem vence em 3 dias.
 */
export async function processarLembretesVencimento() {
  // Queremos 3 dias para frente
  const dataAlvo = new Date();
  dataAlvo.setDate(dataAlvo.getDate() + 3);
  const dataAlvoIso = dataAlvo.toISOString().slice(0, 10);

  console.log(`[Cron] Iniciando varredura de vencimentos para ${dataAlvoIso}...`);

  const clientes = await db
    .select()
    .from(usuarios)
    .where(
      and(
        eq(usuarios.statusPagamento, "ativo"),
        gte(usuarios.valor, 1) // Apenas quem paga
      )
    );

  let enviados = 0;
  let falhas = 0;

  for (const cliente of clientes) {
    const vencimentoIso = paraIso(cliente.proximaCobranca);
    
    if (vencimentoIso === dataAlvoIso) {
      try {
        const linkPagamento = `${process.env.WEBSITE_URL || "https://playplusnow.com.br"}/checkout`;
        const emailDados = templates.avisoVencimento({
          nome: cliente.nome,
          dias: 3,
          valor: `R$ ${(cliente.valor || 0).toFixed(2).replace(".", ",")}`,
          linkPagamento,
        });

        const res = await enviarEmail({
          para: cliente.email,
          assunto: emailDados.assunto,
          texto: emailDados.texto,
          html: emailDados.html,
        });

        if (res.ok) enviados++;
        else falhas++;
      } catch (e) {
        console.error(`[Cron] Erro ao processar e-mail para ${cliente.email}:`, e);
        falhas++;
      }
    }
  }

  return { processados: clientes.length, enviados, falhas };
}
