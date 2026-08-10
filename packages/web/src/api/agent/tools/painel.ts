// Tools do assistente — leituras do painel do CLIENTE LOGADO.
//
// Todas as tools são criadas por `ferramentasDoCliente(clienteId)`: o id vem da
// sessão no endpoint, nunca do modelo. Assim o assistente não consegue ler
// dados de outro cliente mesmo se for instruído a isso.
//
// Regra de segurança: nenhuma tool devolve a SENHA das contas matrizes. O
// assistente orienta o cliente a copiar do card no painel.
import { and, desc, eq, inArray } from "drizzle-orm";
import { tool } from "ai";
import z from "zod";
import { db } from "../../database";
import {
  alocacoes,
  aplicativos,
  contasMatrizes,
  chamados,
  codigosOtp,
  combos,
  faturas,
  solicitacoesTv,
  pacotes,
  usuarios,
} from "../../database/schema";
import { MISSOES, recalcularProgresso, tituloDoNivel } from "../../routes/recompensas";
import { servicoInfo } from "../../../web/lib/servicos-info";
import { SLUGS_NETFLIX } from "../../routes/netflix";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

async function nomeDoServico(slug: string) {
  const [app] = await db.select().from(aplicativos).where(eq(aplicativos.slug, slug));
  return app?.nome ?? slug;
}

export function ferramentasDoCliente(clienteId: number) {
  return {
    /* ---------------------------------------------------------------- */
    meusAcessos: tool({
      description:
        "Lista os apps liberados para o cliente, com o e-mail de acesso, o status e onde assistir. Use sempre que a pergunta envolver quais apps ele tem ou se um app está ativo.",
      inputSchema: z.object({}),
      async execute() {
        const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
        const [pacote] = cliente?.pacoteId
          ? await db.select().from(pacotes).where(eq(pacotes.id, cliente.pacoteId))
          : [];

        const rows = await db
          .select({
            servico: alocacoes.servico,
            email: contasMatrizes.email,
            status: contasMatrizes.status,
            regiao: contasMatrizes.regiao,
          })
          .from(alocacoes)
          .innerJoin(contasMatrizes, eq(contasMatrizes.id, alocacoes.contaId))
          .where(and(eq(alocacoes.clienteId, clienteId), eq(alocacoes.status, "ativo")));

        const acessos = [];
        for (const r of rows) {
          const nome = await nomeDoServico(r.servico);
          const info = servicoInfo(r.servico, nome);
          acessos.push({
            servico: nome,
            slug: r.servico,
            emailDeAcesso: r.email,
            senha: "disponível no card do app, no painel (botão de copiar)",
            status: r.status === "manutencao" ? "em manutenção" : "ativo",
            regiao: r.regiao,
            site: info.url,
            dispositivos: info.dispositivos,
          });
        }

        return {
          pacote: pacote?.nome ?? "sem pacote",
          total: acessos.length,
          acessos,
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    comoAcessar: tool({
      description:
        "Passo a passo oficial de login de um serviço específico, com site oficial, dispositivos suportados e dicas. Use quando o cliente perguntar como entrar/assistir/instalar um app.",
      inputSchema: z.object({
        servico: z.string().describe("nome ou slug do serviço, ex.: 'netflix', 'Disney+', 'unitv'"),
      }),
      async execute({ servico }) {
        const busca = servico.toLowerCase().trim();
        const apps = await db.select().from(aplicativos);
        const achado =
          apps.find((a) => a.slug === busca) ??
          apps.find((a) => a.nome.toLowerCase() === busca) ??
          apps.find((a) => a.nome.toLowerCase().includes(busca) || busca.includes(a.slug));

        const slug = achado?.slug ?? busca;
        const nome = achado?.nome ?? servico;
        const info = servicoInfo(slug, nome);

        const [temAcesso] = await db
          .select({ id: alocacoes.id })
          .from(alocacoes)
          .where(
            and(
              eq(alocacoes.clienteId, clienteId),
              eq(alocacoes.servico, slug),
              eq(alocacoes.status, "ativo"),
            ),
          );

        return {
          servico: nome,
          clienteTemEsteApp: Boolean(temAcesso),
          site: info.url,
          dispositivos: info.dispositivos,
          passos: info.passos,
          dicas: info.dicas,
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    desbloqueioNetflix: tool({
      description:
        "Estado da secao 'Desbloquear Tela Netflix' do cliente: se ele tem Netflix, o codigo por e-mail disponivel agora (Opcao A) e as solicitacoes de codigo de TV / netflix.com/tv2 (Opcao B). Use SEMPRE que a pergunta envolver tela bloqueada, 'estou viajando', codigo na TV, netflix.com/tv2 ou verificacao da Netflix.",
      inputSchema: z.object({}),
      async execute() {
        const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
        if (!cliente) return { temNetflix: false };

        const contas = await db
          .select({ email: contasMatrizes.email, status: contasMatrizes.status })
          .from(alocacoes)
          .innerJoin(contasMatrizes, eq(contasMatrizes.id, alocacoes.contaId))
          .where(
            and(
              eq(alocacoes.clienteId, clienteId),
              eq(alocacoes.status, "ativo"),
              inArray(alocacoes.servico, SLUGS_NETFLIX),
            ),
          );

        const emails = new Set([
          cliente.email.toLowerCase(),
          ...contas.map((c) => c.email.toLowerCase()),
        ]);

        const otps = await db
          .select()
          .from(codigosOtp)
          .orderBy(desc(codigosOtp.recebidoEm))
          .limit(40);

        const codigosEmail = otps
          .filter(
            (r) =>
              SLUGS_NETFLIX.includes(r.servicoSlug) &&
              (r.clienteId === clienteId || emails.has((r.destinatario ?? "").toLowerCase())),
          )
          .slice(0, 3)
          .map((r) => ({ codigo: r.codigo, recebidoEm: new Date(r.recebidoEm).toISOString() }));

        const pedidos = await db
          .select()
          .from(solicitacoesTv)
          .where(eq(solicitacoesTv.clienteId, clienteId))
          .orderBy(desc(solicitacoesTv.criadoEm))
          .limit(5);

        return {
          temNetflix: contas.length > 0,
          contaEmManutencao: contas.some((c) => c.status !== "ativo"),
          onde: 'aba "Desbloquear Netflix" no menu do painel',
          opcaoA: {
            quando: 'a TV diz que enviou um codigo para o e-mail da conta ou pede "Estou viajando"',
            comoFazer:
              'na TV escolher "Enviar e-mail", voltar ao painel, tocar no codigo para copiar e digitar na TV',
            codigosDisponiveisAgora: codigosEmail,
          },
          opcaoB: {
            quando: "a TV mostra o endereco netflix.com/tv2 com um codigo curto na tela",
            comoFazer:
              "digitar esse codigo no campo da Opcao B e enviar; a equipe autoriza e a TV libera sozinha",
            minhasSolicitacoes: pedidos.map((p) => ({
              codigoTv: p.codigoTv,
              status: p.status,
              resposta: p.respostaAdmin,
              criadoEm: new Date(p.criadoEm).toISOString(),
            })),
          },
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    codigoRecente: tool({
      description:
        "Últimos códigos de verificação (OTP) recebidos para as contas do cliente. Use quando o app pedir 'código enviado por e-mail' ou 'código de acesso temporário'.",
      inputSchema: z.object({}),
      async execute() {
        const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
        if (!cliente) return { codigos: [] };

        const minhasContas = await db
          .select({ email: contasMatrizes.email })
          .from(alocacoes)
          .innerJoin(contasMatrizes, eq(contasMatrizes.id, alocacoes.contaId))
          .where(and(eq(alocacoes.clienteId, clienteId), eq(alocacoes.status, "ativo")));

        const emails = new Set([
          cliente.email.toLowerCase(),
          ...minhasContas.map((c) => c.email.toLowerCase()),
        ]);

        const rows = await db
          .select()
          .from(codigosOtp)
          .orderBy(desc(codigosOtp.recebidoEm))
          .limit(40);

        const codigos = rows
          .filter(
            (r) => r.clienteId === clienteId || emails.has((r.destinatario ?? "").toLowerCase()),
          )
          .slice(0, 5)
          .map((r) => ({
            codigo: r.codigo,
            servico: r.servico || r.servicoSlug,
            recebidoEm: new Date(r.recebidoEm).toISOString(),
          }));

        return {
          codigos,
          ondeVer: 'bloco "Seu código de acesso recente" na aba Meus Acessos',
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    minhasFaturas: tool({
      description:
        "Faturas do cliente: valor, desconto, vencimento e status (pago/aberto/vencido). Use para dúvidas de pagamento, cobrança e recibo.",
      inputSchema: z.object({}),
      async execute() {
        const rows = await db
          .select()
          .from(faturas)
          .where(eq(faturas.clienteId, clienteId))
          .orderBy(desc(faturas.competencia))
          .limit(12);

        return {
          faturas: rows.map((f) => ({
            numero: f.numero,
            competencia: f.competencia,
            valor: brl(f.valor),
            cupom: f.cupom || null,
            desconto: f.desconto ? `${f.desconto}%` : null,
            valorCobrado: brl(f.valorFinal),
            vencimento: f.vencimento,
            status: f.status,
            pagoEm: f.pagoEm || null,
          })),
          comoPagar:
            "botão Pagar com Pix na aba Faturas — gera o copia-e-cola na hora e a baixa é automática",
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    minhaJornada: tool({
      description:
        "XP, nível, missões, prêmios liberados, cupom ativo, link de indicação e quantas indicações já viraram assinantes. Use para dúvidas sobre recompensas, pontos, indicação e afiliados.",
      inputSchema: z.object({}),
      async execute() {
        const { cliente, codigo, progresso, indicados, assinantes } =
          await recalcularProgresso(clienteId);

        const concluidas = new Set(progresso.missoesConcluidas ?? []);
        const proxima = MISSOES.find((m) => !concluidas.has(m.id));

        return {
          nivel: `${progresso.nivel} · ${tituloDoNivel(progresso.nivel)}`,
          xp: progresso.xp,
          renovacoesEmDia: progresso.renovacoes,
          mesesAtivo: progresso.mesesAtivo,
          linkDeIndicacao: `${process.env.WEBSITE_URL?.replace(/\/$/, "") ?? ""}/signup?ref=${codigo}`,
          codigoDeIndicacao: codigo,
          indicados: indicados.length,
          indicadosQueAssinaram: assinantes.length,
          cupomAtivo: progresso.cupomAtivo || null,
          premiosLiberados: progresso.premiosLiberados ?? [],
          missoesConcluidas: [...concluidas],
          proximaMissao: proxima
            ? { titulo: proxima.titulo, alvo: proxima.alvo, recompensa: proxima.recompensa }
            : null,
          statusPagamento: cliente.statusPagamento,
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    meusChamados: tool({
      description:
        "Chamados de suporte abertos pelo cliente e o andamento de cada um. Use quando ele perguntar sobre um problema já relatado.",
      inputSchema: z.object({}),
      async execute() {
        const rows = await db
          .select()
          .from(chamados)
          .where(eq(chamados.clienteId, clienteId))
          .orderBy(desc(chamados.id))
          .limit(10);

        return {
          chamados: rows.map((c) => ({
            id: c.id,
            servico: c.servico ?? "geral",
            tipo: c.tipo,
            descricao: c.descricao,
            resposta: c.resposta ?? null,
            status: c.status,
            abertoEm: c.criadoEm,
          })),
          comoAbrir: 'botão "Relatar problema" dentro do card do app',
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    combosDisponiveis: tool({
      description:
        "Combos e pacotes que o cliente pode contratar ou adicionar. Use para dúvidas de upgrade, adicionar app novo ou economizar.",
      inputSchema: z.object({}),
      async execute() {
        const rows = await db.select().from(combos).where(eq(combos.ativo, true)).limit(8);
        return {
          combos: rows.map((c) => ({
            nome: c.nome,
            apps: c.apps,
            preco: brl(c.preco),
            precoCheio: brl(c.precoCheio),
            destaque: c.destaque,
          })),
          comoContratar: "aba Novidades/Upgrades do painel",
        };
      },
    }),
  };
}
