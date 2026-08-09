import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Tv,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { useFilaTvNetflix, useResponderTv, haQuantoTempoTv, horaCurta } from "../../queries/netflix";

/**
 * SOLICITACOES DE TV NETFLIX — fila prioritaria do admin.
 *
 * Quando o cliente manda o codigo do netflix.com/tv2, ele fica parado na
 * frente da TV esperando. Por isso a fila e curta, atualiza sozinha a cada
 * 10s e a aprovacao e de 1 clique: copia o codigo, autoriza na conta e marca
 * como liberado — o painel do cliente reage automaticamente.
 */

const NETFLIX = "#e50914";

const ESTILO: Record<string, string> = {
  pendente: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  aprovado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  recusado: "border-neon-red/40 bg-neon-red/10 text-neon-red",
  cancelado: "border-white/15 bg-white/5 text-white/40",
};

export function NetflixTvView() {
  const { data, isPending } = useFilaTvNetflix();
  const responder = useResponderTv();
  const [copiado, setCopiado] = useState<number | null>(null);

  const itens = data?.itens ?? [];
  const pendentes = data?.pendentes ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Aguardando aprovação",
            value: String(pendentes),
            sub: pendentes ? "cliente parado na frente da TV" : "fila zerada",
            cor: pendentes ? "#f59e0b" : "#22d3ee",
          },
          {
            label: "Liberadas nas últimas 24h",
            value: String(data?.aprovadasHoje ?? 0),
            sub: "telas destravadas sem suporte humano",
            cor: "#34d399",
          },
          {
            label: "Total na janela",
            value: String(itens.length),
            sub: "solicitações das últimas 24h",
            cor: "#a855f7",
          },
        ].map((s) => (
          <GlassCard key={s.label} className="p-5" style={{ borderColor: `${s.cor}33` }}>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">{s.value}</div>
            <div className="mt-1 font-sans text-[11px]" style={{ color: s.cor }}>
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard strong className="overflow-hidden" style={{ borderColor: `${NETFLIX}44` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <Tv className="size-4" style={{ color: "#ff6b74" }} />
            <span className="font-display text-sm font-bold text-white">
              Solicitações de TV Netflix
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pendentes > 0 && (
              <Pill accent="red" icon={<AlertTriangle className="size-3" />}>
                {pendentes} com prioridade
              </Pill>
            )}
            <a
              href="https://www.netflix.com/account/travel-verification"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-sans text-[11px] text-white/40 transition-colors hover:text-white"
            >
              abrir Netflix <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        {isPending ? (
          <div className="flex items-center gap-3 px-5 py-6">
            <Loader2 className="size-4 animate-spin text-neon-purple" />
            <span className="font-sans text-xs text-white/40">Carregando fila...</span>
          </div>
        ) : itens.length === 0 ? (
          <p className="px-5 py-6 font-sans text-sm text-white/35">
            Nenhuma solicitação nas últimas 24 horas. Quando um cliente enviar o código do
            netflix.com/tv2 pelo painel dele, ele aparece aqui na hora.
          </p>
        ) : (
          <div className="divide-y divide-white/6">
            {itens.map((s) => {
              const pendente = s.status === "pendente";
              return (
                <div
                  key={s.id}
                  data-testid={`tv-solicitacao-${s.id}`}
                  className={cn(
                    "flex flex-wrap items-center gap-4 px-5 py-4 transition-colors",
                    pendente ? "bg-amber-400/[0.04]" : "hover:bg-white/[0.02]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(s.codigoTv);
                      setCopiado(s.id);
                      setTimeout(() => setCopiado(null), 1800);
                    }}
                    title="Copiar código da TV"
                    className="flex items-center gap-2 rounded-xl border px-4 py-2 transition-colors"
                    style={{ borderColor: `${NETFLIX}55`, background: `${NETFLIX}12` }}
                  >
                    <span
                      className="font-display text-lg font-extrabold tracking-[0.2em]"
                      style={{ color: "#ff6b74" }}
                    >
                      {s.codigoTv}
                    </span>
                    {copiado === s.id ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5 text-white/40" />
                    )}
                  </button>

                  <div className="min-w-[170px] flex-1">
                    <div className="font-display text-sm font-bold text-white">
                      {s.clienteNome ?? "Cliente removido"}
                    </div>
                    <div className="font-sans text-[11px] text-white/35">
                      {s.clienteEmail ?? "—"} · {s.dispositivo || "dispositivo não informado"}
                    </div>
                  </div>

                  <div className="min-w-[150px] font-sans text-[11px] text-white/40">
                    <div className="text-white/55">{s.contaRotulo ?? "sem matriz vinculada"}</div>
                    <div className="font-mono text-[10.5px] text-white/30">
                      {s.contaEmail ?? "—"}
                    </div>
                  </div>

                  <div className="w-28 font-sans text-[11px] text-white/35">
                    {haQuantoTempoTv(s.criadoEm)}
                    <div className="text-white/25">{horaCurta(s.criadoEm)}</div>
                  </div>

                  {pendente ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <NeonButton
                        accent="cyan"
                        size="sm"
                        data-testid={`tv-aprovar-${s.id}`}
                        disabled={responder.isPending}
                        onClick={() =>
                          responder.mutate({ id: s.id, status: "aprovado", resposta: "" })
                        }
                      >
                        {responder.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        Aprovar
                      </NeonButton>
                      <NeonButton
                        accent="red"
                        variant="outline"
                        size="sm"
                        data-testid={`tv-recusar-${s.id}`}
                        disabled={responder.isPending}
                        onClick={() =>
                          responder.mutate({ id: s.id, status: "recusado", resposta: "" })
                        }
                      >
                        <X className="size-3.5" />
                        Recusar
                      </NeonButton>
                    </div>
                  ) : (
                    <div className="flex min-w-[150px] flex-col items-end gap-1">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest",
                          ESTILO[s.status] ?? ESTILO.cancelado,
                        )}
                      >
                        {s.status}
                      </span>
                      {s.respostaAdmin && (
                        <span className="max-w-[220px] text-right font-sans text-[10.5px] text-white/30">
                          {s.respostaAdmin}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-white/45">
          Como liberar em 1 minuto
        </div>
        <ol className="mt-3 space-y-2">
          {[
            "Copie o código da TV clicando nele aqui na fila.",
            "Abra a Netflix logado na conta matriz indicada ao lado do cliente.",
            "Acesse netflix.com/tv2 (ou o link de verificação) e cole o código.",
            "Confirme a autorização e volte aqui para tocar em Aprovar.",
            "O painel do cliente muda para liberado em até 10 segundos e a TV destrava sozinha.",
          ].map((passo, i) => (
            <li key={passo} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-neon-purple/40 bg-neon-purple/10 font-display text-[11px] font-bold text-neon-purple">
                {i + 1}
              </span>
              <span className="font-sans text-[12.5px] leading-relaxed text-white/60">{passo}</span>
            </li>
          ))}
        </ol>
      </GlassCard>
    </div>
  );
}

export default NetflixTvView;
