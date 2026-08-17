/**
 * TESTE DE ISOLAMENTO DA CENTRAL DE CÓDIGOS 2.0.
 *
 * Prova, contra o banco real, que:
 *   1. o código vai só para quem abriu pedido (FIFO por matriz);
 *   2. o segundo pedido recebe o segundo código;
 *   3. código sem pedido casado fica sem dono;
 *   4. código expirado / marcado como usado desaparece do painel.
 *
 * Uso: bun --env-file=../../.env scripts/teste-entrega-codigo.ts
 * Não cria nem apaga clientes — usa os de teste (92 e 93) e limpa o que criou.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/api/database";
import {
  alocacoes,
  codigosOtp,
  contasMatrizes,
  pedidosCodigo,
} from "../src/api/database/schema";
import { registrarEmail } from "../src/api/routes/codigos";
import { meusCodigosVisiveis } from "../src/api/lib/codigos-entrega";

const CLIENTE_A = 92;
const CLIENTE_B = 93;
const CAPTURA = "teste-isolamento@mail.playplusnow.com.br";

const falhas: string[] = [];
function checar(nome: string, ok: boolean, extra = "") {
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${extra ? ` — ${extra}` : ""}`);
  if (!ok) falhas.push(nome);
}

async function limpar(contaId: number) {
  await db.delete(codigosOtp).where(eq(codigosOtp.destinatario, CAPTURA));
  await db.delete(pedidosCodigo).where(eq(pedidosCodigo.contaId, contaId));
  await db
    .delete(alocacoes)
    .where(and(eq(alocacoes.contaId, contaId), inArray(alocacoes.clienteId, [CLIENTE_A, CLIENTE_B])));
  await db.delete(contasMatrizes).where(eq(contasMatrizes.id, contaId));
}

const email = (codigo: string) => ({
  remetente: "info@account.netflix.com",
  destinatario: CAPTURA,
  assunto: "Seu código de acesso temporário da Netflix",
  corpo: `Use este código de verificação para continuar assistindo: ${codigo}`,
  origem: "webhook" as const,
});

async function main() {
  // matriz de teste isolada, com o endereço de captura preenchido
  const [conta] = await db
    .insert(contasMatrizes)
    .values({
      servico: "netflix",
      rotulo: "TESTE — isolamento de códigos",
      email: "teste-isolamento-login@example.com",
      emailCaptura: CAPTURA,
      senha: "x",
      totalVagas: 4,
      vagasOcupadas: 2,
      status: "ativo",
      custo: 0,
    })
    .returning();
  console.log(`matriz de teste #${conta.id}`);

  try {
    for (const clienteId of [CLIENTE_A, CLIENTE_B]) {
      await db.insert(alocacoes).values({
        clienteId,
        contaId: conta.id,
        servico: "netflix",
        status: "ativo",
      });
    }

    /* ---- 1. código com pedido do cliente A ---- */
    await db
      .insert(pedidosCodigo)
      .values({ clienteId: CLIENTE_A, contaId: conta.id, servicoSlug: "netflix" });
    const r1 = await registrarEmail(email("1111"));
    checar("e-mail 1 processado", r1.ok);
    const visA = await meusCodigosVisiveis(CLIENTE_A);
    const visB = await meusCodigosVisiveis(CLIENTE_B);
    checar("cliente A vê o código 1111", visA.some((c) => c.codigo === "1111"));
    checar("cliente B NÃO vê o código de A", !visB.some((c) => c.codigo === "1111"));

    /* ---- 2. agora o pedido é do cliente B ---- */
    await db
      .insert(pedidosCodigo)
      .values({ clienteId: CLIENTE_B, contaId: conta.id, servicoSlug: "netflix" });
    await registrarEmail(email("2222"));
    const visB2 = await meusCodigosVisiveis(CLIENTE_B);
    const visA2 = await meusCodigosVisiveis(CLIENTE_A);
    checar("cliente B vê o código 2222", visB2.some((c) => c.codigo === "2222"));
    checar("cliente A NÃO vê o código de B", !visA2.some((c) => c.codigo === "2222"));

    /* ---- 3. código sem pedido = sem dono ---- */
    const r3 = await registrarEmail(email("3333"));
    checar("código 3333 ficou sem dono", r3.ok && r3.entregue === null);
    const semDono = await db.select().from(codigosOtp).where(eq(codigosOtp.codigo, "3333"));
    checar(
      "3333 sem entregueClienteId no banco",
      semDono.every((c) => !c.entregueClienteId),
    );
    const visA3 = await meusCodigosVisiveis(CLIENTE_A);
    const visB3 = await meusCodigosVisiveis(CLIENTE_B);
    checar(
      "3333 não aparece para nenhum cliente",
      ![...visA3, ...visB3].some((c) => c.codigo === "3333"),
    );

    /* ---- 4. "já usei" e expiração ---- */
    const alvo = (await meusCodigosVisiveis(CLIENTE_A)).find((c) => c.codigo === "1111");
    if (alvo) {
      await db.update(codigosOtp).set({ usadoEm: new Date() }).where(eq(codigosOtp.id, alvo.id));
      const depois = await meusCodigosVisiveis(CLIENTE_A);
      checar('some depois de "já usei"', !depois.some((c) => c.codigo === "1111"));
    } else {
      checar("código 1111 disponível para o teste de uso", false);
    }

    const alvoB = (await meusCodigosVisiveis(CLIENTE_B)).find((c) => c.codigo === "2222");
    if (alvoB) {
      await db
        .update(codigosOtp)
        .set({ expiraEm: new Date(Date.now() - 60_000) })
        .where(eq(codigosOtp.id, alvoB.id));
      const depois = await meusCodigosVisiveis(CLIENTE_B);
      checar("some depois de expirar (15 min)", !depois.some((c) => c.codigo === "2222"));
    } else {
      checar("código 2222 disponível para o teste de expiração", false);
    }
  } finally {
    await limpar(conta.id);
    console.log("limpeza concluída");
  }

  console.log(falhas.length ? `\nFALHAS: ${falhas.join(", ")}` : "\nTUDO OK");
  process.exit(falhas.length ? 1 : 0);
}

void main();
