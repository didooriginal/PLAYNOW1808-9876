// TELA DE BLOQUEIO POR INADIMPLENCIA — unica coisa que o cliente atrasado ve.
// Sem logins, sem senhas, sem suporte humano: apenas o caminho do pagamento.
import { Copy, Check, Lock, MessageCircle, Receipt } from "lucide-react";
import { useState } from "react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { brl, whatsappLink } from "@/lib/mock-data";
import { ContadorVencimento, type Situacao } from "./contador";

/** chave Pix da operacao — trocar aqui muda em todo o painel */
const CHAVE_PIX = "pix@plaplusnow.com";

export function TelaBloqueio({
  nome,
  situacao,
  motivo,
}: {
  nome: string;
  situacao: Situacao;
  motivo: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarPix() {
    await navigator.clipboard.writeText(CHAVE_PIX);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

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
        <GlassCard accent="cyan" className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-neon-cyan" />
            <div className="font-display text-sm font-bold text-white">Pagar por Pix</div>
          </div>
          <p className="mt-2 font-sans text-[12px] leading-relaxed text-white/45">
            Copie a chave, pague o valor exato e envie o comprovante no WhatsApp. A liberação é
            manual e sai em poucos minutos no horário comercial.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 p-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/80">
              {CHAVE_PIX}
            </span>
            <button
              type="button"
              onClick={copiarPix}
              data-testid="copiar-pix"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
              aria-label="Copiar chave Pix"
            >
              {copiado ? <Check className="size-3.5 text-neon-cyan" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          <a
            href={whatsappLink(
              `Olá! Sou ${nome} e quero regularizar meu plano PLAPLUSNOW (${brl(situacao.valor)}).`,
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block"
          >
            <NeonButton accent="cyan" size="sm" className="w-full">
              <MessageCircle className="size-4" />
              Enviar comprovante no WhatsApp
            </NeonButton>
          </a>
        </GlassCard>

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
