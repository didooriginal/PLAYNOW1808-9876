import { z } from "zod";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { adminOnly, authed } from "../middleware/auth";
import { notificar } from "./notificacoes";
import { estaBloqueado } from "../lib/cobranca";
import { db } from "../database";
import {
  alocacoes,
  aplicativos,
  codigosOtp,
  contasMatrizes,
  usuarios,
} from "../database/schema";

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

/* ------------------------------------------------------------------ */
/* EXTRAÇÃO DO CÓDIGO                                                  */
/* ------------------------------------------------------------------ */

/** rótulos que costumam anteceder o código no corpo do e-mail */
const ROTULOS = [
  "codigo de verificacao",
  "codigo de acesso",
  "codigo temporario",
  "codigo",
  "verification code",
  "security code",
  "access code",
  "one-time",
  "otp",
  "pin",
  "token",
];

/** remove acentos e baixa a caixa — deixa a busca por rótulo previsível */
const normalizar = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** parece ano (1900–2099) ou valor de 4 dígitos redondo demais para ser código */
const pareceAno = (n: string) => /^(19|20)\d{2}$/.test(n);

/**
 * Acha o código no texto. Primeiro procura números perto de um rótulo
 * ("seu código é 481920"); se não achar, cai no primeiro número isolado de
 * 4 a 6 dígitos que não pareça um ano.
 */
export function extrairCodigo(texto: string): { codigo: string; trecho: string } | null {
  const plano = texto.replace(/\s+/g, " ");
  const alvo = normalizar(plano);

  for (const rotulo of ROTULOS) {
    let de = 0;
    while (de < alvo.length) {
      const pos = alvo.indexOf(rotulo, de);
      if (pos === -1) break;
      const janela = plano.slice(pos, pos + rotulo.length + 80);
      const achou = janela.match(/(?<!\d)(\d{4,6})(?!\d)/);
      if (achou && !pareceAno(achou[1])) {
        return { codigo: achou[1], trecho: janela.trim().slice(0, 180) };
      }
      de = pos + rotulo.length;
    }
  }

  // padrão invertido: "481920 é o seu código"
  const invertido = plano.match(
    /(?<!\d)(\d{4,6})(?!\d)(?=[^0-9]{0,30}(?:e o seu|é o seu|is your|para|to ))/i,
  );
  if (invertido && !pareceAno(invertido[1])) {
    const pos = plano.indexOf(invertido[1]);
    return { codigo: invertido[1], trecho: plano.slice(Math.max(0, pos - 60), pos + 90).trim() };
  }

  // fallback: primeiro número isolado plausível
  const todos = [...plano.matchAll(/(?<!\d)(\d{4,6})(?!\d)/g)];
  const bom = todos.find((m) => !pareceAno(m[1]));
  if (bom) {
    const pos = bom.index ?? 0;
    return {
      codigo: bom[1],
      trecho: plano.slice(Math.max(0, pos - 60), pos + 90).trim(),
    };
  }

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
  if (!email) return null;

  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  if (cliente) return cliente.id;

  const contas = await db
    .select({ id: contasMatrizes.id })
    .from(contasMatrizes)
    .where(eq(contasMatrizes.email, email));
  if (!contas.length) return null;

  const vagas = await db
    .select({ clienteId: alocacoes.clienteId })
    .from(alocacoes)
    .where(
      and(
        inArray(
          alocacoes.contaId,
          contas.map((c) => c.id),
        ),
        eq(alocacoes.status, "ativo"),
        ...(servicoSlug !== "desconhecido" ? [eq(alocacoes.servico, servicoSlug)] : []),
      ),
    );

  const unicos = [...new Set(vagas.map((v) => v.clienteId))];
  return unicos.length === 1 ? unicos[0] : null;
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
}

export async function registrarEmail(entrada: EmailBruto) {
  const cabecalhos = lerCabecalhos(entrada.corpo);
  const remetente = (entrada.remetente || cabecalhos.remetente || "").trim();
  const destinatario = (entrada.destinatario || cabecalhos.destinatario || "").trim();
  const assunto = (entrada.assunto || cabecalhos.assunto || "").trim();

  const achado = extrairCodigo(`${assunto} ${entrada.corpo}`);
  if (!achado) return { ok: false as const, motivo: "Nenhum código de 4 a 6 dígitos encontrado" };

  const { servicoSlug, servico } = await identificarServico(remetente, assunto, entrada.corpo);
  const clienteId = await identificarCliente(destinatario, servicoSlug);

  await purgar();

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

  // GATILHO: todo OTP capturado vira alerta na central do admin.
  await notificar({
    escopo: "admin",
    clienteId,
    tipo: "otp",
    severidade: servicoSlug.startsWith("netflix") ? "alerta" : "info",
    titulo: `Código ${servico} recebido: ${achado.codigo}`,
    mensagem: `${destinatario || "conta matriz"}${assunto ? ` · ${assunto}` : ""}`,
    destino: "codigos",
    chave: `otp:${row?.id ?? `${achado.codigo}-${Date.now()}`}`,
  });

  return { ok: true as const, registro: row };
}

/* ------------------------------------------------------------------ */
/* ROTAS                                                               */
/* ------------------------------------------------------------------ */

export const codigos = {
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
      })
      .from(codigosOtp)
      .leftJoin(usuarios, eq(usuarios.id, codigosOtp.clienteId))
      .orderBy(desc(codigosOtp.recebidoEm));
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

  /**
   * "Seu código de acesso recente" no painel do cliente.
   * Devolve os códigos vinculados a ele OU endereçados a uma conta matriz em
   * que ele tem vaga ativa — sem nunca expor a conta/e-mail da matriz.
   */
  meuCodigo: authed.handler(async ({ context }) => {
    await purgar();

    const [cliente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.authUserId, context.user.id));
    if (!cliente) return [];
    // inadimplente nao ve codigos de acesso
    if (estaBloqueado(cliente.statusPagamento, cliente.confiancaAte)) return [];

    const minhasContas = await db
      .select({ email: contasMatrizes.email })
      .from(alocacoes)
      .innerJoin(contasMatrizes, eq(contasMatrizes.id, alocacoes.contaId))
      .where(and(eq(alocacoes.clienteId, cliente.id), eq(alocacoes.status, "ativo")));

    const emails = [
      ...new Set([cliente.email, ...minhasContas.map((c) => c.email.toLowerCase())]),
    ];

    const rows = await db
      .select({
        id: codigosOtp.id,
        codigo: codigosOtp.codigo,
        servicoSlug: codigosOtp.servicoSlug,
        servico: codigosOtp.servico,
        recebidoEm: codigosOtp.recebidoEm,
      })
      .from(codigosOtp)
      .where(
        or(
          eq(codigosOtp.clienteId, cliente.id),
          emails.length ? inArray(codigosOtp.destinatario, emails) : undefined,
        ),
      )
      .orderBy(desc(codigosOtp.recebidoEm))
      .limit(5);

    return rows;
  }),
};
