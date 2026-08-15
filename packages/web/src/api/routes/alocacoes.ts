import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import {
  alocacoes as tabelaAlocacoes,
  assinaturasApps,
  contasMatrizes,
  filaVagas,
  usuarios,
} from "../database/schema";
import {
  atenderFila,
  direitosDoCliente,
  encerrarAssinaturaApp,
  garantirAlocacao,
  registrarAssinaturaApp,
  sincronizarAcessosDoCliente,
  sincronizarVagas,
} from "../lib/acessos";

/**
 * O alocador vive em `api/lib/acessos.ts` (junto da fila de espera e da
 * realocação). Reexportado aqui porque várias rotas já importavam daqui.
 */
export { garantirAlocacao, sincronizarVagas } from "../lib/acessos";

/**
 * ALOCAÇÕES — vínculo real entre cliente e conta matriz.
 * Substitui o contador solto `vagasOcupadas` como fonte de verdade: o contador
 * continua existindo (KPIs e queries legadas), mas é sempre derivado daqui.
 *
 * Regra de ouro: liberar NUNCA apaga a linha nem o cadastro do cliente —
 * apenas marca `status = liberado` e carimba `liberadoEm`.
 */

export const alocacoes = {
  /** clientes vinculados a uma conta matriz (item "vínculo cliente × conta") */
  porConta: adminOnly
    .input(z.object({ contaId: z.number().int(), incluirHistorico: z.boolean().default(false) }))
    .handler(({ input }) => {
      const filtro = input.incluirHistorico
        ? eq(tabelaAlocacoes.contaId, input.contaId)
        : and(eq(tabelaAlocacoes.contaId, input.contaId), eq(tabelaAlocacoes.status, "ativo"));

      return db
        .select({
          id: tabelaAlocacoes.id,
          clienteId: tabelaAlocacoes.clienteId,
          contaId: tabelaAlocacoes.contaId,
          servico: tabelaAlocacoes.servico,
          status: tabelaAlocacoes.status,
          motivo: tabelaAlocacoes.motivo,
          criadoEm: tabelaAlocacoes.criadoEm,
          liberadoEm: tabelaAlocacoes.liberadoEm,
          clienteNome: usuarios.nome,
          clienteEmail: usuarios.email,
          clienteStatus: usuarios.statusPagamento,
        })
        .from(tabelaAlocacoes)
        .innerJoin(usuarios, eq(tabelaAlocacoes.clienteId, usuarios.id))
        .where(filtro)
        .orderBy(desc(tabelaAlocacoes.criadoEm));
    }),

  /** mapa contaId → clientes ativos, para renderizar todas as contas de uma vez */
  mapa: adminOnly.handler(async () => {
    const rows = await db
      .select({
        id: tabelaAlocacoes.id,
        contaId: tabelaAlocacoes.contaId,
        clienteId: tabelaAlocacoes.clienteId,
        servico: tabelaAlocacoes.servico,
        criadoEm: tabelaAlocacoes.criadoEm,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        clienteStatus: usuarios.statusPagamento,
      })
      .from(tabelaAlocacoes)
      .innerJoin(usuarios, eq(tabelaAlocacoes.clienteId, usuarios.id))
      .where(eq(tabelaAlocacoes.status, "ativo"))
      .orderBy(desc(tabelaAlocacoes.criadoEm));

    const mapa: Record<number, typeof rows> = {};
    for (const row of rows) {
      (mapa[row.contaId] ??= []).push(row);
    }
    return mapa;
  }),

  /** aloca manualmente um cliente numa conta matriz específica */
  alocar: adminOnly
    .input(z.object({ clienteId: z.number().int(), contaId: z.number().int() }))
    .handler(async ({ input }) => {
      const [conta] = await db
        .select()
        .from(contasMatrizes)
        .where(eq(contasMatrizes.id, input.contaId));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta matriz não encontrada" });

      const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, input.clienteId));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const ativas = await db
        .select({ id: tabelaAlocacoes.id, clienteId: tabelaAlocacoes.clienteId })
        .from(tabelaAlocacoes)
        .where(and(eq(tabelaAlocacoes.contaId, input.contaId), eq(tabelaAlocacoes.status, "ativo")));

      if (ativas.some((a) => a.clienteId === input.clienteId))
        throw new ORPCError("CONFLICT", { message: "Este cliente já está nesta conta" });

      if (ativas.length >= conta.totalVagas)
        throw new ORPCError("BAD_REQUEST", {
          message: "Conta lotada — libere uma vaga ou aumente o total",
        });

      const [row] = await db
        .insert(tabelaAlocacoes)
        .values({ clienteId: input.clienteId, contaId: conta.id, servico: conta.servico })
        .returning();
      await sincronizarVagas(conta.id);
      return row;
    }),

  /**
   * Libera a vaga para realocação — mantém a linha (histórico) e o cadastro
   * do cliente intactos.
   */
  liberar: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        motivo: z.enum(["reposicao", "manual", "troca_pacote"]).default("manual"),
      }),
    )
    .handler(async ({ input }) => {
      const [alocacao] = await db.select().from(tabelaAlocacoes).where(eq(tabelaAlocacoes.id, input.id));
      if (!alocacao) throw new ORPCError("NOT_FOUND", { message: "Alocação não encontrada" });
      if (alocacao.status === "liberado") return alocacao;

      const [row] = await db
        .update(tabelaAlocacoes)
        .set({ status: "liberado", motivo: input.motivo, liberadoEm: new Date() })
        .where(eq(tabelaAlocacoes.id, input.id))
        .returning();
      await sincronizarVagas(alocacao.contaId);
      return row;
    }),

  /** histórico completo (ativos + liberados) de uma conta */
  historico: adminOnly
    .input(z.object({ contaId: z.number().int() }))
    .handler(({ input }) =>
      db
        .select({
          id: tabelaAlocacoes.id,
          status: tabelaAlocacoes.status,
          motivo: tabelaAlocacoes.motivo,
          criadoEm: tabelaAlocacoes.criadoEm,
          liberadoEm: tabelaAlocacoes.liberadoEm,
          clienteNome: usuarios.nome,
          clienteEmail: usuarios.email,
        })
        .from(tabelaAlocacoes)
        .innerJoin(usuarios, eq(tabelaAlocacoes.clienteId, usuarios.id))
        .where(eq(tabelaAlocacoes.contaId, input.contaId))
        .orderBy(desc(tabelaAlocacoes.criadoEm)),
    ),

  /** clientes que ainda não têm vaga ativa na conta — alimenta o seletor do admin */
  disponiveis: adminOnly
    .input(z.object({ contaId: z.number().int() }))
    .handler(async ({ input }) => {
      const ativas = await db
        .select({ clienteId: tabelaAlocacoes.clienteId })
        .from(tabelaAlocacoes)
        .where(and(eq(tabelaAlocacoes.contaId, input.contaId), eq(tabelaAlocacoes.status, "ativo")));
      const ocupados = ativas.map((a) => a.clienteId);

      const todos = await db
        .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
        .from(usuarios)
        .where(eq(usuarios.admin, false));

      return todos.filter((u) => !ocupados.includes(u.id));
    }),

  /** todas as alocações ativas de um cliente (usado na ficha do cliente) */
  porCliente: adminOnly
    .input(z.object({ clienteId: z.number().int() }))
    .handler(async ({ input }) => {
      const rows = await db
        .select()
        .from(tabelaAlocacoes)
        .where(and(eq(tabelaAlocacoes.clienteId, input.clienteId), eq(tabelaAlocacoes.status, "ativo")));
      if (!rows.length) return [];

      const contas = await db
        .select()
        .from(contasMatrizes)
        .where(
          inArray(
            contasMatrizes.id,
            rows.map((r) => r.contaId),
          ),
        );

      return rows.map((r) => ({
        ...r,
        conta: contas.find((c) => c.id === r.contaId) ?? null,
      }));
    }),
  /** aloca um cliente em qualquer conta disponível para o serviço informado */
  alocarPorServico: adminOnly
    .input(z.object({ clienteId: z.number().int(), servico: z.string().min(1) }))
    .handler(async ({ input }) => {
      const { alocacao, motivo } = await garantirAlocacao(input.clienteId, input.servico);
      if (!alocacao) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            motivo === "sem_conta"
              ? `Nenhuma conta matriz cadastrada para "${input.servico}"`
              : `Sem vaga livre para "${input.servico}" — libere uma vaga ou cadastre outra conta`,
        });
      }
      return alocacao;
    }),

  /**
   * ADICIONAR APP AO CLIENTE (painel do admin).
   * Diferente do `alocarPorServico`: além da vaga, grava o DIREITO em
   * `assinaturas_apps`, então o app passa a aparecer no dashboard do cliente e
   * a ter vencimento próprio. Sem vaga, não falha: entra na fila e avisa.
   */
  adicionarAppAoCliente: adminOnly
    .input(
      z.object({
        clienteId: z.number().int(),
        servico: z.string().min(1),
        origem: z.enum(["avulso", "combo", "premio", "pacote"]).default("avulso"),
        ciclo: z.enum(["mensal", "trimestral", "semestral", "anual"]).default("mensal"),
        valor: z.number().nonnegative().default(0),
        /** ISO YYYY-MM-DD — vencimento próprio deste app */
        proximaCobranca: z.string().default(""),
        expiraEm: z.string().default(""),
      }),
    )
    .handler(async ({ input }) => {
      const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, input.clienteId));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      await registrarAssinaturaApp(input);
      const resultado = await sincronizarAcessosDoCliente(input.clienteId, "manual");

      return {
        servico: input.servico,
        alocado: !resultado.semVaga.includes(input.servico),
        aguardando: resultado.semVaga.includes(input.servico),
      };
    }),

  /** remove o direito do app e libera a vaga (mantém o histórico) */
  removerAppDoCliente: adminOnly
    .input(z.object({ clienteId: z.number().int(), servico: z.string().min(1) }))
    .handler(async ({ input }) => {
      await encerrarAssinaturaApp(input.clienteId, input.servico, "cancelado");
      // vaga que acabou de vagar pode atender quem está na fila
      const atendidos = await atenderFila(input.servico);
      return { ok: true, filaAtendida: atendidos.length };
    }),

  /**
   * APPS DESTE CLIENTE — alimenta o popup do painel admin.
   * Junta as três verdades numa lista só: o direito (`assinaturas_apps` +
   * pacote), a vaga (`alocacoes` + conta matriz) e a espera (`fila_vagas`).
   */
  appsDoCliente: adminOnly
    .input(z.object({ clienteId: z.number().int() }))
    .handler(async ({ input }) => {
      const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, input.clienteId));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });

      const servicos = await direitosDoCliente(input.clienteId);

      const assinaturas = await db
        .select()
        .from(assinaturasApps)
        .where(eq(assinaturasApps.clienteId, input.clienteId));

      const vagas = await db
        .select()
        .from(tabelaAlocacoes)
        .where(
          and(
            eq(tabelaAlocacoes.clienteId, input.clienteId),
            eq(tabelaAlocacoes.status, "ativo"),
          ),
        );

      const contas = vagas.length
        ? await db
            .select()
            .from(contasMatrizes)
            .where(
              inArray(
                contasMatrizes.id,
                vagas.map((v) => v.contaId),
              ),
            )
        : [];

      const espera = await db
        .select()
        .from(filaVagas)
        .where(
          and(eq(filaVagas.clienteId, input.clienteId), eq(filaVagas.status, "aguardando")),
        );

      const itens = servicos.map((servico) => {
        const assinatura = assinaturas.find((a) => a.servico === servico && a.status === "ativo");
        const vaga = vagas.find((v) => v.servico === servico);
        const conta = vaga ? (contas.find((c) => c.id === vaga.contaId) ?? null) : null;
        const naFila = espera.some((f) => f.servico === servico);

        return {
          servico,
          origem: assinatura?.origem ?? "pacote",
          ciclo: assinatura?.ciclo ?? cliente.ciclo,
          valor: assinatura?.valor ?? 0,
          proximaCobranca: assinatura?.proximaCobranca || cliente.proximaCobranca,
          expiraEm: assinatura?.expiraEm ?? "",
          alocacaoId: vaga?.id ?? null,
          desde: vaga?.criadoEm ?? null,
          conta: conta
            ? {
                id: conta.id,
                rotulo: conta.rotulo,
                email: mascararEmail(conta.email),
                ativa: conta.ativa,
                status: conta.status,
              }
            : null,
          /** ativo | aguardando */
          status: vaga ? "ativo" : naFila ? "aguardando" : "sem_vaga",
        };
      });

      return {
        cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone ?? "" },
        itens,
      };
    }),
};

/** `joao@gmail.com` → `jo•••@gmail.com` — o admin identifica sem expor a conta */
function mascararEmail(email: string) {
  const [nome, dominio] = email.split("@");
  if (!dominio) return email;
  return `${nome.slice(0, 2)}•••@${dominio}`;
}
