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
  criadoEm: integer("criado_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Usuario = typeof usuarios.$inferSelect;
export type NovoUsuario = typeof usuarios.$inferInsert;
