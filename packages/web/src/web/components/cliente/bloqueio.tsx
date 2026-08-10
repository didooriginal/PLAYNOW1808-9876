// TELA DE BLOQUEIO POR INADIMPLENCIA — unica coisa que o cliente atrasado ve.
// Sem logins, sem senhas, sem suporte humano: apenas o caminho do pagamento.
import { Lock } from "lucide-react";
import { GlassCard, Pill } from "../ui/kit";
import { brl } from "@/lib/mock-data";
import { PagarPix } from "./pagar-pix";
import { ContadorVencimento, type Situacao } from "./contador";

export function TelaBloqueio({
  nome,
  situacao,
  motivo,
}: {
  nome: string;
  situacao: Situacao;
  motivo: string;
}) {
  return (
    <div className="space-y-5" data-testid="tela-bloqueio">
      <GlassCard strong accent="red" className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,31,61,0.3) 0%, transparent 70%)" }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-neon-red/45 bg-neon-red/10">
              <Lock className="size-6 text-neon-red" />
            </span>
            <div className="min-w-0">
              <Pill accent="red">Acesso bloqueado</Pill>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
                {nome.split(" ")[0]}, seu plano está {situacao.rotulo.toLowerCase()}
              </h2>
              <p className="mt-2 max-w-xl font-sans text-[13px] leading-relaxed text-white/50">
                {motivo}
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-neon-red/35 bg-neon-red/[0.08] p-5 text-center">
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40">
              Valor para regularizar
            </div>
            <div className="mt-1 font-display text-3xl font-extrabold text-white">
              {brl(situacao.valor)}
            </div>
            <div className="mt-1 font-sans text-[11px] text-neon-red">
              vencimento {situacao.vencimento || "—"} · {situacao.diasEmAtraso} dias em atraso
            </div>
          </div>
        </div>
      </GlassCard>

      <ContadorVencimento situacao={situacao} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PagarPix titulo="regularizar plano" />

        <GlassCard className="p-5 sm:p-6">
          <div className="font-display text-sm font-bold text-white">
            O que volta assim que o pagamento cair
          </div>
          <ul className="mt-4 space-y-3">
            {[
              "Logins e senhas de todos os apps do seu pacote",
              "Central de códigos e desbloqueio de tela da Netflix",
              "Atendimento humano e abertura de chamados",
              "Progresso da Jornada e cupons de fidelidade",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-neon-red" />
                <span className="font-sans text-[12.5px] leading-relaxed text-white/55">
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-3 font-sans text-[11.5px] leading-relaxed text-white/40">
            Nada é cancelado: sua conta, seu histórico e suas vagas continuam reservados. O bloqueio
            é temporário e reversível na hora.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
