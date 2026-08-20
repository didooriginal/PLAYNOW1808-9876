/**
 * MIGRACAO ADITIVA SEGURA (substitui `db:push` no dia a dia).
 *
 * Por que este script existe: em 20/08/2026 o `drizzle-kit push` (dialect
 * turso) apagou as 56 linhas de `contas_matrizes` ao adicionar tres colunas
 * NOT NULL. O plano que ele executou foi:
 *
 *   delete from contas_matrizes;
 *   ALTER TABLE `contas_matrizes` ADD `vagas_travadas` integer DEFAULT false NOT NULL;
 *   ...
 *
 * Ou seja: o push TRUNCA a tabela antes de adicionar coluna NOT NULL, e o
 * `--force` (usado para rodar sem TTY) aceita a perda de dados sem perguntar.
 * Reproduzido em banco local: 5 linhas -> 0 linhas.
 *
 * Este script faz o mesmo trabalho SEM nunca apagar dado: compara o schema
 * declarado em `src/api/database/schema.ts` com o banco real e roda apenas
 * `ALTER TABLE ... ADD COLUMN`. Nada de DELETE, DROP ou recriacao de tabela.
 *
 * Uso:
 *   bun run db:colunas            -> so mostra o plano (dry run)
 *   bun run db:colunas -- aplicar -> aplica os ALTERs
 *
 * Tabela nova ou coluna removida/alterada de tipo ele NAO resolve: avisa e
 * pede decisao humana (ai sim `db:push`, com backup na mao e conferindo o
 * plano que o drizzle-kit mostra).
 */
import { createClient } from "@libsql/client";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../src/api/database/schema";

const aplicar = process.argv.slice(2).includes("aplicar");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente - rode via `bun run db:colunas` na pasta packages/web");
const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

function ehTabela(v: unknown): v is SQLiteTable {
  return typeof v === "object" && v !== null && Symbol.for("drizzle:Name") in (v as object);
}

/** literal SQL do default de uma coluna, do jeito que o SQLite aceita */
function literalDefault(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "1" : "0";
  if (typeof valor === "number") return String(valor);
  return `'${String(valor).replace(/'/g, "''")}'`;
}

type Pendencia = { tabela: string; sql: string };
const pendentes: Pendencia[] = [];
const avisos: string[] = [];

for (const valor of Object.values(schema)) {
  if (!ehTabela(valor)) continue;
  const cfg = getTableConfig(valor);

  const info = await db.execute({ sql: "select name from pragma_table_info(?)", args: [cfg.name] });
  if (info.rows.length === 0) {
    avisos.push(`tabela AUSENTE no banco: ${cfg.name} (criacao de tabela nao e feita por este script)`);
    continue;
  }
  const existentes = new Set(info.rows.map((r) => String(r.name)));

  for (const col of cfg.columns) {
    if (existentes.has(col.name)) continue;
    const tipo = col.getSQLType();
    const def = col.hasDefault ? literalDefault(col.default) : "";
    if (col.notNull && !col.hasDefault) {
      avisos.push(
        `coluna nova ${cfg.name}.${col.name} e NOT NULL sem default: precisa de valor de preenchimento decidido a mao`,
      );
      continue;
    }
    const partes = [`ALTER TABLE \`${cfg.name}\` ADD \`${col.name}\` ${tipo}`];
    if (def !== "") partes.push(`DEFAULT ${def}`);
    if (col.notNull) partes.push("NOT NULL");
    pendentes.push({ tabela: cfg.name, sql: `${partes.join(" ")};` });
  }
}

if (avisos.length > 0) {
  console.log("\nATENCAO (nao resolvido automaticamente):");
  for (const a of avisos) console.log(`  - ${a}`);
}

if (pendentes.length === 0) {
  console.log("\nNada a fazer: todas as colunas do schema existem no banco.");
  process.exit(0);
}

console.log(`\n${pendentes.length} coluna(s) faltando no banco:`);
for (const p of pendentes) console.log(`  ${p.sql}`);

if (!aplicar) {
  console.log("\nDry run. Para aplicar: bun run db:colunas -- aplicar");
  process.exit(0);
}

for (const p of pendentes) {
  await db.execute(p.sql);
  console.log(`ok  ${p.sql}`);
}
console.log(`\n${pendentes.length} coluna(s) adicionada(s). Nenhum dado foi apagado.`);
