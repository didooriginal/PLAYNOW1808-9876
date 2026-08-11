// CONTADOR REGRESSIVO DE VENCIMENTO — relogio ao vivo com alerta visual.
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CircleAlert,
  HeartHandshake,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { GlassCard, NeonButton } from "../ui/kit";
import { brl } from "@/lib/mock-data";
import { irParaPagamento } from "@/lib/navegacao";

export type Situacao = {
  status: string;
  rotulo: string;
  bloqueado: boolean;
  diasRestantes: number | null;
  diasEmAtraso: number;
  venceEm: string | null;
  vencimento: string;
  valor: number;
  ciclo: string;
  formaPagamento: string;
  /** credito de confianca concedido pelo admin; ativa=false quando nao tem */
  confianca?: {
    ativa: boolean;
    ate: string | null;
    horasRestantes: number;
    minutosRestantes: number;
    motivo: string;
    vezes: number;
  };
};

/**
 * FAIXA DO CREDITO DE CONFIANCA
 * ------------------------------------------------------------------
 * Aparece so quando o admin liberou o acesso de um cliente em atraso. O painel
 * segue 100% normal — a faixa existe para ele saber que o prazo e temporario
 * e ter o botao de pagar a um clique. O relogio bate de segundo em segundo a
 * partir do `ate` (ISO) que o servidor manda.
 */
export function FaixaConfianca({ situacao }: { situacao: Situacao }) {
  const credito = situacao.confianca;
  const [tick, setTick] = useState(() => restante(credito?.ate ?? null));

  useEffect(() => {
    const ate = credito?.ate ?? null;
    setTick(restante(ate));
    const id = setInterval(() => setTick(restante(ate)), 1000);
    return () => clearInterval(id);
  }, [credito?.ate]);

  if (!credito?.ativa || !tick || tick.atrasado) return null;

  const horas = tick.dias * 24 + tick.horas;

  return (
    <GlassCard
      accent="cyan"
      className="relative overflow-hidden p-5"
      data-testid="faixa-confianca"
    >
      <div className="pointer-events-none absolute -right-14 -top-14 size-48 rounded-full bg-neon-cyan/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/50 bg-neon-cyan/10">
            <HeartHandshake className="size-5 text-neon-cyan" />
          </span>
          <div className="min-w-0">
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-neon-cyan/70">
              Crédito de confiança
            </div>
            <div className="mt-1 font-display text-lg font-extrabold text-white">
              Liberamos seu acesso por mais{" "}
              <span className="text-neon-cyan tabular-nums">
                {horas}h {String(tick.minutos).padStart(2, "0")}m{" "}
                {String(tick.segundos).padStart(2, "0")}s
              </span>
            </div>
            <div className="mt-1 font-sans text-[12px] text-white/45">
              {credito.motivo
                ? `${credito.motivo} · pague até lá para não perder o acesso.`
                : "Tudo segue funcionando normalmente. Pague dentro do prazo para não perder o acesso."}
            </div>
          </div>
        </div>
        <NeonButton accent="cyan" size="sm" onClick={irParaPagamento}>
          Pagar {brl(situacao.valor)} agora
        </NeonButton>
      </div>
    </GlassCard>
  );
}

function restante(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  return {
    atrasado: ms < 0,
    dias: Math.floor(abs / 86_400_000),
    horas: Math.floor((abs % 86_400_000) / 3_600_000),
    minutos: Math.floor((abs % 3_600_000) / 60_000),
    segundos: Math.floor((abs % 60_000) / 1000),
  };
}

export function ContadorVencimento({ situacao }: { situacao: Situacao }) {
  const [tick, setTick] = useState(() => restante(situacao.venceEm));

  useEffect(() => {
    setTick(restante(situacao.venceEm));
    const id = setInterval(() => setTick(restante(situacao.venceEm)), 1000);
    return () => clearInterval(id);
  }, [situacao.venceEm]);

  if (!situacao.venceEm || !tick) return null;

  const dias = situacao.diasRestantes ?? 0;
  const critico = situacao.bloqueado || tick.atrasado;
  const alerta = !critico && dias <= 3;

  const cor = critico ? "#ff1f3d" : alerta ? "#fbbf24" : "#22d3ee";
  const Icone = critico ? CircleAlert : alerta ? TriangleAlert : ShieldCheck;

  const titulo = critico
    ? `Plano em atraso há ${situacao.diasEmAtraso || tick.dias} ${(situacao.diasEmAtraso || tick.dias) === 1 ? "dia" : "dias"}`
    : dias === 0
      ? "Seu plano vence hoje"
      : `Faltam ${tick.dias} ${tick.dias === 1 ? "dia" : "dias"} para o vencimento`;

  const blocos = [
    { valor: tick.dias, rotulo: "dias" },
    { valor: tick.horas, rotulo: "horas" },
    { valor: tick.minutos, rotulo: "min" },
    { valor: tick.segundos, rotulo: "seg" },
  ];

  return (
    <GlassCard
      className="relative overflow-hidden p-5 sm:p-6"
      data-testid="contador-vencimento"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${cor}38 0%, transparent 70%)` }}
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{ borderColor: `${cor}66`, background: `${cor}14` }}
          >
            <Icone className="size-5" style={{ color: cor }} />
          </span>
          <div>
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-white/35">
              Contagem regressiva
            </div>
            <div className="mt-1 font-display text-lg font-extrabold text-white">{titulo}</div>
            <div className="mt-1 font-sans text-[12px] text-white/45">
              Vencimento {situacao.vencimento || "—"} · {brl(situacao.valor)} ·{" "}
              {situacao.ciclo === "anual" ? "anual" : "mensal"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {blocos.map((b) => (
            <div
              key={b.rotulo}
              className="w-[62px] rounded-2xl border border-white/10 bg-black/40 px-2 py-2.5 text-center"
              style={{ borderColor: `${cor}3a` }}
            >
              <div
                className="font-display text-xl font-extrabold tabular-nums"
                style={{ color: cor }}
              >
                {String(b.valor).padStart(2, "0")}
              </div>
              <div className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/35">
                {b.rotulo}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(critico || alerta) && (
        <div
          className="relative mt-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: `${cor}3a`, background: `${cor}0f` }}
        >
          <div className="min-w-0">
            <div className="font-display text-[13px] font-bold text-white">
              {critico
                ? "Acessos e suporte bloqueados até o pagamento"
                : "Pague agora e evite o bloqueio automático"}
            </div>
            <div className="mt-0.5 font-sans text-[11.5px] text-white/45">
              {critico
                ? "Assim que confirmarmos o pagamento, tudo volta na hora."
                : `Depois do vencimento, os logins somem do painel automaticamente.`}
            </div>
          </div>
          <div className="shrink-0">
            <NeonButton
              accent={critico ? "red" : "cyan"}
              size="sm"
              data-testid="pagar-agora"
              onClick={irParaPagamento}
            >
              <CalendarClock className="size-4" />
              {critico ? "Regularizar agora" : "Pagar renovação"}
            </NeonButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
