import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { alocacoes, contasMatrizes, filaVagas, usuarios } from "../database/schema";
import { atenderFila, realocarClientes, sincronizarVagas } from "../lib/acessos";
import { linkWhats } from "../lib/whats";

/** contagem de vagas realmente ocupadas (alocações ativas) */
async function ativasDaConta(contaId: number) {
  const rows = await db
    .select({ id: alocacoes.id })
    .from(alocacoes)
    .where(and(eq(alocacoes.contaId, contaId), eq(alocacoes.status, "ativo")));
  return rows.length;
}

const contaInput = z.object({
  servico: z.string().min(1),
  rotulo: z.string().min(1),
  email: z.string().min(1),
  senha: z.string().min(1),
  totalVagas: z.number().int().positive().default(1),
  vagasOcupadas: z.number().int().nonnegative().default(0),
  status: z.enum(["ativo", "manutencao"]).default("ativo"),
  renovacao: z.string().default(""),
  custo: z.number().nonnegative().default(0),
  regiao: z.string().default("BR"),
  observacao: z.string().nullable().optional(),
  /** vencimento da assinatura da matriz — ISO `YYYY-MM-DD` */
  dataVencimento: z.string().default(""),
  /** cartão usado no pagamento, ex.: "Nubank final 4412" */
  cartaoUtilizado: z.string().default(""),
});

export const contas = {
  /** estoque completo de contas matrizes */
  listar: adminOnly.handler(() =>
    db.select().from(contasMatrizes).orderBy(asc(contasMatrizes.servico), asc(contasMatrizes.rotulo)),
  ),

  obter: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });
    return row;
  }),

  criar: adminOnly.input(contaInput).handler(async ({ input }) => {
    const [row] = await db.insert(contasMatrizes).values(input).returning();
    return row;
  }),

  atualizar: adminOnly
    .input(contaInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db
        .update(contasMatrizes)
        .set(patch)
        .where(eq(contasMatrizes.id, id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });
      return row;
    }),

  /** ocupa (+1) ou libera (-1) uma vaga, respeitando o total */
  ajustarVagas: adminOnly
    .input(z.object({ id: z.number().int(), delta: z.number().int() }))
    .handler(async ({ input }) => {
      const [conta] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

      const proximo = conta.vagasOcupadas + input.delta;
      if (proximo < 0) throw new ORPCError("BAD_REQUEST", { message: "Não há vagas ocupadas para liberar" });
      if (proximo > conta.totalVagas)
        throw new ORPCError("BAD_REQUEST", { message: "Conta esgotada — reponha antes de alocar" });

      const [row] = await db
        .update(contasMatrizes)
        .set({ vagasOcupadas: proximo })
        .where(eq(contasMatrizes.id, input.id))
        .returning();
      return row;
    }),

  /**
   * Altera o total de vagas da conta. Guard: nunca abaixo do número de
   * clientes já alocados — libere as vagas antes de reduzir.
   */
  editarVagas: adminOnly
    .input(z.object({ id: z.number().int(), totalVagas: z.number().int().min(1).max(50) }))
    .handler(async ({ input }) => {
      const [conta] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

      const ocupadas = Math.max(await ativasDaConta(input.id), 0);
      if (input.totalVagas < ocupadas)
        throw new ORPCError("BAD_REQUEST", {
          message: `Existem ${ocupadas} cliente(s) alocado(s). Libere vagas antes de reduzir para ${input.totalVagas}.`,
        });

      const [row] = await db
        .update(contasMatrizes)
        .set({ totalVagas: input.totalVagas })
        .where(eq(contasMatrizes.id, input.id))
        .returning();
      return row;
    }),

  /**
   * REPOR CONTA — libera todas as vagas para realocação.
   * Não deleta alocação nem cadastro de cliente: cada vínculo ativo vira
   * `liberado` com motivo `reposicao`, preservando o histórico completo.
   */
  repor: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [conta] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
    if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

    /**
     * Repor deixava todo mundo solto: as vagas viravam `liberado` e os
     * clientes ficavam SEM ACESSO até alguém realocar na mão. Agora cada um é
     * recolocado em outra conta na mesma operação; quem não couber entra na
     * fila e gera alerta crítico com link de WhatsApp para o admin.
     */
    const remanejo = await realocarClientes(input.id, "reposicao");

    const [row] = await db
      .update(contasMatrizes)
      .set({ vagasOcupadas: 0, status: "ativo" })
      .where(eq(contasMatrizes.id, input.id))
      .returning();

    return {
      ...row,
      vagasLiberadas: remanejo.liberadas,
      realocados: remanejo.realocados,
      semVaga: remanejo.semVaga,
    };
  }),

  /**
   * LIGA/DESLIGA da conta matriz.
   * Desligar usa o mesmo mecanismo do delete lógico — solta as vagas e
   * remaneja os clientes — mas sem apagar a conta nem o histórico. Religar
   * apenas devolve a conta ao alocador e tenta atender quem está na fila.
   */
  alternarAtiva: adminOnly
    .input(z.object({ id: z.number().int(), ativa: z.boolean() }))
    .handler(async ({ input }) => {
      const [conta] = await db.select().from(contasMatrizes).where(eq(contasMatrizes.id, input.id));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

      const [row] = await db
        .update(contasMatrizes)
        .set({ ativa: input.ativa })
        .where(eq(contasMatrizes.id, input.id))
        .returning();

      if (!input.ativa) {
        const remanejo = await realocarClientes(input.id, "conta_desligada");
        return {
          ...row,
          desligada: true,
          realocados: remanejo.realocados,
          semVaga: remanejo.semVaga,
        };
      }

      const atendidos = await atenderFila(conta.servico);
      return { ...row, desligada: false, realocados: [], semVaga: [], filaAtendida: atendidos.length };
    }),

  /** quem está esperando vaga, por serviço — aba Saúde & Estoque */
  fila: adminOnly.handler(async () => {
    const rows = await db
      .select({
        id: filaVagas.id,
        clienteId: filaVagas.clienteId,
        servico: filaVagas.servico,
        motivo: filaVagas.motivo,
        criadoEm: filaVagas.criadoEm,
        nome: usuarios.nome,
        telefone: usuarios.telefone,
      })
      .from(filaVagas)
      .innerJoin(usuarios, eq(filaVagas.clienteId, usuarios.id))
      .where(eq(filaVagas.status, "aguardando"))
      .orderBy(asc(filaVagas.criadoEm));

    return rows.map((r) => ({
      ...r,
      linkWhats: linkWhats(
        r.telefone ?? "",
        `Oi ${r.nome}! Já estamos liberando seu acesso ao ${r.servico}. Em instantes te mando os dados.`,
      ),
    }));
  }),

  /** recalcula `vagasOcupadas` de todas as contas a partir das alocações ativas */
  sincronizar: adminOnly.handler(async () => {
    const contas = await db.select({ id: contasMatrizes.id }).from(contasMatrizes);
    for (const c of contas) await sincronizarVagas(c.id);
    return { contas: contas.length };
  }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    // remaneja ANTES de apagar: o delete em cascata levaria as alocações
    // junto e os clientes ficariam sem acesso sem ninguém saber
    const remanejo = await realocarClientes(input.id, "conta_desligada");
    await db.delete(contasMatrizes).where(eq(contasMatrizes.id, input.id));
    return { ok: true, realocados: remanejo.realocados, semVaga: remanejo.semVaga };
  }),

  /** resumo de lotação usado nos KPIs do admin */
  resumo: adminOnly.handler(async () => {
    const [row] = await db
      .select({
        contas: sql<number>`count(*)`,
        vagasTotais: sql<number>`coalesce(sum(${contasMatrizes.totalVagas}), 0)`,
        vagasOcupadas: sql<number>`coalesce(sum(${contasMatrizes.vagasOcupadas}), 0)`,
        esgotadas: sql<number>`coalesce(sum(case when ${contasMatrizes.vagasOcupadas} >= ${contasMatrizes.totalVagas} then 1 else 0 end), 0)`,
        custoMensal: sql<number>`coalesce(sum(${contasMatrizes.custo}), 0)`,
        vencendo: sql<number>`coalesce(sum(case when ${contasMatrizes.dataVencimento} <> '' and julianday(${contasMatrizes.dataVencimento}) - julianday('now') between 0 and 5 then 1 else 0 end), 0)`,
        vencidas: sql<number>`coalesce(sum(case when ${contasMatrizes.dataVencimento} <> '' and julianday(${contasMatrizes.dataVencimento}) < julianday('now') then 1 else 0 end), 0)`,
      })
      .from(contasMatrizes);
    return row;
  }),
};
