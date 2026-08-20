import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { MSG_BLOQUEIO, estaBloqueado } from "../lib/cobranca";
import { db } from "../database";
import { alocacoes, ativacoesIptv, usuarios } from "../database/schema";
import { avisarCliente } from "../lib/avisos-cliente";
import {
  LINK_APP_IPTV,
  MAX_PENDENTES_IPTV,
  SLUGS_IPTV,
  normalizarMac,
} from "../lib/iptv";

/**
 * ATIVACAO DO IPTV (app Fun Play)
 * ------------------------------------------------------------------
 * Diferente dos streamings, o IPTV nao entrega login/senha: o app e liberado
 * pelo ENDERECO MAC do aparelho. O fluxo completo:
 *
 *   compra confirmada
 *     -> e-mail `boasVindasIptv` (lib/pedidos.ts) com o link do app e a
 *        instrucao de achar o MAC no canto inferior direito da tela
 *     -> cliente digita o MAC aqui (`enviarMac`)
 *     -> alerta critico para o admin no painel + WhatsApp (notificar/escopo
 *        admin ja dispara o WhatsApp em services/whatsapp.ts)
 *     -> admin cadastra o MAC no servidor e clica "marcar como ativado"
 *     -> cliente ve a confirmacao no painel (alerta escopo cliente)
 *
 * Um cliente pode cadastrar varios aparelhos; o mesmo MAC nunca entra duas
 * vezes (indice unico cliente_id + mac).
 */

async function clienteDaSessaoOpcional(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  return cliente ?? null;
}

async function clienteDaSessao(authUserId: string) {
  const cliente = await clienteDaSessaoOpcional(authUserId);
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
  return cliente;
}

/** true quando o cliente tem vaga ativa em algum app de IPTV */
async function temIptv(clienteId: number) {
  const rows = await db
    .select({ servico: alocacoes.servico })
    .from(alocacoes)
    .where(
      and(
        eq(alocacoes.clienteId, clienteId),
        eq(alocacoes.status, "ativo"),
        inArray(alocacoes.servico, SLUGS_IPTV),
      ),
    );
  return rows.length > 0;
}

/** estado neutro: login sem ficha de cliente nao pode virar 404 em loop */
const SEM_IPTV = {
  temIptv: false as const,
  bloqueado: false as const,
  linkApp: LINK_APP_IPTV,
  pedidos: [] as Array<typeof ativacoesIptv.$inferSelect>,
  pendente: null,
  ativos: [] as Array<typeof ativacoesIptv.$inferSelect>,
};

export const iptv = {
  /** tudo que a aba "Ativar IPTV" do painel do cliente precisa */
  minhaAtivacao: authed.handler(async ({ context }) => {
    const cliente = await clienteDaSessaoOpcional(context.user.id);
    if (!cliente) return SEM_IPTV;

    const pedidos = await db
      .select()
      .from(ativacoesIptv)
      .where(eq(ativacoesIptv.clienteId, cliente.id))
      .orderBy(desc(ativacoesIptv.criadoEm))
      .limit(20);

    return {
      temIptv: await temIptv(cliente.id),
      bloqueado: estaBloqueado(cliente.statusPagamento, cliente.confiancaAte),
      linkApp: LINK_APP_IPTV,
      pedidos,
      pendente: pedidos.find((p) => p.status === "pendente") ?? null,
      ativos: pedidos.filter((p) => p.status === "ativado"),
    };
  }),

  /** o cliente manda o MAC que apareceu no canto inferior direito do app */
  enviarMac: authed
    .input(
      z.object({
        mac: z.string().min(12, "Digite o endereço MAC completo"),
        dispositivo: z.string().max(80).default(""),
      }),
    )
    .handler(async ({ context, input }) => {
      const cliente = await clienteDaSessao(context.user.id);
      if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte)) {
        throw new ORPCError("FORBIDDEN", { message: MSG_BLOQUEIO });
      }

      const mac = normalizarMac(input.mac);
      if (!mac) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Endereço MAC inválido. Use o formato AA:BB:CC:DD:EE:FF (12 caracteres).",
        });
      }

      const meus = await db
        .select()
        .from(ativacoesIptv)
        .where(eq(ativacoesIptv.clienteId, cliente.id));

      const repetido = meus.find((m) => m.mac === mac);
      if (repetido) {
        throw new ORPCError("CONFLICT", {
          message:
            repetido.status === "ativado"
              ? "Este aparelho já está ativado. Se os canais não abrirem, fale com o suporte."
              : "Você já enviou este endereço MAC. Estamos cuidando da ativação.",
        });
      }

      const pendentes = meus.filter((m) => m.status === "pendente").length;
      if (pendentes >= MAX_PENDENTES_IPTV) {
        throw new ORPCError("CONFLICT", {
          message: `Você já tem ${pendentes} aparelhos aguardando ativação. Aguarde a liberação antes de enviar outro.`,
        });
      }

      const [row] = await db
        .insert(ativacoesIptv)
        .values({
          clienteId: cliente.id,
          servicoSlug: SLUGS_IPTV[0]!,
          mac,
          dispositivo: input.dispositivo.trim(),
          status: "pendente",
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        })
        .returning();

      /**
       * GATILHO PRINCIPAL DO FLUXO: este alerta e o que vira mensagem no
       * WhatsApp do admin (escopo "admin" -> dispararWebhook -> whatsapp).
       * O texto segue exatamente o pedido: nome do cliente + MAC.
       */
      await notificar({
        escopo: "admin",
        clienteId: cliente.id,
        tipo: "sistema",
        severidade: "critico",
        titulo: `Novo cliente solicitou ativação: ${cliente.nome}`,
        mensagem: `MAC: ${mac}${input.dispositivo ? ` · ${input.dispositivo.trim()}` : ""}`,
        destino: "iptv",
        chave: `iptv:${row?.id ?? Date.now()}`,
      });

      return row;
    }),

  /** o cliente desiste (digitou errado, trocou de aparelho...) */
  cancelarMac: authed
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const cliente = await clienteDaSessao(context.user.id);
      const [row] = await db
        .update(ativacoesIptv)
        .set({ status: "cancelado", atualizadoEm: new Date() })
        .where(
          and(
            eq(ativacoesIptv.id, input.id),
            eq(ativacoesIptv.clienteId, cliente.id),
            eq(ativacoesIptv.status, "pendente"),
          ),
        )
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Solicitação não encontrada" });
      return row;
    }),

  /* ---------------------------------------------------------------- */
  /* ADMIN                                                             */
  /* ---------------------------------------------------------------- */

  /** fila de ativacoes: pendentes primeiro, historico completo abaixo */
  fila: adminOnly.handler(async () => {
    const rows = await db
      .select({
        id: ativacoesIptv.id,
        mac: ativacoesIptv.mac,
        dispositivo: ativacoesIptv.dispositivo,
        status: ativacoesIptv.status,
        respostaAdmin: ativacoesIptv.respostaAdmin,
        servicoSlug: ativacoesIptv.servicoSlug,
        criadoEm: ativacoesIptv.criadoEm,
        ativadoEm: ativacoesIptv.ativadoEm,
        clienteId: ativacoesIptv.clienteId,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        clienteTelefone: usuarios.telefone,
      })
      .from(ativacoesIptv)
      .leftJoin(usuarios, eq(usuarios.id, ativacoesIptv.clienteId))
      .orderBy(desc(ativacoesIptv.criadoEm))
      .limit(200);

    const peso = (s: string) => (s === "pendente" ? 0 : 1);
    const ordenadas = [...rows].sort((a, b) => peso(a.status) - peso(b.status));

    return {
      itens: ordenadas,
      pendentes: rows.filter((r) => r.status === "pendente").length,
      ativados: rows.filter((r) => r.status === "ativado").length,
    };
  }),

  /** "marcar como ativado" (ou recusar) em 1 clique */
  responder: adminOnly
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["ativado", "recusado"]),
        resposta: z.string().max(300).default(""),
      }),
    )
    .handler(async ({ input }) => {
      const padrao =
        input.status === "ativado"
          ? "Aparelho liberado! Feche o app Fun Play por completo e abra de novo para os canais carregarem."
          : "Não conseguimos ativar este endereço MAC. Confira o número no canto inferior direito do app e envie de novo.";

      const [row] = await db
        .update(ativacoesIptv)
        .set({
          status: input.status,
          respostaAdmin: input.resposta.trim() || padrao,
          atualizadoEm: new Date(),
          ativadoEm: input.status === "ativado" ? new Date() : null,
        })
        .where(eq(ativacoesIptv.id, input.id))
        .returning();

      if (!row) throw new ORPCError("NOT_FOUND", { message: "Solicitação não encontrada" });

      await notificar({
        escopo: "cliente",
        clienteId: row.clienteId,
        tipo: "sistema",
        severidade: input.status === "ativado" ? "info" : "alerta",
        titulo:
          input.status === "ativado"
            ? "IPTV liberado! Abra o app Fun Play"
            : "Endereço MAC não foi aceito",
        mensagem: row.respostaAdmin,
        destino: "iptv",
        chave: `iptv-resp:${row.id}:${input.status}`,
      });

      // acesso reposto: push automatico + WhatsApp na fila do admin
      if (input.status === "ativado") {
        await avisarCliente(row.clienteId, "acesso", {
          app: "IPTV",
          chave: `iptv:${row.id}`,
        });
      }

      return row;
    }),
};
