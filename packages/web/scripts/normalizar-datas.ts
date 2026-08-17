/**
 * Normaliza `usuarios.cliente_desde` para ISO (AAAA-MM-DD).
 * Uso: bun --env-file=../../.env scripts/normalizar-datas.ts [--aplicar]
 * Sem `--aplicar` só mostra o que mudaria.
 */
import { db } from "../src/api/database";
import { sql } from "drizzle-orm";

const aplicar = process.argv.includes("--aplicar");

const linhas = await db.all<{ id: number; nome: string; cliente_desde: string }>(
  sql`select id, nome, cliente_desde from usuarios where cliente_desde like '%/%'`,
);

if (linhas.length === 0) {
  console.log("Nada a corrigir: todas as datas já estão em ISO.");
  process.exit(0);
}

for (const l of linhas) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(l.cliente_desde.trim());
  if (!m) {
    console.log(`#${l.id} ${l.nome}: formato desconhecido "${l.cliente_desde}" — pulado`);
    continue;
  }
  const novo = `${m[3]}-${m[2]}-${m[1]}`;
  console.log(`#${l.id} ${l.nome}: ${l.cliente_desde} -> ${novo}${aplicar ? "" : " (simulação)"}`);
  if (aplicar) {
    await db.run(sql`update usuarios set cliente_desde = ${novo} where id = ${l.id}`);
  }
}

process.exit(0);
