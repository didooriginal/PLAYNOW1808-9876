import { and, asc, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "../database";
import {
  alocacoes,
  aplicativos,
  codigosOtp,
  contasMatrizes,
  pedidosCodigo,
} from "../database/schema";
import { enviarPush } from "./push";

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
 * PUSH DO CODIGO — o aviso que tira o cliente da frente da tela.
 *
 * Sem isto o codigo so existe para quem esta com o painel aberto olhando. O
 * cliente esta de pe na frente da TV: o push chega no celular dele sozinho,
 * com o codigo no proprio texto, e um toque abre o painel com o codigo ja
 * copiado (ver `acao: "copiar"` no sw.js).
 *
 * Escolha consciente: o codigo APARECE na tela de bloqueio. Trocamos um pouco
 * de sigilo por velocidade — e um OTP de 15 minutos de app de streaming, nao
 * uma senha de banco.
 *
 * Nunca lanca e nunca bloqueia: `enviarPush` devolve `{enviados:0}` quando o
 * cliente nao ligou os avisos, e um push que falha NAO pode derrubar a entrega
 * do codigo.
 */
export async function avisarCodigoPronto(params: {
  clienteId: number;
  /** rotulo humano do app ("Disney+"); cai para o slug quando faltar */
  servico: string;
  codigo: string;
  codigoId: number;
}) {
  const { clienteId, servico, codigo, codigoId } = params;
  try {
    const envio = await enviarPush(clienteId, {
      titulo: `Seu código do ${servico} chegou`,
      corpo: `${codigo} — toque para abrir e copiar. Vale por 15 minutos.`,
      url: `/dashboard?aba=acessos&codigo=${codigoId}`,
      // a notificacao nova substitui a anterior: nunca dois codigos na barra
      tag: "codigo",
      acao: "copiar",
    });
    if (envio.enviados === 0) {
      // separa "ninguem ligou os avisos" de "o envio falhou": sao problemas
      // diferentes — o primeiro e adocao, o segundo e infra.
      const motivo =
        envio.falhas > 0
          ? `${envio.falhas} envio(s) falharam`
          : envio.removidos > 0
            ? `${envio.removidos} inscricao(oes) morta(s) removida(s)`
            : "nenhum aparelho inscrito";
      console.log(
        `[push] codigo ${codigoId} entregue ao cliente ${clienteId} sem aviso — ${motivo}`,
      );
    }
    return envio;
  } catch {
    return { enviados: 0, falhas: 0, removidos: 0 };
  }
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
  /** rotulo humano do app, so para o texto do push */
  servico?: string;
  /** o codigo em si, so para o texto do push */
  codigo?: string;
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

  /*
   * Push SO aqui, no caminho do webhook: o codigo chegou por e-mail e o
   * cliente nao esta olhando a tela. No resgate (`resgatarCodigoOrfao`) ele
   * acabou de clicar no painel e ve o codigo na hora — avisar ali seria
   * barulho duplicado.
   */
  if (params.codigo) {
    await avisarCodigoPronto({
      clienteId: pedido.clienteId,
      servico: params.servico || servicoSlug,
      codigo: params.codigo,
      codigoId,
    });
  }

  return pedido;
}

/** quanto tempo olhar PARA TRAS atras de um codigo orfao no resgate */
export const JANELA_RESGATE_MS = 5 * 60 * 1000;

/**
 * RESGATE DE CODIGO ORFAO.
 *
 * O problema: a ordem real do cliente e o inverso do que o fluxo assumia. Ele
 * tenta entrar na TV, o app dispara o e-mail, e SO ENTAO ele lembra do painel e
 * clica em "Pedi o codigo agora". Quando clica, o codigo ja chegou e ficou sem
 * dono — `entregarCodigo` so enxerga pedidos que existiam no instante do
 * e-mail. Resultado: o cliente esperava um codigo que ja estava no banco.
 * (Visto na pratica: codigos 37 e 38 chegaram 8s ANTES do pedido 25.)
 *
 * Aqui olhamos para tras. As travas sao as mesmas da entrega normal:
 *   - so codigo SEM DONO (`entregueClienteId` nulo) — nunca rouba de ninguem;
 *   - so de matriz onde ESTE cliente tem vaga ativa no MESMO app;
 *   - nao usado e dentro da janela curta;
 *   - o MAIS RECENTE primeiro: se o cliente pediu reenvio, o valido e o ultimo;
 *   - o UPDATE exige `entregueClienteId is null`, entao dois clientes clicando
 *     junto nao levam o mesmo codigo — o segundo nao atualiza nada.
 *
 * Limite honesto: numa matriz compartilhada nao da para saber QUEM disparou o
 * codigo (o app manda para a conta, nao para a pessoa). Por isso a janela e
 * curta. Esse risco ja existe no FIFO da entrega normal; aqui ele nao aumenta
 * de natureza, so de alcance.
 */
export async function resgatarCodigoOrfao(clienteId: number, servicoSlug: string) {
  const contas = await minhasContasDoServico(clienteId, servicoSlug);
  if (!contas.length) return null;

  /*
   * Enderecos onde o codigo PODE ter caido. Nao basta a captura da propria
   * conta: um mesmo Gmail hospeda varias matrizes e o encaminhamento aponta
   * para uma so (o e-mail do Disney+ cai em netflix166@). Por isso entram
   * tambem as capturas das contas IRMAS do mesmo login.
   */
  const logins = [...new Set(contas.map((c) => c.email).filter(Boolean))];
  const irmas = logins.length
    ? await db
        .select({ email: contasMatrizes.email, emailCaptura: contasMatrizes.emailCaptura })
        .from(contasMatrizes)
        .where(inArray(contasMatrizes.email, logins))
    : [];

  const destinos = [
    ...new Set(
      [...contas, ...irmas]
        .flatMap((c) => [c.email, c.emailCaptura])
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase()),
    ),
  ];
  if (!destinos.length) return null;

  const [orfao] = await db
    .select()
    .from(codigosOtp)
    .where(
      and(
        isNull(codigosOtp.entregueClienteId),
        isNull(codigosOtp.usadoEm),
        gt(codigosOtp.recebidoEm, new Date(Date.now() - JANELA_RESGATE_MS)),
        inArray(codigosOtp.servicoSlug, slugsDaFamilia(servicoSlug)),
        inArray(codigosOtp.destinatario, destinos),
      ),
    )
    // o mais NOVO: se houve reenvio, o codigo que presta e o ultimo
    .orderBy(desc(codigosOtp.recebidoEm))
    .limit(1);

  if (!orfao) return null;

  const agora = new Date();
  const [pedido] = await db
    .insert(pedidosCodigo)
    .values({
      clienteId,
      contaId: contas[0].contaId,
      servicoSlug,
      status: "entregue",
      criadoEm: agora,
      atendidoEm: agora,
      codigoId: orfao.id,
    })
    .returning();

  /*
   * A condicao `entregueClienteId is null` no WHERE e o que torna isto seguro
   * numa corrida: quem chegar depois nao atualiza linha nenhuma.
   */
  const tomado = await db
    .update(codigosOtp)
    .set({
      pedidoId: pedido.id,
      entregueClienteId: clienteId,
      clienteId,
      expiraEm: new Date(agora.getTime() + VALIDADE_CODIGO_MS),
    })
    .where(and(eq(codigosOtp.id, orfao.id), isNull(codigosOtp.entregueClienteId)))
    .returning();

  if (!tomado.length) {
    // outro cliente levou no meio do caminho: desfaz o pedido de resgate
    await db.delete(pedidosCodigo).where(eq(pedidosCodigo.id, pedido.id));
    return null;
  }

  return { pedido, codigo: tomado[0] };
}

/** quanto esperar antes de avisar que nenhum codigo chegou */
export const AVISO_ESPERA_MS = 60 * 1000;

/** pedidos que ja tem aviso agendado — evita dois timers no mesmo pedido */
const avisosAgendados = new Set<number>();

/** nome bonito do app a partir do slug ("disney" -> "Disney+") */
async function nomeDoApp(servicoSlug: string) {
  const [app] = await db
    .select({ nome: aplicativos.nome })
    .from(aplicativos)
    .where(eq(aplicativos.slug, servicoSlug))
    .limit(1);
  return app?.nome || servicoSlug;
}

/**
 * AVISO DE ESPERA — o espelho, no celular, do bloco ambar da tela.
 *
 * Passou um minuto e nenhum codigo casou com o pedido: quase sempre porque o
 * app nao mandou e-mail nenhum (o codigo ja tinha sido enviado antes). O
 * caminho e pedir o reenvio dentro do proprio app — e o cliente precisa saber
 * disso mesmo tendo fechado o painel.
 *
 * Best-effort de proposito: o timer vive no processo do servidor. Se ele
 * reiniciar dentro do minuto, o aviso se perde. Nao vale uma tabela de
 * agendamento para uma mensagem de conveniencia — o pedido continua valendo
 * seus 10 minutos de qualquer forma.
 */
export function agendarAvisoDeEspera(pedidoId: number, clienteId: number, servicoSlug: string) {
  if (avisosAgendados.has(pedidoId)) return;
  avisosAgendados.add(pedidoId);

  const timer = setTimeout(() => {
    void (async () => {
      avisosAgendados.delete(pedidoId);
      try {
        const [atual] = await db
          .select({ status: pedidosCodigo.status })
          .from(pedidosCodigo)
          .where(eq(pedidosCodigo.id, pedidoId))
          .limit(1);
        // ja recebeu, cancelou ou expirou: silencio
        if (!atual || atual.status !== "aguardando") return;

        const nome = await nomeDoApp(servicoSlug);
        await enviarPush(clienteId, {
          titulo: "Nenhum código chegou ainda",
          corpo: `Volte no ${nome} e toque em "reenviar código" — assim que chegar, eu te aviso.`,
          url: "/dashboard?aba=acessos",
          tag: "codigo-espera",
        });
      } catch {
        /* aviso e best-effort */
      }
    })();
  }, AVISO_ESPERA_MS);

  // nao segura o processo vivo so por causa de um aviso
  if (typeof timer.unref === "function") timer.unref();
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
