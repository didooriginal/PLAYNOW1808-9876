/**
 * ACESSOS — ponte entre o que o cliente COMPROU e a vaga que ele OCUPA.
 *
 * Antes desta camada só o pacote gerava vaga: quem comprava app avulso no
 * montador pagava e o dashboard não mostrava nada. Aqui o direito (pacote,
 * combo, avulso ou prêmio) vira sempre uma alocação real — e, quando não há
 * estoque, vira uma posição na fila com alerta crítico para o admin, para que
 * nenhum cliente pago fique sem acesso em silêncio.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import {
  alocacoes,
  assinaturasApps,
  contasMatrizes,
  filaVagas,
  pacotes,
  usuarios,
} from "../database/schema";
import { notificar } from "../routes/notificacoes";
import { linkWhats, numeroAdmin } from "./whats";
import { resolverServico } from "./planos";

const hojeIso = () => new Date().toISOString().slice(0, 10);

/** recalcula `vagasOcupadas` da conta a partir das alocações ativas */
export async function sincronizarVagas(contaId: number) {
  const ativas = await db
    .select({ id: alocacoes.id })
    .from(alocacoes)
    .where(and(eq(alocacoes.contaId, contaId), eq(alocacoes.status, "ativo")));
  await db
    .update(contasMatrizes)
    .set({ vagasOcupadas: ativas.length })
    .where(eq(contasMatrizes.id, contaId));
  return ativas.length;
}

export type ResultadoAlocacao = {
  alocacao: typeof alocacoes.$inferSelect | null;
  /** ja_tinha | alocado | sem_vaga | sem_conta */
  motivo: "ja_tinha" | "alocado" | "sem_vaga" | "sem_conta";
};

/**
 * Garante que o cliente tenha uma vaga ativa no serviço informado.
 * Idempotente: se já existe alocação ativa, devolve a existente.
 *
 * Devolve SEMPRE um motivo — antes retornava `null` puro e quem chamava não
 * conseguia distinguir "acabou o estoque" de "esse app nem tem conta matriz
 * cadastrada", então o cliente ficava sem acesso em silêncio.
 *
 * Regras de escolha da conta, nesta ordem:
 *  - fora contas desligadas (`ativa = false`), em manutenção ou que não
 *    aceitam novos;
 *  - fora o pool de dias de jogo (rotatividade alta, não serve de casa fixa);
 *  - contas de reserva ficam por último — só entram quando não há outra;
 *  - entre as elegíveis, a que tem mais vagas livres (espalha o risco).
 */
export async function garantirAlocacao(
  clienteId: number,
  servico: string,
  opcoes: { excluirContaId?: number; permitirReserva?: boolean } = {},
): Promise<ResultadoAlocacao> {
  const [existente] = await db
    .select()
    .from(alocacoes)
    .where(
      and(
        eq(alocacoes.clienteId, clienteId),
        eq(alocacoes.servico, servico),
        eq(alocacoes.status, "ativo"),
      ),
    );
  if (existente) return { alocacao: existente, motivo: "ja_tinha" };

  const contas = await db
    .select()
    .from(contasMatrizes)
    .where(eq(contasMatrizes.servico, servico));
  if (!contas.length) return { alocacao: null, motivo: "sem_conta" };

  const elegiveis = contas.filter(
    (c) =>
      c.id !== opcoes.excluirContaId &&
      c.ativa &&
      c.status === "ativo" &&
      c.aceitaNovos &&
      !c.poolJogos &&
      (opcoes.permitirReserva !== false || !c.reserva) &&
      c.vagasOcupadas < c.totalVagas,
  );

  const ordenadas = [...elegiveis].sort((a, b) => {
    // conta comum antes de conta de reserva
    if (a.reserva !== b.reserva) return a.reserva ? 1 : -1;
    return b.totalVagas - b.vagasOcupadas - (a.totalVagas - a.vagasOcupadas);
  });

  const livre = ordenadas[0];
  if (!livre) return { alocacao: null, motivo: "sem_vaga" };

  const [row] = await db
    .insert(alocacoes)
    .values({ clienteId, contaId: livre.id, servico })
    .returning();
  await sincronizarVagas(livre.id);
  return { alocacao: row ?? null, motivo: row ? "alocado" : "sem_vaga" };
}

export type OrigemAssinatura = "pacote" | "combo" | "avulso" | "premio";

/**
 * Registra (ou reativa) o direito de uso de um app pelo cliente.
 * Idempotente por `cliente + servico`: comprar duas vezes o mesmo app não
 * cria duas linhas, só atualiza o vencimento.
 */
export async function registrarAssinaturaApp(entrada: {
  clienteId: number;
  servico: string;
  origem: OrigemAssinatura;
  ciclo?: string;
  valor?: number;
  proximaCobranca?: string;
  expiraEm?: string;
}) {
  const [existente] = await db
    .select()
    .from(assinaturasApps)
    .where(
      and(
        eq(assinaturasApps.clienteId, entrada.clienteId),
        eq(assinaturasApps.servico, entrada.servico),
      ),
    );

  const valores = {
    origem: entrada.origem,
    ciclo: entrada.ciclo ?? "mensal",
    valor: entrada.valor ?? 0,
    proximaCobranca: entrada.proximaCobranca ?? "",
    expiraEm: entrada.expiraEm ?? "",
    status: "ativo" as const,
  };

  if (existente) {
    const [row] = await db
      .update(assinaturasApps)
      .set(valores)
      .where(eq(assinaturasApps.id, existente.id))
      .returning();
    return row ?? existente;
  }

  const [row] = await db
    .insert(assinaturasApps)
    .values({
      clienteId: entrada.clienteId,
      servico: entrada.servico,
      inicioEm: hojeIso(),
      ...valores,
    })
    .returning();
  return row ?? null;
}

/** Encerra o direito (cancelamento, prêmio vencido, troca de pacote). */
export async function encerrarAssinaturaApp(
  clienteId: number,
  servico: string,
  status: "cancelado" | "expirado" = "cancelado",
) {
  await db
    .update(assinaturasApps)
    .set({ status })
    .where(and(eq(assinaturasApps.clienteId, clienteId), eq(assinaturasApps.servico, servico)));

  const ativas = await db
    .select()
    .from(alocacoes)
    .where(
      and(
        eq(alocacoes.clienteId, clienteId),
        eq(alocacoes.servico, servico),
        eq(alocacoes.status, "ativo"),
      ),
    );
  for (const a of ativas) {
    await db
      .update(alocacoes)
      .set({ status: "liberado", motivo: "troca_pacote", liberadoEm: new Date() })
      .where(eq(alocacoes.id, a.id));
    await sincronizarVagas(a.contaId);
  }
  await sairDaFila(clienteId, servico);
}

/**
 * Todos os apps a que o cliente tem direito hoje: os do pacote contratado
 * (fonte legada, continua valendo) + tudo que estiver ativo em
 * `assinaturas_apps` (avulsos, combos e prêmios).
 */
export async function direitosDoCliente(clienteId: number): Promise<string[]> {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
  if (!cliente) return [];

  const doPacote = cliente.pacoteId
    ? ((await db.select().from(pacotes).where(eq(pacotes.id, cliente.pacoteId)))[0]?.servicos ?? [])
    : [];

  const extras = await db
    .select({ servico: assinaturasApps.servico })
    .from(assinaturasApps)
    .where(
      and(eq(assinaturasApps.clienteId, clienteId), eq(assinaturasApps.status, "ativo")),
    );

  return [...new Set([...doPacote, ...extras.map((e) => e.servico)])];
}

/** Coloca o cliente na fila de espera daquele app (sem duplicar). */
export async function entrarNaFila(clienteId: number, servico: string, motivo: string) {
  const [existente] = await db
    .select()
    .from(filaVagas)
    .where(
      and(
        eq(filaVagas.clienteId, clienteId),
        eq(filaVagas.servico, servico),
        eq(filaVagas.status, "aguardando"),
      ),
    );
  if (existente) return existente;

  const [row] = await db
    .insert(filaVagas)
    .values({ clienteId, servico, motivo })
    .returning();
  return row ?? null;
}

/** Tira o cliente da fila quando a vaga finalmente saiu. */
export async function sairDaFila(clienteId: number, servico: string) {
  await db
    .update(filaVagas)
    .set({ status: "atendido", atendidoEm: new Date() })
    .where(
      and(
        eq(filaVagas.clienteId, clienteId),
        eq(filaVagas.servico, servico),
        eq(filaVagas.status, "aguardando"),
      ),
    );
}

/** Alerta crítico no painel + link de WhatsApp pronto para o admin. */
async function avisarSemVaga(cliente: { id: number; nome: string }, servico: string, motivo: string) {
  const mensagem =
    `PLAYPLUSNOW — SEM VAGA\n` +
    `Cliente: ${cliente.nome} (#${cliente.id})\n` +
    `App: ${servico}\n` +
    `Motivo: ${motivo}\n` +
    `Ação: abrir vaga ou cadastrar nova conta matriz agora.`;

  await notificar({
    escopo: "admin",
    clienteId: cliente.id,
    tipo: "sistema",
    severidade: "critico",
    titulo: `Sem vaga de ${servico} para ${cliente.nome}`,
    mensagem,
    destino: linkWhats(numeroAdmin(), mensagem),
    // uma notificação por cliente+app+dia — não spamma o painel
    chave: `sem-vaga:${cliente.id}:${servico}:${hojeIso()}`,
  });
}

export type ResultadoSincronizacao = {
  alocados: { servico: string; contaId: number }[];
  jaTinham: string[];
  semVaga: string[];
  /** opções entregues por convite do provedor — não usam vaga */
  convites: string[];
};

/**
 * Garante uma vaga ativa para CADA app a que o cliente tem direito.
 * É o coração do "cliente nunca fica sem acesso": chamado depois de qualquer
 * compra, troca de pacote, prêmio ou remanejo de conta.
 */
export async function sincronizarAcessosDoCliente(
  clienteId: number,
  motivo = "compra",
): Promise<ResultadoSincronizacao> {
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.id, clienteId));
  const resultado: ResultadoSincronizacao = { alocados: [], jaTinham: [], semVaga: [], convites: [] };
  if (!cliente) return resultado;

  for (const servico of await direitosDoCliente(clienteId)) {
    // opções entregues por CONVITE (ex.: Netflix individual, onde o admin
    // cadastra o e-mail do cliente como membro extra) não consomem vaga de
    // conta matriz: quem manda o acesso é o próprio provedor. Elas aparecem
    // na fila de convites do admin, não na fila de vagas.
    const resolvido = await resolverServico(servico);
    if (resolvido?.entrega === "convite") {
      resultado.convites.push(servico);
      await sairDaFila(clienteId, servico);
      continue;
    }

    const { alocacao, motivo: resposta } = await garantirAlocacao(clienteId, servico);

    if (alocacao && resposta === "ja_tinha") {
      resultado.jaTinham.push(servico);
      await sairDaFila(clienteId, servico);
      continue;
    }
    if (alocacao) {
      resultado.alocados.push({ servico, contaId: alocacao.contaId });
      await sairDaFila(clienteId, servico);
      continue;
    }

    resultado.semVaga.push(servico);
    await entrarNaFila(clienteId, servico, motivo);
    await avisarSemVaga(cliente, servico, motivo);
  }

  return resultado;
}

export type ResultadoRealocacao = {
  liberadas: number;
  realocados: { clienteId: number; nome: string; servico: string; contaId: number }[];
  semVaga: { clienteId: number; nome: string; servico: string; linkWhats: string }[];
};

/**
 * Esvazia uma conta matriz e RECOLOCA cada cliente em outra conta.
 *
 * Usado pelo "Repor conta", pelo liga/desliga e pela remoção. Antes disso, o
 * repor apenas soltava todo mundo e os clientes ficavam sem acesso nenhum até
 * alguém perceber. Agora quem não consegue vaga entra na fila e gera alerta
 * crítico com link de WhatsApp para o admin.
 */
export async function realocarClientes(
  contaId: number,
  motivo: "reposicao" | "conta_desligada" | "manual" = "reposicao",
): Promise<ResultadoRealocacao> {
  const ativas = await db
    .select()
    .from(alocacoes)
    .where(and(eq(alocacoes.contaId, contaId), eq(alocacoes.status, "ativo")));

  const resultado: ResultadoRealocacao = { liberadas: 0, realocados: [], semVaga: [] };
  if (!ativas.length) {
    await sincronizarVagas(contaId);
    return resultado;
  }

  const ids = [...new Set(ativas.map((a) => a.clienteId))];
  const clientes = await db.select().from(usuarios).where(inArray(usuarios.id, ids));
  const nomeDe = (id: number) => clientes.find((c) => c.id === id)?.nome ?? `Cliente #${id}`;

  // 1) solta as vagas (sem apagar linha nem cadastro — só histórico)
  await db
    .update(alocacoes)
    .set({
      status: "liberado",
      motivo: motivo === "conta_desligada" ? "reposicao" : motivo,
      liberadoEm: new Date(),
    })
    .where(and(eq(alocacoes.contaId, contaId), eq(alocacoes.status, "ativo")));
  await sincronizarVagas(contaId);
  resultado.liberadas = ativas.length;

  // 2) recoloca cada um em OUTRA conta (a de origem fica de fora)
  for (const antiga of ativas) {
    const { alocacao } = await garantirAlocacao(antiga.clienteId, antiga.servico, {
      excluirContaId: contaId,
    });

    if (alocacao) {
      resultado.realocados.push({
        clienteId: antiga.clienteId,
        nome: nomeDe(antiga.clienteId),
        servico: antiga.servico,
        contaId: alocacao.contaId,
      });
      await sairDaFila(antiga.clienteId, antiga.servico);
      continue;
    }

    const cliente = { id: antiga.clienteId, nome: nomeDe(antiga.clienteId) };
    await entrarNaFila(antiga.clienteId, antiga.servico, motivo);
    await avisarSemVaga(cliente, antiga.servico, motivo);

    const mensagem =
      `PLAYPLUSNOW — cliente sem vaga após ${motivo === "conta_desligada" ? "desligar conta" : "reposição"}\n` +
      `${cliente.nome} (#${cliente.id}) — ${antiga.servico}`;
    resultado.semVaga.push({
      clienteId: cliente.id,
      nome: cliente.nome,
      servico: antiga.servico,
      linkWhats: linkWhats(numeroAdmin(), mensagem),
    });
  }

  return resultado;
}

/**
 * Varre a fila de espera de um serviço e tenta acomodar quem está aguardando.
 * Chamado quando uma vaga é liberada ou uma conta nova entra no ar.
 */
export async function atenderFila(servico?: string) {
  const espera = await db
    .select()
    .from(filaVagas)
    .where(
      servico
        ? and(eq(filaVagas.status, "aguardando"), eq(filaVagas.servico, servico))
        : eq(filaVagas.status, "aguardando"),
    );

  const atendidos: { clienteId: number; servico: string }[] = [];
  for (const item of espera) {
    const { alocacao } = await garantirAlocacao(item.clienteId, item.servico);
    if (!alocacao) continue;
    await sairDaFila(item.clienteId, item.servico);
    atendidos.push({ clienteId: item.clienteId, servico: item.servico });
  }
  return atendidos;
}

/** Contas matrizes de um serviço com vaga livre — usado nos avisos do admin. */
export async function vagasLivres(servico: string) {
  const contas = await db
    .select()
    .from(contasMatrizes)
    .where(eq(contasMatrizes.servico, servico));
  return contas
    .filter((c) => c.ativa && c.status === "ativo" && c.vagasOcupadas < c.totalVagas)
    .reduce((total, c) => total + (c.totalVagas - c.vagasOcupadas), 0);
}
