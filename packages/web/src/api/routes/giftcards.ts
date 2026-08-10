import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { contasMatrizes, movimentacoesGift, notificacoes } from "../database/schema";
import { lerParametros, salvarParametro, type ChaveParametro } from "../lib/config";

/**
 * GESTÃO DE CONTAS — SALDO DE GIFT CARD
 * ------------------------------------------------------------------
 * Cada conta matriz (Netflix, Disney+, ...) é paga com créditos de gift card.
 * O admin nunca digita o saldo final: lança "+R$ 70" e o sistema soma,
 * guardando o extrato completo em `movimentacoes_gift`.
 *
 * ALERTA INTELIGENTE: dispara quando
 *     saldoGiftCard < custoMensal * (1 + margem/100)
 * ou seja, quando não sobra o custo do mês mais a margem de segurança (20%
 * por padrão). O alerta aparece no painel e vira notificação para o webhook.
 */

function centavos(v: number) {
  return Math.round(v * 100) / 100;
}

type ContaSaldo = {
  id: number;
  saldoGiftCard: number;
  custoMensal: number;
  alertaSaldoCritico: number;
};

/** limite abaixo do qual a conta é considerada crítica */
export function limiteCritico(conta: ContaSaldo, margem: number) {
  if (conta.alertaSaldoCritico > 0) return centavos(conta.alertaSaldoCritico);
  return centavos(conta.custoMensal * (1 + margem / 100));
}

/** quantos meses o saldo ainda cobre */
export function mesesDeFolga(conta: ContaSaldo) {
  if (conta.custoMensal <= 0) return null;
  return Math.floor((conta.saldoGiftCard / conta.custoMensal) * 10) / 10;
}

export const giftcards = {
  /** todas as contas com saldo, limite calculado e situação */
  listar: adminOnly.handler(async () => {
    const params = await lerParametros();
    const contas = await db
      .select()
      .from(contasMatrizes)
      .orderBy(asc(contasMatrizes.servico), asc(contasMatrizes.rotulo));

    return {
      margem: params.margemSaldoCritico,
      contas: contas.map((c) => {
        const limite = limiteCritico(c, params.margemSaldoCritico);
        const critico = c.custoMensal > 0 && c.saldoGiftCard < limite;
        return {
          id: c.id,
          servico: c.servico,
          nomeConta: c.nomeConta || c.rotulo,
          rotulo: c.rotulo,
          email: c.email,
          saldoGiftCard: c.saldoGiftCard,
          custoMensal: c.custoMensal,
          alertaSaldoCritico: c.alertaSaldoCritico,
          limite,
          critico,
          mesesDeFolga: mesesDeFolga(c),
          dataVencimento: c.dataVencimento,
          poolJogos: c.poolJogos,
        };
      }),
    };
  }),

  /** extrato de créditos e consumos de uma conta */
  extrato: adminOnly
    .input(z.object({ contaId: z.number().int() }))
    .handler(({ input }) =>
      db
        .select()
        .from(movimentacoesGift)
        .where(eq(movimentacoesGift.contaId, input.contaId))
        .orderBy(desc(movimentacoesGift.criadoEm))
        .limit(50),
    ),

  /** dados de gestão financeira da conta (nome, custo, limite manual) */
  atualizar: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        nomeConta: z.string().optional(),
        custoMensal: z.number().nonnegative().optional(),
        alertaSaldoCritico: z.number().nonnegative().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { id, ...patch } = input;
      const [row] = await db
        .update(contasMatrizes)
        .set(patch)
        .where(eq(contasMatrizes.id, id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada" });
      return row;
    }),

  /**
   * LANÇAMENTO DE SALDO — o admin informa quanto colocou (ex.: +70) ou quanto
   * saiu. O saldo final é sempre calculado pelo servidor.
   */
  lancar: adminOnly
    .input(
      z.object({
        contaId: z.number().int(),
        tipo: z.enum(["credito", "debito", "ajuste"]).default("credito"),
        valor: z.number().positive(),
        observacao: z.string().default(""),
      }),
    )
    .handler(async ({ context, input }) => {
      const [conta] = await db
        .select()
        .from(contasMatrizes)
        .where(eq(contasMatrizes.id, input.contaId));
      if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada" });

      const delta =
        input.tipo === "credito" ? input.valor : input.tipo === "debito" ? -input.valor : 0;
      const saldo =
        input.tipo === "ajuste" ? centavos(input.valor) : centavos(conta.saldoGiftCard + delta);

      if (saldo < 0)
        throw new ORPCError("BAD_REQUEST", {
          message: `Saldo ficaria negativo (R$ ${saldo.toFixed(2)}). Confira o valor do débito.`,
        });

      await db
        .update(contasMatrizes)
        .set({ saldoGiftCard: saldo })
        .where(eq(contasMatrizes.id, input.contaId));

      const [mov] = await db
        .insert(movimentacoesGift)
        .values({
          contaId: input.contaId,
          tipo: input.tipo,
          valor: centavos(input.valor),
          saldoResultante: saldo,
          observacao: input.observacao,
          autor: context.user.email,
        })
        .returning();

      return { movimentacao: mov, saldo };
    }),

  /**
   * VARREDURA DE ALERTAS — cria uma notificação por conta em saldo crítico.
   * Idempotente pela chave `gift:<contaId>:<AAAA-MM-DD>`: no máximo um aviso
   * por conta por dia, para não inundar a central.
   */
  varrer: adminOnly.handler(async () => {
    const params = await lerParametros();
    const contas = await db.select().from(contasMatrizes);
    const hoje = new Date().toISOString().slice(0, 10);

    const criticas = contas.filter(
      (c) => c.custoMensal > 0 && c.saldoGiftCard < limiteCritico(c, params.margemSaldoCritico),
    );

    for (const conta of criticas) {
      const limite = limiteCritico(conta, params.margemSaldoCritico);
      await db
        .insert(notificacoes)
        .values({
          escopo: "admin",
          tipo: "sistema",
          severidade: conta.saldoGiftCard < conta.custoMensal ? "critico" : "alerta",
          titulo: `Saldo crítico — ${conta.nomeConta || conta.rotulo}`,
          mensagem: `Saldo de R$ ${conta.saldoGiftCard.toFixed(2)} abaixo do mínimo de R$ ${limite.toFixed(2)} (custo mensal R$ ${conta.custoMensal.toFixed(2)} + ${params.margemSaldoCritico}% de margem). Insira novos créditos antes da renovação.`,
          destino: "gestaocontas",
          chave: `gift:${conta.id}:${hoje}`,
        })
        .onConflictDoNothing();
    }

    return { criticas: criticas.length };
  }),

  /** parâmetros do negócio (comissão, taxas, margens, preços) */
  parametros: adminOnly.handler(() => lerParametros()),

  salvarParametro: adminOnly
    .input(z.object({ chave: z.string(), valor: z.union([z.string(), z.number()]) }))
    .handler(async ({ input }) => {
      await salvarParametro(input.chave as ChaveParametro, input.valor);
      return lerParametros();
    }),
};
