/**
 * AUDITORIA (somente leitura) — alocações duplicadas.
 *
 * Antes da trava de "uma vaga ativa por serviço", o admin conseguia alocar o
 * mesmo cliente em duas contas do mesmo app. Isso deixa vaga fantasma presa na
 * conta antiga. Este script só LISTA os casos — nenhuma correção automática.
 *
 * Uso: cd packages/web && bun --env-file=../../.env scripts/auditar-alocacoes.ts
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/api/database";
import { alocacoes, contasMatrizes, usuarios } from "../src/api/database/schema";

const linhas = await db
  .select({
    alocacaoId: alocacoes.id,
    clienteId: alocacoes.clienteId,
    cliente: usuarios.nome,
    servico: alocacoes.servico,
    contaId: alocacoes.contaId,
    conta: contasMatrizes.rotulo,
    criadoEm: alocacoes.criadoEm,
  })
  .from(alocacoes)
  .innerJoin(usuarios, eq(alocacoes.clienteId, usuarios.id))
  .innerJoin(contasMatrizes, eq(alocacoes.contaId, contasMatrizes.id))
  .where(eq(alocacoes.status, "ativo"));

const grupos = new Map<string, typeof linhas>();
for (const l of linhas) {
  const chave = `${l.clienteId}::${l.servico}`;
  const atual = grupos.get(chave) ?? [];
  atual.push(l);
  grupos.set(chave, atual);
}

const duplicados = [...grupos.entries()].filter(([, v]) => v.length > 1);

if (!duplicados.length) {
  console.log(`OK — ${linhas.length} alocações ativas, nenhuma duplicada por serviço.`);
} else {
  console.log(`ATENÇÃO — ${duplicados.length} caso(s) de vaga duplicada:\n`);
  for (const [chave, itens] of duplicados) {
    const [, servico] = chave.split("::");
    console.log(`  ${itens[0]!.cliente} (id ${itens[0]!.clienteId}) · ${servico}`);
    for (const i of itens) {
      console.log(
        `    - alocação ${i.alocacaoId} na conta "${i.conta}" (id ${i.contaId}) desde ${i.criadoEm.toISOString().slice(0, 10)}`,
      );
    }
  }
  console.log("\nNenhuma correção foi aplicada — decida caso a caso qual vaga manter.");
}

/** silencia o aviso de import não usado quando o filtro `and` não é necessário */
void and;
