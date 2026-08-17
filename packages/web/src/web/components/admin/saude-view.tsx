import { useState } from "react";
import { Activity, ArrowRightLeft, Check, Clock3, HeartPulse, Loader2, MessageCircle, PackageSearch, RefreshCw, ShieldAlert, X } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, ProgressBar } from "../ui/kit";
import { Ajuda, Tooltip } from "../ui/tooltip";
import {
  useAlternarReserva,
  useFalhasRecentes,
  useLiberarEntrada,
  usePainelSaude,
  useRemanejarConta,
  useVarrerSaude,
} from "../../queries/saude";
import { useFilaVagas, useResolverFila } from "../../queries/contas";

/**
 * SAÚDE DAS CONTAS + ESTOQUE INTELIGENTE.
 * Aqui o admin enxerga o que costuma só aparecer no grito do cliente:
 * conta que está falhando demais (e já parou de receber gente nova) e
 * serviço com estoque no limite (hora de comprar matriz).
 */

const ROTULO_FALHA: Record<string, string> = {
  senha_incorreta: "Senha incorreta",
  sem_credito: "Sem crédito",
  erro_login: "Erro de login",
  tela_ocupada: "Tela ocupada",
  outro: "Outro",
};

export function SaudeView() {
  const { data, isLoading } = usePainelSaude();
  const falhas = useFalhasRecentes();
  const varrer = useVarrerSaude();
  const alternarReserva = useAlternarReserva();
  const liberar = useLiberarEntrada();
  const remanejar = useRemanejarConta();
  const fila = useFilaVagas();
  const resolverFila = useResolverFila();
  // itens que sumiram da tela no clique + recado de quando nao deu pra alocar
  const [encerrando, setEncerrando] = useState<number[]>([]);
  const [recado, setRecado] = useState<Record<number, string>>({});

  const MOTIVO_FALHA: Record<string, string> = {
    sem_vaga: "Ainda não há vaga livre nesse app — abra uma vaga ou cadastre outra conta matriz.",
    sem_conta: "Nenhuma conta matriz cadastrada para esse app.",
  };

  function resolverItem(id: number, acao: "atendido" | "cancelado") {
    setEncerrando((v) => [...v, id]);
    setRecado((r) => ({ ...r, [id]: "" }));
    resolverFila.mutate(
      { id, acao },
      {
        onSuccess: (res) => {
          if (!res.ok)
            setRecado((r) => ({
              ...r,
              [id]: MOTIVO_FALHA[res.motivo] ?? "Não foi possível alocar agora.",
            }));
        },
        onSettled: () => setEncerrando((v) => v.filter((x) => x !== id)),
      },
    );
  }

  if (isLoading) return <p className="font-sans text-sm text-white/40">Analisando as contas…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="p-5">
          <HeartPulse className="size-5 text-neon-cyan" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{data?.resumo.contas ?? 0}</div>
          <div className="font-sans text-xs text-white/40">contas monitoradas</div>
        </GlassCard>
        <GlassCard accent={data?.resumo.pausadas ? "red" : undefined} className="p-5">
          <ShieldAlert className={data?.resumo.pausadas ? "size-5 text-neon-red" : "size-5 text-white/30"} />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{data?.resumo.pausadas ?? 0}</div>
          <div className="font-sans text-xs text-white/40">pausadas para novos clientes</div>
        </GlassCard>
        <GlassCard className="p-5">
          <ArrowRightLeft className="size-5 text-neon-purple" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{data?.resumo.reservas ?? 0}</div>
          <div className="font-sans text-xs text-white/40">contas de reserva disponíveis</div>
        </GlassCard>
        <GlassCard accent={data?.resumo.servicosNoLimite ? "red" : undefined} className="p-5">
          <PackageSearch className={data?.resumo.servicosNoLimite ? "size-5 text-neon-red" : "size-5 text-white/30"} />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{data?.resumo.servicosNoLimite ?? 0}</div>
          <div className="font-sans text-xs text-white/40">serviços acima de {data?.alertaOcupacao ?? 95}%</div>
        </GlassCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl font-sans text-xs text-white/40">
          Uma conta é pausada automaticamente ao acumular{" "}
          <span className="text-white/60">{data?.limiteFalhas ?? 3} falhas em 30 dias</span>. Os
          clientes que já estão nela continuam ativos — use "Remanejar" para movê-los para uma conta
          de reserva do mesmo serviço.
        </p>
        <NeonButton accent="cyan" onClick={() => varrer.mutate({})} disabled={varrer.isPending}>
          {varrer.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Reavaliar agora
        </NeonButton>
      </div>

      {/* -------- fila de espera -------- */}
      <GlassCard accent={fila.data?.length ? "red" : undefined} className="p-5">
        <span className="font-display text-sm font-bold text-white">Fila de espera por vaga</span>
        <Ajuda ajuda="saude.fila" lado="bottom" />
        <div className="mt-4 space-y-2">
          {(fila.data ?? []).filter((f) => !encerrando.includes(f.id)).map((f) => (
            <div
              key={f.id}
              data-testid={`fila-vaga-${f.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AppIcon id={f.servico} size="xs" />
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold text-white">
                    {f.nome}
                  </div>
                  <div className="font-sans text-[11px] text-white/35">
                    {f.servico} · aguardando desde{" "}
                    {new Date(f.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill accent="red">
                  <Clock3 className="size-3" />
                  na fila
                </Pill>
                {f.linkWhats && (
                  <a
                    href={f.linkWhats}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Avisar ${f.nome} pelo WhatsApp`}
                    className="flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
                  >
                    <MessageCircle className="size-3.5" />
                    WhatsApp
                  </a>
                )}
                <Tooltip texto="saude.resolverFila" titulo="Marcar como resolvido">
                  <button
                    type="button"
                    data-testid={`resolver-fila-${f.id}`}
                    onClick={() => resolverItem(f.id, "atendido")}
                    aria-label={`Marcar vaga de ${f.nome} como resolvida`}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 font-sans text-[11px] text-emerald-300 transition-colors hover:border-emerald-400/60"
                  >
                    <Check className="size-3.5" />
                    Resolvido
                  </button>
                </Tooltip>
                <Tooltip texto="saude.cancelarFila" titulo="Cancelar pedido">
                  <button
                    type="button"
                    data-testid={`cancelar-fila-${f.id}`}
                    onClick={() => resolverItem(f.id, "cancelado")}
                    aria-label={`Cancelar pedido de vaga de ${f.nome}`}
                    className="flex size-8 items-center justify-center rounded-lg border border-white/12 text-white/45 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                  >
                    <X className="size-3.5" />
                  </button>
                </Tooltip>
              </div>
              {recado[f.id] && (
                <p className="w-full font-sans text-[11px] text-amber-300/90">{recado[f.id]}</p>
              )}
            </div>
          ))}
          {!fila.data?.length && (
            <p className="font-sans text-xs text-white/35">
              Ninguém esperando vaga — todos os clientes pagos estão alocados.
            </p>
          )}
        </div>
      </GlassCard>

      {/* -------- estoque por serviço -------- */}
      <GlassCard className="p-5">
        <span className="font-display text-sm font-bold text-white">Estoque por serviço</span>
        <Ajuda ajuda="saude.estoquePorServico" lado="bottom" />
        <div className="mt-4 space-y-3">
          {(data?.estoque ?? []).map((e) => (
            <div key={e.servico} className="rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AppIcon id={e.servico} size="xs" />
                  <span className="font-display text-sm font-semibold text-white">{e.servico}</span>
                  <span className="font-sans text-[11px] text-white/35">{e.contas} conta(s)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-sans text-[11px] text-white/45">
                    {e.ocupadas}/{e.totalVagas} vagas
                  </span>
                  <Pill accent={e.ocupacao >= (data?.alertaOcupacao ?? 95) ? "red" : "cyan"}>
                    {e.ocupacao}%
                  </Pill>
                </div>
              </div>
              <ProgressBar value={e.ocupadas} max={e.totalVagas || 1} className="mt-3" />
            </div>
          ))}
          {!data?.estoque.length && (
            <p className="font-sans text-xs text-white/35">Nenhuma conta cadastrada ainda.</p>
          )}
        </div>
      </GlassCard>

      {/* -------- contas em risco -------- */}
      <GlassCard className="p-5">
        <span className="font-display text-sm font-bold text-white">Contas com falhas</span>
        <Ajuda ajuda="saude.contasFalhas" lado="bottom" />
        <div className="mt-4 space-y-2">
          {(data?.emRisco ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">{c.rotulo}</div>
                <div className="font-sans text-[11px] text-white/35">
                  {c.falhasRecentes} falha(s) em 30 dias · {c.vagasOcupadas}/{c.totalVagas} vagas
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill accent={c.aceitaNovos ? "cyan" : "red"}>
                  {c.aceitaNovos ? "recebendo novos" : "entrada pausada"}
                </Pill>
                <button
                  type="button"
                  onClick={() => liberar.mutate({ contaId: c.id, aceitaNovos: !c.aceitaNovos })}
                  className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
                >
                  {c.aceitaNovos ? "Pausar entrada" : "Religar entrada"}
                </button>
                <button
                  type="button"
                  onClick={() => alternarReserva.mutate({ contaId: c.id, reserva: !c.reserva })}
                  className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
                >
                  {c.reserva ? "Tirar de reserva" : "Marcar reserva"}
                </button>
                <button
                  type="button"
                  onClick={() => remanejar.mutate({ contaId: c.id })}
                  disabled={remanejar.isPending}
                  className="rounded-lg border border-neon-purple/40 bg-neon-purple/10 px-3 py-1.5 font-sans text-[11px] text-neon-purple hover:bg-neon-purple/20"
                >
                  Remanejar clientes
                </button>
              </div>
            </div>
          ))}
          {!data?.emRisco.length && (
            <p className="font-sans text-xs text-white/35">
              Nenhuma conta com falha registrada nos últimos 30 dias. Operação limpa.
            </p>
          )}
        </div>
        {remanejar.data && (
          <p className="mt-3 font-sans text-xs text-neon-cyan">
            {remanejar.data.movidos} cliente(s) remanejado(s).{" "}
            {remanejar.data.motivo || "Vagas atualizadas."}
          </p>
        )}
      </GlassCard>

      {/* -------- log de falhas -------- */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-neon-red" />
          <span className="font-display text-sm font-bold text-white">Últimas falhas relatadas</span>
          <Ajuda ajuda="saude.ultimasFalhas" lado="bottom" />
        </div>
        <div className="mt-4 space-y-1.5">
          {(falhas.data ?? []).map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
              <span className="font-sans text-xs text-white/70">
                {ROTULO_FALHA[f.tipo] ?? f.tipo} · {f.conta ?? f.servico ?? "sem conta"}
              </span>
              <span className="font-sans text-[11px] text-white/30">
                {f.cliente} · {new Date(f.criadoEm).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
          {!falhas.data?.length && (
            <p className="font-sans text-xs text-white/35">Nenhum chamado de acesso em 30 dias.</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default SaudeView;
