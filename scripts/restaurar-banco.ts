/**
 * RESTAURAR O BANCO a partir de um dump do `db:backup`.
 *
 *      bun run db:restore -- backups/backup-2026-08-16T00-00-00.json
 *      bun run db:restore -- <arquivo> --tabelas usuarios,carteiras
 *      bun run db:restore -- <arquivo> --limpar
 *
 * Por padrão é ADITIVO e não destrói nada: insere as linhas do dump e ignora
 * as que já existem (`insert or ignore`, casa por chave primária). Use
 * `--limpar` só quando quiser mesmo que a tabela volte a ser exatamente o
 * que estava no arquivo — aí o conteúdo atual dela é apagado antes.
 *
 * `--tabelas` restaura apenas as tabelas listadas (ex.: recuperar os clientes
 * sem encostar em mais nada).
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith("--"));
const limpar = args.includes("--limpar");
const filtro = args.includes("--tabelas")
  ? (args[args.indexOf("--tabelas") + 1] ?? "").split(",").filter(Boolean)
  : [];

if (!arquivo) {
  console.error("Informe o arquivo: bun run db:restore -- backups/backup-....json");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente. Rode com: bun run db:restore (usa o .env da raiz).");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const dump = JSON.parse(readFileSync(arquivo, "utf8")) as {
  criadoEm: string;
  tabelas: Record<string, Record<string, unknown>[]>;
};

console.log(`Dump de ${dump.criadoEm}${limpar ? " · MODO --limpar (apaga antes)" : ""}`);

const existentes = new Set(
  (
    await client.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    )
  ).rows.map((r) => String(r.name)),
);

let inseridas = 0;

for (const [tabela, linhas] of Object.entries(dump.tabelas)) {
  if (filtro.length && !filtro.includes(tabela)) continue;
  if (!existentes.has(tabela)) {
    console.log(`  ${tabela.padEnd(26)} ignorada (não existe mais no schema)`);
    continue;
  }
  if (!linhas.length) continue;

  if (limpar) await client.execute(`delete from "${tabela}"`);

  const colunas = Object.keys(linhas[0]);
  const sql = `insert or ignore into "${tabela}" (${colunas
    .map((c) => `"${c}"`)
    .join(", ")}) values (${colunas.map(() => "?").join(", ")})`;

  await client.batch(
    linhas.map((linha) => ({
      sql,
      args: colunas.map((c) => (linha[c] ?? null) as never),
    })),
    "write",
  );

  inseridas += linhas.length;
  console.log(`  ${tabela.padEnd(26)} ${linhas.length}`);
}

console.log(`\nRestauração concluída · ${inseridas} linhas processadas`);
