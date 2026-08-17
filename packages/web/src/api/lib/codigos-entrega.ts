import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "../database";
import { alocacoes, codigosOtp, contasMatrizes, pedidosCodigo } from "../database/schema";

/**
 * ENTREGA DIRIGIDA DE CODIGO.
 *
 * O problema que este arquivo resolve: uma conta matriz tem varios clientes.
 * Se o painel mostrasse "o ultimo codigo recebido", dois clientes pedindo
 * codigo ao mesmo tempo veriam o codigo um do outro — e um deles digitaria o
 * codigo errado na TV.
 *
 * A regra aqui e simples e explicita:
 *   1. o cliente ABRE UM PEDIDO no painel ("Pedi o codigo agora");
 *   2. quando o e-mail chega, o codigo e casado com o pedido `aguardando`
 *      mais antigo da MESMA matriz e do MESMO servico (FIFO);
 *   3. sem pedido casado, o codigo fica SEM DONO: aparece so no admin.
 *
 * Nada de heuristica: quem nao pediu nao ve.
 */

/** janela em que um pedido continua valendo para receber um codigo */
export const JANELA_PEDIDO_MS = 10 * 60 * 1000;
/** tempo que o codigo entregue fica visivel no painel do cliente */
export const VALIDADE_CODIGO_MS = 15 * 60 * 1000;

/** slugs tratados como o mesmo servico na hora de casar pedido x codigo */
const FAMILIAS: Record<string, string> = {
  "netflix-individual": "netflix",
  "youtube-individual": "youtube",
  "globoplay-premium": "globoplay",
  "globoplay-premium-telecine": "globoplay",
  "premiere-comum": "premiere",
  "premiere-prime": "premiere",
  "premiere-globoplay": "premiere",
  "unitv-vitalicio": "unitv",
};

/** "netflix-individual" e "netflix" contam como o mesmo app para o pedido */
export function familiaDoServico(slug: string) {
  return FAMILIAS[slug] ?? slug;
}

/** todos os slugs que pertencem a mesma familia do slug informado */
export function slugsDaFamilia(slug: string) {
  const familia = familiaDoServico(slug);
  const irmaos = Object.entries(FAMILIAS)
    .filter(([, f]) => f === familia)
    .map(([s]) => s);
  return [...new Set([familia, slug, ...irmaos])];
}

/**
 * Fecha os pedidos que passaram da janela sem receber codigo. Chamada em toda
 * leitura para o painel nunca mostrar um "aguardando" eterno.
 */
export async function expirarPedidosVencidos() {
  await db
    .update(pedidosCodigo)
    .set({ status: "expirado" })
    .where(
      and(
        eq(pedidosCodigo.status, "aguardando"),
        lt(pedidosCodigo.criadoEm, new Date(Date.now() - JANELA_PEDIDO_MS)),
      ),
    );
}

/** matrizes em que o cliente tem vaga ativa naquele app (com o e-mail de captura) */
export async function minhasContasDoServico(clienteId: number, servicoSlug: string) {
  const slugs = slugsDaFamilia(servicoSlug);
  return db
    .select({
      contaId: contasMatrizes.id,
      rotulo: contasMatrizes.rotulo,
      email: contasMatrizes.email,
      emailCaptura: contasMatrizes.emailCaptura,
      status: contasMatrizes.status,
      servico: alocacoes.servico,
    })
    .from(alocacoes)
    .innerJoin(contasMatrizes, eq(contasMatrizes.id, alocacoes.contaId))
    .where(
      and(
        eq(alocacoes.clienteId, clienteId),
        eq(alocacoes.status, "ativo"),
        inArray(alocacoes.servico, slugs),
      ),
    );
}

/**
 * Casa um codigo recem-chegado com um pedido em aberto.
 *
 * `contaIds` sao as matrizes cujo e-mail (login ou captura) bate com o
 * destinatario do e-mail. Devolve o pedido atendido, ou null quando o codigo
 * fica sem dono.
 */
export async function entregarCodigo(params: {
  codigoId: number;
  servicoSlug: string;
  contaIds: number[];
  /** quando o destinatario era o e-mail pessoal do cliente, o dono ja e certo */
  clienteDireto?: number | null;
}) {
  const { codigoId, servicoSlug, contaIds, clienteDireto } = params;
  await expirarPedidosVencidos();

  const desde = new Date(Date.now() - JANELA_PEDIDO_MS);
  const slugs = slugsDaFamilia(servicoSlug);

  /*
   * Filtro do pedido: precisa ser da mesma familia de servico E de uma das
   * matrizes que recebeu o e-mail. Quando o e-mail foi para o endereco pessoal
   * do cliente, aceita o pedido dele mesmo que a conta nao tenha casado.
   */
  const alvoConta =
    contaIds.length > 0 ? inArray(pedidosCodigo.contaId, contaIds) : undefined;
  const alvoCliente = clienteDireto ? eq(pedidosCodigo.clienteId, clienteDireto) : undefined;
  const alvo = alvoConta && alvoCliente ? or(alvoConta, alvoCliente) : (alvoConta ?? alvoCliente);
  if (!alvo) return null;

  const [pedido] = await db
    .select()
    .from(pedidosCodigo)
    .where(
      and(
        eq(pedidosCodigo.status, "aguardando"),
        gt(pedidosCodigo.criadoEm, desde),
        servicoSlug !== "desconhecido" ? inArray(pedidosCodigo.servicoSlug, slugs) : undefined,
        alvo,
      ),
    )
    // FIFO: quem pediu primeiro recebe primeiro
    .orderBy(asc(pedidosCodigo.criadoEm))
    .limit(1);

  if (!pedido) return null;

  const agora = new Date();
  await db
    .update(pedidosCodigo)
    .set({ status: "entregue", codigoId, atendidoEm: agora })
    .where(eq(pedidosCodigo.id, pedido.id));

  await db
    .update(codigosOtp)
    .set({
      pedidoId: pedido.id,
      entregueClienteId: pedido.clienteId,
      clienteId: pedido.clienteId,
      expiraEm: new Date(agora.getTime() + VALIDADE_CODIGO_MS),
    })
    .where(eq(codigosOtp.id, codigoId));

  return pedido;
}

/** codigos que ESTE cliente pode ver agora: entregues a ele, nao usados e no prazo */
export async function meusCodigosVisiveis(clienteId: number) {
  const agora = new Date();
  return db
    .select({
      id: codigosOtp.id,
      codigo: codigosOtp.codigo,
      servico: codigosOtp.servico,
      servicoSlug: codigosOtp.servicoSlug,
      assunto: codigosOtp.assunto,
      recebidoEm: codigosOtp.recebidoEm,
      expiraEm: codigosOtp.expiraEm,
    })
    .from(codigosOtp)
    .where(
      and(
        eq(codigosOtp.entregueClienteId, clienteId),
        isNull(codigosOtp.usadoEm),
        gt(codigosOtp.expiraEm, agora),
      ),
    )
    .orderBy(asc(codigosOtp.expiraEm));
}
