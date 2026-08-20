/**
 * Prova que o codigo do Disney+ que chega no endereco de captura de uma conta
 * IRMA (mesmo Gmail de login, servico diferente) e entregue ao cliente que
 * pediu na conta certa.
 */
import { db } from "../src/api/database";
import { codigosOtp, pedidosCodigo } from "../src/api/database/schema";
import { registrarEmail } from "../src/api/routes/codigos";
import { meusCodigosVisiveis } from "../src/api/lib/codigos-entrega";
import { limparCorpoEmail } from "../src/api/lib/email-mime";
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";

const CLIENTE = 91;   // Admin PLAYPLUSNOW (cliente de teste)
const CONTA = 145;    // "Disney - 103", login playnowplus07@gmail.com
const DESTINO = "netflix166@mail.playplusnow.com.br"; // captura da IRMA (166, Netflix)

const EML = new URL("./fixtures/disney-otp.eml", import.meta.url).pathname;
const corpo = limparCorpoEmail(readFileSync(EML, "utf-8"));

// isola o teste do FIFO: nenhum pedido antigo do mesmo cliente/servico em aberto
const antes = await db
  .select({ id: pedidosCodigo.id })
  .from(pedidosCodigo)
  .where(and(eq(pedidosCodigo.clienteId, CLIENTE), eq(pedidosCodigo.status, "aguardando")));
if (antes.length) {
  await db.update(pedidosCodigo).set({ status: "expirado" })
    .where(inArray(pedidosCodigo.id, antes.map((p) => p.id)));
  console.log("pedidos antigos em aberto neutralizados:", antes.map((p) => p.id).join(","));
}

const [pedido] = await db.insert(pedidosCodigo)
  .values({ clienteId: CLIENTE, contaId: CONTA, servicoSlug: "disney", status: "aguardando", criadoEm: new Date() })
  .returning();
console.log("pedido criado:", pedido.id, "| cliente", pedido.clienteId, "| conta", pedido.contaId, "| disney");

const r = await registrarEmail({
  remetente: "disneyplus@mail.disneyplus.com",
  destinatario: DESTINO,
  assunto: "Seu codigo de acesso unico para o Disney+",
  corpo,
  origem: "webhook",
});
console.log("e-mail chegou em:", DESTINO, "(captura da conta 166, Netflix)");
console.log("registrarEmail:", JSON.stringify(r.ok ? { codigo: r.registro?.codigo, entregue: r.entregue } : r));

const [p2] = await db.select().from(pedidosCodigo).where(eq(pedidosCodigo.id, pedido.id));
const visiveis = await meusCodigosVisiveis(CLIENTE);
console.log("pedido", pedido.id, "->", p2.status, "| codigoId", p2.codigoId);
console.log("painel do cliente", CLIENTE, ":", JSON.stringify(visiveis.map((v) => v.codigo + " " + v.servico)));

const ok = p2.status === "entregue" && p2.codigoId !== null
  && visiveis.some((v) => v.codigo === "739412");
console.log(ok ? "\nPASSOU" : "\nFALHOU");

// limpeza total
if (p2.codigoId) await db.delete(codigosOtp).where(eq(codigosOtp.id, p2.codigoId));
await db.delete(pedidosCodigo).where(eq(pedidosCodigo.id, pedido.id));
const sobrou = await db.select({ id: codigosOtp.id }).from(codigosOtp).where(eq(codigosOtp.codigo, "739412"));
console.log("limpeza: codigos 739412 restantes =", sobrou.length);
process.exit(ok ? 0 : 1);
