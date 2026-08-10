import { Check, Copy, HeartHandshake, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useEncerrarWinback,
  useMarcarWinbackEnviado,
  usePainelWinback,
  useVarrerWinback,
} from "../../queries/winback";

/**
 * RECUPERAÇÃO (WIN-BACK) — fila de quem saiu e pode voltar.
 * A régua roda sozinha: 15, 30 e 60 dias de inatividade, com cupom crescente.
 * O admin só dispara a mensagem (já escrita) e marca o resultado.
 */

const ROTULO_ETAPA: Record<number, string> = {
  1: "1ª tentativa",
  2: "2ª tentativa",
  3: "última chance",
};

export function RecuperacaoView() {
  const { data, isLoading } = usePainelWinback();
  const varrer = useVarrerWinback();
  const marcar = useMarcarWinbackEnviado();
  const encerrar = useEncerrarWinback();
  const [copiado, setCopiado] = useState<number | null>(null);

  if (isLoading) return <p className="font-sans text-sm text-white/40">Montando a fila…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard accent="red" className="p-5">
          <HeartHandshake className="size-5 text-neon-red" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {data?.resumo.pendentes ?? 0}
          </div>
          <div className="font-sans text-xs text-white/40">ofertas prontas para disparar</div>
        </GlassCard>
        <GlassCard className="p-5">
          <MessageCircle className="size-5 text-neon-cyan" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {data?.resumo.enviados ?? 0}
          </div>
          <div className="font-sans text-xs text-white/40">aguardando resposta</div>
        </GlassCard>
        <GlassCard className="p-5">
          <Check className="size-5 text-emerald-400" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {data?.resumo.recuperados ?? 0}
          </div>
          <div className="font-sans text-xs text-white/40">clientes recuperados</div>
        </GlassCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl font-sans text-xs text-white/40">
          A régua entra em quem está suspenso ou cancelado há mais de{" "}
          <span className="text-white/60">{data?.dias ?? 15} dias</span>, com cupom base de{" "}
          <span className="text-white/60">{data?.descontoBase ?? 30}%</span> que sobe nas etapas
          seguintes. Ao marcar como enviado, o cupom já fica preso na conta do cliente.
        </p>
        <NeonButton accent="cyan" onClick={() => varrer.mutate({})} disabled={varrer.isPending}>
          {varrer.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Atualizar fila
        </NeonButton>
      </div>

      <div className="space-y-3">
        {(data?.itens ?? []).map((i) => (
          <GlassCard
            key={i.id}
            accent={i.status === "pendente" ? "red" : i.status === "recuperado" ? "cyan" : undefined}
            className="p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-bold text-white">{i.nome}</div>
                <div className="truncate font-sans text-[11px] text-white/35">
                  {i.email} · {i.telefone || "sem telefone"} · {i.diasInativo} dias fora
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill accent="purple">{ROTULO_ETAPA[i.etapa] ?? `etapa ${i.etapa}`}</Pill>
                <Pill accent="red">{i.desconto}% OFF</Pill>
                <Pill accent={i.status === "recuperado" ? "cyan" : "purple"}>{i.status}</Pill>
              </div>
            </div>

            <p className="mt-3 rounded-2xl bg-white/[0.03] p-3 font-sans text-xs leading-relaxed text-white/60">
              {i.mensagem}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-white/12 px-3 py-1.5 font-mono text-[11px] text-neon-cyan">
                {i.cupom}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(i.mensagem);
                  setCopiado(i.id);
                  setTimeout(() => setCopiado(null), 1600);
                }}
                className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
              >
                {copiado === i.id ? <Check className="mr-1 inline size-3" /> : <Copy className="mr-1 inline size-3" />}
                Copiar mensagem
              </button>
              {i.whatsapp && (
                <a
                  href={i.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 font-sans text-[11px] text-emerald-300 hover:bg-emerald-400/20"
                >
                  <MessageCircle className="mr-1 inline size-3" />
                  Abrir WhatsApp
                </a>
              )}
              {i.status === "pendente" && (
                <button
                  type="button"
                  onClick={() => marcar.mutate({ id: i.id })}
                  className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 font-sans text-[11px] text-neon-cyan hover:bg-neon-cyan/20"
                >
                  Marcar enviado + travar cupom
                </button>
              )}
              {i.status !== "recuperado" && (
                <button
                  type="button"
                  onClick={() => encerrar.mutate({ id: i.id, status: "recuperado" })}
                  className="rounded-lg border border-emerald-400/35 px-3 py-1.5 font-sans text-[11px] text-emerald-300 hover:bg-emerald-400/10"
                >
                  <Check className="mr-1 inline size-3" />
                  Voltou
                </button>
              )}
              {i.status !== "descartado" && (
                <button
                  type="button"
                  onClick={() => encerrar.mutate({ id: i.id, status: "descartado" })}
                  className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/45 hover:bg-white/5"
                >
                  <X className="mr-1 inline size-3" />
                  Descartar
                </button>
              )}
            </div>
          </GlassCard>
        ))}

        {!data?.itens.length && (
          <GlassCard className="p-8 text-center">
            <HeartHandshake className="mx-auto size-8 text-white/20" />
            <p className="mt-3 font-sans text-sm text-white/40">
              Ninguém na fila de recuperação — nenhum cliente suspenso há mais de{" "}
              {data?.dias ?? 15} dias.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

export default RecuperacaoView;
