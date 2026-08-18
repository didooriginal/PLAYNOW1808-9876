import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Banco real da PLAYPLUSNOW (Turso/SQLite via Drizzle).
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
  /**
   * Endereco do NOSSO dominio que recebe os e-mails de codigo desta matriz
   * (ex.: "netflix01@mail.playplusnow.com.br"). O Cloudflare Email Routing faz
   * catch-all -> Worker -> POST /api/webhooks/email, e este campo e o que
   * amarra o e-mail recebido a conta matriz certa. Vazio = captura desligada.
   */
  emailCaptura: text("email_captura").notNull().default(""),
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

  /**
   * LIGA/DESLIGA da conta. Diferente de `aceitaNovos` (que só bloqueia
   * entradas novas): desligar tira a conta de circulação e remaneja quem já
   * estava nela, com o mesmo mecanismo do delete — sem apagar nada.
   */
  ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),

  /* ---- FUTEBOL AO VIVO ---- */
  /** conta do pool exclusivo de dias de jogo (descartável//alta rotatividade) */
  poolJogos: integer("pool_jogos", { mode: "boolean" }).notNull().default(false),
  /**
   * App realmente contratado nesta conta do pool (`aplicativos.slug`).
   * Só vale para contas com `poolJogos = true`: o `servico` delas continua
   * "jogos" para elas NÃO entrarem no estoque normal, mas o admin precisa
   * saber que aquela conta é, por exemplo, um Premiere temporário.
   */
  appPool: text("app_pool"),
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
  /** dados de contato que o proprio cliente edita no painel */
  endereco: text("endereco"),
  cidade: text("cidade"),
  estado: text("estado"),
  cep: text("cep"),
  /** URL publica da foto de perfil (upload direto para o object storage) */
  avatarUrl: text("avatar_url"),
  /**
   * Conta criada pelo ADM com senha provisoria: o painel do cliente fica
   * bloqueado na tela de troca de senha ate ele definir a propria senha.
   */
  precisaTrocarSenha: integer("precisa_trocar_senha", { mode: "boolean" })
    .notNull()
    .default(false),
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
  /** mensal | trimestral | semestral | anual */
  ciclo: text("ciclo").notNull().default("mensal"),
  /** valor efetivamente cobrado (pode divergir do preço de tabela) */
  valor: real("valor").notNull().default(0),
  /**
   * Mensalidade SEM os apps avulsos — normalmente o preço do pacote.
   * `valor` = `valorBase` + soma dos apps avulsos ativos (convertida ao ciclo).
   */
  valorBase: real("valor_base").notNull().default(0),
  /**
   * Quando o admin digita a mensalidade à mão, o recálculo automático para de
   * mexer no `valor` — o número dele manda até ele voltar para o automático.
   */
  valorManual: integer("valor_manual", { mode: "boolean" }).notNull().default(false),
  proximaCobranca: text("proxima_cobranca").notNull().default(""),
  clienteDesde: text("cliente_desde").notNull().default(""),
  admin: integer("admin", { mode: "boolean" }).notNull().default(false),
  /** 1–7 — nivel do cliente; a partir do 3 o painel de afiliados destrava */
  nivel: integer("nivel").notNull().default(1),
  /** se o cliente ja aceitou se tornar um afiliado (apenas nivel 3) */
  afiliadoAtivo: integer("afiliado_ativo", { mode: "boolean" })
    .notNull()
    .default(false),
  /** codigo unico de indicacao - vira o link `site.com/signup?ref=CODIGO` */
  referralCode: text("referral_code").unique(),
  /** id do cliente que indicou este cadastro (preenchido no signup via ?ref=) */
  indicadoPor: integer("indicado_por"),
  /** IP registrado no cadastro — base do anti-fraude de rede de afiliados */
  ipCadastro: text("ip_cadastro").notNull().default(""),
  /** impressão digital do dispositivo no cadastro — anti-fraude de rede */
  dispositivoHash: text("dispositivo_hash").notNull().default(""),
  /** adicional Futebol Ao Vivo contratado */
  salaJogos: integer("sala_jogos", { mode: "boolean" }).notNull().default(false),
  /** ISO YYYY-MM-DD de quando o adicional Futebol Ao Vivo foi ativado */
  salaJogosDesde: text("sala_jogos_desde").notNull().default(""),
  /**
   * CRÉDITO DE CONFIANÇA — timestamp até quando o cliente inadimplente segue
   * com acesso liberado como se estivesse em dia. Só o admin concede, pelo
   * card do cliente. Nulo ou no passado = sem crédito ativo.
   */
  confiancaAte: integer("confianca_ate", { mode: "timestamp" }),
  /** motivo anotado pelo admin ao conceder o crédito */
  confiancaMotivo: text("confianca_motivo").notNull().default(""),
  /** quando o crédito atual foi concedido */
  confiancaConcedidaEm: integer("confianca_concedida_em", { mode: "timestamp" }),
  /** quantas vezes esse cliente já recebeu crédito de confiança */
  confiancaTotal: integer("confianca_total").notNull().default(0),
  /** aparelhos cadastrados pelo cliente no signup (ex.: "TV LG, iPhone 15") */
  aparelhos: text("aparelhos").notNull().default(""),
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
  /** preço de venda PLAYPLUSNOW (tabela oficial) */
  preco: real("preco").notNull().default(0),
  /**
   * posição na grade de aplicativos da landing — menor aparece primeiro.
   * O admin reordena na aba Catálogo; empate cai na ordem alfabética.
   */
  ordem: integer("ordem").notNull().default(0),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  /**
   * Nem todo app tem gift card à venda. Quando false, o provedor não aparece
   * na aba Estoque de Gift Cards (a menos que já tenha código cadastrado).
   */
  temGiftCard: integer("tem_gift_card", { mode: "boolean" }).notNull().default(false),
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
/* ASSINATURAS DE APPS — o que o cliente tem direito de acessar        */
/* ------------------------------------------------------------------ */

/**
 * Uma linha por app que o cliente tem direito de usar, venha de onde vier
 * (pacote, combo, compra avulsa no montador ou prêmio da gamificação).
 *
 * Por que existe: até aqui só quem comprava PACOTE ganhava vaga em conta
 * matriz — quem comprava app avulso pagava e não recebia acesso. Além disso,
 * um avulso comprado no dia 20 tem ciclo próprio, que não é o do pacote; sem
 * esta tabela não havia onde guardar esse vencimento separado.
 *
 * `alocacoes` continua sendo o vínculo físico (cliente × conta matriz); aqui é
 * o DIREITO. Direito sem vaga = cliente na `fila_vagas`.
 */
export const assinaturasApps = sqliteTable("assinaturas_apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** slug do app (casa com `aplicativos.slug` e `contas_matrizes.servico`) */
  servico: text("servico").notNull(),
  /** pacote | combo | avulso | premio */
  origem: text("origem").notNull().default("avulso"),
  /** mensal | trimestral | semestral | anual — só faz sentido para avulsos */
  ciclo: text("ciclo").notNull().default("mensal"),
  /** quanto esse app custa por mês para este cliente (0 quando vem do pacote) */
  valor: real("valor").notNull().default(0),
  inicioEm: text("inicio_em").notNull().default(""),
  /** ISO YYYY-MM-DD — vencimento próprio do avulso/prêmio */
  proximaCobranca: text("proxima_cobranca").notNull().default(""),
  /** prêmios e cortesias somem sozinhos nesta data */
  expiraEm: text("expira_em").notNull().default(""),
  /**
   * ativo | aguardando_pagamento | cancelado | expirado
   * `aguardando_pagamento` é um direito já contratado que ainda NÃO vale:
   * não entra em `direitosDoCliente`, logo não ocupa vaga nem aparece como
   * acesso. Vira `ativo` sozinho quando a cobrança dele é paga.
   */
  status: text("status").notNull().default("ativo"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type AssinaturaApp = typeof assinaturasApps.$inferSelect;
export type NovaAssinaturaApp = typeof assinaturasApps.$inferInsert;

/* ------------------------------------------------------------------ */
/* COBRANÇAS EXTRAS — app adicionado no meio do ciclo                  */
/* ------------------------------------------------------------------ */

/**
 * Quando o admin adiciona um app avulso no meio do ciclo, o primeiro mês é
 * cobrado à parte: entra aqui e é somado à fatura em aberto da competência.
 * A partir do mês seguinte o app já está dentro da mensalidade recalculada,
 * então a cobrança extra existe uma vez só, por app.
 *
 * Pagar a fatura que contém a cobrança quita o extra e, se o app foi
 * adicionado como "liberar após o pagamento", é isso que solta o acesso.
 */
export const cobrancasExtras = sqliteTable("cobrancas_extras", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** slug do app (ou da opção do app) que gerou a cobrança */
  servico: text("servico").notNull().default(""),
  descricao: text("descricao").notNull().default(""),
  valor: real("valor").notNull().default(0),
  /** "YYYY-MM" da fatura que carrega este extra */
  competencia: text("competencia").notNull().default(""),
  /** aberto | pago | cancelado */
  status: text("status").notNull().default("aberto"),
  /** true quando o acesso só é liberado depois que este extra for pago */
  liberaAcesso: integer("libera_acesso", { mode: "boolean" }).notNull().default(false),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  pagoEm: text("pago_em").notNull().default(""),
});

export type CobrancaExtra = typeof cobrancasExtras.$inferSelect;

/* ------------------------------------------------------------------ */
/* FILA DE VAGAS — cliente pago sem estoque de conta matriz            */
/* ------------------------------------------------------------------ */

/**
 * Rede de segurança da regra "cliente nunca fica sem acesso": quando o direito
 * existe mas não há vaga, entra aqui e o admin é avisado na hora (alerta
 * crítico + link de WhatsApp). Some sozinho assim que a vaga aparece.
 */
export const filaVagas = sqliteTable("fila_vagas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  servico: text("servico").notNull(),
  /** compra | reposicao | conta_desligada | premio | manual */
  motivo: text("motivo").notNull().default("compra"),
  /** aguardando | atendido | cancelado */
  status: text("status").notNull().default("aguardando"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  atendidoEm: integer("atendido_em", { mode: "timestamp" }),
});

export type FilaVaga = typeof filaVagas.$inferSelect;
export type NovaFilaVaga = typeof filaVagas.$inferInsert;

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
  /** mensal | trimestral | semestral | anual */
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

  /* ---- ENTREGA DIRIGIDA (um codigo para UM cliente) ---- */
  /**
   * Pedido que este codigo atendeu. Numa matriz com varios clientes, o codigo
   * so vai para quem clicou em "Pedi o codigo agora": sem pedido casado, ele
   * fica sem dono e aparece apenas no admin.
   */
  pedidoId: integer("pedido_id"),
  /** cliente que REALMENTE recebeu o codigo no painel (preenchido na entrega) */
  entregueClienteId: integer("entregue_cliente_id").references(() => usuarios.id, {
    onDelete: "set null",
  }),
  /** o cliente clicou em "ja usei este codigo" — some do painel na hora */
  usadoEm: integer("usado_em", { mode: "timestamp" }),
  /** limite de exibicao no painel do cliente (entrega + 15 min) */
  expiraEm: integer("expira_em", { mode: "timestamp" }),
});

export type CodigoOtp = typeof codigosOtp.$inferSelect;

/**
 * CAIXA DE ENTRADA DO WEBHOOK.
 *
 * `codigos_otp` só guarda e-mail do qual saiu um código de 4 a 6 dígitos, e
 * ainda assim só um trecho de 180 caracteres. Esta tabela guarda o e-mail
 * INTEIRO de tudo que chega em `/api/webhooks/email`, inclusive quando nenhum
 * código é encontrado (confirmação do Gmail, aviso de novo aparelho, etc.).
 * É o que permite o admin ler a mensagem original no painel.
 */
export const emailsRecebidos = sqliteTable("emails_recebidos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  remetente: text("remetente").notNull().default(""),
  destinatario: text("destinatario").notNull().default(""),
  assunto: text("assunto").notNull().default(""),
  /** corpo completo, do jeito que o provedor mandou (texto ou HTML) */
  corpo: text("corpo").notNull().default(""),
  /** código extraído, quando houve — "" quando o e-mail não tinha código */
  codigo: text("codigo").notNull().default(""),
  /** slug do app identificado (ou "desconhecido") */
  servicoSlug: text("servico_slug").notNull().default("desconhecido"),
  /** webhook | manual */
  origem: text("origem").notNull().default("webhook"),
  /** e-mail marcado pelo admin: não é apagado pela limpeza automática */
  fixado: integer("fixado", { mode: "boolean" }).notNull().default(false),
  recebidoEm: integer("recebido_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type EmailRecebido = typeof emailsRecebidos.$inferSelect;
export type NovoCodigoOtp = typeof codigosOtp.$inferInsert;

/* ------------------------------------------------------------------ */
/* PEDIDOS DE CODIGO — o que garante o isolamento entre clientes       */
/* ------------------------------------------------------------------ */

/**
 * O cliente clica em "Pedi o codigo agora" ANTES de acionar o streaming.
 * Quando o e-mail chega, `entregarCodigo()` casa o codigo com o pedido
 * `aguardando` mais antigo da mesma matriz + mesmo servico (FIFO, janela de
 * 10 minutos). Dois clientes da mesma conta pedindo ao mesmo tempo recebem
 * cada um o SEU codigo; quem nao pediu nao ve nada.
 *
 * Fluxo: aguardando -> entregue | expirado | cancelado.
 */
export const pedidosCodigo = sqliteTable("pedidos_codigo", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** matriz em que o cliente tem vaga ativa naquele app */
  contaId: integer("conta_id").references(() => contasMatrizes.id, { onDelete: "set null" }),
  /** slug do app pedido (netflix, disney, prime, ...) */
  servicoSlug: text("servico_slug").notNull(),
  /** aguardando | entregue | expirado | cancelado */
  status: text("status").notNull().default("aguardando"),
  /** codigo que atendeu este pedido */
  codigoId: integer("codigo_id"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  atendidoEm: integer("atendido_em", { mode: "timestamp" }),
});

export type PedidoCodigo = typeof pedidosCodigo.$inferSelect;
export type NovoPedidoCodigo = typeof pedidosCodigo.$inferInsert;

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
    /**
     * Quando o alerta deixou de ser um problema. "Lida" só diz que o admin
     * viu; "resolvido" tira o item da fila. Preenchido automaticamente quando
     * a causa some (cliente pagou, vaga apareceu) ou pelo botão do painel.
     */
    resolvidoEm: integer("resolvido_em", { mode: "timestamp" }),
    /** auto | manual — quem encerrou o alerta */
    resolvidoPor: text("resolvido_por"),
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
    /**
     * Parte de `valor` que veio de cobrancas extras (1o mes de app avulso
     * adicionado no meio do ciclo). Guardado a parte para o reajuste ser
     * idempotente: mensalidade = valor - extras.
     */
    extras: real("extras").notNull().default(0),
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
/* BANNERS PARA AFILIADOS                                              */
/* ------------------------------------------------------------------ */

export const bannersAfiliados = sqliteTable("banners_afiliados", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titulo: text("titulo").notNull(),
  subtitulo: text("subtitulo").notNull().default(""),
  imagemUrl: text("imagem_url").notNull(),
  linkDestino: text("link_destino").notNull().default(""),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type BannerAfiliado = typeof bannersAfiliados.$inferSelect;
export type NovoBannerAfiliado = typeof bannersAfiliados.$inferInsert;

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
   * adicional Futebol Ao Vivo). Fica `null` em cobranças de fatura simples.
   */
  pedido: text("pedido", { mode: "json" }).$type<{
    tipo: "assinatura" | "jogos";
    titulo: string;
    pacoteId: number | null;
    comboId: number | null;
    apps: string[];
    ciclo: "mensal" | "trimestral" | "semestral" | "anual";
    valor: number;
  } | null>(),
  /** payload copia-e-cola do Pix */
  copiaECola: text("copia_e_cola").notNull().default(""),
  /** id do pagamento no provedor (ex.: payment.id do Mercado Pago) */
  provedorId: text("provedor_id").notNull().default(""),
  /** QR Code do Pix em PNG base64, devolvido pelo provedor */
  qrBase64: text("qr_base64").notNull().default(""),
  /** página de pagamento hospedada pelo provedor (fallback do QR) */
  linkPagamento: text("link_pagamento").notNull().default(""),
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
/* FUTEBOL AO VIVO — pool de acesso de alta disponibilidade              */
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

/* ------------------------------------------------------------------ */
/* ESTOQUE DE GIFT CARDS — códigos comprados, ainda não aplicados      */
/* ------------------------------------------------------------------ */

/**
 * Cada linha é UM código físico/digital de gift card comprado pela operação.
 * Fluxo do código: `disponivel` → `em_uso` (admin copiou e está aplicando na
 * conta matriz) → `utilizado` (aplicação confirmada, crédito lançado em
 * `movimentacoes_gift`). O campo `code` nunca aparece na lista sem que o admin
 * peça para revelar — a UI mostra mascarado e oferece "copiar".
 */
export const giftCards = sqliteTable("gift_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** slug do provedor — casa com `aplicativos.slug` / `contas_matrizes.servico` */
  provider: text("provider").notNull(),
  /** valor de face do cartão em reais */
  value: real("value").notNull().default(0),
  /** código resgatável — visibilidade restrita na interface */
  code: text("code").notNull().unique(),
  /** disponivel | em_uso | utilizado */
  status: text("status").notNull().default("disponivel"),
  /** conta matriz onde o código foi aplicado, quando já utilizado */
  contaId: integer("conta_id").references(() => contasMatrizes.id, {
    onDelete: "set null",
  }),
  /** e-mail do admin que cadastrou o código */
  autor: text("autor").notNull().default(""),
  /** observação livre (lote, nota fiscal, fornecedor) */
  observacao: text("observacao").notNull().default(""),
  aplicadoEm: integer("aplicado_em", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type GiftCard = typeof giftCards.$inferSelect;
export type NovoGiftCard = typeof giftCards.$inferInsert;

/* ------------------------------------------------------------------ */
/* ASSINATURAS — cartão de crédito com cobrança recorrente automática  */
/* ------------------------------------------------------------------ */

/**
 * Uma linha por assinatura criada no gateway (Mercado Pago Preapproval).
 * O cliente autoriza o cartão uma vez e o provedor cobra sozinho a cada
 * ciclo; cada cobrança chega pelo webhook e passa pela mesma baixa do Pix.
 */
export const assinaturas = sqliteTable("assinaturas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** mercadopago | (futuros provedores) */
  provedor: text("provedor").notNull().default("mercadopago"),
  /** id do preapproval no provedor */
  provedorId: text("provedor_id").notNull().default(""),
  /** nossa referência enviada como external_reference */
  referencia: text("referencia").notNull().unique(),
  /** pending | authorized | paused | cancelled */
  status: text("status").notNull().default("pending"),
  /** mensal | trimestral | semestral | anual */
  ciclo: text("ciclo").notNull().default("mensal"),
  valor: real("valor").notNull().default(0),
  titulo: text("titulo").notNull().default(""),
  /** pedido do checkout aplicado quando a 1ª cobrança é aprovada */
  pedido: text("pedido", { mode: "json" }).$type<{
    tipo: "assinatura" | "jogos";
    titulo: string;
    pacoteId: number | null;
    comboId: number | null;
    apps: string[];
    ciclo: "mensal" | "trimestral" | "semestral" | "anual";
    valor: number;
  } | null>(),
  /** URL do provedor onde o cliente informa o cartão */
  initPoint: text("init_point").notNull().default(""),
  /** quantas cobranças recorrentes já foram aprovadas */
  cobrancasPagas: integer("cobrancas_pagas").notNull().default(0),
  ultimoPagamentoEm: integer("ultimo_pagamento_em", { mode: "timestamp" }),
  proximaCobranca: text("proxima_cobranca").notNull().default(""),
  canceladaEm: integer("cancelada_em", { mode: "timestamp" }),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Assinatura = typeof assinaturas.$inferSelect;
export type NovaAssinatura = typeof assinaturas.$inferInsert;

/* ------------------------------------------------------------------ */
/* MARKETING — biblioteca de textos prontos do admin                   */
/* ------------------------------------------------------------------ */

export const marketingTexts = sqliteTable("marketing_texts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titulo: text("titulo").notNull(),
  conteudo: text("conteudo").notNull(),
  /** promo | suporte | boas_vindas | geral */
  categoria: text("categoria").notNull().default("geral"),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type MarketingText = typeof marketingTexts.$inferSelect;
export type NovoMarketingText = typeof marketingTexts.$inferInsert;

/* ------------------------------------------------------------------ */
/* PLANOS DE APP (VARIANTES) — "Globoplay comum / Premium / +Telecine" */
/* ------------------------------------------------------------------ */

/**
 * Um app pode ser vendido em mais de uma versão, com preços diferentes.
 * Em vez de poluir a vitrine com três cards de Globoplay, o app continua sendo
 * UM card e as versões viram opções escolhidas na hora da contratação avulsa.
 *
 * Regras que valem para todo app (é genérico de propósito):
 *  - app SEM nenhum plano cadastrado continua funcionando como sempre
 *    (preço único vindo de `aplicativos.preco`) — nada quebra;
 *  - app COM planos passa a exigir a escolha de uma opção no avulso;
 *  - PACOTES são fechados: sempre entregam o plano `padrao` e ignoram o resto.
 *
 * `slug` é o identificador de estoque: cada opção tem a SUA conta matriz
 * (`contas_matrizes.servico = planos_apps.slug`), porque cada combinação é um
 * login diferente na prática. Ex.: "globoplay-premium-telecine".
 */
export const planosApps = sqliteTable("planos_apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aplicativoId: integer("aplicativo_id")
    .notNull()
    .references(() => aplicativos.id, { onDelete: "cascade" }),
  /** identificador de estoque — casa com `contas_matrizes.servico` */
  slug: text("slug").notNull().unique(),
  /** rótulo curto exibido ao cliente: "Premium + Telecine" */
  nome: text("nome").notNull(),
  /** uma linha explicando o que muda nesta opção */
  descricao: text("descricao").notNull().default(""),
  /** preço de venda mensal desta opção — editável no ADM */
  preco: real("preco").notNull().default(0),
  /** preço de mercado, usado no comparativo de economia */
  precoAvulso: real("preco_avulso").notNull().default(0),
  /**
   * como o acesso é entregue:
   *  - `vaga`    → aloca numa conta matriz do estoque (fluxo padrão);
   *  - `convite` → não usa vaga: o admin cadastra o e-mail do cliente como
   *                membro extra no painel do provedor e QUEM manda o acesso é
   *                o próprio provedor (caso "Netflix individual").
   */
  entrega: text("entrega").notNull().default("vaga"),
  /** opção marcada por padrão e usada pelos pacotes fechados */
  padrao: integer("padrao", { mode: "boolean" }).notNull().default(false),
  ordem: integer("ordem").notNull().default(0),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type PlanoApp = typeof planosApps.$inferSelect;
export type NovoPlanoApp = typeof planosApps.$inferInsert;

/* ------------------------------------------------------------------ */
/* CONVITES DE APP — fila do "membro extra" (Netflix individual)       */
/* ------------------------------------------------------------------ */

/**
 * Fila de cadastro manual para planos com `entrega = "convite"`.
 * O cliente informa o e-mail dele na contratação, o pedido cai aqui e o admin
 * adiciona esse e-mail como membro extra no painel do provedor. O convite de
 * acesso é enviado pelo PRÓPRIO provedor ao e-mail informado — por isso o
 * cliente vê "aguardando cadastro" no painel até o admin marcar como enviado.
 */
export const convitesApps = sqliteTable("convites_apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  /** slug do plano escolhido (ex.: "netflix-individual") */
  servico: text("servico").notNull(),
  /** e-mail que o cliente quer usar no provedor */
  email: text("email").notNull(),
  /** pendente | enviado | ativo | recusado */
  status: text("status").notNull().default("pendente"),
  /** conta matriz de onde o convite saiu (quando o admin registra) */
  contaId: integer("conta_id"),
  observacao: text("observacao").notNull().default(""),
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  atendidoEm: integer("atendido_em", { mode: "timestamp" }),
});

export type ConviteApp = typeof convitesApps.$inferSelect;
export type NovoConviteApp = typeof convitesApps.$inferInsert;

/* ------------------------------------------------------------------ */
/* ATIVACOES IPTV — MAC do app Funplay enviado pelo cliente            */
/* ------------------------------------------------------------------ */

/**
 * O IPTV (slug "iptv" — PLAYPLUSNOW + Canais ao vivo) nao e liberado por
 * login/senha: o app Funplay e travado por ENDERECO MAC do aparelho. Fluxo:
 *
 *  1. compra confirmada -> e-mail de boas-vindas do IPTV com o link do app e a
 *     instrucao "pegue o MAC no canto inferior direito da tela";
 *  2. o cliente digita esse MAC no painel dele (uma linha aqui, status
 *     "pendente");
 *  3. o admin recebe alerta no painel + WhatsApp e cadastra o MAC no servidor;
 *  4. o admin marca "ativado" e o cliente ve a confirmacao no painel.
 *
 * Um cliente pode ter varios aparelhos, entao a tabela e um historico: o
 * mesmo MAC nao entra duas vezes para o mesmo cliente (indice unico).
 */
export const ativacoesIptv = sqliteTable(
  "ativacoes_iptv",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    /** slug do app que originou o pedido (hoje sempre "iptv") */
    servicoSlug: text("servico_slug").notNull().default("iptv"),
    /** MAC normalizado em MAIUSCULAS no formato AA:BB:CC:DD:EE:FF */
    mac: text("mac").notNull(),
    /** onde o app esta instalado: "TV Box sala", "Fire Stick", ... */
    dispositivo: text("dispositivo").notNull().default(""),
    /** pendente | ativado | recusado | cancelado */
    status: text("status").notNull().default("pendente"),
    /** recado do admin devolvido ao cliente */
    respostaAdmin: text("resposta_admin").notNull().default(""),
    criadoEm: integer("criado_em", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    atualizadoEm: integer("atualizado_em", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    ativadoEm: integer("ativado_em", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("ativacoes_iptv_cliente_mac_idx").on(t.clienteId, t.mac)],
);

export type AtivacaoIptv = typeof ativacoesIptv.$inferSelect;
export type NovaAtivacaoIptv = typeof ativacoesIptv.$inferInsert;
