// CENTRAL DE ALERTAS DO ADMIN — fila operacional com gatilhos automaticos.
import { useState } from "react";
import {
  BellRing,
  Check,
  CheckCheck,
  CircleAlert,
  Info,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Ajuda, Tooltip } from "../ui/tooltip";
import { InterruptorResumo, usePreferenciaResumo } from "./resumo-entrada";
import { CanaisAlertaCard } from "./canais-alerta";
import {
  haQuantoTempo,
  useAlertasAdmin,
  useMarcarLida,
  useMarcarTodasLidas,
  useResolverAlerta,
  useVarrerVencimentos,
} from "../../queries/notificacoes";

const COR = { info: "#22d3ee", alerta: "#fbbf24", critico: "#ff1f3d" } as const;
const ICONE = { info: Info, alerta: TriangleAlert, critico: CircleAlert } as const;
type Severidade = keyof typeof COR;

const ROTULO_TIPO: Record<string, string> = {
  otp: "Código por e-mail",
  tv: "Desbloqueio de TV",
  vencimento: "Vencimento",
  pagamento: "Pagamento",
  sistema: "Sistema",
  chamado: "Suporte",
};

export function AlertasView({ onIr }: { onIr?: (destino: string) => void }) {
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);
  const [verResolvidos, setVerResolvidos] = useState(false);
  const [encerrando, setEncerrando] = useState<number[]>([]);
  const { data, isLoading } = useAlertasAdmin(apenasNaoLidas, verResolvidos);
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();
  const resolver = useResolverAlerta();
  const varrer = useVarrerVencimentos();
  const preferenciaResumo = usePreferenciaResumo();

  // some da tela na hora do clique, sem esperar o refetch
  function encerrar(id: number, reabrir = false) {
    setEncerrando((v) => [...v, id]);
    resolver.mutate(
      { ids: [id], reabrir },
      { onSettled: () => setEncerrando((v) => v.filter((x) => x !== id)) },
    );
  }

  const itens = (data?.itens ?? []).filter((n) => !encerrando.includes(n.id));
  const naoLidas = data?.naoLidas ?? 0;
  const criticos = data?.criticos ?? 0;

  return (
    <div className="space-y-5" data-testid="alertas-view">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { rotulo: "Não lidos", valor: naoLidas, cor: "#a855f7", ajuda: "alertas.filtroNaoLidas" },
          { rotulo: "Críticos", valor: criticos, cor: "#ff1f3d", ajuda: "alertas.fila" },
          { rotulo: "Na fila", valor: itens.length, cor: "#22d3ee", ajuda: "alertas.fila" },
        ].map((c) => (
          <GlassCard key={c.rotulo} className="p-4">
            <div className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
              {c.rotulo}
              <Ajuda ajuda={c.ajuda} />
            </div>
            <div
              className="mt-1 font-display text-2xl font-extrabold tabular-nums"
              style={{ color: c.cor }}
            >
              {c.valor}
            </div>
          </GlassCard>
        ))}
      </div>

      <CanaisAlertaCard />

      <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <InterruptorResumo
          ligado={preferenciaResumo.ligado}
          onAlternar={preferenciaResumo.alternar}
        />
        <div className="flex items-center gap-1.5 font-sans text-[11px] text-white/35">
          Pop-up de entrada
          <Ajuda ajuda="resumo.interruptor" />
        </div>
      </GlassCard>

      <div className="flex flex-wrap items-center gap-2">
        <Tooltip texto="alertas.filtroNaoLidas" titulo="Somente não lidos">
        <button
          type="button"
          data-testid="filtro-nao-lidas"
          onClick={() => setApenasNaoLidas((v) => !v)}
          className={`rounded-xl border px-3.5 py-2 font-sans text-[12px] transition-colors ${
            apenasNaoLidas
              ? "border-neon-purple/55 bg-neon-purple/12 text-white"
              : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25"
          }`}
        >
          Somente não lidos
        </button>
        </Tooltip>
        <Tooltip texto="alertas.verResolvidos" titulo="Ver encerrados">
        <button
          type="button"
          data-testid="filtro-resolvidos"
          onClick={() => setVerResolvidos((v) => !v)}
          className={`rounded-xl border px-3.5 py-2 font-sans text-[12px] transition-colors ${
            verResolvidos
              ? "border-neon-cyan/55 bg-neon-cyan/12 text-white"
              : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25"
          }`}
        >
          Ver encerrados
        </button>
        </Tooltip>
        <Tooltip texto="alertas.reavaliar" titulo="Reavaliar vencimentos">
        <NeonButton
          accent="purple"
          size="sm"
          data-testid="reavaliar-vencimentos"
          disabled={varrer.isPending}
          onClick={() => varrer.mutate({})}
        >
          {varrer.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Reavaliar vencimentos
        </NeonButton>
        </Tooltip>
        {naoLidas > 0 && (
          <Tooltip texto="alertas.marcarTodas" titulo="Marcar todas como lidas">
          <NeonButton
            accent="cyan"
            size="sm"
            variant="ghost"
            data-testid="marcar-todas"
            onClick={() => marcarTodas.mutate({ escopo: "admin" })}
          >
            <CheckCheck className="size-4" />
            Marcar todas como lidas
          </NeonButton>
          </Tooltip>
        )}
      </div>

      {isLoading ? (
        <GlassCard className="p-8 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-white/40" />
        </GlassCard>
      ) : itens.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <BellRing className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-display text-sm font-bold text-white">Fila limpa</p>
          <p className="mt-1 font-sans text-[12px] text-white/40">
            Nenhum alerta pendente. Novos gatilhos aparecem aqui em tempo real.
          </p>
        </GlassCard>
      ) : (
        <ul className="space-y-2">
          {itens.map((n) => {
            const sev = (n.severidade ?? "info") as Severidade;
            const Icone = ICONE[sev] ?? Info;
            const cor = COR[sev] ?? COR.info;
            return (
              <li key={n.id}>
                <GlassCard
                  className={`flex items-start gap-3 p-4 ${
                    n.resolvidoEm ? "opacity-45" : n.lida ? "opacity-60" : ""
                  }`}
                >
                  <span
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${cor}55`, background: `${cor}14` }}
                  >
                    <Icone className="size-4" style={{ color: cor }} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[13px] font-bold text-white">
                        {n.titulo}
                      </span>
                      <Pill accent={sev === "critico" ? "red" : sev === "alerta" ? "purple" : "cyan"}>
                        {ROTULO_TIPO[n.tipo] ?? n.tipo}
                      </Pill>
                      {n.resolvidoEm ? (
                        <Pill accent="cyan">
                          Encerrado{n.resolvidoPor === "auto" ? " automaticamente" : ""}
                        </Pill>
                      ) : (
                        !n.lida && (
                          <span className="size-1.5 rounded-full bg-neon-purple" aria-hidden />
                        )
                      )}
                    </div>
                    {n.mensagem && (
                      <p className="mt-1 font-sans text-[12px] leading-relaxed text-white/45">
                        {n.mensagem}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <span className="font-sans text-[10.5px] text-white/30">
                        {haQuantoTempo(n.criadoEm)}
                        {n.clienteNome ? ` · ${n.clienteNome}` : ""}
                      </span>
                      {n.destino && onIr && (
                        <button
                          type="button"
                          onClick={() => onIr(n.destino)}
                          className="font-sans text-[11px] text-neon-cyan underline-offset-2 hover:underline"
                        >
                          abrir
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {n.resolvidoEm ? (
                      <Tooltip texto="alertas.reabrir" titulo="Reabrir alerta">
                        <button
                          type="button"
                          data-testid={`reabrir-alerta-${n.id}`}
                          onClick={() => encerrar(n.id, true)}
                          aria-label="Reabrir alerta"
                          className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
                        >
                          <Undo2 className="size-3.5" />
                        </button>
                      </Tooltip>
                    ) : (
                      <>
                        {!n.lida && (
                          <Tooltip texto="alertas.marcarLida" titulo="Marcar como lido">
                            <button
                              type="button"
                              onClick={() => marcarLida.mutate({ ids: [n.id] })}
                              aria-label="Marcar como lido"
                              className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
                            >
                              <Check className="size-3.5" />
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip texto="alertas.resolver" titulo="Marcar como resolvido">
                          <button
                            type="button"
                            data-testid={`resolver-alerta-${n.id}`}
                            onClick={() => encerrar(n.id)}
                            aria-label="Marcar alerta como resolvido"
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 font-sans text-[11px] text-emerald-300 transition-colors hover:border-emerald-400/60"
                          >
                            <CheckCheck className="size-3.5" />
                            Resolvido
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
