import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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
  /** preço avulso de mercado — usado no comparativo de economia */
  precoAvulso: real("preco_avulso").notNull().default(0),
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
/* AUTENTICAÇÃO (Better Auth)                                          */
/* ------------------------------------------------------------------ */

export * from "./auth-schema";
