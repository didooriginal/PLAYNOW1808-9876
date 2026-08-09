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
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  haQuantoTempo,
  useAlertasAdmin,
  useMarcarLida,
  useMarcarTodasLidas,
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
  const { data, isLoading } = useAlertasAdmin(apenasNaoLidas);
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();
  const varrer = useVarrerVencimentos();

  const itens = data?.itens ?? [];
  const naoLidas = data?.naoLidas ?? 0;
  const criticos = data?.criticos ?? 0;

  return (
    <div className="space-y-5" data-testid="alertas-view">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { rotulo: "Não lidos", valor: naoLidas, cor: "#a855f7" },
          { rotulo: "Críticos", valor: criticos, cor: "#ff1f3d" },
          { rotulo: "Na fila", valor: itens.length, cor: "#22d3ee" },
        ].map((c) => (
          <GlassCard key={c.rotulo} className="p-4">
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
              {c.rotulo}
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

      <div className="flex flex-wrap items-center gap-2">
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
        {naoLidas > 0 && (
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
                  className={`flex items-start gap-3 p-4 ${n.lida ? "opacity-60" : ""}`}
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
                      {!n.lida && (
                        <span className="size-1.5 rounded-full bg-neon-purple" aria-hidden />
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

                  {!n.lida && (
                    <button
                      type="button"
                      onClick={() => marcarLida.mutate({ ids: [n.id] })}
                      aria-label="Marcar como lido"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
                    >
                      <Check className="size-3.5" />
                    </button>
                  )}
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
