import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { adminOnly } from "../middleware/auth";
import { db } from "../database";
import { filaWhats, usuarios } from "../database/schema";
import { avisarCliente } from "../lib/avisos-cliente";

/**
 * FILA DE WHATSAPP — o painel de disparo do admin.
 *
 * Os 7 eventos do cliente entram aqui automaticamente com a mensagem pronta e
 * o link `wa.me`. O admin abre o link, envia e marca como enviado. É o modelo
 * manual: custo zero por mensagem e nenhum risco de banimento.
 *
 * O push (canal automatico) ja saiu sozinho no momento do evento — esta fila
 * e o reforco humano para quem nao ligou os avisos ou usa iPhone sem o PWA.
 */

const EVENTOS = [
  "vencimento",
  "pagamento",
  "acesso",
  "convite",
  "atraso",
  "winback",
  "promocao",
] as const;

export const filaWhatsRota = {
  /** fila do painel — pendentes primeiro, com nome e telefone do cliente */
  listar: adminOnly
    .input(
      z
        .object({
          status: z.enum(["pendente", "enviado", "descartado", "todos"]).default("pendente"),
          evento: z.enum([...EVENTOS, "todos"]).default("todos"),
          limite: z.number().int().min(1).max(300).default(100),
        })
        .optional(),
    )
    .handler(async ({ input }) => {
      const status = input?.status ?? "pendente";
      const evento = input?.evento ?? "todos";

      const filtros = [
        status === "todos" ? undefined : eq(filaWhats.status, status),
        evento === "todos" ? undefined : eq(filaWhats.evento, evento),
      ].filter(Boolean);

      const linhas = await db
        .select({
          id: filaWhats.id,
          clienteId: filaWhats.clienteId,
          evento: filaWhats.evento,
          mensagem: filaWhats.mensagem,
          link: filaWhats.link,
          telefone: filaWhats.telefone,
          status: filaWhats.status,
          criadoEm: filaWhats.criadoEm,
          enviadoEm: filaWhats.enviadoEm,
          cliente: usuarios.nome,
        })
        .from(filaWhats)
        .leftJoin(usuarios, eq(usuarios.id, filaWhats.clienteId))
        .where(filtros.length ? and(...filtros) : undefined)
        .orderBy(desc(filaWhats.criadoEm))
        .limit(input?.limite ?? 100);

      const [contagem] = await db
        .select({
          pendentes: sql<number>`sum(case when ${filaWhats.status} = 'pendente' then 1 else 0 end)`,
          enviados: sql<number>`sum(case when ${filaWhats.status} = 'enviado' then 1 else 0 end)`,
          semTelefone: sql<number>`sum(case when ${filaWhats.status} = 'pendente' and ${filaWhats.telefone} = '' then 1 else 0 end)`,
        })
        .from(filaWhats);

      return {
        itens: linhas.map((l) => ({
          ...l,
          cliente: l.cliente ?? `Cliente #${l.clienteId}`,
        })),
        resumo: {
          pendentes: Number(contagem?.pendentes ?? 0),
          enviados: Number(contagem?.enviados ?? 0),
          semTelefone: Number(contagem?.semTelefone ?? 0),
        },
      };
    }),

  /** admin clicou no link e mandou: tira da fila */
  marcarEnviado: adminOnly
    .input(z.object({ ids: z.array(z.number().int()).min(1).max(200) }))
    .handler(async ({ input }) => {
      await db
        .update(filaWhats)
        .set({ status: "enviado", enviadoEm: new Date() })
        .where(inArray(filaWhats.id, input.ids));
      return { ok: true, quantidade: input.ids.length };
    }),

  /** não faz sentido mandar (cliente já resolveu, número errado) */
  descartar: adminOnly
    .input(z.object({ ids: z.array(z.number().int()).min(1).max(200) }))
    .handler(async ({ input }) => {
      await db
        .update(filaWhats)
        .set({ status: "descartado" })
        .where(inArray(filaWhats.id, input.ids));
      return { ok: true, quantidade: input.ids.length };
    }),

  /** limpa o histórico já tratado (enviado/descartado) */
  limparTratados: adminOnly.handler(async () => {
    await db.delete(filaWhats).where(inArray(filaWhats.status, ["enviado", "descartado"]));
    return { ok: true };
  }),

  /**
   * PROMOÇÃO EM MASSA — 7º evento.
   *
   * Manda o push na hora para todo mundo que ligou os avisos e enfileira o
   * WhatsApp de cada cliente para o admin disparar. `chave` do dia + campanha
   * evita mandar a mesma promoção duas vezes.
   */
  promocao: adminOnly
    .input(
      z.object({
        texto: z.string().min(5).max(600),
        campanha: z.string().min(2).max(40),
        /** quem recebe: todos os clientes ou só os que estão em dia */
        publico: z.enum(["todos", "ativos", "inativos"]).default("todos"),
      }),
    )
    .handler(async ({ input }) => {
      const clientes = await db
        .select({ id: usuarios.id, status: usuarios.statusPagamento, admin: usuarios.admin })
        .from(usuarios);

      const alvo = clientes.filter((c) => {
        if (c.admin) return false;
        if (input.publico === "ativos") return c.status === "ativo";
        if (input.publico === "inativos") return c.status !== "ativo";
        return true;
      });

      let push = 0;
      let fila = 0;
      for (const c of alvo) {
        const r = await avisarCliente(c.id, "promocao", {
          texto: input.texto.trim(),
          chave: `campanha:${input.campanha.trim()}`,
        });
        push += r.push;
        if (r.fila) fila += 1;
      }

      return { clientes: alvo.length, push, fila };
    }),
};
