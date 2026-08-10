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

  /* ---- GESTÃO DE CONTAS (saldo de gift card) ---- */
  /** nome comercial da conta exibido na aba Gestão de Contas */
  nomeConta: text("nome_conta").notNull().default(""),
  /** saldo atual do gift card/créditos — atualizado à mão pelo admin */
  saldoGiftCard: real("saldo_gift_card").notNull().default(0),
  /** quanto essa conta consome por mês */
  custoMensal: real("custo_mensal").notNull().default(0),
  /**
   * limite de saldo crítico. Quando 0, o sistema usa a regra automática:
   * custoMensal * 1.2 (custo do mês + 20% de margem de segurança).
   */
  alertaSaldoCritico: real("alerta_saldo_critico").notNull().default(0),

  /* ---- SAÚDE / DISPONIBILIDADE ---- */
  /**
   * quando false, o alocador para de colocar clientes novos nesta conta.
   * Ligado automaticamente pelo monitor de saúde ao detectar falhas seguidas.
   */
  aceitaNovos: integer("aceita_novos", { mode: "boolean" }).notNull().default(true),
  /** falhas contabilizadas na janela de 30 dias (chamados de acesso) */
  falhasRecentes: integer("falhas_recentes").notNull().default(0),
  /** conta de reserva: só recebe clientes remanejados de contas problemáticas */
  reserva: integer("reserva", { mode: "boolean" }).notNull().default(false),

  /* ---- SALA DE JOGOS ---- */
  /** conta do pool exclusivo de dias de jogo (descartável//alta rotatividade) */
  poolJogos: integer("pool_jogos", { mode: "boolean" }).notNull().default(false),
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
  /** ativo (finalizado/em dia) | pendente | atrasado | suspenso */
  statusPagamento: text("status_pagamento").notNull().default("ativo"),
  /** pix | cartao | dinheiro | boleto | transferencia | outro */
  formaPagamento: text("forma_pagamento").notNull().default("pix"),
  /** aceite do checklist de boas-vindas (regras de uso) */
  termosAceitosEm: integer("termos_aceitos_em", { mode: "timestamp" }),
  /** trava de vencimento: data so muda por rota dedicada, com motivo e log */
  vencimentoTravado: integer("vencimento_travado", { mode: "boolean" })
    .notNull()
    .default(true),
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
  /** IP registrado no cadastro — base do anti-fraude de rede de afiliados */
  ipCadastro: text("ip_cadastro").notNull().default(""),
  /** impressão digital do dispositivo no cadastro — anti-fraude de rede */
  dispositivoHash: text("dispositivo_hash").notNull().default(""),
  /** adicional Sala de Jogos contratado */
  salaJogos: integer("sala_jogos", { mode: "boolean" }).notNull().default(false),
  /** ISO YYYY-MM-DD de quando o adicional Sala de Jogos foi ativado */
  salaJogosDesde: text("sala_jogos_desde").notNull().default(""),
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
/* SOLICITACOES DE TV (desbloqueio netflix.com/tv2)                    */
/* ------------------------------------------------------------------ */

/**
 * Quando a Netflix pede o codigo que aparece na tela da Smart TV
 * (netflix.com/tv2), o cliente digita esse codigo no painel dele e a
 * solicitacao cai aqui com prioridade para o admin aprovar em 1 clique.
 *
 * Fluxo: pendente -> aprovado | recusado | cancelado.
 */
export const solicitacoesTv = sqliteTable("solicitacoes_tv", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** conta matriz do servico (quando o cliente tem vaga ativa) */
  contaId: integer("conta_id").references(() => contasMatrizes.id, { onDelete: "set null" }),
  /** slug do app — hoje sempre netflix, mas fica generico de proposito */
  servicoSlug: text("servico_slug").notNull().default("netflix"),
  /** codigo exibido na tela da TV (4 a 12 caracteres) */
  codigoTv: text("codigo_tv").notNull(),
  /** onde a tela apareceu: "Smart TV Samsung sala", "TV Box", ... */
  dispositivo: text("dispositivo").notNull().default(""),
  /** pendente | aprovado | recusado | cancelado */
  status: text("status").notNull().default("pendente"),
  /** recado do admin devolvido ao cliente */
  respostaAdmin: text("resposta_admin").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  resolvidoEm: integer("resolvido_em", { mode: "timestamp" }),
});

export type SolicitacaoTv = typeof solicitacoesTv.$inferSelect;
export type NovaSolicitacaoTv = typeof solicitacoesTv.$inferInsert;

/* ------------------------------------------------------------------ */
/* NOTIFICACOES — central de alertas do admin e avisos do cliente      */
/* ------------------------------------------------------------------ */

/**
 * Um alerta por evento relevante. `chave` deixa o disparo idempotente:
 * o mesmo lembrete de vencimento nunca e criado duas vezes.
 *
 * escopo: admin (central de alertas do painel) | cliente (avisos no painel).
 */
export const notificacoes = sqliteTable(
  "notificacoes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** admin | cliente */
    escopo: text("escopo").notNull().default("admin"),
    /** destinatario quando escopo = cliente; contexto quando escopo = admin */
    clienteId: integer("cliente_id").references(() => usuarios.id, { onDelete: "cascade" }),
    /** otp | tv | vencimento | pagamento | sistema */
    tipo: text("tipo").notNull().default("sistema"),
    /** info | alerta | critico */
    severidade: text("severidade").notNull().default("info"),
    titulo: text("titulo").notNull(),
    mensagem: text("mensagem").notNull().default(""),
    /** aba de destino no painel, ex.: "codigos" | "netflixtv" | "faturas" */
    destino: text("destino").notNull().default(""),
    /** chave de deduplicacao do gatilho */
    chave: text("chave").notNull(),
    lida: integer("lida", { mode: "boolean" }).notNull().default(false),
    criadoEm: integer("criado_em", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("notificacoes_chave_idx").on(t.chave)],
);

export type Notificacao = typeof notificacoes.$inferSelect;
export type NovaNotificacao = typeof notificacoes.$inferInsert;

/* ------------------------------------------------------------------ */
/* HISTORICO DE VENCIMENTO — trava de alteracao da data de pagamento   */
/* ------------------------------------------------------------------ */

export const historicoVencimento = sqliteTable("historico_vencimento", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  de: text("de").notNull().default(""),
  para: text("para").notNull().default(""),
  motivo: text("motivo").notNull().default(""),
  /** e-mail do admin que autorizou */
  autor: text("autor").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type HistoricoVencimento = typeof historicoVencimento.$inferSelect;
export type NovoHistoricoVencimento = typeof historicoVencimento.$inferInsert;

/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* CONFIGURAÇÕES GLOBAIS — parâmetros editáveis do SaaS                */
/* ------------------------------------------------------------------ */

/**
 * Chave/valor com os parâmetros que o dono do negócio ajusta sem deploy:
 * percentual de comissão, taxa de saque, bônus de crédito, preço da Sala de
 * Jogos, margem de saldo crítico, dias de win-back etc.
 * Defaults ficam em `api/lib/config.ts` — a tabela só guarda o que foi mudado.
 */
export const configuracoes = sqliteTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull().default(""),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Configuracao = typeof configuracoes.$inferSelect;

/* ------------------------------------------------------------------ */
/* MOVIMENTAÇÕES DE GIFT CARD — extrato do saldo das contas matrizes   */
/* ------------------------------------------------------------------ */

/**
 * Toda alteração de saldo vira uma linha aqui. O admin nunca digita o saldo
 * final: ele lança "+R$ 70" e o sistema soma, mantendo a trilha de auditoria
 * de quanto foi colocado, quando e por quem.
 */
export const movimentacoesGift = sqliteTable("movimentacoes_gift", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contaId: integer("conta_id")
    .notNull()
    .references(() => contasMatrizes.id, { onDelete: "cascade" }),
  /** credito (gift card inserido) | debito (consumo/renovação) | ajuste */
  tipo: text("tipo").notNull().default("credito"),
  /** valor absoluto do lançamento — o sinal vem do `tipo` */
  valor: real("valor").notNull().default(0),
  /** saldo resultante depois do lançamento — congela o extrato */
  saldoResultante: real("saldo_resultante").notNull().default(0),
  observacao: text("observacao").notNull().default(""),
  /** e-mail do admin que lançou */
  autor: text("autor").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type MovimentacaoGift = typeof movimentacoesGift.$inferSelect;
export type NovaMovimentacaoGift = typeof movimentacoesGift.$inferInsert;

/* ------------------------------------------------------------------ */
/* AFILIADOS — carteira, comissões e saques                            */
/* ------------------------------------------------------------------ */

/**
 * Uma carteira por cliente. Saldos são sempre DERIVADOS das comissões e dos
 * saques (`recalcularCarteira()` em routes/afiliados.ts) — nunca editados na
 * mão, para o extrato nunca divergir do somatório.
 */
export const carteiras = sqliteTable("carteiras", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .unique()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** comissões liberadas e ainda não sacadas/creditadas */
  disponivel: real("disponivel").notNull().default(0),
  /** comissões aguardando o pagamento da fatura do indicado */
  pendente: real("pendente").notNull().default(0),
  /** comissões travadas pelo anti-fraude */
  bloqueado: real("bloqueado").notNull().default(0),
  totalGanho: real("total_ganho").notNull().default(0),
  totalSacado: real("total_sacado").notNull().default(0),
  /** total já convertido em desconto na mensalidade (com bônus) */
  totalCreditado: real("total_creditado").notNull().default(0),
  /** crédito ainda não consumido pelas faturas */
  creditoDisponivel: real("credito_disponivel").notNull().default(0),
  /** % da rede em dia na última apuração — define o bônus de performance */
  redeEmDia: integer("rede_em_dia").notNull().default(0),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Carteira = typeof carteiras.$inferSelect;

/**
 * Comissão de 5% sobre cada pagamento de um indicado. `chave` é única
 * (afiliado + indicado + competência) para o apurador ser idempotente.
 */
export const comissoes = sqliteTable(
  "comissoes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    afiliadoId: integer("afiliado_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    indicadoId: integer("indicado_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    faturaId: integer("fatura_id").references(() => faturas.id, { onDelete: "set null" }),
    /** "YYYY-MM" */
    competencia: text("competencia").notNull().default(""),
    /** valor pago pelo indicado que serviu de base */
    valorBase: real("valor_base").notNull().default(0),
    percentual: real("percentual").notNull().default(5),
    valor: real("valor").notNull().default(0),
    /** pendente | liberada | bloqueada | paga */
    status: text("status").notNull().default("pendente"),
    /** preenchido quando o anti-fraude bloqueia (IP/dispositivo duplicado) */
    motivoBloqueio: text("motivo_bloqueio").notNull().default(""),
    chave: text("chave").notNull(),
    criadoEm: integer("criado_em", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("comissoes_chave_idx").on(t.chave)],
);

export type Comissao = typeof comissoes.$inferSelect;

/**
 * Pedido de resgate. Dois caminhos: `saque` (Pix, com taxa e mínimo) ou
 * `credito` (abate na mensalidade, com +25% de bônus e possível +1% de
 * performance quando a rede se mantém 90% em dia).
 */
export const saques = sqliteTable("saques", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** saque | credito */
  tipo: text("tipo").notNull().default("saque"),
  valorBruto: real("valor_bruto").notNull().default(0),
  /** custo do saque em Pix (0 no crédito) */
  taxa: real("taxa").notNull().default(0),
  /** bônus de reinvestimento (25%) já somado ao valor final do crédito */
  bonus: real("bonus").notNull().default(0),
  /** bônus de performance da rede (+1%) */
  bonusPerformance: real("bonus_performance").notNull().default(0),
  valorLiquido: real("valor_liquido").notNull().default(0),
  /** chave Pix informada no saque */
  chavePix: text("chave_pix").notNull().default(""),
  /** pendente | pago | recusado */
  status: text("status").notNull().default("pendente"),
  observacao: text("observacao").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  processadoEm: integer("processado_em", { mode: "timestamp" }),
});

export type Saque = typeof saques.$inferSelect;

/* ------------------------------------------------------------------ */
/* COBRANÇAS PIX — gateway plugável (modo simulado por padrão)         */
/* ------------------------------------------------------------------ */

export const cobrancasPix = sqliteTable("cobrancas_pix", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  faturaId: integer("fatura_id").references(() => faturas.id, { onDelete: "set null" }),
  /** simulado | mercadopago | efi | asaas | pagarme */
  provedor: text("provedor").notNull().default("simulado"),
  /** id da cobrança no provedor */
  txid: text("txid").notNull().unique(),
  valor: real("valor").notNull().default(0),
  /** o que está sendo cobrado, em texto (aparece no checkout e no admin) */
  descricao: text("descricao").notNull().default(""),
  /**
   * Pedido do checkout serializado em JSON. Quando o pagamento é confirmado,
   * este pedido é APLICADO automaticamente (troca de pacote, apps liberados,
   * adicional Sala de Jogos). Fica `null` em cobranças de fatura simples.
   */
  pedido: text("pedido", { mode: "json" }).$type<{
    tipo: "assinatura" | "jogos";
    titulo: string;
    pacoteId: number | null;
    comboId: number | null;
    apps: string[];
    ciclo: "mensal" | "anual";
    valor: number;
  } | null>(),
  /** payload copia-e-cola do Pix */
  copiaECola: text("copia_e_cola").notNull().default(""),
  /** aguardando | pago | expirado | cancelado */
  status: text("status").notNull().default("aguardando"),
  expiraEm: integer("expira_em", { mode: "timestamp" }),
  pagoEm: integer("pago_em", { mode: "timestamp" }),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type CobrancaPix = typeof cobrancasPix.$inferSelect;

/* ------------------------------------------------------------------ */
/* SALA DE JOGOS — pool de acesso de alta disponibilidade              */
/* ------------------------------------------------------------------ */

/**
 * Liberação temporária de uma conta do pool de jogos para um cliente com o
 * adicional ativo. É o que elimina o gargalo do suporte em dia de pico: o
 * cliente pega o acesso sozinho no painel e a vaga volta ao pool ao expirar.
 */
export const liberacoesJogos = sqliteTable("liberacoes_jogos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  contaId: integer("conta_id")
    .notNull()
    .references(() => contasMatrizes.id, { onDelete: "cascade" }),
  servico: text("servico").notNull().default(""),
  /** ativa | expirada | revogada */
  status: text("status").notNull().default("ativa"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiraEm: integer("expira_em", { mode: "timestamp" }).notNull(),
});

export type LiberacaoJogos = typeof liberacoesJogos.$inferSelect;

/* ------------------------------------------------------------------ */
/* WIN-BACK — régua de reativação de suspensos/cancelados              */
/* ------------------------------------------------------------------ */

/**
 * Um registro por etapa da régua e por cliente (`chave` única). Guarda o
 * cupom oferecido e se a mensagem já foi despachada pelo webhook.
 */
export const winbackEnvios = sqliteTable(
  "winback_envios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    /** 1 (15 dias) | 2 (30 dias) | 3 (60 dias) */
    etapa: integer("etapa").notNull().default(1),
    diasInativo: integer("dias_inativo").notNull().default(0),
    cupom: text("cupom").notNull().default(""),
    desconto: integer("desconto").notNull().default(0),
    mensagem: text("mensagem").notNull().default(""),
    /** pendente | enviado | recuperado | descartado */
    status: text("status").notNull().default("pendente"),
    chave: text("chave").notNull(),
    criadoEm: integer("criado_em", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    enviadoEm: integer("enviado_em", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("winback_chave_idx").on(t.chave)],
);

export type WinbackEnvio = typeof winbackEnvios.$inferSelect;

/* ------------------------------------------------------------------ */
/* RECUPERAÇÃO DE SENHA — fila de "esqueci minha senha"                */
/* ------------------------------------------------------------------ */

/**
 * Cada pedido de redefinição de senha vira uma linha aqui. O link é gerado
 * pelo Better Auth e disparado por e-mail automaticamente; guardamos o
 * registro para o admin conseguir acompanhar (e reenviar o link pelo
 * WhatsApp enquanto o domínio de e-mail próprio não estiver verificado).
 */
export const resetsSenha = sqliteTable("resets_senha", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  /** cliente correspondente em `usuarios`, quando existir */
  clienteId: integer("cliente_id").references(() => usuarios.id, {
    onDelete: "set null",
  }),
  /** link completo de redefinição (contém o token do Better Auth) */
  link: text("link").notNull().default(""),
  /** pendente | usado | expirado */
  status: text("status").notNull().default("pendente"),
  /** email | admin — de onde partiu o pedido */
  origem: text("origem").notNull().default("email"),
  /** entrega por e-mail: pendente | enviado | falhou | sem_provedor */
  entrega: text("entrega").notNull().default("pendente"),
  /** mensagem de erro do provedor de e-mail, quando houver */
  erroEntrega: text("erro_entrega").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiraEm: integer("expira_em", { mode: "timestamp" }).notNull(),
  usadoEm: integer("usado_em", { mode: "timestamp" }),
});

export type ResetSenha = typeof resetsSenha.$inferSelect;
