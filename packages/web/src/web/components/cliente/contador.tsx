// CONTADOR REGRESSIVO DE VENCIMENTO — relogio ao vivo com alerta visual.
import { useEffect, useState } from "react";
import { CalendarClock, CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { GlassCard, NeonButton } from "../ui/kit";
import { brl, whatsappLink } from "@/lib/mock-data";

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
};

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
          <a
            href={whatsappLink(
              critico
                ? "Olá! Quero regularizar meu plano PLAPLUSNOW e liberar meus acessos."
                : "Olá! Quero pagar a renovação do meu plano PLAPLUSNOW.",
            )}
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
          >
            <NeonButton accent={critico ? "red" : "cyan"} size="sm" data-testid="pagar-agora">
              <CalendarClock className="size-4" />
              {critico ? "Regularizar agora" : "Pagar renovação"}
            </NeonButton>
          </a>
        </div>
      )}
    </GlassCard>
  );
}
