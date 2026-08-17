/**
 * BACKUP DO BANCO — dump completo em JSON.
 *
 *      bun run db:backup
 *
 * Lê TODAS as tabelas do Turso (descobertas via `sqlite_master`, então
 * tabela nova entra no backup sozinha) e grava um arquivo em `backups/`.
 * É só leitura: nada no banco é alterado.
 *
 * Existe porque o seed com `force` apaga clientes de verdade e não havia
 * como voltar atrás. Rode antes de qualquer seed, migração ou deploy.
 */
import { createClient } from "@libsql/client";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente. Rode com: bun run db:backup (usa o .env da raiz).");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

/** tabelas de verdade, fora as internas do SQLite e do drizzle */
const tabelas = (
  await client.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
  )
).rows.map((r) => String(r.name));

const dump: Record<string, unknown[]> = {};
let total = 0;

for (const tabela of tabelas) {
  const { rows } = await client.execute(`select * from "${tabela}"`);
  const linhas = rows.map((r) => ({ ...r }));
  dump[tabela] = linhas;
  total += linhas.length;
  if (linhas.length) console.log(`  ${tabela.padEnd(26)} ${linhas.length}`);
}

const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const pasta = join(import.meta.dir, "..", "backups");
mkdirSync(pasta, { recursive: true });
const arquivo = join(pasta, `backup-${carimbo}.json`);

writeFileSync(
  arquivo,
  JSON.stringify({ criadoEm: new Date().toISOString(), tabelas: dump }, null, 2),
);

/* RETENÇÃO: mantém os 14 dumps mais recentes (~2 semanas de backup diário). */
const MANTER = 14;
const antigos = readdirSync(pasta)
  .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
  .sort()
  .reverse()
  .slice(MANTER);
for (const f of antigos) rmSync(join(pasta, f));

console.log(`\nBackup salvo: ${arquivo}`);
if (antigos.length) console.log(`${antigos.length} backup(s) antigo(s) removido(s) (retenção: ${MANTER})`);
console.log(`${tabelas.length} tabelas · ${total} linhas`);
