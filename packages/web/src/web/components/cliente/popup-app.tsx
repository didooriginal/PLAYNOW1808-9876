// POPUP "LEVE O PAINEL NO CELULAR" — aparece no painel do cliente e resolve,
// em 2 passos, as duas coisas que fazem o cliente receber o código na hora:
//   1. instalar o PLAYPLUSNOW na tela inicial (PWA);
//   2. ligar os avisos (push) neste aparelho.
//
// Regras de exibição:
// - só aparece depois de ~1,5s no painel (não briga com o carregamento);
// - nunca aparece junto do checklist de boas-vindas (o dashboard controla isso);
// - desaparece para sempre quando os 2 passos estão feitos;
// - "Agora não" adia por 3 dias.
import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  Download,
  Loader2,
  Share,
  Smartphone,
  SquarePlus,
  TriangleAlert,
  X,
} from "lucide-react";
import { NeonButton } from "../ui/kit";
import {
  assinarPromptDeInstalacao,
  ehIOS,
  estaInstalado,
  getPromptDeInstalacao,
  limparPromptDeInstalacao,
  type PromptDeInstalacao,
} from "@/lib/pwa";
import { criarInscricao, inscricaoAtual, permissaoAtual, pushSuportado } from "@/lib/push-cliente";
import { useChavePush, useInscreverPush } from "../../queries/push";

const CHAVE_ADIADO = "ppn:popup-app-adiado";
const CHAVE_PRONTO = "ppn:popup-app-pronto";
const DIAS_ADIADO = 3;
const ATRASO_MS = 1500;

function liberadoPorLocalStorage() {
  if (typeof localStorage === "undefined") return false;
  if (localStorage.getItem(CHAVE_PRONTO) === "1") return false;
  const adiado = Number(localStorage.getItem(CHAVE_ADIADO) ?? 0);
  if (adiado > 0 && Date.now() - adiado < DIAS_ADIADO * 86_400_000) return false;
  return true;
}

export function PopupApp() {
  const chave = useChavePush();
  const inscrever = useInscreverPush();

  const [visivel, setVisivel] = useState(false);
  const [fechado, setFechado] = useState(() => !liberadoPorLocalStorage());
  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(() => getPromptDeInstalacao());
  const [instalado, setInstalado] = useState(() => estaInstalado());
  const [ligadoAqui, setLigadoAqui] = useState(true); // otimista: só pede se confirmar que não
  const [conferido, setConferido] = useState(false);
  const [passosIOS, setPassosIOS] = useState(false);
  const [erro, setErro] = useState("");

  const ios = ehIOS();
  const suportado = pushSuportado();
  const permissao = permissaoAtual();
  const pushDisponivel = suportado && chave.data?.configurado !== false;

  useEffect(() => assinarPromptDeInstalacao(setPrompt), []);

  useEffect(() => {
    function onInstalled() {
      setInstalado(true);
    }
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  useEffect(() => {
    void inscricaoAtual().then((i) => {
      setLigadoAqui(Boolean(i));
      setConferido(true);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), ATRASO_MS);
    return () => clearTimeout(t);
  }, []);

  const faltaInstalar = !instalado;
  const faltaAvisos = pushDisponivel && !ligadoAqui;
  const tudoPronto = conferido && !faltaInstalar && !faltaAvisos;

  // Nada pendente = o popup nunca mais precisa aparecer neste aparelho.
  useEffect(() => {
    if (tudoPronto && typeof localStorage !== "undefined") {
      localStorage.setItem(CHAVE_PRONTO, "1");
    }
  }, [tudoPronto]);

  if (fechado || !visivel || !conferido || tudoPronto) return null;

  function adiar() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CHAVE_ADIADO, String(Date.now()));
    }
    setFechado(true);
  }

  async function instalar() {
    setErro("");
    if (ios || !prompt) {
      setPassosIOS(true);
      return;
    }
    await prompt.prompt();
    const escolha = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    limparPromptDeInstalacao();
    if (escolha.outcome === "accepted") setInstalado(true);
  }

  async function ligarAvisos() {
    setErro("");
    const resultado = await criarInscricao(chave.data?.chave ?? "");
    if (!resultado.ok) {
      setErro(resultado.motivo);
      return;
    }
    const gravado = await inscrever.mutateAsync(resultado.dados).catch(() => null);
    if (!gravado?.ok) {
      setErro("Não consegui salvar a inscrição. Tente de novo em instantes.");
      return;
    }
    setLigadoAqui(true);
  }

  const avisosBloqueadosNoIOS = ios && !instalado;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
      data-testid="popup-app"
    >
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/12 bg-[#0b0b0f] p-6 shadow-[0_0_80px_-20px_rgba(34,211,238,0.55)] sm:rounded-3xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.22) 0%, transparent 70%)" }}
        />

        <button
          type="button"
          onClick={adiar}
          aria-label="Fechar"
          data-testid="popup-app-fechar"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/35 transition-colors hover:text-white"
        >
          <X className="size-4" />
        </button>

        <div className="relative flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10">
            <Smartphone className="size-6 text-neon-cyan" />
          </span>
          <div className="min-w-0 pr-8">
            <div className="font-sans text-[11px] uppercase tracking-[0.24em] text-white/40">
              Leve o painel no bolso
            </div>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
              Instale o app e ligue os avisos
            </h2>
            <p className="mt-2 font-sans text-[13px] leading-relaxed text-white/50">
              Com o app na tela inicial e os avisos ligados, o código de acesso, o aviso de
              vencimento e a confirmação de pagamento chegam sozinhos no seu celular. Leva 20
              segundos.
            </p>
          </div>
        </div>

        <div className="relative mt-6 space-y-3">
          {/* PASSO 1 — instalar */}
          <div
            className={`rounded-2xl border p-4 ${
              instalado
                ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-display text-[11px] font-bold ${
                    instalado
                      ? "border-emerald-400 bg-emerald-400 text-black"
                      : "border-neon-purple/50 bg-neon-purple/10 text-neon-purple"
                  }`}
                >
                  {instalado ? <Check className="size-3.5" strokeWidth={3} /> : "1"}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-[13.5px] font-bold text-white">
                    Instalar na tela inicial
                  </div>
                  <p className="mt-1 font-sans text-[12px] leading-relaxed text-white/45">
                    {instalado
                      ? "Feito — você já está usando o app instalado."
                      : "Abre em tela cheia, sem baixar nada da loja de aplicativos."}
                  </p>
                </div>
              </div>
              {!instalado && (
                <NeonButton
                  accent="purple"
                  size="sm"
                  onClick={() => void instalar()}
                  className="shrink-0"
                  data-testid="popup-app-instalar"
                >
                  <Download className="size-3.5" />
                  Instalar
                </NeonButton>
              )}
            </div>

            {passosIOS && !instalado && (
              <ol className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
                {(ios
                  ? [
                      <>
                        Toque em <Share className="mx-1 inline size-3.5 text-neon-cyan" />
                        <b className="font-semibold text-white/80">Compartilhar</b> na barra do
                        Safari.
                      </>,
                      <>
                        Escolha <SquarePlus className="mx-1 inline size-3.5 text-neon-cyan" />
                        <b className="font-semibold text-white/80">Adicionar à Tela de Início</b>.
                      </>,
                      <>
                        Confirme em <b className="font-semibold text-white/80">Adicionar</b> e abra
                        o PLAYPLUSNOW pelo novo ícone.
                      </>,
                    ]
                  : [
                      <>
                        Abra o menu <b className="font-semibold text-white/80">⋮</b> do navegador.
                      </>,
                      <>
                        Escolha <b className="font-semibold text-white/80">Instalar app</b> ou{" "}
                        <b className="font-semibold text-white/80">Adicionar à tela inicial</b>.
                      </>,
                      <>Confirme e abra o painel pelo atalho criado.</>,
                    ]
                ).map((passo, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-neon-purple/50 bg-neon-purple/10 font-display text-[10px] font-bold text-neon-purple">
                      {i + 1}
                    </span>
                    <span className="font-sans text-[12px] leading-relaxed text-white/55">
                      {passo}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* PASSO 2 — avisos */}
          {pushDisponivel && (
            <div
              className={`rounded-2xl border p-4 ${
                ligadoAqui
                  ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-display text-[11px] font-bold ${
                      ligadoAqui
                        ? "border-emerald-400 bg-emerald-400 text-black"
                        : "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                    }`}
                  >
                    {ligadoAqui ? <Check className="size-3.5" strokeWidth={3} /> : "2"}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-[13.5px] font-bold text-white">
                      Ligar os avisos neste aparelho
                    </div>
                    <p className="mt-1 font-sans text-[12px] leading-relaxed text-white/45">
                      {ligadoAqui
                        ? "Feito — este aparelho já recebe os avisos."
                        : "O código de acesso chega como notificação, sem precisar abrir o site."}
                    </p>
                  </div>
                </div>
                {!ligadoAqui && (
                  <NeonButton
                    accent="cyan"
                    size="sm"
                    onClick={() => void ligarAvisos()}
                    disabled={
                      inscrever.isPending || permissao === "denied" || avisosBloqueadosNoIOS
                    }
                    className={`shrink-0 ${avisosBloqueadosNoIOS ? "opacity-40" : ""}`}
                    data-testid="popup-app-ligar"
                  >
                    {inscrever.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Bell className="size-3.5" />
                    )}
                    Ligar
                  </NeonButton>
                )}
              </div>

              {avisosBloqueadosNoIOS && (
                <div className="mt-3 flex gap-2.5 rounded-xl border border-neon-purple/25 bg-neon-purple/5 p-3">
                  <TriangleAlert className="size-3.5 shrink-0 text-neon-purple" />
                  <p className="font-sans text-[11.5px] leading-relaxed text-white/55">
                    No iPhone e iPad os avisos só funcionam depois de instalar o app na tela de
                    início. Faça o passo 1, abra pelo ícone novo e volte aqui.
                  </p>
                </div>
              )}

              {permissao === "denied" && (
                <div className="mt-3 flex gap-2.5 rounded-xl border border-neon-red/25 bg-neon-red/5 p-3">
                  <TriangleAlert className="size-3.5 shrink-0 text-neon-red" />
                  <p className="font-sans text-[11.5px] leading-relaxed text-white/55">
                    As notificações estão bloqueadas para este site. Libere no cadeado da barra de
                    endereço e recarregue a página.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {erro && <p className="relative mt-4 font-sans text-[12.5px] text-neon-red/80">{erro}</p>}

        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={adiar}
            data-testid="popup-app-adiar"
            className="font-sans text-[11px] uppercase tracking-widest text-white/40 transition-colors hover:text-white"
          >
            Agora não
          </button>
          <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-white/30">
            <BellRing className="size-3.5" />
            Some sozinho quando os 2 passos estiverem feitos
          </span>
        </div>
      </div>
    </div>
  );
}
