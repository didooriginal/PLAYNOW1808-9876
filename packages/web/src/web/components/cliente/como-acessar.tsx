// Modal "Como acessar" — passo a passo de login por serviço + regras de ouro.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  MonitorSmartphone,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { NeonButton } from "../ui/kit";
import { REGRAS_OURO, servicoInfo } from "@/lib/servicos-info";
import { CodigoAcesso } from "./codigo-acesso";

export function ComoAcessarModal({
  slug,
  nome,
  cor,
  onClose,
}: {
  slug: string;
  nome: string;
  cor: string;
  onClose: () => void;
}) {
  const info = servicoInfo(slug, nome);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Como acessar ${nome}`}
        className="glass-strong relative flex max-h-[90dvh] w-full max-w-lg animate-modal-in flex-col overflow-hidden rounded-t-3xl border-white/12 sm:rounded-3xl"
        style={{ boxShadow: `0 40px 120px -40px ${cor}` }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${cor}40 0%, transparent 70%)` }}
        />

        {/* header */}
        <div className="relative flex items-start gap-3 border-b border-white/8 p-5">
          <AppIcon id={slug} size="md" active />
          <div className="min-w-0 flex-1">
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-white/35">
              Como acessar
            </div>
            <div className="truncate font-display text-lg font-extrabold text-white">{nome}</div>
            <div className="mt-1 flex items-center gap-1.5 font-sans text-[11px] text-white/40">
              <MonitorSmartphone className="size-3.5 shrink-0" />
              <span className="truncate">{info.dispositivos}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-colors hover:border-neon-red/50 hover:text-neon-red"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* corpo com scroll */}
        <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
              Passo a passo
            </div>
            <ol className="mt-3 space-y-3">
              {info.passos.map((passo, i) => (
                <li key={passo} className="flex gap-3">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border font-display text-[11px] font-bold"
                    style={{ borderColor: `${cor}66`, color: cor, background: `${cor}14` }}
                  >
                    {i + 1}
                  </span>
                  <p className="pt-0.5 font-sans text-[13px] leading-relaxed text-white/70">
                    {passo}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* pedido de código: vale para qualquer app que verifica por e-mail */}
          <CodigoAcesso slug={slug} nome={nome} compacto />

          {info.dicas.length > 0 && (
            <div className="rounded-2xl border border-neon-cyan/25 bg-neon-cyan/[0.06] p-4">
              <div className="flex items-center gap-1.5 font-display text-xs font-bold text-neon-cyan">
                <Sparkles className="size-3.5" />
                Dicas de uso
              </div>
              <ul className="mt-2.5 space-y-2">
                {info.dicas.map((d) => (
                  <li key={d} className="flex gap-2 font-sans text-[12.5px] leading-relaxed text-white/65">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-neon-cyan" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-4">
            <div className="flex items-center gap-1.5 font-display text-xs font-bold text-amber-300">
              <ShieldAlert className="size-3.5" />
              Regras de ouro — segurança do acesso
            </div>
            <ul className="mt-2.5 space-y-2">
              {REGRAS_OURO.map((r) => (
                <li key={r} className="flex gap-2 font-sans text-[12.5px] leading-relaxed text-white/65">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-amber-400" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* rodapé */}
        <div className="relative flex gap-2 border-t border-white/8 bg-black/25 p-4 pb-[76px] sm:pb-4">
          <NeonButton variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
            Fechar
          </NeonButton>
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
            data-testid="modal-abrir-servico"
          >
            <NeonButton accent="red" size="sm" className="w-full">
              {info.rotulo}
              <ExternalLink className="size-3.5" />
            </NeonButton>
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
