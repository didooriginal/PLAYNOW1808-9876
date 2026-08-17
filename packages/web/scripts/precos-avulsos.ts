/**
 * TABELA OFICIAL DE PREÇOS AVULSOS — aplicação pontual.
 *
 * Rode UMA vez para alinhar o banco com a tabela combinada com o dono da
 * operação. Depois disso, quem manda no preço é o admin: nem este script nem o
 * seed voltam a mexer sozinhos (`semearAplicativos` é aditivo desde ago/2026).
 *
 *   cd packages/web && bun --env-file=../../.env scripts/precos-avulsos.ts
 *
 * Só mexe em `preco` (o que a PLAYPLUSNOW cobra). `precoAvulso` (preço de
 * mercado do comparativo) fica intacto para não zerar a economia exibida; nos
 * apps novos ele nasce igual ao preço e é editável no admin.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/api/database";
import { aplicativos, planosApps } from "../src/api/database/schema";

/** slug -> preço de venda mensal */
const PRECOS_APP: Record<string, number> = {
  prime: 15,
  paramount: 15,
  globoplay: 20,
  disney: 20,
  telecine: 15,
  netflix: 20, // base "a partir de" — as opções são 20 / 25
  canva: 15,
  deezer: 15,
  iptv: 35, // PLAYPLUSNOW + Canais ao vivo
  crunchyroll: 15,
  looke: 15,
  recordplus: 15,
  appletv: 15,
  youtube: 15,
  hbomax: 15,
  premiere: 25, // base — as opções são 25 / 35 / 40
  spotify: 15,
  unitv: 19.9,
  brasilparalelo: 15,
};

/** apps que ainda não existiam no catálogo */
const NOVOS = [
  {
    slug: "telecine",
    nome: "Telecine",
    mono: "TC",
    cor: "#e6b422",
    tipo: "video",
    categoria: "streaming",
    preco: 15,
    precoAvulso: 24.9,
  },
  {
    slug: "unitv",
    nome: "UniTV",
    mono: "UN",
    cor: "#1f6feb",
    tipo: "video",
    categoria: "iptv",
    preco: 19.9,
    precoAvulso: 19.9,
  },
  {
    slug: "brasilparalelo",
    nome: "Brasil Paralelo",
    mono: "BP",
    cor: "#c9a227",
    tipo: "video",
    categoria: "streaming",
    preco: 15,
    precoAvulso: 15,
  },
];

/** renomeações combinadas */
const RENOMEAR: Record<string, { nome: string; mono: string }> = {
  iptv: { nome: "PLAYPLUSNOW + Canais ao vivo", mono: "PPN" },
};

/** slug da variação -> preço */
const PRECOS_PLANO: Record<string, number> = {
  "netflix-compartilhada": 20,
  "netflix-individual": 25,
  "globoplay-comum": 20,
  "globoplay-premium": 25,
  "globoplay-premium-telecine": 40,
  "premiere-comum": 25,
  "premiere-prime": 35,
  "premiere-globoplay": 40,
};

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

async function main() {
  console.log("== APPS NOVOS ==");
  for (const novo of NOVOS) {
    const [existe] = await db
      .select({ id: aplicativos.id })
      .from(aplicativos)
      .where(eq(aplicativos.slug, novo.slug));
    if (existe) {
      console.log(`  · ${novo.slug} já existe — não recriado`);
      continue;
    }
    await db.insert(aplicativos).values(novo);
    console.log(`  + ${novo.slug} criado (${brl(novo.preco)})`);
  }

  console.log("== RENOMEAÇÕES ==");
  for (const [slug, dados] of Object.entries(RENOMEAR)) {
    const r = await db
      .update(aplicativos)
      .set(dados)
      .where(eq(aplicativos.slug, slug))
      .returning({ nome: aplicativos.nome });
    console.log(r[0] ? `  ~ ${slug} -> ${r[0].nome}` : `  ! ${slug} não encontrado`);
  }

  console.log("== PREÇOS DOS APPS ==");
  for (const [slug, preco] of Object.entries(PRECOS_APP)) {
    const [antes] = await db
      .select({ preco: aplicativos.preco })
      .from(aplicativos)
      .where(eq(aplicativos.slug, slug));
    if (!antes) {
      console.log(`  ! ${slug} não existe no catálogo`);
      continue;
    }
    if (antes.preco === preco) {
      console.log(`  = ${slug} já está em ${brl(preco)}`);
      continue;
    }
    await db.update(aplicativos).set({ preco }).where(eq(aplicativos.slug, slug));
    console.log(`  ~ ${slug}: ${brl(antes.preco)} -> ${brl(preco)}`);
  }

  console.log("== PREÇOS DAS VARIAÇÕES ==");
  for (const [slug, preco] of Object.entries(PRECOS_PLANO)) {
    const [antes] = await db
      .select({ preco: planosApps.preco })
      .from(planosApps)
      .where(eq(planosApps.slug, slug));
    if (!antes) {
      console.log(`  ! variação ${slug} não existe`);
      continue;
    }
    if (antes.preco === preco) {
      console.log(`  = ${slug} já está em ${brl(preco)}`);
      continue;
    }
    await db.update(planosApps).set({ preco }).where(eq(planosApps.slug, slug));
    console.log(`  ~ ${slug}: ${brl(antes.preco)} -> ${brl(preco)}`);
  }

  console.log("\nPronto. A partir de agora só o admin muda esses preços.");
}

await main();
