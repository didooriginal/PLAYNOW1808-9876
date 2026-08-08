import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import { chamados, contasMatrizes, usuarios } from "../database/schema";

/**
 * SUPORTE — o cliente relata um problema no acesso ("senha incorreta",
 * "conta sem crédito", "erro de login") e o chamado cai na fila do admin.
 */

export const TIPOS_CHAMADO = [
  "senha_incorreta",
  "sem_credito",
  "erro_login",
  "tela_ocupada",
  "outro",
] as const;

const tipoEnum = z.enum(TIPOS_CHAMADO);

/** resolve o registro de `usuarios` a partir da sessão */
async function clienteDaSessao(authUserId: string, email: string) {
  const [porVinculo] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (porVinculo) return porVinculo;
  const [porEmail] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase()));
  return porEmail ?? null;
}

export const suporteRoutes = {
  /** cliente abre um chamado a partir de um acesso do painel */
  abrir: authed
    .input(
      z.object({
        tipo: tipoEnum,
        descricao: z.string().max(1000).default(""),
        servico: z.string().nullable().optional(),
        contaId: z.number().int().nullable().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const cliente = await clienteDaSessao(context.user.id, context.user.email);
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const [row] = await db
        .insert(chamados)
        .values({
          clienteId: cliente.id,
          contaId: input.contaId ?? null,
          servico: input.servico ?? null,
          tipo: input.tipo,
          descricao: input.descricao,
        })
        .returning();
      return row;
    }),

  /** chamados do cliente logado */
  meus: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessao(context.user.id, context.user.email);
    if (!cliente) return [];
    return db
      .select()
      .from(chamados)
      .where(eq(chamados.clienteId, cliente.id))
      .orderBy(desc(chamados.criadoEm));
  }),

  /** fila completa do admin, com cliente e conta resolvidos */
  listar: adminOnly.handler(() =>
    db
      .select({
        id: chamados.id,
        tipo: chamados.tipo,
        descricao: chamados.descricao,
        status: chamados.status,
        resposta: chamados.resposta,
        servico: chamados.servico,
        contaId: chamados.contaId,
        criadoEm: chamados.criadoEm,
        atualizadoEm: chamados.atualizadoEm,
        clienteId: chamados.clienteId,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        clienteTelefone: usuarios.telefone,
        contaRotulo: contasMatrizes.rotulo,
        contaEmail: contasMatrizes.email,
      })
      .from(chamados)
      .innerJoin(usuarios, eq(chamados.clienteId, usuarios.id))
      .leftJoin(contasMatrizes, eq(chamados.contaId, contasMatrizes.id))
      .orderBy(desc(chamados.criadoEm)),
  ),

  atualizar: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["aberto", "em_andamento", "resolvido"]).optional(),
        resposta: z.string().max(1000).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db
        .update(chamados)
        .set({ ...patch, atualizadoEm: new Date() })
        .where(eq(chamados.id, id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Chamado não encontrado" });
      return row;
    }),

  /** contadores para o badge da aba Suporte */
  resumo: adminOnly.handler(async () => {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        abertos: sql<number>`coalesce(sum(case when ${chamados.status} = 'aberto' then 1 else 0 end), 0)`,
        emAndamento: sql<number>`coalesce(sum(case when ${chamados.status} = 'em_andamento' then 1 else 0 end), 0)`,
        resolvidos: sql<number>`coalesce(sum(case when ${chamados.status} = 'resolvido' then 1 else 0 end), 0)`,
      })
      .from(chamados);
    return row;
  }),
};
