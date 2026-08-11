// Tools do COPILOTO ADMIN — leitura operacional do painel administrativo.
//
// Diferente das tools do cliente (que são escopadas a um clienteId), estas
// leem a operação inteira: estoque de contas matrizes, base de clientes,
// fila de suporte, códigos OTP, gamificação e financeiro.
//
// Só são montadas pelo endpoint `/api/agent/admin-messages`, que exige sessão
// com `usuarios.admin = true`. Nenhuma tool devolve SENHA de conta matriz —
// nem para o admin, para a senha não vazar em log/histórico de chat.
import { and, desc, eq, inArray } from "drizzle-orm";
import { tool } from "ai";
import z from "zod";
import { db } from "../../database";
import {
  alocacoes,
  aplicativos,
  chamados,
  codigosOtp,
  combos,
  contasMatrizes,
  faturas,
  pacotes,
  recompensasEventos,
  recompensasProgresso,
  usuarios,
} from "../../database/schema";
import { MANUAL, MANUAL_VERSAO, type Bloco } from "../../../web/lib/manual-admin";

const DIACRITICOS = new RegExp("[\̀-\ͯ]", "g");

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICOS, "").trim();
}

/** transforma um bloco declarativo do manual em texto plano pesquisável */
function blocoEmTexto(b: Bloco): string {
  switch (b.tipo) {
    case "texto":
      return b.texto;
    case "passos":
      return [b.titulo ?? "", ...b.itens.map((i, n) => `${n + 1}. ${i}`)].join("\n");
    case "campos":
      return [b.titulo ?? "", ...b.itens.map((i) => `${i.termo}: ${i.desc}`)].join("\n");
    case "aviso":
      return `[${b.tom}] ${b.texto}`;
    case "tabela":
      return [
        b.titulo ?? "",
        b.colunas.join(" | "),
        ...b.linhas.map((l) => l.join(" | ")),
      ].join("\n");
  }
}

function secaoEmTexto(id: string) {
  const s = MANUAL.find((x) => x.id === id);
  if (!s) return null;
  return {
    id: s.id,
    titulo: s.titulo,
    ondeFicaNoPainel: s.onde,
    resumo: s.resumo,
    conteudo: s.blocos.map(blocoEmTexto).join("\n\n"),
  };
}

/** dias entre hoje e uma data ISO YYYY-MM-DD (negativo = já venceu) */
function diasAte(iso: string) {
  if (!iso) return null;
  const alvo = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export function ferramentasDoAdmin() {
  return {
    /* ---------------------------------------------------------------- */
    buscarNoManual: tool({
      description:
        "Busca no Manual Operacional do Admin as seções que explicam um procedimento do painel (repor conta, criar combo, Central de OTP, gamificação, faturas, cadastrar app, atender chamado, regras de ouro). Use SEMPRE que a pergunta for 'como faço X', 'onde fica X' ou 'como funciona X'.",
      inputSchema: z.object({
        consulta: z
          .string()
          .describe("termos da dúvida, ex.: 'repor conta matriz', 'otp', 'combo', 'inadimplente'"),
      }),
      async execute({ consulta }) {
        const termos = normalizar(consulta).split(/\s+/).filter((t) => t.length > 2);

        const pontuadas = MANUAL.map((s) => {
          const alvo = normalizar(
            [s.titulo, s.onde, s.resumo, ...s.blocos.map(blocoEmTexto)].join(" "),
          );
          const tituloNorm = normalizar(`${s.titulo} ${s.onde}`);
          let score = 0;
          for (const t of termos) {
            if (tituloNorm.includes(t)) score += 5;
            if (alvo.includes(t)) score += 2;
          }
          return { id: s.id, score };
        })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        const secoes = (pontuadas.length ? pontuadas.map((p) => p.id) : ["inicio", "regras"])
          .map(secaoEmTexto)
          .filter(Boolean);

        return {
          versaoDoManual: MANUAL_VERSAO,
          encontrouCorrespondencia: pontuadas.length > 0,
          secoes,
          indiceCompleto: MANUAL.map((s) => ({ id: s.id, titulo: s.titulo, onde: s.onde })),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    estoque: tool({
      description:
        "Situação real do estoque de contas matrizes: lotação (vagas ocupadas/total), status, região, vencimento da assinatura e quais contas estão lotadas ou vencendo. Use para perguntas sobre vagas, contas cheias, contas em manutenção ou renovações próximas.",
      inputSchema: z.object({
        servico: z
          .string()
          .optional()
          .describe("filtra por slug do serviço, ex.: 'netflix'. Omita para ver tudo."),
        apenas: z
          .enum(["todas", "lotadas", "comVaga", "manutencao", "vencendo"])
          .optional()
          .describe("recorte desejado. Padrão: todas."),
      }),
      async execute({ servico, apenas = "todas" }) {
        const rows = servico
          ? await db
              .select()
              .from(contasMatrizes)
              .where(eq(contasMatrizes.servico, normalizar(servico)))
          : await db.select().from(contasMatrizes);

        const contas = rows.map((c) => {
          const dias = diasAte(c.dataVencimento);
          return {
            id: c.id,
            rotulo: c.rotulo,
            servico: c.servico,
            emailDeLogin: c.email,
            vagas: `${c.vagasOcupadas}/${c.totalVagas}`,
            vagasLivres: Math.max(0, c.totalVagas - c.vagasOcupadas),
            lotada: c.vagasOcupadas >= c.totalVagas,
            status: c.status === "manutencao" ? "manutencao" : "ativo",
            regiao: c.regiao,
            custoMensal: brl(c.custo),
            vencimento: c.dataVencimento || "sem data",
            diasParaVencer: dias,
            cartaoUtilizado: c.cartaoUtilizado || "não informado",
          };
        });

        const filtradas = contas.filter((c) => {
          if (apenas === "lotadas") return c.lotada;
          if (apenas === "comVaga") return c.vagasLivres > 0 && c.status === "ativo";
          if (apenas === "manutencao") return c.status === "manutencao";
          if (apenas === "vencendo") return c.diasParaVencer !== null && c.diasParaVencer <= 5;
          return true;
        });

        return {
          totalDeContas: contas.length,
          vagasTotais: contas.reduce((s, c) => s + Number(c.vagas.split("/")[1] ?? 0), 0),
          vagasLivres: contas.reduce((s, c) => s + c.vagasLivres, 0),
          contasLotadas: contas.filter((c) => c.lotada).length,
          contasEmManutencao: contas.filter((c) => c.status === "manutencao").length,
          contasVencendoEm5Dias: contas.filter(
            (c) => c.diasParaVencer !== null && c.diasParaVencer <= 5,
          ).length,
          recorte: apenas,
          contas: filtradas.slice(0, 40),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    clientes: tool({
      description:
        "Base de clientes: pacote, ciclo, valor, status de pagamento, próxima cobrança e quantos apps estão alocados. Aceita busca por nome ou e-mail. Use para perguntas sobre um cliente específico ou sobre a carteira.",
      inputSchema: z.object({
        busca: z.string().optional().describe("nome ou e-mail do cliente. Omita para o panorama."),
        status: z
          .enum(["todos", "ativo", "pendente", "atrasado", "suspenso"])
          .optional()
          .describe("filtra por status de pagamento. Padrão: todos."),
      }),
      async execute({ busca, status = "todos" }) {
        const todos = await db.select().from(usuarios).where(eq(usuarios.admin, false));
        const listaPacotes = await db.select().from(pacotes);
        const nomeDoPacote = (id: number | null) =>
          listaPacotes.find((p) => p.id === id)?.nome ?? "sem pacote";

        const ativas = await db
          .select({ clienteId: alocacoes.clienteId })
          .from(alocacoes)
          .where(eq(alocacoes.status, "ativo"));
        const appsPorCliente = new Map<number, number>();
        for (const a of ativas) {
          appsPorCliente.set(a.clienteId, (appsPorCliente.get(a.clienteId) ?? 0) + 1);
        }

        const b = busca ? normalizar(busca) : "";
        const filtrados = todos.filter((u) => {
          const casaBusca =
            !b || normalizar(u.nome).includes(b) || normalizar(u.email).includes(b);
          const casaStatus = status === "todos" || u.statusPagamento === status;
          return casaBusca && casaStatus;
        });

        return {
          totalDaBase: todos.length,
          porStatus: {
            ativo: todos.filter((u) => u.statusPagamento === "ativo").length,
            pendente: todos.filter((u) => u.statusPagamento === "pendente").length,
            atrasado: todos.filter((u) => u.statusPagamento === "atrasado").length,
            suspenso: todos.filter((u) => u.statusPagamento === "suspenso").length,
          },
          receitaMensalRecorrente: brl(
            todos
              .filter((u) => u.statusPagamento !== "atrasado" && u.statusPagamento !== "suspenso")
              .reduce((s, u) => s + (u.ciclo === "anual" ? u.valor : u.valor), 0),
          ),
          encontrados: filtrados.length,
          clientes: filtrados.slice(0, 25).map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            telefone: u.telefone ?? "não informado",
            pacote: nomeDoPacote(u.pacoteId),
            ciclo: u.ciclo,
            valor: brl(u.valor),
            statusPagamento: u.statusPagamento,
            proximaCobranca: u.proximaCobranca || "sem data",
            clienteDesde: u.clienteDesde || "sem data",
            appsAtivos: appsPorCliente.get(u.id) ?? 0,
            codigoDeIndicacao: u.referralCode ?? "sem código",
          })),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    filaSuporte: tool({
      description:
        "Fila de chamados de suporte: quantidade por status e por tipo, com os chamados mais recentes e o cliente/serviço de cada um. Use para 'o que está pendente', 'quantos chamados abertos', 'qual problema mais aparece'.",
      inputSchema: z.object({
        status: z
          .enum(["todos", "aberto", "em_andamento", "resolvido"])
          .optional()
          .describe("padrão: todos"),
      }),
      async execute({ status = "todos" }) {
        const rows = await db.select().from(chamados).orderBy(desc(chamados.criadoEm));
        const nomes = new Map(
          (
            await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios)
          ).map((u) => [u.id, u.nome]),
        );

        const filtrados = status === "todos" ? rows : rows.filter((c) => c.status === status);
        const porTipo: Record<string, number> = {};
        for (const c of rows.filter((x) => x.status !== "resolvido")) {
          porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + 1;
        }

        return {
          total: rows.length,
          abertos: rows.filter((c) => c.status === "aberto").length,
          emAndamento: rows.filter((c) => c.status === "em_andamento").length,
          resolvidos: rows.filter((c) => c.status === "resolvido").length,
          tiposPendentesMaisComuns: porTipo,
          chamados: filtrados.slice(0, 20).map((c) => ({
            id: c.id,
            cliente: nomes.get(c.clienteId) ?? `cliente ${c.clienteId}`,
            servico: c.servico ?? "não informado",
            tipo: c.tipo,
            status: c.status,
            descricao: c.descricao.slice(0, 220),
            abertoEm: c.criadoEm.toISOString().slice(0, 10),
          })),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    codigosRecentes: tool({
      description:
        "Códigos de verificação (OTP) capturados pela Central de Códigos nas últimas horas, com serviço, destinatário, se estão vinculados a um cliente e se já expiraram (validade de 1 hora). Use para dúvidas sobre OTP e códigos não vinculados.",
      inputSchema: z.object({
        horas: z.number().optional().describe("janela de tempo em horas. Padrão: 24."),
      }),
      async execute({ horas = 24 }) {
        const limite = Date.now() - horas * 3_600_000;
        const rows = await db.select().from(codigosOtp).orderBy(desc(codigosOtp.recebidoEm));
        const nomes = new Map(
          (
            await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios)
          ).map((u) => [u.id, u.nome]),
        );

        const janela = rows.filter((c) => c.recebidoEm.getTime() >= limite);
        const agora = Date.now();

        return {
          janelaEmHoras: horas,
          totalNaJanela: janela.length,
          semClienteVinculado: janela.filter((c) => !c.clienteId).length,
          codigos: janela.slice(0, 20).map((c) => ({
            id: c.id,
            codigo: c.codigo,
            servico: c.servico,
            destinatario: c.destinatario,
            cliente: c.clienteId ? (nomes.get(c.clienteId) ?? "cliente removido") : "não vinculado",
            origem: c.origem,
            recebidoEm: c.recebidoEm.toISOString(),
            expirado: agora - c.recebidoEm.getTime() > 3_600_000,
          })),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    gamificacao: tool({
      description:
        "Resumo da gamificação e do programa de indicações: XP, níveis, ranking, indicações que viraram assinantes, prêmios liberados e avisos de prêmio pendentes de entrega. Use para 'quem indicou mais', 'tem prêmio para entregar', 'como está a jornada'.",
      inputSchema: z.object({}),
      async execute() {
        const progresso = await db.select().from(recompensasProgresso);
        const ids = progresso.map((p) => p.clienteId);
        const pessoas = ids.length
          ? await db
              .select({ id: usuarios.id, nome: usuarios.nome })
              .from(usuarios)
              .where(inArray(usuarios.id, ids))
          : [];
        const nomes = new Map(pessoas.map((u) => [u.id, u.nome]));

        const pendentes = await db
          .select()
          .from(recompensasEventos)
          .where(
            and(
              eq(recompensasEventos.notificarAdmin, true),
              eq(recompensasEventos.lidoPeloAdmin, false),
            ),
          )
          .orderBy(desc(recompensasEventos.criadoEm));

        const ranking = [...progresso].sort((a, b) => b.xp - a.xp).slice(0, 10);

        return {
          clientesComProgresso: progresso.length,
          xpTotalDistribuido: progresso.reduce((s, p) => s + p.xp, 0),
          indicacoesTotais: progresso.reduce((s, p) => s + p.indicacoes, 0),
          indicacoesQueViraramAssinantes: progresso.reduce(
            (s, p) => s + p.indicacoesAssinantes,
            0,
          ),
          avisosPendentesDeEntrega: pendentes.slice(0, 15).map((e) => ({
            cliente: nomes.get(e.clienteId) ?? `cliente ${e.clienteId}`,
            tipo: e.tipo,
            descricao: e.descricao,
            em: e.criadoEm.toISOString().slice(0, 10),
          })),
          ranking: ranking.map((p) => ({
            cliente: nomes.get(p.clienteId) ?? `cliente ${p.clienteId}`,
            xp: p.xp,
            nivel: p.nivel,
            indicacoes: p.indicacoes,
            indicacoesAssinantes: p.indicacoesAssinantes,
            renovacoes: p.renovacoes,
            mesesAtivo: p.mesesAtivo,
            missoesConcluidas: p.missoesConcluidas.length,
            premiosLiberados: p.premiosLiberados,
            premiosEntregues: p.premiosEntregues,
          })),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    financeiro: tool({
      description:
        "Resumo financeiro real: faturas por status, faturamento recebido e a receber, inadimplência, custo das contas matrizes e margem estimada. Use para perguntas de faturamento, inadimplência, custo e lucro.",
      inputSchema: z.object({
        competencia: z
          .string()
          .optional()
          .describe("mês no formato YYYY-MM. Omita para o mês corrente."),
      }),
      async execute({ competencia }) {
        const mes = competencia ?? new Date().toISOString().slice(0, 7);
        const todas = await db.select().from(faturas).orderBy(desc(faturas.competencia));
        const doMes = todas.filter((f) => f.competencia === mes);
        const nomes = new Map(
          (
            await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios)
          ).map((u) => [u.id, u.nome]),
        );

        const soma = (lista: typeof todas) => lista.reduce((s, f) => s + f.valorFinal, 0);
        const contas = await db.select().from(contasMatrizes);
        const custo = contas.reduce((s, c) => s + c.custo, 0);
        const recebido = soma(doMes.filter((f) => f.status === "pago"));

        return {
          competencia: mes,
          faturasNoMes: doMes.length,
          pagas: doMes.filter((f) => f.status === "pago").length,
          abertas: doMes.filter((f) => f.status === "aberto").length,
          vencidas: doMes.filter((f) => f.status === "vencido").length,
          recebido: brl(recebido),
          aReceber: brl(soma(doMes.filter((f) => f.status === "aberto"))),
          inadimplencia: brl(soma(doMes.filter((f) => f.status === "vencido"))),
          custoMensalDasMatrizes: brl(custo),
          margemEstimada: brl(recebido - custo),
          vencidasDetalhe: doMes
            .filter((f) => f.status === "vencido")
            .slice(0, 15)
            .map((f) => ({
              numero: f.numero,
              cliente: nomes.get(f.clienteId) ?? `cliente ${f.clienteId}`,
              valor: brl(f.valorFinal),
              vencimento: f.vencimento,
            })),
        };
      },
    }),

    /* ---------------------------------------------------------------- */
    catalogo: tool({
      description:
        "Catálogo de aplicativos, pacotes e combos ativos, com preços de venda, preço avulso de mercado e economia do combo. Use para dúvidas de preço, o que existe cadastrado e o que um pacote inclui.",
      inputSchema: z.object({}),
      async execute() {
        const apps = await db.select().from(aplicativos);
        const listaPacotes = await db.select().from(pacotes);
        const listaCombos = await db.select().from(combos);

        return {
          totalDeApps: apps.length,
          apps: apps.map((a) => ({
            slug: a.slug,
            nome: a.nome,
            categoria: a.categoria,
            precoPlayplusnow: brl(a.preco),
            precoAvulsoMercado: brl(a.precoAvulso),
            ativo: a.ativo,
          })),
          pacotes: listaPacotes.map((p) => ({
            nome: p.nome,
            preco: brl(p.preco),
            apps: p.servicos,
            ativo: p.ativo,
          })),
          combos: listaCombos.map((c) => ({
            nome: c.nome,
            preco: brl(c.preco),
            precoCheio: brl(c.precoCheio),
            economia: brl(Math.max(0, c.precoCheio - c.preco)),
            apps: c.apps,
          })),
        };
      },
    }),
  };
}
