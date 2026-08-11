// Card "Instalar Aplicativo" — adiciona o painel na tela inicial do celular.
import { useEffect, useState } from "react";
import { Check, Download, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  assinarPromptDeInstalacao,
  ehIOS,
  estaInstalado,
  getPromptDeInstalacao,
  limparPromptDeInstalacao,
  type PromptDeInstalacao,
} from "@/lib/pwa";

const CHAVE_DISPENSADO = "ppn:instalar-dispensado";

export function InstalarApp() {
  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(() => getPromptDeInstalacao());
  const [instalado, setInstalado] = useState(() => estaInstalado());
  const [dispensado, setDispensado] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(CHAVE_DISPENSADO) === "1",
  );
  const [passosIOS, setPassosIOS] = useState(false);
  const ios = ehIOS();

  useEffect(() => assinarPromptDeInstalacao(setPrompt), []);
  useEffect(() => {
    function onInstalled() {
      setInstalado(true);
    }
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (instalado || dispensado) return null;

  async function instalar() {
    if (ios || !prompt) {
      setPassosIOS(true);
      return;
    }
    await prompt.prompt();
    const escolha = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    limparPromptDeInstalacao();
    if (escolha.outcome === "accepted") setInstalado(true);
  }

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, "1");
    setDispensado(true);
  }

  return (
    <GlassCard accent="purple" className="relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -left-16 -bottom-20 size-52 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 70%)" }}
      />

      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar"
        className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/35 transition-colors hover:text-white"
      >
        <X className="size-3.5" />
      </button>

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-neon-purple/40 bg-neon-purple/10">
            <Smartphone className="size-5 text-neon-purple" />
          </span>
          <div className="min-w-0">
            <Pill accent="purple">App instalável</Pill>
            <h3 className="mt-2 font-display text-lg font-bold text-white">
              Instale o PLAYPLUSNOW no seu celular
            </h3>
            <p className="mt-1.5 max-w-xl font-sans text-[13px] leading-relaxed text-white/50">
              Atalho na tela inicial, abre em tela cheia e você chega nos seus logins em 1 toque —
              sem baixar nada da loja de aplicativos.
            </p>
          </div>
        </div>

        <NeonButton
          accent="purple"
          size="md"
          onClick={instalar}
          className="shrink-0"
          data-testid="instalar-app"
        >
          <Download className="size-4" />
          Instalar App
        </NeonButton>
      </div>

      {passosIOS && (
        <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="font-display text-xs font-bold text-white">
            {ios ? "No iPhone / iPad, faça assim:" : "Instalação manual pelo navegador:"}
          </div>
          <ol className="mt-3 space-y-2.5">
            {(ios
              ? [
                  <>
                    Toque no botão <Share className="mx-1 inline size-3.5 text-neon-cyan" />
                    <b className="font-semibold text-white/80">Compartilhar</b> na barra do Safari.
                  </>,
                  <>
                    Escolha <SquarePlus className="mx-1 inline size-3.5 text-neon-cyan" />
                    <b className="font-semibold text-white/80">Adicionar à Tela de Início</b>.
                  </>,
                  <>
                    Confirme em <b className="font-semibold text-white/80">Adicionar</b> — o ícone
                    aparece junto dos seus outros apps.
                  </>,
                ]
              : [
                  <>
                    Abra o menu <b className="font-semibold text-white/80">⋮</b> do navegador.
                  </>,
                  <>
                    Escolha{" "}
                    <b className="font-semibold text-white/80">Instalar app</b> ou{" "}
                    <b className="font-semibold text-white/80">Adicionar à tela inicial</b>.
                  </>,
                  <>Confirme e pronto: o atalho fica na sua tela inicial.</>,
                ]
            ).map((passo, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-neon-purple/50 bg-neon-purple/10 font-display text-[10px] font-bold text-neon-purple">
                  {i + 1}
                </span>
                <span className="font-sans text-[12.5px] leading-relaxed text-white/60">{passo}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setPassosIOS(false)}
            className="mt-4 inline-flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-widest text-white/40 transition-colors hover:text-white"
          >
            <Check className="size-3.5" />
            Entendi
          </button>
        </div>
      )}
    </GlassCard>
  );
}
