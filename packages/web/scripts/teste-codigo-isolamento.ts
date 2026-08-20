import { db } from "../src/api/database";
import { codigosOtp, pedidosCodigo } from "../src/api/database/schema";
import { registrarEmail } from "../src/api/routes/codigos";
import { and, eq, inArray } from "drizzle-orm";

async function limpar() {
  const abertos = await db.select({ id: pedidosCodigo.id }).from(pedidosCodigo)
    .where(eq(pedidosCodigo.status, "aguardando"));
  if (abertos.length) await db.update(pedidosCodigo).set({ status: "expirado" })
    .where(inArray(pedidosCodigo.id, abertos.map((p) => p.id)));
}

const CORPO_NETFLIX = "Netflix\n\nSeu codigo de acesso temporario e 445566\n\nUse este codigo para continuar assistindo.";

// ---------- TESTE NEGATIVO ----------
// Cliente 91 tem pedido de DISNEY na conta 145. Chega um e-mail da NETFLIX no
// mesmo Gmail (captura netflix166@). O codigo da Netflix NAO pode ir pro 91.
await limpar();
const [pDisney] = await db.insert(pedidosCodigo)
  .values({ clienteId: 91, contaId: 145, servicoSlug: "disney", status: "aguardando", criadoEm: new Date() })
  .returning();

const rNet = await registrarEmail({
  remetente: "info@account.netflix.com",
  destinatario: "netflix166@mail.playplusnow.com.br",
  assunto: "Seu codigo de acesso temporario da Netflix",
  corpo: CORPO_NETFLIX,
  origem: "webhook",
});

const [pDisney2] = await db.select().from(pedidosCodigo).where(eq(pedidosCodigo.id, pDisney.id));
const entregueA = rNet.ok ? rNet.entregue?.id ?? null : null;
console.log("NEGATIVO: pedido disney do cliente 91 ->", pDisney2.status, "| codigoId", pDisney2.codigoId);
console.log("NEGATIVO: codigo netflix", rNet.ok ? rNet.registro?.codigo : "-", "entregue a:", entregueA);
const negOk = pDisney2.status === "aguardando" && pDisney2.codigoId === null && entregueA !== 91;
console.log(negOk ? "  PASSOU (Netflix nao vazou para o pedido de Disney)" : "  FALHOU");

if (rNet.ok && rNet.registro) await db.delete(codigosOtp).where(eq(codigosOtp.id, rNet.registro.id));
await db.delete(pedidosCodigo).where(eq(pedidosCodigo.id, pDisney.id));

// ---------- REGRESSAO ----------
// Caso normal, que sempre funcionou: e-mail Netflix na captura da propria conta
// 166, cliente 103 (vaga ativa de netflix na 166) com pedido aberto.
await limpar();
const [pNet] = await db.insert(pedidosCodigo)
  .values({ clienteId: 103, contaId: 166, servicoSlug: "netflix", status: "aguardando", criadoEm: new Date() })
  .returning();

const rNet2 = await registrarEmail({
  remetente: "info@account.netflix.com",
  destinatario: "netflix166@mail.playplusnow.com.br",
  assunto: "Seu codigo de acesso temporario da Netflix",
  corpo: CORPO_NETFLIX,
  origem: "webhook",
});
const [pNet2] = await db.select().from(pedidosCodigo).where(eq(pedidosCodigo.id, pNet.id));
console.log("REGRESSAO: pedido netflix do cliente 103 ->", pNet2.status, "| codigoId", pNet2.codigoId);
console.log("REGRESSAO: entregue a:", rNet2.ok ? rNet2.entregue : "-");
const regOk = pNet2.status === "entregue" && pNet2.codigoId !== null;
console.log(regOk ? "  PASSOU (caso normal intacto)" : "  FALHOU");

if (pNet2.codigoId) await db.delete(codigosOtp).where(eq(codigosOtp.id, pNet2.codigoId));
await db.delete(pedidosCodigo).where(eq(pedidosCodigo.id, pNet.id));

const sobra = await db.select({ id: codigosOtp.id }).from(codigosOtp).where(eq(codigosOtp.codigo, "445566"));
console.log("\nlimpeza: codigos 445566 restantes =", sobra.length);
console.log("RESULTADO:", [negOk, regOk].filter(Boolean).length + "/2");
process.exit(negOk && regOk ? 0 : 1);
