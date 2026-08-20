/**
 * Prova o RESGATE de codigo orfao: o codigo chega ANTES do cliente clicar em
 * "Pedi o codigo agora" (a ordem real do fluxo) e ainda assim e entregue.
 * Roda contra o banco e limpa tudo que cria.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/api/database";
import { codigosOtp, pedidosCodigo } from "../src/api/database/schema";
import { registrarEmail } from "../src/api/routes/codigos";
import {
  meusCodigosVisiveis,
  resgatarCodigoOrfao,
} from "../src/api/lib/codigos-entrega";
import { limparCorpoEmail } from "../src/api/lib/email-mime";
import { readFileSync } from "node:fs";

const CLIENTE = 91;   // Admin PLAYPLUSNOW, vaga ativa de disney na conta 145
const OUTRO = 103;    // vaga ativa de netflix na conta 166 (nao tem disney)
const DESTINO = "netflix166@mail.playplusnow.com.br";
const EML = new URL("./fixtures/disney-otp.eml", import.meta.url).pathname;
const corpo = limparCorpoEmail(readFileSync(EML, "utf-8"));

const criados: number[] = [];
const pedidosCriados: number[] = [];

async function zerar() {
  for (const c of [CLIENTE, OUTRO]) {
    const abertos = await db
      .select({ id: pedidosCodigo.id })
      .from(pedidosCodigo)
      .where(and(eq(pedidosCodigo.clienteId, c), eq(pedidosCodigo.status, "aguardando")));
    if (abertos.length)
      await db.update(pedidosCodigo).set({ status: "expirado" })
        .where(inArray(pedidosCodigo.id, abertos.map((p) => p.id)));
  }
}

async function chegaCodigoOrfao() {
  const r = await registrarEmail({
    remetente: "disneyplus@mail.disneyplus.com",
    destinatario: DESTINO,
    assunto: "Seu codigo de acesso unico para o Disney+",
    corpo,
    origem: "webhook",
  });
  if (!r.ok) throw new Error("registrarEmail falhou");
  criados.push(r.registro!.id);
  return r;
}

const res: [string, boolean][] = [];

// ---------- 1. CASO PRINCIPAL ----------
await zerar();
const r1 = await chegaCodigoOrfao();
console.log("1) codigo chegou SEM ninguem ter pedido -> dono:", r1.entregue);
const resg = await resgatarCodigoOrfao(CLIENTE, "disney");
if (resg) pedidosCriados.push(resg.pedido.id);
const vis1 = await meusCodigosVisiveis(CLIENTE);
console.log("   depois do clique, painel do cliente 91:", JSON.stringify(vis1.map((v) => v.codigo)));
res.push(["resgate entrega o codigo que ja tinha chegado",
  !!resg && vis1.some((v) => v.codigo === "739412")]);

// ---------- 2. NAO RESGATA DUAS VEZES ----------
const resg2 = await resgatarCodigoOrfao(CLIENTE, "disney");
console.log("2) segundo resgate do mesmo codigo:", resg2 ? "PEGOU DE NOVO" : "null (correto)");
res.push(["codigo ja entregue nao e resgatado de novo", resg2 === null]);

// limpa o caso 1
for (const id of pedidosCriados) await db.delete(pedidosCodigo).where(eq(pedidosCodigo.id, id));
for (const id of criados) await db.delete(codigosOtp).where(eq(codigosOtp.id, id));
criados.length = 0; pedidosCriados.length = 0;

// ---------- 3. QUEM NAO TEM VAGA NO APP NAO RESGATA ----------
await zerar();
const r3 = await chegaCodigoOrfao();
const resg3 = await resgatarCodigoOrfao(OUTRO, "disney");
console.log("3) cliente 103 (sem vaga de disney) tentando resgatar:", resg3 ? "PEGOU" : "null (correto)");
res.push(["cliente sem vaga no app nao resgata", resg3 === null]);
if (resg3) pedidosCriados.push(resg3.pedido.id);

// ---------- 4. CORRIDA: DOIS CLIENTES AO MESMO TEMPO ----------
// os dois tem vaga de disney? nao — entao simulo o cliente 91 duas vezes em
// paralelo, que e o caso real de duplo clique / duas abas.
const [a, b] = await Promise.all([
  resgatarCodigoOrfao(CLIENTE, "disney"),
  resgatarCodigoOrfao(CLIENTE, "disney"),
]);
for (const x of [a, b]) if (x) pedidosCriados.push(x.pedido.id);
const ganhou = [a, b].filter(Boolean).length;
console.log("4) dois resgates simultaneos ->", ganhou, "entrega(s)");
res.push(["corrida entrega o codigo uma vez so", ganhou === 1]);

// limpeza final
for (const id of pedidosCriados) await db.delete(pedidosCodigo).where(eq(pedidosCodigo.id, id));
for (const id of criados) await db.delete(codigosOtp).where(eq(codigosOtp.id, id));
const sobra = await db.select({ id: codigosOtp.id }).from(codigosOtp).where(eq(codigosOtp.codigo, "739412"));
await zerar();

console.log("");
for (const [nome, ok] of res) console.log((ok ? "PASSOU" : "FALHOU") + " - " + nome);
console.log("limpeza: codigos 739412 restantes =", sobra.length);
const todos = res.every(([, ok]) => ok) && sobra.length === 0;
console.log("RESULTADO:", res.filter(([, ok]) => ok).length + "/" + res.length);
process.exit(todos ? 0 : 1);
