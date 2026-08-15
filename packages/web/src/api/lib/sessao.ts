import { eq } from "drizzle-orm";
import { db } from "../database";
import { usuarios } from "../database/schema";

/** Formato mínimo do usuário da sessão (Better Auth). */
type UsuarioSessao = { id: string; email: string; name?: string | null };

type Ficha = typeof usuarios.$inferSelect;

/**
 * FONTE ÚNICA da ficha do cliente a partir da sessão.
 *
 * Existia um lookup duplicado (`usuarios.eu` e o middleware `adminOnly`), e as
 * duas cópias podiam divergir — foi assim que o admin passou a receber
 * `admin: false` depois de o handler `eu` criar uma ficha nova em paralelo.
 * Agora as duas rotas chamam daqui.
 *
 * Ordem de resolução, sempre a mesma:
 *  1. `auth_user_id` (vínculo forte);
 *  2. e-mail (ficha criada antes do login — amarra o `auth_user_id` de uma vez);
 *  3. nada encontrado → `null`.
 *
 * NUNCA cria ficha. Criar é decisão explícita de quem chama (ver
 * `garantirFichaDaSessao`), porque um insert silencioso aqui gera ficha
 * duplicada com `admin: false` e derruba o acesso ao painel.
 */
export async function fichaDaSessao(user: UsuarioSessao): Promise<Ficha | null> {
  const [porAuth] = await db.select().from(usuarios).where(eq(usuarios.authUserId, user.id));
  if (porAuth) return porAuth;

  const email = user.email.trim().toLowerCase();
  const [porEmail] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  if (!porEmail) return null;

  // ficha existia sem vínculo: amarra agora para o próximo login cair no passo 1
  const [vinculada] = await db
    .update(usuarios)
    .set({ authUserId: user.id })
    .where(eq(usuarios.id, porEmail.id))
    .returning();
  return vinculada ?? { ...porEmail, authUserId: user.id };
}

/**
 * Igual ao `fichaDaSessao`, mas cria a ficha quando a conta de login existe e
 * não tem registro nenhum (ficha apagada, ou login criado antes do hook).
 * O insert é protegido: só acontece quando nem `auth_user_id` nem e-mail
 * existem, e em caso de corrida relê a linha em vez de duplicar.
 */
export async function garantirFichaDaSessao(user: UsuarioSessao): Promise<Ficha | null> {
  const existente = await fichaDaSessao(user);
  if (existente) return existente;

  const email = user.email.trim().toLowerCase();
  const [nova] = await db
    .insert(usuarios)
    .values({
      nome: user.name || email.split("@")[0],
      email,
      authUserId: user.id,
      statusPagamento: "pendente",
      clienteDesde: new Date().toISOString().slice(0, 10),
    })
    .onConflictDoNothing()
    .returning();
  if (nova) return nova;

  // conflito de e-mail/auth_user_id numa chamada simultânea: relê
  return fichaDaSessao(user);
}

/** `true` quando a sessão pertence a um administrador. */
export async function ehAdmin(user: UsuarioSessao) {
  const ficha = await fichaDaSessao(user);
  return Boolean(ficha?.admin);
}
