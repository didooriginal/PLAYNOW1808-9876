import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Banco real da PLAPLUSNOW (Turso/SQLite via Drizzle).
 * Aplique alterações com `bun run db:push` dentro de packages/web.
 *
 * 3 tabelas principais:
 *  - pacotes          → combos vendidos (nome, preço, array de serviços/ícones)
 *  - contas_matrizes  → estoque (serviço, e-mail, senha, vagas totais/ocupadas)
 *  - usuarios         → clientes (nome, e-mail, status de pagamento, pacote contratado)
 */

/* ------------------------------------------------------------------ */
/* PACOTES                                                             */
/* ------------------------------------------------------------------ */

export const pacotes = sqliteTable("pacotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  tagline: text("tagline").notNull().default(""),
  /** preço mensal */
  preco: real("preco").notNull(),
  /** preço por mês no plano anual (opcional) */
  precoAnual: real("preco_anual"),
  /**
   * array de ids de serviços/ícones — guardado como JSON.
   * ex.: ["netflix","disney","spotify"]
   */
  servicos: text("servicos", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .$defaultFn(() => []),
  /**
   * benefícios exibidos no card do pacote na landing — JSON de strings.
   * ex.: ["3 apps liberados","Suporte no WhatsApp"]
   */
  perks: text("perks", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .$defaultFn(() => []),
  /** cor de destaque no site: red | cyan | purple */
  accent: text("accent").notNull().default("cyan"),
  badge: text("badge"),
  destaque: integer("destaque", { mode: "boolean" }).notNull().default(false),
  vagasRestantes: integer("vagas_restantes").notNull().default(0),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Pacote = typeof pacotes.$inferSelect;
export type NovoPacote = typeof pacotes.$inferInsert;

/* ------------------------------------------------------------------ */
/* CONTAS MATRIZES                                                     */
/* ------------------------------------------------------------------ */

export const contasMatrizes = sqliteTable("contas_matrizes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** id do serviço (netflix, disney, hbomax, ...) — casa com o ícone no front */
  servico: text("servico").notNull(),
  /** rótulo interno: "Netflix — Conta Matriz 01" */
  rotulo: text("rotulo").notNull(),
  /** e-mail de login do streaming */
  email: text("email").notNull(),
  /** senha do streaming */
  senha: text("senha").notNull(),
  totalVagas: integer("total_vagas").notNull().default(1),
  vagasOcupadas: integer("vagas_ocupadas").notNull().default(0),
  /** ativo | manutencao */
  status: text("status").notNull().default("ativo"),
  renovacao: text("renovacao").notNull().default(""),
  custo: real("custo").notNull().default(0),
  regiao: text("regiao").notNull().default("BR"),
  observacao: text("observacao"),
  /**
   * vencimento da assinatura da matriz — ISO `YYYY-MM-DD`.
   * Usado pelos alertas de gestão do admin (tarja amarela < 5 dias, vermelha vencida).
   */
  dataVencimento: text("data_vencimento").notNull().default(""),
  /** cartão/meio de pagamento usado para pagar esta matriz (ex.: "Nubank final 4412") */
  cartaoUtilizado: text("cartao_utilizado").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ContaMatriz = typeof contasMatrizes.$inferSelect;
export type NovaContaMatriz = typeof contasMatrizes.$inferInsert;

/* ------------------------------------------------------------------ */
/* USUARIOS                                                            */
/* ------------------------------------------------------------------ */

export const usuarios = sqliteTable("usuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  telefone: text("telefone"),
  /** ativo | vencendo | inadimplente */
  statusPagamento: text("status_pagamento").notNull().default("ativo"),
  /** pacote contratado */
  pacoteId: integer("pacote_id").references(() => pacotes.id, {
    onDelete: "set null",
  }),
  /** mensal | anual */
  ciclo: text("ciclo").notNull().default("mensal"),
  /** valor efetivamente cobrado (pode divergir do preço de tabela) */
  valor: real("valor").notNull().default(0),
  proximaCobranca: text("proxima_cobranca").notNull().default(""),
  clienteDesde: text("cliente_desde").notNull().default(""),
  admin: integer("admin", { mode: "boolean" }).notNull().default(false),
  /** codigo unico de indicacao - vira o link `site.com/signup?ref=CODIGO` */
  referralCode: text("referral_code").unique(),
  /** id do cliente que indicou este cadastro (preenchido no signup via ?ref=) */
  indicadoPor: integer("indicado_por"),
  /** vínculo com a conta de login (tabela `user` do Better Auth) */
  authUserId: text("auth_user_id").unique(),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Usuario = typeof usuarios.$inferSelect;
export type NovoUsuario = typeof usuarios.$inferInsert;

/* ------------------------------------------------------------------ */
/* APLICATIVOS — catálogo de apps que podem compor um pacote           */
/* ------------------------------------------------------------------ */

export const aplicativos = sqliteTable("aplicativos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** identificador usado em `pacotes.servicos` e `contas_matrizes.servico` */
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  /** monograma exibido quando não existe logo de marca (ex.: "D+") */
  mono: text("mono").notNull().default(""),
  /** cor da marca em hex — usada no ícone/glow */
  cor: text("cor").notNull().default("#22d3ee"),
  /** video | musica | extra */
  tipo: text("tipo").notNull().default("video"),
  /** streaming | esportes | produtividade | musica | iptv | asiatico */
  categoria: text("categoria").notNull().default("streaming"),
  /** preço avulso de mercado — usado no comparativo de economia */
  precoAvulso: real("preco_avulso").notNull().default(0),
  /** preço de venda PLAPLUSNOW (tabela oficial) */
  preco: real("preco").notNull().default(0),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Aplicativo = typeof aplicativos.$inferSelect;
export type NovoAplicativo = typeof aplicativos.$inferInsert;

/* ------------------------------------------------------------------ */
/* ALOCAÇÕES — vínculo cliente ↔ conta matriz (com histórico)          */
/* ------------------------------------------------------------------ */

/**
 * Cada linha é uma vaga de uma conta matriz entregue a um cliente.
 * Liberar/repor NUNCA apaga a linha: muda `status` para `liberado` e carimba
 * `liberadoEm`, preservando todo o histórico de quem já usou a conta.
 */
export const alocacoes = sqliteTable("alocacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  contaId: integer("conta_id")
    .notNull()
    .references(() => contasMatrizes.id, { onDelete: "cascade" }),
  /** slug do app — redundante de propósito, mantém o histórico legível */
  servico: text("servico").notNull(),
  /** ativo | liberado */
  status: text("status").notNull().default("ativo"),
  /** por que a vaga foi liberada: reposicao | manual | troca_pacote */
  motivo: text("motivo"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  liberadoEm: integer("liberado_em", { mode: "timestamp" }),
});

export type Alocacao = typeof alocacoes.$inferSelect;
export type NovaAlocacao = typeof alocacoes.$inferInsert;

/* ------------------------------------------------------------------ */
/* CHAMADOS DE SUPORTE                                                 */
/* ------------------------------------------------------------------ */

export const chamados = sqliteTable("chamados", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** conta matriz relacionada ao problema (quando o chamado parte de um acesso) */
  contaId: integer("conta_id").references(() => contasMatrizes.id, { onDelete: "set null" }),
  servico: text("servico"),
  /** senha_incorreta | sem_credito | erro_login | tela_ocupada | outro */
  tipo: text("tipo").notNull().default("outro"),
  descricao: text("descricao").notNull().default(""),
  /** aberto | em_andamento | resolvido */
  status: text("status").notNull().default("aberto"),
  /** resposta/observação da equipe */
  resposta: text("resposta"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Chamado = typeof chamados.$inferSelect;
export type NovoChamado = typeof chamados.$inferInsert;

/* ------------------------------------------------------------------ */
/* GAMIFICACAO — progresso, XP, niveis e premios                       */
/* ------------------------------------------------------------------ */

/**
 * Uma linha por cliente. Todos os campos sao DERIVADOS automaticamente do
 * historico (tempo de casa, status de pagamento, indicacoes convertidas) por
 * `recalcularProgresso()` em routes/recompensas.ts — nunca editados na mao.
 */
export const recompensasProgresso = sqliteTable("recompensas_progresso", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .unique()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  nivel: integer("nivel").notNull().default(1),
  /** renovacoes pagas em dia */
  renovacoes: integer("renovacoes").notNull().default(0),
  /** total de pessoas cadastradas com o link do cliente */
  indicacoes: integer("indicacoes").notNull().default(0),
  /** indicacoes que viraram assinantes (pacote contratado) */
  indicacoesAssinantes: integer("indicacoes_assinantes").notNull().default(0),
  /** meses completos desde `clienteDesde` */
  mesesAtivo: integer("meses_ativo").notNull().default(0),
  /** ids das missoes concluidas — JSON ex.: ["m1","m2"] */
  missoesConcluidas: text("missoes_concluidas", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .$defaultFn(() => []),
  /** premios liberados — JSON ex.: ["cupom15","hbo_max","surpresa"] */
  premiosLiberados: text("premios_liberados", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .$defaultFn(() => []),
  /** premios ja entregues pelo admin — JSON */
  premiosEntregues: text("premios_entregues", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .$defaultFn(() => []),
  /** cupom ativo aplicado na proxima fatura (ex.: "PPN15OFF") */
  cupomAtivo: text("cupom_ativo").notNull().default(""),
  /** desconto percentual do cupom ativo */
  cupomDesconto: integer("cupom_desconto").notNull().default(0),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type RecompensaProgresso = typeof recompensasProgresso.$inferSelect;
export type NovaRecompensaProgresso = typeof recompensasProgresso.$inferInsert;

/**
 * Livro-razao de XP e premios. `chave` e unica por cliente para deixar o
 * calculo automatico idempotente (rodar de novo nao duplica pontos) e dar ao
 * admin a trilha de auditoria de quando cada marco caiu.
 */
export const recompensasEventos = sqliteTable("recompensas_eventos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** renovacao | indicacao | missao | premio | bonus */
  tipo: text("tipo").notNull(),
  /** chave idempotente: "renovacao:3", "indicacao:12", "missao:m5" */
  chave: text("chave").notNull(),
  descricao: text("descricao").notNull().default(""),
  xp: integer("xp").notNull().default(0),
  /** avisa o admin (ex.: cliente bateu 12 meses = presente surpresa) */
  notificarAdmin: integer("notificar_admin", { mode: "boolean" }).notNull().default(false),
  lidoPeloAdmin: integer("lido_pelo_admin", { mode: "boolean" }).notNull().default(false),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type RecompensaEvento = typeof recompensasEventos.$inferSelect;
export type NovaRecompensaEvento = typeof recompensasEventos.$inferInsert;

/* ------------------------------------------------------------------ */
/* COMBOS INTELIGENTES                                                 */
/* ------------------------------------------------------------------ */

/**
 * Combo promocional montado no admin: escolhe 2+ apps e define um preco
 * abaixo da soma dos avulsos. `apps` guarda a lista de slugs em JSON.
 */
export const combos = sqliteTable("combos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull().default(""),
  /** JSON com os slugs de `aplicativos` que compoem o combo */
  apps: text("apps", { mode: "json" }).$type<string[]>().notNull().default([]),
  /** preco promocional cobrado pelo combo */
  preco: real("preco").notNull().default(0),
  /** soma dos avulsos no momento do cadastro — congela a comparacao */
  precoCheio: real("preco_cheio").notNull().default(0),
  /** mensal | anual */
  ciclo: text("ciclo").notNull().default("mensal"),
  /** aparece na landing para visitantes */
  visivelLanding: integer("visivel_landing", { mode: "boolean" }).notNull().default(true),
  /** aparece no painel do cliente como upgrade sugerido */
  visivelCliente: integer("visivel_cliente", { mode: "boolean" }).notNull().default(true),
  destaque: integer("destaque", { mode: "boolean" }).notNull().default(false),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Combo = typeof combos.$inferSelect;
export type NovoCombo = typeof combos.$inferInsert;

/* ------------------------------------------------------------------ */
/* CENTRAL DE CODIGOS (OTP)                                            */
/* ------------------------------------------------------------------ */

/**
 * Codigos de verificacao extraidos de e-mails recebidos (webhook de inbound
 * email ou colagem manual no admin). Sao efemeros por design: tudo com mais
 * de 1 hora e apagado automaticamente a cada leitura da central.
 */
export const codigosOtp = sqliteTable("codigos_otp", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** codigo numerico de 4 a 6 digitos extraido do corpo do e-mail */
  codigo: text("codigo").notNull(),
  /** slug do app identificado (ou "desconhecido") */
  servicoSlug: text("servico_slug").notNull().default("desconhecido"),
  /** nome exibido do servico */
  servico: text("servico").notNull().default("Desconhecido"),
  /** cliente vinculado pelo e-mail de destino, quando identificado */
  clienteId: integer("cliente_id").references(() => usuarios.id, { onDelete: "set null" }),
  /** remetente do e-mail */
  remetente: text("remetente").notNull().default(""),
  /** destinatario — usado para casar com a conta matriz / cliente */
  destinatario: text("destinatario").notNull().default(""),
  assunto: text("assunto").notNull().default(""),
  /** trecho do corpo em volta do codigo, para conferencia */
  trecho: text("trecho").notNull().default(""),
  /** webhook | manual */
  origem: text("origem").notNull().default("webhook"),
  recebidoEm: integer("recebido_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type CodigoOtp = typeof codigosOtp.$inferSelect;
export type NovoCodigoOtp = typeof codigosOtp.$inferInsert;

/* ------------------------------------------------------------------ */
/* FATURAS                                                             */
/* ------------------------------------------------------------------ */

/**
 * Faturas do cliente. Geradas automaticamente a partir do historico
 * (`clienteDesde` + ciclo + valor) e idempotentes pela chave
 * `cliente_id + competencia` (competencia = "YYYY-MM").
 */
export const faturas = sqliteTable(
  "faturas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    /** "YYYY-MM" — chave idempotente junto com cliente_id */
    competencia: text("competencia").notNull(),
    /** numero exibido, ex.: PPN-2026-08-0009 */
    numero: text("numero").notNull().default(""),
    descricao: text("descricao").notNull().default(""),
    /** valor de tabela, antes do desconto */
    valor: real("valor").notNull().default(0),
    /** cupom aplicado (ex.: PPN15OFF) */
    cupom: text("cupom").notNull().default(""),
    /** percentual de desconto do cupom */
    desconto: integer("desconto").notNull().default(0),
    /** valor efetivamente cobrado, ja com desconto */
    valorFinal: real("valor_final").notNull().default(0),
    /** pago | aberto | vencido */
    status: text("status").notNull().default("aberto"),
    /** ISO YYYY-MM-DD */
    vencimento: text("vencimento").notNull().default(""),
    pagoEm: text("pago_em").notNull().default(""),
    criadoEm: integer("criado_em", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("faturas_cliente_competencia_idx").on(t.clienteId, t.competencia)],
);

export type Fatura = typeof faturas.$inferSelect;
export type NovaFatura = typeof faturas.$inferInsert;

/* ------------------------------------------------------------------ */
/* AUTENTICAÇÃO (Better Auth)                                          */
/* ------------------------------------------------------------------ */

export * from "./auth-schema";
