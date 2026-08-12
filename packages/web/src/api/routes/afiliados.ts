import { z } from "zod";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { db } from "../database";
import {
  bannersAfiliados,
  carteiras,
  comissoes,
  faturas,
  saques,
  usuarios,
} from "../database/schema";
import { lerParametros } from "../lib/config";

/**
 * MÓDULO AFILIADO
 * ------------------------------------------------------------------
 * Cada cliente vira afiliado automaticamente: o `referralCode` gerado no
 * cadastro vira o link `site.com/signup?ref=CODIGO`. Sobre cada fatura PAGA
 * de um indicado, o afiliado ganha 5% (parametrizável).
 *
 * Três invariantes que o módulo nunca quebra:
 *  1. Comissão só existe contra uma fatura paga — nada de saldo inventado.
 *  2. `chave` única (afiliado:indicado:competência) deixa a apuração
 *     idempotente: pode rodar a cada carga de painel sem duplicar centavo.
 *  3. Saldo da carteira é sempre DERIVADO das comissões e dos saques
 *     (`recalcularCarteira`) — nunca somado/subtraído na mão.
 *
 * ANTI-FRAUDE DE REDE: se o indicado se cadastrou com o mesmo IP ou o mesmo
 * dispositivo do afiliado, a comissão nasce `bloqueada` com o motivo e vai
 * para a fila de revisão do admin, sem entrar no saldo disponível.
 */

function centavos(v: number) {
  return Math.round(v * 100) / 100;
}

/** dinheiro só sai do "pendente" quando a fatura do indicado está paga */
const STATUS_EM_DIA = new Set(["ativo", "pendente"]);

/* ------------------------------------------------------------------ */
/* ANTI-FRAUDE                                                         */
/* ------------------------------------------------------------------ */

type Assinatura = { ipCadastro: string; dispositivoHash: string };

/**
 * Compara as digitais de cadastro do afiliado e do indicado.
 * Retorna o motivo do bloqueio, ou "" quando a indicação é legítima.
 */
export function motivoFraude(afiliado: Assinatura, indicado: Assinatura) {
  const mesmoIp =
    !!afiliado.ipCadastro && afiliado.ipCadastro === indicado.ipCadastro;
  const mesmoDispositivo =
    !!afiliado.dispositivoHash && afiliado.dispositivoHash === indicado.dispositivoHash;

  if (mesmoIp && mesmoDispositivo)
    return "IP e dispositivo idênticos aos do afiliado — autoindicação provável";
  if (mesmoDispositivo) return "Mesmo dispositivo do afiliado";
  if (mesmoIp) return "Mesmo IP do afiliado";
  return "";
}

/* ------------------------------------------------------------------ */
/* APURAÇÃO                                                            */
/* ------------------------------------------------------------------ */

/**
 * Varre os indicados de um afiliado e cria/atualiza as comissões das faturas
 * pagas. Idempotente. Devolve a carteira recalculada.
 */
export async function apurarComissoes(afiliadoId: number) {
  const params = await lerParametros();

  const [afiliado] = await db.select().from(usuarios).where(eq(usuarios.id, afiliadoId));
  if (!afiliado) return null;

  const indicados = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.indicadoPor, afiliadoId));

  if (indicados.length > 0) {
    const ids = indicados.map((i) => i.id);
    const pagas = await db
      .select()
      .from(faturas)
      .where(and(inArray(faturas.clienteId, ids), eq(faturas.status, "pago")));

    const existentes = await db
      .select()
      .from(comissoes)
      .where(eq(comissoes.afiliadoId, afiliadoId));
    const jaTem = new Map(existentes.map((c) => [c.chave, c]));

    const novas: (typeof comissoes.$inferInsert)[] = [];
    for (const fatura of pagas) {
      const indicado = indicados.find((i) => i.id === fatura.clienteId);
      if (!indicado) continue;

      const chave = `${afiliadoId}:${indicado.id}:${fatura.competencia}`;
      if (jaTem.has(chave)) continue;

      const base = fatura.valorFinal || fatura.valor;
      if (base <= 0) continue;

      const bloqueio = motivoFraude(afiliado, indicado);
      novas.push({
        afiliadoId,
        indicadoId: indicado.id,
        faturaId: fatura.id,
        competencia: fatura.competencia,
        valorBase: centavos(base),
        percentual: params.comissaoPercentual,
        valor: centavos((base * params.comissaoPercentual) / 100),
        status: bloqueio ? "bloqueada" : "liberada",
        motivoBloqueio: bloqueio,
        chave,
      });
    }

    if (novas.length > 0) {
      await db.insert(comissoes).values(novas).onConflictDoNothing();
    }
  }

  return recalcularCarteira(afiliadoId);
}

/** Recalcula os saldos da carteira a partir das comissões e dos saques. */
export async function recalcularCarteira(clienteId: number) {
  const params = await lerParametros();

  const linhas = await db.select().from(comissoes).where(eq(comissoes.afiliadoId, clienteId));
  const pedidos = await db.select().from(saques).where(eq(saques.clienteId, clienteId));
  const indicados = await db
    .select({ id: usuarios.id, statusPagamento: usuarios.statusPagamento })
    .from(usuarios)
    .where(eq(usuarios.indicadoPor, clienteId));

  const soma = (filtro: (c: (typeof linhas)[number]) => boolean) =>
    centavos(linhas.filter(filtro).reduce((t, c) => t + c.valor, 0));

  const ganho = soma((c) => c.status !== "bloqueada");
  const bloqueado = soma((c) => c.status === "bloqueada");
  const pendente = soma((c) => c.status === "pendente");

  const sacado = centavos(
    pedidos
      .filter((s) => s.tipo === "saque" && s.status !== "recusado")
      .reduce((t, s) => t + s.valorBruto, 0),
  );
  const creditadoBruto = centavos(
    pedidos
      .filter((s) => s.tipo === "credito" && s.status !== "recusado")
      .reduce((t, s) => t + s.valorBruto, 0),
  );
  const creditadoLiquido = centavos(
    pedidos
      .filter((s) => s.tipo === "credito" && s.status !== "recusado")
      .reduce((t, s) => t + s.valorLiquido, 0),
  );

  const emDia = indicados.filter((i) => STATUS_EM_DIA.has(i.statusPagamento)).length;
  const redeEmDia = indicados.length ? Math.round((emDia / indicados.length) * 100) : 0;

  const disponivel = Math.max(centavos(ganho - pendente - sacado - creditadoBruto), 0);

  const valores = {
    disponivel,
    pendente,
    bloqueado,
    totalGanho: ganho,
    totalSacado: sacado,
    totalCreditado: creditadoLiquido,
    creditoDisponivel: creditadoLiquido,
    redeEmDia,
    atualizadoEm: new Date(),
  };

  const [existente] = await db.select().from(carteiras).where(eq(carteiras.clienteId, clienteId));
  if (existente) {
    const [row] = await db
      .update(carteiras)
      .set(valores)
      .where(eq(carteiras.clienteId, clienteId))
      .returning();
    return { carteira: row, params };
  }
  const [row] = await db
    .insert(carteiras)
    .values({ clienteId, ...valores })
    .returning();
  return { carteira: row, params };
}

/** cliente da sessão (nunca confia em id vindo do corpo da requisição) */
async function euCliente(authUserId: string, email: string) {
  const [porVinculo] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.authUserId, authUserId));
  if (porVinculo) return porVinculo;
  const [porEmail] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase()));
  if (!porEmail) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return porEmail;
}

/** garante que o cliente tenha um código de indicação */
async function garantirCodigo(cliente: typeof usuarios.$inferSelect) {
  if (cliente.referralCode) return cliente.referralCode;
  const base = cliente.nome
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const codigo = `${base || "PPN"}${String(cliente.id).padStart(3, "0")}`;
  await db.update(usuarios).set({ referralCode: codigo }).where(eq(usuarios.id, cliente.id));
  return codigo;
}

export const afiliados = {
  /**
   * PAINEL DO AFILIADO — link único, carteira, rede de indicados com status
   * (Ativo/Atrasado) e o extrato de comissões. Apura antes de responder, para
   * o cliente nunca ver saldo desatualizado.
   */
  meuPainel: authed.handler(async ({ context }) => {
    const cliente = await euCliente(context.user.id, context.user.email);
    const codigo = await garantirCodigo(cliente);
    const resultado = await apurarComissoes(cliente.id);
    const params = resultado?.params ?? (await lerParametros());
    const carteira = resultado?.carteira;

    const indicados = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        statusPagamento: usuarios.statusPagamento,
        clienteDesde: usuarios.clienteDesde,
        valor: usuarios.valor,
      })
      .from(usuarios)
      .where(eq(usuarios.indicadoPor, cliente.id));

    const extrato = await db
      .select({
        id: comissoes.id,
        valor: comissoes.valor,
        valorBase: comissoes.valorBase,
        competencia: comissoes.competencia,
        status: comissoes.status,
        motivoBloqueio: comissoes.motivoBloqueio,
        indicadoId: comissoes.indicadoId,
        criadoEm: comissoes.criadoEm,
      })
      .from(comissoes)
      .where(eq(comissoes.afiliadoId, cliente.id))
      .orderBy(desc(comissoes.criadoEm))
      .limit(50);

    const pedidos = await db
      .select()
      .from(saques)
      .where(eq(saques.clienteId, cliente.id))
      .orderBy(desc(saques.criadoEm))
      .limit(20);

    const base = (process.env.WEBSITE_URL || "").replace(/\/+$/, "");
    const redeEmDia = carteira?.redeEmDia ?? 0;

    return {
      codigo,
      link: `${base}/signup?ref=${codigo}`,
      carteira: carteira ?? null,
      nivel: cliente.nivel,
      afiliadoAtivo: cliente.afiliadoAtivo,
      indicados: indicados.map((i) => ({
        ...i,
        emDia: STATUS_EM_DIA.has(i.statusPagamento),
      })),
      extrato: extrato.map((c) => ({
        ...c,
        indicado: indicados.find((i) => i.id === c.indicadoId)?.nome ?? "Cliente",
      })),
      saques: pedidos,
      regras: {
        percentual: params.comissaoPercentual,
        bonusCredito: params.bonusCredito,
        bonusPerformance: params.bonusPerformance,
        metaRedeEmDia: params.metaRedeEmDia,
        saqueMinimo: params.saqueMinimo,
        saqueTaxa: params.saqueTaxa,
        /** o bônus de performance só entra se a rede estiver dentro da meta */
        performanceLiberada: redeEmDia >= params.metaRedeEmDia,
      },
    };
  }),

  /** ativa o status de afiliado — exclusivo de clientes nível 3 ou superior */
  tornarAfiliado: authed.handler(async ({ context }) => {
    const cliente = await euCliente(context.user.id, context.user.email);
    if (cliente.nivel < 3) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas clientes nível 3 ou superior podem se tornar afiliados.",
      });
    }
    const [row] = await db
      .update(usuarios)
      .set({ afiliadoAtivo: true })
      .where(eq(usuarios.id, cliente.id))
      .returning();
    return { ok: true, afiliadoAtivo: row.afiliadoAtivo };
  }),

  /** banners promocionais ativos para o afiliado divulgar */
  listarBanners: authed.handler(async () => {
    return db.select().from(bannersAfiliados).where(eq(bannersAfiliados.ativo, true));
  }),

  /**
   * SIMULADOR — mostra lado a lado quanto sai no Pix (com taxa) e quanto vira
   * desconto (com +25% e o eventual +1% de performance) antes de confirmar.
   */
  simularResgate: authed
    .input(z.object({ valor: z.number().positive() }))
    .handler(async ({ context, input }) => {
      const cliente = await euCliente(context.user.id, context.user.email);
      const { carteira, params } = (await recalcularCarteira(cliente.id))!;
      const performance = carteira.redeEmDia >= params.metaRedeEmDia;

      const bonus = centavos((input.valor * params.bonusCredito) / 100);
      const extra = performance ? centavos((input.valor * params.bonusPerformance) / 100) : 0;

      return {
        disponivel: carteira.disponivel,
        saque: {
          valorBruto: input.valor,
          taxa: params.saqueTaxa,
          valorLiquido: centavos(input.valor - params.saqueTaxa),
          minimo: params.saqueMinimo,
          permitido: input.valor >= params.saqueMinimo && input.valor <= carteira.disponivel,
        },
        credito: {
          valorBruto: input.valor,
          bonus,
          bonusPerformance: extra,
          valorLiquido: centavos(input.valor + bonus + extra),
          permitido: input.valor > 0 && input.valor <= carteira.disponivel,
        },
        performanceLiberada: performance,
        redeEmDia: carteira.redeEmDia,
      };
    }),

  /**
   * RESGATE — `saque` cai na fila do admin para pagamento em Pix (com taxa e
   * mínimo); `credito` é instantâneo e vira desconto na mensalidade com
   * +25% de bônus (e +1% quando a rede está 90% em dia).
   */
  resgatar: authed
    .input(
      z.object({
        tipo: z.enum(["saque", "credito"]),
        valor: z.number().positive(),
        chavePix: z.string().default(""),
      }),
    )
    .handler(async ({ context, input }) => {
      const cliente = await euCliente(context.user.id, context.user.email);
      const { carteira, params } = (await recalcularCarteira(cliente.id))!;

      if (input.valor > carteira.disponivel)
        throw new ORPCError("BAD_REQUEST", {
          message: `Saldo insuficiente. Disponível: R$ ${carteira.disponivel.toFixed(2)}`,
        });

      if (input.tipo === "saque") {
        if (input.valor < params.saqueMinimo)
          throw new ORPCError("BAD_REQUEST", {
            message: `O saque mínimo é R$ ${params.saqueMinimo.toFixed(2)}. Abaixo disso, use o crédito em desconto — que ainda ganha ${params.bonusCredito}% de bônus.`,
          });
        if (!input.chavePix.trim())
          throw new ORPCError("BAD_REQUEST", { message: "Informe a chave Pix para o saque" });

        const [row] = await db
          .insert(saques)
          .values({
            clienteId: cliente.id,
            tipo: "saque",
            valorBruto: centavos(input.valor),
            taxa: params.saqueTaxa,
            valorLiquido: centavos(input.valor - params.saqueTaxa),
            chavePix: input.chavePix.trim(),
            status: "pendente",
          })
          .returning();

        await recalcularCarteira(cliente.id);
        return row;
      }

      const performance = carteira.redeEmDia >= params.metaRedeEmDia;
      const bonus = centavos((input.valor * params.bonusCredito) / 100);
      const extra = performance ? centavos((input.valor * params.bonusPerformance) / 100) : 0;

      const [row] = await db
        .insert(saques)
        .values({
          clienteId: cliente.id,
          tipo: "credito",
          valorBruto: centavos(input.valor),
          bonus,
          bonusPerformance: extra,
          valorLiquido: centavos(input.valor + bonus + extra),
          status: "pago",
          observacao: performance
            ? `Reinvestimento com ${params.bonusCredito}% de bônus + ${params.bonusPerformance}% de performance`
            : `Reinvestimento com ${params.bonusCredito}% de bônus`,
          processadoEm: new Date(),
        })
        .returning();

      await recalcularCarteira(cliente.id);
      return row;
    }),

  /* ---------------------------------------------------------------- */
  /* ADMIN                                                            */
  /* ---------------------------------------------------------------- */

  /** visão consolidada: comissões, bloqueios do anti-fraude e fila de saques */
  resumo: adminOnly.handler(async () => {
    const params = await lerParametros();
    const todas = await db.select().from(comissoes);
    const fila = await db
      .select({
        id: saques.id,
        clienteId: saques.clienteId,
        tipo: saques.tipo,
        valorBruto: saques.valorBruto,
        taxa: saques.taxa,
        valorLiquido: saques.valorLiquido,
        chavePix: saques.chavePix,
        status: saques.status,
        criadoEm: saques.criadoEm,
        nome: usuarios.nome,
      })
      .from(saques)
      .leftJoin(usuarios, eq(usuarios.id, saques.clienteId))
      .orderBy(desc(saques.criadoEm))
      .limit(50);

    const soma = (f: (c: (typeof todas)[number]) => boolean) =>
      centavos(todas.filter(f).reduce((t, c) => t + c.valor, 0));

    const bloqueadas = todas.filter((c) => c.status === "bloqueada");
    const nomes = new Map(
      (
        await db
          .select({ id: usuarios.id, nome: usuarios.nome })
          .from(usuarios)
      ).map((u) => [u.id, u.nome]),
    );

    return {
      totalComissoes: soma(() => true),
      liberadas: soma((c) => c.status === "liberada"),
      bloqueadas: soma((c) => c.status === "bloqueada"),
      pagas: soma((c) => c.status === "paga"),
      saquesPendentes: fila.filter((s) => s.tipo === "saque" && s.status === "pendente").length,
      fila,
      suspeitas: bloqueadas.map((c) => ({
        id: c.id,
        valor: c.valor,
        motivo: c.motivoBloqueio,
        competencia: c.competencia,
        afiliado: nomes.get(c.afiliadoId) ?? `#${c.afiliadoId}`,
        indicado: nomes.get(c.indicadoId) ?? `#${c.indicadoId}`,
      })),
      regras: params,
    };
  }),

  /** libera manualmente uma comissão travada pelo anti-fraude (falso positivo) */
  liberarComissao: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const [row] = await db
        .update(comissoes)
        .set({ status: "liberada", motivoBloqueio: "" })
        .where(eq(comissoes.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Comissão não encontrada" });
      await recalcularCarteira(row.afiliadoId);
      return row;
    }),

  /** confirma ou recusa um pedido de saque */
  processarSaque: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["pago", "recusado"]),
        observacao: z.string().default(""),
      }),
    )
    .handler(async ({ input }) => {
      const [row] = await db
        .update(saques)
        .set({ status: input.status, observacao: input.observacao, processadoEm: new Date() })
        .where(eq(saques.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Saque não encontrado" });

      if (input.status === "pago") {
        await db
          .update(comissoes)
          .set({ status: "paga" })
          .where(and(eq(comissoes.afiliadoId, row.clienteId), ne(comissoes.status, "bloqueada")));
      }
      await recalcularCarteira(row.clienteId);
      return row;
    }),

  /** força a reapuração de todas as redes — usado após baixas de fatura */
  reapurar: adminOnly.handler(async () => {
    const afiliadosAtivos = await db
      .selectDistinct({ id: usuarios.indicadoPor })
      .from(usuarios)
      .where(ne(usuarios.indicadoPor, 0));

    let total = 0;
    for (const linha of afiliadosAtivos) {
      if (!linha.id) continue;
      await apurarComissoes(linha.id);
      total += 1;
    }
    return { redes: total };
  }),
};
