/**
 * Roda o seed sem precisar de sessão de admin (a procedure `seed.run` exige login admin).
 * Uso: bun run seed                                        → só popula se estiver vazio
 *      bun run seed -- force                               → tenta recriar os dados de demonstração
 *      bun run seed -- force --confirmo-apagar-tudo        → ignora a trava e apaga a base
 *
 * A trava recusa o modo force quando o banco tem sinal de operação real
 * (cliente ativo, fatura paga ou Pix confirmado). Sempre rode `bun run db:backup` antes.
 */
import { executarSeed } from "../src/api/routes/seed";

const args = process.argv.slice(2);
const force = args.includes("force");
const confirmarApagarTudo = args.includes("--confirmo-apagar-tudo");

try {
  const resultado = await executarSeed({ force, confirmarApagarTudo });
  console.log(JSON.stringify(resultado, null, 2));
  process.exit(0);
} catch (erro) {
  console.error(`\n${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exit(1);
}
