import { z } from "zod";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { estaBloqueado } from "../lib/cobranca";
import { db } from "../database";
import { decodificarAssunto, limparCorpoEmail } from "../lib/email-mime";
import {
  alocacoes,
  aplicativos,
  codigosOtp,
  contasMatrizes,
  emailsRecebidos,
  pedidosCodigo,
  usuarios,
} from "../database/schema";
import {
  JANELA_PEDIDO_MS,
  entregarCodigo,
  expirarPedidosVencidos,
  meusCodigosVisiveis,
  minhasContasDoServico,
  slugsDaFamilia,
} from "../lib/codigos-entrega";

/**
 * CENTRAL DE CÓDIGOS (OTP).
 *
 * Os streamings mandam um código de verificação para o e-mail da conta matriz.
 * Aqui esse e-mail entra por duas portas:
 *   1. webhook  → POST /api/webhooks/email (registrado em api/index.ts)
 *   2. manual   → o admin cola o e-mail inteiro na aba "Central de Códigos"
 *
 * Em qualquer caminho o fluxo é o mesmo: extrai o código de 4 a 6 dígitos,
 * identifica o serviço pelo remetente/assunto e tenta vincular o cliente pelo
 * destinatário. Tudo com mais de 1 hora é apagado automaticamente a cada
 * leitura — o código é efêmero por natureza e não vira histórico.
 */

const UMA_HORA_MS = 60 * 60 * 1000;
/** por quanto tempo o e-mail bruto fica na caixa de entrada do admin (7 dias) */
const RETENCAO_CAIXA_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* EXTRAÇÃO DO CÓDIGO                                                  */
/* ------------------------------------------------------------------ */

/**
 * Rotulos que costumam anteceder o codigo, do MAIS ESPECIFICO para o mais
 * generico. A ordem importa: "codigo" sozinho casa em qualquer lugar e
 * roubaria a vez de "codigo de acesso".
 */
const ROTULOS = [
  "informe este codigo",
  "digite este codigo",
  "digite o codigo",
  "use este codigo",
  "insira o codigo",
  "codigo de verificacao",
  "codigo de acesso",
  "codigo de seguranca",
  "codigo temporario",
  "codigo de login",
  "codigo unico",
  "seu codigo",
  "verification code",
  "security code",
  "access code",
  "one-time code",
  "one-time",
  "codigo",
  "otp",
  "pin",
  "token",
];

/**
 * Baixa a caixa e tira acentos SEM mudar o tamanho da string: os indices do
 * texto normalizado precisam valer no texto original, senao o trecho sai
 * deslocado (era uma das fontes do codigo errado).
 */
const normalizar = (v: string) =>
  Array.from(v)
    .map((c) => {
      const semAcento = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return semAcento.length === 1 ? semAcento : c.toLowerCase();
    })
    .join("");

/** parece ano (1900-2099) — nunca e codigo */
const pareceAno = (n: string) => /^(19|20)\d{2}$/.test(n);

/** distancia maxima entre o fim do rotulo e o inicio do numero */
const JANELA_DEPOIS = 60;
/** distancia maxima quando o numero vem ANTES do rotulo ("3290 e o seu codigo") */
const JANELA_ANTES = 40;

/**
 * true quando o numero esta sozinho na "palavra" — sem letra, hex ou hifen
 * colado. Barra uuid de rastreio ("...-4783-afd4..."), IP e id de cabecalho.
 */
function numeroIsolado(plano: string, inicio: number, tamanho: number) {
  let de = inicio;
  while (de > 0 && !/\s/.test(plano[de - 1] as string)) de--;
  let ate = inicio + tamanho;
  while (ate < plano.length && !/\s/.test(plano[ate] as string)) ate++;
  const palavra = plano.slice(de, ate);
  // aceita "3290", "3290.", "(3290)", "codigo:3290" -> nunca letra ou hifen
  return !/[A-Za-z]/.test(palavra) && !/[-_/\\]/.test(palavra);
}

/**
 * Acha o codigo no e-mail.
 *
 * 1. o corpo passa por `limparCorpoEmail()`: e-mail cru vira o texto que o
 *    humano leria (parte text/plain decodificada, sem cabecalhos e sem URLs);
 * 2. junta os numeros de 4 a 6 digitos ISOLADOS (nada de uuid/IP/hex);
 * 3. escolhe o que estiver mais perto de um rotulo, do rotulo mais especifico
 *    para o mais generico, aceitando o numero depois OU antes do rotulo;
 * 4. sem rotulo nenhum, cai no primeiro numero isolado plausivel.
 */
export function extrairCodigo(texto: string): { codigo: string; trecho: string } | null {
  const plano = limparCorpoEmail(texto).replace(/\s+/g, " ");
  const alvo = normalizar(plano);

  const candidatos = [...plano.matchAll(/(?<![0-9A-Za-z])(\d{4,6})(?![0-9A-Za-z])/g)]
    .map((m) => ({ valor: m[1] as string, pos: m.index ?? 0 }))
    .filter((c) => !pareceAno(c.valor) && numeroIsolado(plano, c.pos, c.valor.length));

  if (!candidatos.length) return null;

  const comTrecho = (c: { valor: string; pos: number }) => ({
    codigo: c.valor,
    trecho: plano
      .slice(Math.max(0, c.pos - 70), c.pos + c.valor.length + 90)
      .trim()
      .slice(0, 180),
  });

  const posicoesDeRotulo: number[] = [];

  for (const rotulo of ROTULOS) {
    let de = 0;
    while (de < alvo.length) {
      const pos = alvo.indexOf(rotulo, de);
      if (pos === -1) break;
      const fimRotulo = pos + rotulo.length;

      const depois = candidatos
        .filter((c) => c.pos >= fimRotulo && c.pos <= fimRotulo + JANELA_DEPOIS)
        .sort((a, b) => a.pos - b.pos)[0];
      if (depois) return comTrecho(depois);

      const antes = candidatos
        .filter((c) => c.pos + c.valor.length <= pos && c.pos + c.valor.length >= pos - JANELA_ANTES)
        .sort((a, b) => b.pos - a.pos)[0];
      if (antes) return comTrecho(antes);

      de = fimRotulo;
      posicoesDeRotulo.push(fimRotulo);
    }
  }

  /*
   * Segunda passada: existe rotulo no e-mail, mas o numero ficou mais longe
   * (layout com tabela/HTML no meio). Pega o numero isolado mais proximo de
   * algum rotulo, ate 200 caracteres.
   */
  if (posicoesDeRotulo.length) {
    const perto = candidatos
      .map((c) => ({
        c,
        dist: Math.min(...posicoesDeRotulo.map((r) => Math.abs(c.pos - r))),
      }))
      .filter((x) => x.dist <= 200)
      .sort((a, b) => a.dist - b.dist)[0];
    if (perto) return comTrecho(perto.c);
  }

  /*
   * Nenhum rotulo: NAO adivinha. Antes o extrator devolvia o primeiro numero
   * de 4 a 6 digitos que achasse, e aviso do tipo "novo login" virava codigo
   * falso no painel do cliente (CEP, telefone 0800, endereco da empresa).
   */
  return null;
}

/* ------------------------------------------------------------------ */
/* IDENTIFICAÇÃO DO SERVIÇO                                            */
/* ------------------------------------------------------------------ */

/** apelidos extras por slug — o que aparece no domínio/assunto do e-mail */
const APELIDOS: Record<string, string[]> = {
  netflix: ["netflix"],
  "netflix-individual": [],
  disney: ["disney", "disneyplus"],
  prime: ["primevideo", "amazon", "amazonvideo"],
  hbomax: ["hbomax", "hbo", "max.com", "warnermedia", "wbd"],
  paramount: ["paramount"],
  appletv: ["apple", "icloud", "appletv"],
  spotify: ["spotify"],
  youtube: ["youtube", "google", "googlemail"],
  "youtube-individual": [],
  crunchyroll: ["crunchyroll"],
  globoplay: ["globoplay", "globo"],
  "globoplay-premium": [],
  deezer: ["deezer"],
  canva: ["canva"],
  capcut: ["capcut", "bytedance"],
  dazn: ["dazn"],
  premiere: ["premiere"],
  combate: ["combate"],
  looke: ["looke"],
  recordplus: ["recordplus", "record"],
  "brasil-paralelo": ["brasilparalelo"],
  kocowa: ["kocowa"],
  vikki: ["viki", "rakuten"],
  funplay: ["funplay"],
  clarotv: ["clarotv", "claro"],
  skytv: ["skytv", "sky"],
  unitv: ["unitv"],
  "unitv-vitalicio": [],
  univer: ["univer"],
  star: ["starplus"],
  iptv: [],
};

async function identificarServico(remetente: string, assunto: string, corpo: string) {
  const apps = await db
    .select({ slug: aplicativos.slug, nome: aplicativos.nome })
    .from(aplicativos);

  const alvoForte = normalizar(`${remetente} ${assunto}`).replace(/[^a-z0-9.]/g, "");
  const alvoFraco = normalizar(corpo).replace(/[^a-z0-9.]/g, "");

  const candidatos = apps
    .map((app) => {
      const chaves = [
        app.slug.replace(/-/g, ""),
        normalizar(app.nome).replace(/[^a-z0-9]/g, ""),
        ...(APELIDOS[app.slug] ?? []).map((a) => a.replace(/[^a-z0-9.]/g, "")),
      ].filter((c) => c.length >= 3);

      const forte = chaves.some((c) => alvoForte.includes(c));
      const fraco = chaves.some((c) => alvoFraco.includes(c));
      const maiorChave = Math.max(...chaves.map((c) => c.length), 0);
      return { app, peso: forte ? 2 : fraco ? 1 : 0, maiorChave };
    })
    .filter((c) => c.peso > 0)
    .sort((a, b) => b.peso - a.peso || b.maiorChave - a.maiorChave);

  const melhor = candidatos[0];
  return melhor
    ? { servicoSlug: melhor.app.slug, servico: melhor.app.nome }
    : { servicoSlug: "desconhecido", servico: "Desconhecido" };
}

/* ------------------------------------------------------------------ */
/* VÍNCULO COM O CLIENTE                                               */
/* ------------------------------------------------------------------ */

/**
 * Tenta descobrir de quem é o código:
 *  1. destinatário é o e-mail de um cliente → é dele;
 *  2. destinatário é uma conta matriz com UMA única vaga ativa → é do ocupante;
 *  3. conta matriz compartilhada → deixa sem dono (o admin repassa manualmente).
 */
async function identificarCliente(destinatario: string, servicoSlug: string) {
  const email = destinatario.trim().toLowerCase();
  if (!email) return { clienteId: null as number | null, contaIds: [] as number[] };

  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  if (cliente) return { clienteId: cliente.id, contaIds: [] as number[] };

  /*
   * O destinatario pode ser o e-mail de LOGIN da matriz ou o endereco de
   * CAPTURA do nosso dominio (netflix01@mail.playplusnow.com.br), que e o
   * caminho novo via Cloudflare Email Routing.
   */
  const contas = await db
    .select({ id: contasMatrizes.id })
    .from(contasMatrizes)
    .where(or(eq(contasMatrizes.email, email), eq(contasMatrizes.emailCaptura, email)));
  if (!contas.length) return { clienteId: null as number | null, contaIds: [] as number[] };

  const contaIds = contas.map((c) => c.id);

  const vagas = await db
    .select({ clienteId: alocacoes.clienteId })
    .from(alocacoes)
    .where(
      and(
        inArray(alocacoes.contaId, contaIds),
        eq(alocacoes.status, "ativo"),
        ...(servicoSlug !== "desconhecido"
          ? [inArray(alocacoes.servico, slugsDaFamilia(servicoSlug))]
          : []),
      ),
    );

  /*
   * Vaga unica: da para atribuir com seguranca. Conta compartilhada: fica sem
   * dono aqui e quem decide e o `entregarCodigo()`, pelo pedido em aberto.
   */
  const unicos = [...new Set(vagas.map((v) => v.clienteId))];
  return { clienteId: unicos.length === 1 ? unicos[0] : null, contaIds };
}

/* ------------------------------------------------------------------ */
/* PIPELINE COMPARTILHADO (webhook + colagem manual)                   */
/* ------------------------------------------------------------------ */

export type EmailBruto = {
  remetente?: string;
  destinatario?: string;
  assunto?: string;
  corpo: string;
  origem: "webhook" | "manual";
};

/** lê cabeçalhos De/Para/Assunto quando o admin cola o e-mail inteiro */
function lerCabecalhos(corpo: string) {
  const pegar = (padroes: RegExp[]) => {
    for (const re of padroes) {
      const m = corpo.match(re);
      if (m?.[1]) return m[1].trim();
    }
    return "";
  };

  const emailDe = pegar([/^\s*(?:de|from)\s*:\s*(.+)$/im]);
  const emailPara = pegar([/^\s*(?:para|to)\s*:\s*(.+)$/im]);
  const assunto = pegar([/^\s*(?:assunto|subject)\s*:\s*(.+)$/im]);

  const soEmail = (v: string) => v.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? v;

  return {
    remetente: emailDe ? soEmail(emailDe) : "",
    destinatario: emailPara ? soEmail(emailPara) : "",
    assunto,
  };
}

/** apaga tudo que passou de 1 hora — chamado em toda leitura da central */
async function purgar() {
  const limite = new Date(Date.now() - UMA_HORA_MS);
  await db.delete(codigosOtp).where(lt(codigosOtp.recebidoEm, limite));

  // a caixa de entrada guarda por mais tempo (o admin precisa LER o e-mail),
  // e o que estiver fixado nunca some sozinho
  const limiteCaixa = new Date(Date.now() - RETENCAO_CAIXA_MS);
  await db
    .delete(emailsRecebidos)
    .where(and(lt(emailsRecebidos.recebidoEm, limiteCaixa), eq(emailsRecebidos.fixado, false)));
}

export async function registrarEmail(entrada: EmailBruto) {
  const cabecalhos = lerCabecalhos(entrada.corpo);
  const remetente = (entrada.remetente || cabecalhos.remetente || "").trim();
  const destinatario = (entrada.destinatario || cabecalhos.destinatario || "").trim();
  const assunto = decodificarAssunto((entrada.assunto || cabecalhos.assunto || "").trim());

  /*
   * O corpo pode chegar CRU (Worker antigo publicado, ou admin colando o
   * e-mail inteiro): cabecalhos, multipart e quoted-printable. Limpar aqui
   * garante que o codigo venha do texto que o cliente le, e nao de um uuid
   * de cabecalho ou de um link de rastreio.
   */
  const corpoLimpo = limparCorpoEmail(entrada.corpo);

  const achado = extrairCodigo(`${assunto}\n${corpoLimpo}`);
  const { servicoSlug, servico } = await identificarServico(remetente, assunto, corpoLimpo);

  await purgar();

  /*
   * CAIXA DE ENTRADA: o e-mail inteiro é gravado ANTES de qualquer decisão.
   * Antes, e-mail sem código de 4 a 6 dígitos (confirmação do Gmail, aviso de
   * novo aparelho...) era simplesmente descartado e o admin nunca via o
   * conteúdo. Agora tudo fica legível no painel por 7 dias.
   */
  await db.insert(emailsRecebidos).values({
    remetente,
    destinatario,
    assunto,
    corpo: entrada.corpo.slice(0, 200_000),
    codigo: achado?.codigo ?? "",
    servicoSlug,
    origem: entrada.origem,
    recebidoEm: new Date(),
  });

  if (!achado) return { ok: false as const, motivo: "Nenhum código de 4 a 6 dígitos encontrado" };

  const { clienteId, contaIds } = await identificarCliente(destinatario, servicoSlug);

  const [row] = await db
    .insert(codigosOtp)
    .values({
      codigo: achado.codigo,
      servicoSlug,
      servico,
      clienteId,
      remetente,
      destinatario,
      assunto,
      trecho: achado.trecho,
      origem: entrada.origem,
      recebidoEm: new Date(),
    })
    .returning();

  /*
   * ENTREGA DIRIGIDA: o codigo so vai para o painel de quem clicou em
   * "Pedi o codigo agora". Sem pedido casado ele fica sem dono (so admin).
   */
  const pedido = row
    ? await entregarCodigo({
        codigoId: row.id,
        servicoSlug,
        contaIds,
        clienteDireto: clienteId,
      })
    : null;

  let dono: { id: number; nome: string } | null = null;
  if (pedido) {
    const [u] = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(eq(usuarios.id, pedido.clienteId));
    dono = u ?? null;
  }

  // GATILHO: todo OTP capturado vira alerta na central do admin.
  await notificar({
    escopo: "admin",
    clienteId: pedido?.clienteId ?? clienteId,
    tipo: "otp",
    severidade: servicoSlug.startsWith("netflix") ? "alerta" : "info",
    titulo: `Código ${servico} recebido: ${achado.codigo}`,
    mensagem: dono
      ? `Entregue a ${dono.nome}${assunto ? ` · ${assunto}` : ""}`
      : `Sem dono — ninguém pediu${destinatario ? ` · ${destinatario}` : ""}${assunto ? ` · ${assunto}` : ""}`,
    destino: "codigos",
    chave: `otp:${row?.id ?? `${achado.codigo}-${Date.now()}`}`,
  });

  return { ok: true as const, registro: row, entregue: dono };
}

/* ------------------------------------------------------------------ */
/* ROTAS                                                               */
/* ------------------------------------------------------------------ */

/** ficha do cliente logado — todas as rotas de pedido dependem dela */
async function fichaDaSessao(authUserId: string) {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.authUserId, authUserId));
  if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Ficha de cliente não encontrada" });
  return cliente;
}

export const codigos = {
  /* ---------------------------------------------------------------- */
  /* CAIXA DE ENTRADA — e-mails brutos que chegaram no webhook          */
  /* ---------------------------------------------------------------- */

  /**
   * Lista os e-mails recebidos com o CORPO COMPLETO, inclusive os que não
   * tinham código nenhum. É aqui que o admin lê, por exemplo, o código de
   * confirmação que o Gmail manda ao adicionar um endereço de envio.
   */
  caixaEntrada: adminOnly
    .input(
      z
        .object({
          busca: z.string().max(120).optional(),
          limite: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .handler(async ({ input }) => {
      await purgar();
      const brutos = await db
        .select()
        .from(emailsRecebidos)
        .orderBy(desc(emailsRecebidos.recebidoEm))
        .limit(input?.limite ?? 60);

      /*
       * Assunto legivel tambem para o que ja esta gravado: e-mail antigo foi
       * salvo com o assunto codificado ("=?UTF-8?Q?Netflix:_seu_c=C3=B3digo?=").
       */
      const rows = brutos.map((r) => ({ ...r, assunto: decodificarAssunto(r.assunto) }));

      const busca = (input?.busca ?? "").trim().toLowerCase();
      if (!busca) return rows;
      return rows.filter((r) =>
        `${r.remetente} ${r.destinatario} ${r.assunto} ${r.corpo} ${r.codigo}`
          .toLowerCase()
          .includes(busca),
      );
    }),

  /** fixa/desfixa um e-mail para ele escapar da limpeza automática de 7 dias */
  fixarEmail: adminOnly
    .input(z.object({ id: z.number().int(), fixado: z.boolean() }))
    .handler(async ({ input }) => {
      const [row] = await db
        .update(emailsRecebidos)
        .set({ fixado: input.fixado })
        .where(eq(emailsRecebidos.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "E-mail não encontrado" });
      return row;
    }),

  removerEmail: adminOnly
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(emailsRecebidos).where(eq(emailsRecebidos.id, input.id));
      return { ok: true };
    }),

  /** central do admin — purga os antigos e devolve os códigos da última hora */
  listar: adminOnly.handler(async () => {
    await purgar();
    const rows = await db
      .select({
        id: codigosOtp.id,
        codigo: codigosOtp.codigo,
        servicoSlug: codigosOtp.servicoSlug,
        servico: codigosOtp.servico,
        clienteId: codigosOtp.clienteId,
        clienteNome: usuarios.nome,
        clienteEmail: usuarios.email,
        remetente: codigosOtp.remetente,
        destinatario: codigosOtp.destinatario,
        assunto: codigosOtp.assunto,
        trecho: codigosOtp.trecho,
        origem: codigosOtp.origem,
        recebidoEm: codigosOtp.recebidoEm,
        pedidoId: codigosOtp.pedidoId,
        entregueClienteId: codigosOtp.entregueClienteId,
        usadoEm: codigosOtp.usadoEm,
        expiraEm: codigosOtp.expiraEm,
      })
      .from(codigosOtp)
      .leftJoin(usuarios, eq(usuarios.id, codigosOtp.clienteId))
      .orderBy(desc(codigosOtp.recebidoEm));

    // nome de quem REALMENTE recebeu (pode diferir do palpite de vinculo)
    const ids = [...new Set(rows.map((r) => r.entregueClienteId).filter((v): v is number => !!v))];
    const donos = ids.length
      ? await db
          .select({ id: usuarios.id, nome: usuarios.nome })
          .from(usuarios)
          .where(inArray(usuarios.id, ids))
      : [];
    const mapa = new Map(donos.map((d) => [d.id, d.nome]));

    return rows.map((r) => ({
      ...r,
      entregueNome: r.entregueClienteId ? (mapa.get(r.entregueClienteId) ?? null) : null,
      semDono: !r.entregueClienteId,
    }));
  }),

  /** pedidos em aberto agora — mostra a fila viva no admin */
  pedidosAbertos: adminOnly.handler(async () => {
    await expirarPedidosVencidos();
    const rows = await db
      .select({
        id: pedidosCodigo.id,
        clienteId: pedidosCodigo.clienteId,
        clienteNome: usuarios.nome,
        contaId: pedidosCodigo.contaId,
        contaRotulo: contasMatrizes.rotulo,
        servicoSlug: pedidosCodigo.servicoSlug,
        status: pedidosCodigo.status,
        criadoEm: pedidosCodigo.criadoEm,
      })
      .from(pedidosCodigo)
      .leftJoin(usuarios, eq(usuarios.id, pedidosCodigo.clienteId))
      .leftJoin(contasMatrizes, eq(contasMatrizes.id, pedidosCodigo.contaId))
      .where(eq(pedidosCodigo.status, "aguardando"))
      .orderBy(desc(pedidosCodigo.criadoEm))
      .limit(50);
    return rows;
  }),

  /** o admin cola o e-mail recebido; o parser faz o resto */
  registrarManual: adminOnly
    .input(
      z.object({
        corpo: z.string().min(4, "Cole o conteúdo do e-mail"),
        remetente: z.string().default(""),
        destinatario: z.string().default(""),
        assunto: z.string().default(""),
      }),
    )
    .handler(async ({ input }) => {
      const r = await registrarEmail({ ...input, origem: "manual" });
      if (!r.ok) throw new ORPCError("BAD_REQUEST", { message: r.motivo });
      return r.registro;
    }),

  /** vincula/corrige o dono do código na mão */
  vincular: adminOnly
    .input(z.object({ id: z.number().int(), clienteId: z.number().int().nullable() }))
    .handler(async ({ input }) => {
      const [row] = await db
        .update(codigosOtp)
        .set({ clienteId: input.clienteId })
        .where(eq(codigosOtp.id, input.id))
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Código não encontrado" });
      return row;
    }),

  remover: adminOnly.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
    await db.delete(codigosOtp).where(eq(codigosOtp.id, input.id));
    return { ok: true };
  }),

  /* ---------------------------------------------------------------- */
  /* PEDIDO DE CÓDIGO (cliente)                                        */
  /* ---------------------------------------------------------------- */

  /**
   * "Pedi o código agora": abre a janela em que ESTE cliente pode receber o
   * próximo código da matriz. É o que impede um cliente de ver o código do
   * outro na mesma conta compartilhada.
   */
  pedirCodigo: authed
    .input(z.object({ servicoSlug: z.string().min(2) }))
    .handler(async ({ context, input }) => {
      const cliente = await fichaDaSessao(context.user.id);
      if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte))
        throw new ORPCError("FORBIDDEN", {
          message: "Assinatura em atraso — regularize para pedir um código.",
        });

      await expirarPedidosVencidos();

      // já existe um pedido em aberto? devolve o mesmo, sem duplicar a fila
      const [aberto] = await db
        .select()
        .from(pedidosCodigo)
        .where(
          and(eq(pedidosCodigo.clienteId, cliente.id), eq(pedidosCodigo.status, "aguardando")),
        )
        .orderBy(desc(pedidosCodigo.criadoEm))
        .limit(1);
      if (aberto) return aberto;

      const contas = await minhasContasDoServico(cliente.id, input.servicoSlug);
      if (!contas.length)
        throw new ORPCError("FORBIDDEN", {
          message: "Você não tem uma vaga ativa nesse aplicativo.",
        });

      const [pedido] = await db
        .insert(pedidosCodigo)
        .values({
          clienteId: cliente.id,
          contaId: contas[0].contaId,
          servicoSlug: input.servicoSlug,
          status: "aguardando",
          criadoEm: new Date(),
        })
        .returning();
      return pedido;
    }),

  /** o cliente desistiu — libera a vez para outro da mesma matriz */
  cancelarPedido: authed
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const cliente = await fichaDaSessao(context.user.id);
      await db
        .update(pedidosCodigo)
        .set({ status: "cancelado" })
        .where(
          and(
            eq(pedidosCodigo.id, input.id),
            eq(pedidosCodigo.clienteId, cliente.id),
            eq(pedidosCodigo.status, "aguardando"),
          ),
        );
      return { ok: true };
    }),

  /** "já usei este código" — some do painel na hora */
  marcarUsado: authed
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const cliente = await fichaDaSessao(context.user.id);
      await db
        .update(codigosOtp)
        .set({ usadoEm: new Date() })
        .where(
          and(eq(codigosOtp.id, input.id), eq(codigosOtp.entregueClienteId, cliente.id)),
        );
      return { ok: true };
    }),

  /**
   * Painel do cliente: código entregue a ELE, ainda não usado e dentro dos
   * 15 minutos. Mais o pedido em aberto, para a tela mostrar "aguardando".
   */
  meuCodigo: authed.handler(async ({ context }) => {
    await purgar();
    await expirarPedidosVencidos();

    const [cliente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.authUserId, context.user.id));
    if (!cliente) return { codigos: [], pedido: null };
    // inadimplente nao ve codigos de acesso
    if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte))
      return { codigos: [], pedido: null };

    const codigos = await meusCodigosVisiveis(cliente.id);
    const [pedido] = await db
      .select()
      .from(pedidosCodigo)
      .where(
        and(eq(pedidosCodigo.clienteId, cliente.id), eq(pedidosCodigo.status, "aguardando")),
      )
      .orderBy(desc(pedidosCodigo.criadoEm))
      .limit(1);

    return {
      codigos,
      pedido: pedido
        ? {
            id: pedido.id,
            servicoSlug: pedido.servicoSlug,
            criadoEm: pedido.criadoEm,
            expiraEm: new Date(pedido.criadoEm.getTime() + JANELA_PEDIDO_MS),
          }
        : null,
    };
  }),
};
