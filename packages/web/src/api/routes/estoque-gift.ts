import { z } from "zod";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import {
  aplicativos,
  contasMatrizes,
  giftCards,
  movimentacoesGift,
} from "../database/schema";

/**
 * ESTOQUE DE GIFT CARDS
 * ------------------------------------------------------------------
 * Aqui vivem os CÓDIGOS comprados e ainda não resgatados. É o lado físico do
 * dinheiro; o saldo consolidado por conta matriz continua em
 * `contas_matrizes.saldoGiftCard` com extrato em `movimentacoes_gift`.
 *
 * Ciclo de vida de um código:
 *   disponivel → em_uso (admin copiou, está aplicando) → utilizado
 * "utilizado" é o único estado que credita saldo na conta matriz, para o
 * extrato financeiro nunca inflar por engano.
 *
 * SEGURANÇA: `listar` devolve o código MASCARADO. O texto puro só sai pelo
 * procedure `revelar`, um item por chamada, para reduzir exposição em tela.
 */

const STATUS = ["disponivel", "em_uso", "utilizado"] as const;

function centavos(v: number) {
  return Math.round(v * 100) / 100;
}

/** deixa o código no formato de comparação: sem espaços, maiúsculo */
function normalizar(code: string) {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

/** XXXX-XXXX-1234 → mostra apenas os 4 últimos caracteres */
function mascarar(code: string) {
  const limpo = code.trim();
  if (limpo.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, limpo.length - 4))}${limpo.slice(-4)}`;
}

/**
 * Cada linha do lote aceita:
 *   CODIGO
 *   CODIGO;70
 *   CODIGO;70;observação
 * (o separador pode ser `;`, `,` ou tab)
 */
function lerLote(texto: string, valorPadrao: number) {
  const vistos = new Set<string>();
  const itens: { code: string; value: number; observacao: string }[] = [];
  const invalidas: string[] = [];

  for (const linha of texto.split(/\r?\n/)) {
    const cru = linha.trim();
    if (!cru) continue;

    const partes = cru.split(/[;,\t]/).map((p) => p.trim());
    const code = normalizar(partes[0] ?? "");
    if (code.length < 4) {
      invalidas.push(cru);
      continue;
    }

    const valorLinha = partes[1] ? Number(partes[1].replace(",", ".")) : NaN;
    const value = centavos(Number.isFinite(valorLinha) && valorLinha > 0 ? valorLinha : valorPadrao);

    if (vistos.has(code)) continue;
    vistos.add(code);
    itens.push({ code, value, observacao: partes[2] ?? "" });
  }

  return { itens, invalidas };
}

export const estoqueGift = {
  /**
   * SALDO DISPONÍVEL POR PROVEDOR — o número que o admin olha antes de
   * comprar mais cartões. Conta apenas `disponivel` como estoque livre.
   */
  resumo: adminOnly.handler(async () => {
    const [cards, apps, contas] = await Promise.all([
      db.select().from(giftCards),
      db.select().from(aplicativos).orderBy(asc(aplicativos.nome)),
      db.select().from(contasMatrizes),
    ]);

    const nomes = new Map(apps.map((a) => [a.slug, a.nome]));
    const cores = new Map(apps.map((a) => [a.slug, a.cor]));

    /**
     * Quais provedores aparecem na tela:
     *  - os marcados com `temGiftCard` (escolha explícita do admin);
     *  - + os que ainda têm código vivo (`disponivel` ou `em_uso`), para
     *    dinheiro parado nunca sumir de vista por causa de uma flag desligada.
     * Histórico só de códigos já utilizados não segura o app na tela — senão o
     * botão "Remover" não teria efeito nenhum. O catálogo inteiro também não
     * entra: a maioria dos apps não vende gift card.
     */
    const slugs = new Set<string>([
      ...apps.filter((a) => a.temGiftCard).map((a) => a.slug),
      ...cards.filter((c) => c.status !== "utilizado").map((c) => c.provider),
    ]);

    const provedores = [...slugs]
      .map((slug) => {
        const meus = cards.filter((c) => c.provider === slug);
        const disponiveis = meus.filter((c) => c.status === "disponivel");
        const emUso = meus.filter((c) => c.status === "em_uso");
        const usados = meus.filter((c) => c.status === "utilizado");
        const custoMensal = centavos(
          contas
            .filter((c) => c.servico === slug)
            .reduce((soma, c) => soma + c.custoMensal, 0),
        );
        const disponivelValor = centavos(disponiveis.reduce((s, c) => s + c.value, 0));

        return {
          provider: slug,
          nome: nomes.get(slug) ?? slug,
          cor: cores.get(slug) ?? "#22d3ee",
          contas: contas.filter((c) => c.servico === slug).length,
          custoMensal,
          disponivelValor,
          disponivelQtd: disponiveis.length,
          emUsoQtd: emUso.length,
          utilizadoQtd: usados.length,
          utilizadoValor: centavos(usados.reduce((s, c) => s + c.value, 0)),
          /** quantos meses de operação o estoque livre cobre */
          mesesDeFolga: custoMensal > 0 ? Math.floor((disponivelValor / custoMensal) * 10) / 10 : null,
        };
      })
      .sort((a, b) => b.disponivelValor - a.disponivelValor || a.nome.localeCompare(b.nome));

    return {
      provedores,
      /** catálogo para o formulário de cadastro */
      catalogo: apps
        .filter((a) => a.ativo && (a.temGiftCard || slugs.has(a.slug)))
        .map((a) => ({ slug: a.slug, nome: a.nome })),
      /** apps que ainda não estão na tela — alimentam o botão "Adicionar app" */
      disponiveis: apps
        .filter((a) => a.ativo && !slugs.has(a.slug))
        .map((a) => ({ slug: a.slug, nome: a.nome })),
      totais: {
        disponivelValor: centavos(
          cards.filter((c) => c.status === "disponivel").reduce((s, c) => s + c.value, 0),
        ),
        disponivelQtd: cards.filter((c) => c.status === "disponivel").length,
        emUsoQtd: cards.filter((c) => c.status === "em_uso").length,
        utilizadoValor: centavos(
          cards.filter((c) => c.status === "utilizado").reduce((s, c) => s + c.value, 0),
        ),
        total: cards.length,
      },
    };
  }),

  /**
   * Liga/desliga um app na aba de gift cards.
   * Desligar é só visual (a flag), mas quem ainda tem código `disponivel` não
   * pode sumir da tela — o dinheiro ficaria invisível. Nesse caso recusamos.
   */
  alternarApp: adminOnly
    .input(z.object({ slug: z.string().min(1), ativo: z.boolean() }))
    .handler(async ({ input }) => {
      const [app] = await db
        .select()
        .from(aplicativos)
        .where(eq(aplicativos.slug, input.slug));
      if (!app) throw new ORPCError("NOT_FOUND", { message: "Aplicativo não encontrado." });

      if (!input.ativo) {
        const restantes = await db
          .select({ id: giftCards.id })
          .from(giftCards)
          .where(and(eq(giftCards.provider, input.slug), ne(giftCards.status, "utilizado")));
        if (restantes.length)
          throw new ORPCError("BAD_REQUEST", {
            message: `${app.nome} ainda tem ${restantes.length} código(s) em estoque (livre ou em uso). Use ou remova esses códigos antes de tirar o app da tela.`,
          });
      }

      await db
        .update(aplicativos)
        .set({ temGiftCard: input.ativo })
        .where(eq(aplicativos.id, app.id));
      return { ok: true, slug: input.slug, ativo: input.ativo };
    }),

  /** lista de códigos com filtro — SEMPRE mascarado */
  listar: adminOnly
    .input(
      z.object({
        provider: z.string().optional(),
        status: z.enum(STATUS).optional(),
        limite: z.number().int().min(1).max(300).default(120),
      }),
    )
    .handler(async ({ input }) => {
      const filtros = [
        input.provider ? eq(giftCards.provider, input.provider) : undefined,
        input.status ? eq(giftCards.status, input.status) : undefined,
      ].filter(Boolean);

      const rows = await db
        .select()
        .from(giftCards)
        .where(filtros.length ? and(...filtros) : undefined)
        .orderBy(asc(giftCards.status), desc(giftCards.createdAt))
        .limit(input.limite);

      return rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        value: r.value,
        status: r.status,
        contaId: r.contaId,
        autor: r.autor,
        observacao: r.observacao,
        aplicadoEm: r.aplicadoEm,
        createdAt: r.createdAt,
        mascara: mascarar(r.code),
      }));
    }),

  /**
   * REVELAR — devolve o código puro de UM cartão. Separado do `listar` de
   * propósito: nada de despejar a carteira inteira em texto claro na tela.
   */
  revelar: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const [row] = await db.select().from(giftCards).where(eq(giftCards.id, input.id));
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Código não encontrado" });
      return { id: row.id, code: row.code, value: row.value, provider: row.provider };
    }),

  /**
   * CADASTRO EM LOTE — cola-se a lista de códigos, um por linha. Duplicados
   * (no texto ou já no banco) são ignorados silenciosamente para o admin poder
   * reenviar o mesmo lote sem medo.
   */
  cadastrarLote: adminOnly
    .input(
      z.object({
        provider: z.string().min(1),
        valorPadrao: z.number().nonnegative().default(0),
        codigos: z.string().min(1),
        observacao: z.string().default(""),
      }),
    )
    .handler(async ({ context, input }) => {
      const { itens, invalidas } = lerLote(input.codigos, input.valorPadrao);
      if (!itens.length)
        throw new ORPCError("BAD_REQUEST", {
          message: "Nenhum código válido na lista. Um código por linha (mínimo 4 caracteres).",
        });

      const existentes = await db
        .select({ code: giftCards.code })
        .from(giftCards)
        .where(inArray(giftCards.code, itens.map((i) => i.code)));
      const jaTem = new Set(existentes.map((e) => e.code));

      const novos = itens.filter((i) => !jaTem.has(i.code));
      if (novos.length) {
        await db
          .insert(giftCards)
          .values(
            novos.map((i) => ({
              provider: input.provider,
              value: i.value,
              code: i.code,
              observacao: i.observacao || input.observacao,
              autor: context.user.email,
            })),
          )
          .onConflictDoNothing();
      }

      return {
        inseridos: novos.length,
        duplicados: itens.length - novos.length,
        invalidas: invalidas.length,
        valorInserido: centavos(novos.reduce((s, i) => s + i.value, 0)),
      };
    }),

  /**
   * MARCAR EM USO — disparado no clique de "copiar". Evita que dois admins
   * apliquem o mesmo código em contas diferentes.
   */
  marcarEmUso: adminOnly
    .input(z.object({ id: z.number().int(), contaId: z.number().int().optional() }))
    .handler(async ({ input }) => {
      const [row] = await db.select().from(giftCards).where(eq(giftCards.id, input.id));
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Código não encontrado" });
      if (row.status === "utilizado")
        throw new ORPCError("BAD_REQUEST", { message: "Este código já foi utilizado." });

      const [atualizado] = await db
        .update(giftCards)
        .set({ status: "em_uso", contaId: input.contaId ?? row.contaId })
        .where(eq(giftCards.id, input.id))
        .returning();

      return { id: atualizado.id, status: atualizado.status, code: row.code };
    }),

  /**
   * CONFIRMAR USO — o admin confirma que resgatou o código na conta. Aqui o
   * código morre (`utilizado`) e, quando `creditar` estiver ligado, o valor
   * entra no saldo da matriz com extrato em `movimentacoes_gift`.
   */
  confirmarUso: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        contaId: z.number().int().optional(),
        creditar: z.boolean().default(true),
      }),
    )
    .handler(async ({ context, input }) => {
      const [card] = await db.select().from(giftCards).where(eq(giftCards.id, input.id));
      if (!card) throw new ORPCError("NOT_FOUND", { message: "Código não encontrado" });
      if (card.status === "utilizado")
        throw new ORPCError("BAD_REQUEST", { message: "Este código já foi utilizado." });

      const contaId = input.contaId ?? card.contaId ?? null;
      let saldo: number | null = null;

      if (input.creditar && contaId && card.value > 0) {
        const [conta] = await db
          .select()
          .from(contasMatrizes)
          .where(eq(contasMatrizes.id, contaId));
        if (!conta) throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada" });

        saldo = centavos(conta.saldoGiftCard + card.value);
        await db
          .update(contasMatrizes)
          .set({ saldoGiftCard: saldo })
          .where(eq(contasMatrizes.id, contaId));

        await db.insert(movimentacoesGift).values({
          contaId,
          tipo: "credito",
          valor: centavos(card.value),
          saldoResultante: saldo,
          observacao: `Gift card do estoque #${card.id} (${mascarar(card.code)})`,
          autor: context.user.email,
        });
      }

      const [atualizado] = await db
        .update(giftCards)
        .set({ status: "utilizado", contaId, aplicadoEm: new Date() })
        .where(eq(giftCards.id, input.id))
        .returning();

      return { id: atualizado.id, status: atualizado.status, saldo, creditado: saldo !== null };
    }),

  /** DEVOLVER AO ESTOQUE — desfaz um "em uso" que não foi aplicado */
  devolver: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const [row] = await db.select().from(giftCards).where(eq(giftCards.id, input.id));
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Código não encontrado" });
      if (row.status === "utilizado")
        throw new ORPCError("BAD_REQUEST", {
          message: "Código já utilizado não volta para o estoque.",
        });

      await db
        .update(giftCards)
        .set({ status: "disponivel", contaId: null })
        .where(eq(giftCards.id, input.id));
      return { ok: true };
    }),

  /** remove um código cadastrado errado */
  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(giftCards).where(eq(giftCards.id, input.id));
    return { ok: true };
  }),
};
