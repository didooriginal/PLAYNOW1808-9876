import { and, desc, eq } from "drizzle-orm";
import { db } from "../database";
import { resetsSenha, usuarios } from "../database/schema";
import { enviarEmail, layoutEmail } from "../services/email";

/**
 * Recuperação de senha — parte que NÃO depende do Better Auth, para poder ser
 * usada tanto pelo hook `sendResetPassword` (fluxo automático do cliente)
 * quanto pelas procedures de admin (`routes/senha.ts`) sem import circular.
 */

/** validade do link, em segundos (1 hora) */
export const VALIDADE_RESET = 60 * 60;

/** Monta a URL da tela de redefinição a partir da origem da requisição. */
export function urlRedefinicao(token: string, origem?: string | null) {
  const base = (
    origem ||
    process.env.WEBSITE_URL ||
    "http://localhost:4200"
  ).replace(/\/$/, "");
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

/**
 * Grava o pedido na fila e tenta entregar o link por e-mail.
 * Nunca lança: se o e-mail falhar, o registro fica com `entrega` explicando o
 * motivo e o admin consegue reenviar o link manualmente.
 */
export async function registrarReset(entrada: {
  email: string;
  link: string;
  nome?: string | null;
  origem?: "email" | "admin";
  enviarEmailAgora?: boolean;
}) {
  const email = entrada.email.trim().toLowerCase();
  const [cliente] = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.email, email));

  // pedidos anteriores do mesmo e-mail deixam de valer
  await db
    .update(resetsSenha)
    .set({ status: "expirado" })
    .where(and(eq(resetsSenha.email, email), eq(resetsSenha.status, "pendente")));

  let entrega: "pendente" | "enviado" | "falhou" | "sem_provedor" = "pendente";
  let erroEntrega = "";

  if (entrada.enviarEmailAgora !== false) {
    const nome = (entrada.nome || cliente?.nome || "").split(" ")[0];
    const resultado = await enviarEmail({
      para: email,
      assunto: "Redefinir sua senha — PLAYPLUSNOW",
      texto: [
        nome ? `Olá, ${nome}!` : "Olá!",
        "",
        "Recebemos um pedido para redefinir a senha da sua conta PLAYPLUSNOW.",
        "Abra o link abaixo para criar uma senha nova (ele vale por 1 hora):",
        entrada.link,
        "",
        "Se não foi você que pediu, ignore este e-mail — sua senha atual continua valendo.",
      ].join("\n"),
      html: layoutEmail({
        titulo: "Redefinir sua senha",
        corpo: `${nome ? `Olá, <strong>${nome}</strong>! ` : ""}Recebemos um pedido para redefinir a senha da sua conta. O link abaixo vale por <strong>1 hora</strong> e só pode ser usado uma vez.`,
        botao: { texto: "Criar nova senha", url: entrada.link },
        rodape:
          "Se não foi você que pediu, ignore este e-mail — sua senha atual continua valendo.",
      }),
    });

    if (resultado.ok) {
      entrega = "enviado";
    } else {
      entrega = resultado.motivo === "sem_provedor" ? "sem_provedor" : "falhou";
      erroEntrega = resultado.erro;
    }
  }

  const [linha] = await db
    .insert(resetsSenha)
    .values({
      email,
      clienteId: cliente?.id ?? null,
      link: entrada.link,
      status: "pendente",
      origem: entrada.origem ?? "email",
      entrega,
      erroEntrega,
      expiraEm: new Date(Date.now() + VALIDADE_RESET * 1000),
    })
    .returning();

  return { registro: linha, entrega, erroEntrega };
}

/** Marca como usado o pedido pendente mais recente do e-mail. */
export async function marcarResetUsado(email: string) {
  const alvo = email.trim().toLowerCase();
  const [pendente] = await db
    .select({ id: resetsSenha.id })
    .from(resetsSenha)
    .where(and(eq(resetsSenha.email, alvo), eq(resetsSenha.status, "pendente")))
    .orderBy(desc(resetsSenha.id))
    .limit(1);

  if (!pendente) return;
  await db
    .update(resetsSenha)
    .set({ status: "usado", usadoEm: new Date() })
    .where(eq(resetsSenha.id, pendente.id));
}
