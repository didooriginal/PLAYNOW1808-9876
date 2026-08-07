import { z } from "zod";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import { contasMatrizes, pacotes, usuarios } from "../database/schema";

const usuarioInput = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().nullable().optional(),
  statusPagamento: z.enum(["ativo", "vencendo", "inadimplente"]).default("ativo"),
  pacoteId: z.number().int().nullable().optional(),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  valor: z.number().nonnegative().default(0),
  proximaCobranca: z.string().default(""),
  clienteDesde: z.string().default(""),
  admin: z.boolean().default(false),
});

/** join usuário + pacote, no formato consumido pela tabela de clientes do admin */
const listarComPacote = () =>
  db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      telefone: usuarios.telefone,
      statusPagamento: usuarios.statusPagamento,
      pacoteId: usuarios.pacoteId,
      ciclo: usuarios.ciclo,
      valor: usuarios.valor,
      proximaCobranca: usuarios.proximaCobranca,
      clienteDesde: usuarios.clienteDesde,
      admin: usuarios.admin,
      pacoteNome: pacotes.nome,
      pacoteServicos: pacotes.servicos,
    })
    .from(usuarios)
    .leftJoin(pacotes, eq(usuarios.pacoteId, pacotes.id))
    .orderBy(asc(usuarios.nome));

export const usuariosRoutes = {
  /** base de clientes com o pacote contratado resolvido */
  listar: base.handler(() => listarComPacote()),

  obter: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    const [row] = await db.select().from(usuarios).where(eq(usuarios.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
    return row;
  }),

  criar: base.input(usuarioInput).handler(async ({ input }) => {
    const [row] = await db.insert(usuarios).values(input).returning();
    return row;
  }),

  atualizar: base
    .input(usuarioInput.partial().extend({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db.update(usuarios).set(patch).where(eq(usuarios.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado" });
      return row;
    }),

  remover: base.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(usuarios).where(eq(usuarios.id, input.id));
    return { ok: true };
  }),

  /**
   * PAINEL DO CLIENTE — devolve o usuário, o pacote contratado e as credenciais
   * (contas matrizes) de cada serviço incluído no pacote.
   * Sem `email`/`id` retorna o primeiro cliente cadastrado (modo demo).
   */
  painel: base
    .input(z.object({ email: z.string().optional(), id: z.number().int().optional() }).optional())
    .handler(async ({ input }) => {
      const [cliente] = input?.id
        ? await db.select().from(usuarios).where(eq(usuarios.id, input.id))
        : input?.email
          ? await db.select().from(usuarios).where(eq(usuarios.email, input.email))
          : await db.select().from(usuarios).where(eq(usuarios.admin, false)).limit(1);

      if (!cliente) return null;

      const [pacote] = cliente.pacoteId
        ? await db.select().from(pacotes).where(eq(pacotes.id, cliente.pacoteId))
        : [];

      const servicos = pacote?.servicos ?? [];
      const contas = servicos.length
        ? await db
            .select()
            .from(contasMatrizes)
            .where(inArray(contasMatrizes.servico, servicos))
        : [];

      /** uma credencial por serviço do pacote — a matriz com mais vagas livres */
      const acessos = servicos
        .map((servico) => {
          const candidatas = contas
            .filter((c) => c.servico === servico)
            .sort(
              (a, b) => b.totalVagas - b.vagasOcupadas - (a.totalVagas - a.vagasOcupadas),
            );
          const conta = candidatas[0];
          if (!conta) return null;
          return {
            servico,
            contaId: conta.id,
            email: conta.email,
            senha: conta.senha,
            status: conta.status,
            rotulo: conta.rotulo,
            regiao: conta.regiao,
            vagasOcupadas: conta.vagasOcupadas,
            totalVagas: conta.totalVagas,
          };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);

      return { cliente, pacote: pacote ?? null, acessos };
    }),

  /** KPIs de clientes/receita para o painel admin */
  resumo: base.handler(async () => {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        ativos: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'ativo' then 1 else 0 end), 0)`,
        vencendo: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'vencendo' then 1 else 0 end), 0)`,
        inadimplentes: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'inadimplente' then 1 else 0 end), 0)`,
        mrr: sql<number>`coalesce(sum(case when ${usuarios.ciclo} = 'anual' then ${usuarios.valor} / 12.0 else ${usuarios.valor} end), 0)`,
        emAtraso: sql<number>`coalesce(sum(case when ${usuarios.statusPagamento} = 'inadimplente' then ${usuarios.valor} else 0 end), 0)`,
      })
      .from(usuarios)
      .where(eq(usuarios.admin, false));
    return row;
  }),
};
