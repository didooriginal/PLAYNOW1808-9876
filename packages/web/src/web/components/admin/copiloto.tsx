// COPILOTO ADMIN — chat flutuante do painel administrativo.
//
// Só renderiza dentro de /admin (protegido por AdminRoute) e o endpoint
// /api/agent/admin-messages recusa quem não é admin, então há duas barreiras.
//
// Layout: bottom sheet no celular, painel ancorado à direita no desktop.
// Fica no canto ESQUERDO inferior para não colidir com o badge Runable.
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles, Terminal, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArrastavel } from "../../lib/arrastavel";
import { NeonButton } from "../ui/kit";

const SUGESTOES = [
  "Como reponho uma conta matriz?",
  "Quantas contas estão lotadas ou vencendo?",
  "Como monto um combo inteligente?",
  "Como funciona a Central de Códigos OTP?",
  "Tem prêmio de recompensa para entregar?",
  "Qual a inadimplência deste mês?",
];

function textoDaMensagem(m: { parts?: Array<{ type: string; text?: string }> }) {
  return (m.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

/** remove ruido de markdown que o painel nao renderiza (linhas ---, ###, citacoes >) */
function limpar(texto: string) {
  return texto
    .split("\n")
    .filter((l) => !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l))
    .map((l) => l.replace(/^\s*>\s?/, "").replace(/^\s*#{1,6}\s+/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** markdown mínimo: **negrito** e `código` — o modelo é instruído a usar só isso */
function Formatado({ texto }: { texto: string }) {
  const pedacos = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {pedacos.map((pedaco, i) => {
        if (pedaco.startsWith("**") && pedaco.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-white">
              {pedaco.slice(2, -2)}
            </strong>
          );
        }
        if (pedaco.startsWith("`") && pedaco.endsWith("`") && pedaco.length > 2) {
          return (
            <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11.5px]">
              {pedaco.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{pedaco}</span>;
      })}
    </>
  );
}

export function CopilotoAdmin({ nome }: { nome?: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/admin-messages" }),
  });

  const ocupado = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, aberto, status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Outras telas do admin (ex.: aba Marketing) pedem um texto pronto disparando
   * `ppn:abrir-copiloto` com `{ prompt }` — abre o painel já com a pergunta no campo.
   */
  useEffect(() => {
    function onAbrir(e: Event) {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt ?? "";
      setAberto(true);
      if (prompt) setTexto(prompt);
    }
    window.addEventListener("ppn:abrir-copiloto", onAbrir);
    return () => window.removeEventListener("ppn:abrir-copiloto", onAbrir);
  }, []);

  function enviar(pergunta?: string) {
    const conteudo = (pergunta ?? texto).trim();
    if (!conteudo || ocupado) return;
    setTexto("");
    sendMessage({ text: conteudo });
  }

  const primeiroNome = (nome ?? "").split(" ")[0] ?? "";
  const arrasto = useArrastavel("ppn:copiloto:pos");

  return (
    <>
      {/* gatilho — arrastável; parte do canto esquerdo inferior */}
      {!aberto && (
        <button
          type="button"
          {...arrasto.props}
          onClick={() => setAberto(true)}
          onDoubleClick={arrasto.resetar}
          data-testid="abrir-copiloto"
          aria-label="Abrir Copiloto Admin (arraste para mover)"
          title="Arraste para mover · duplo clique volta ao canto"
          className={cn(
            "group fixed bottom-5 left-4 z-[70] flex touch-none select-none items-center gap-2 rounded-full border border-neon-purple/45 bg-black/75 py-3 pl-3 pr-4 backdrop-blur-xl hover:border-neon-purple lg:left-6",
            arrasto.arrastando
              ? "scale-105 cursor-grabbing border-neon-purple"
              : "cursor-grab transition-all hover:-translate-y-0.5",
          )}
          style={{ boxShadow: "0 18px 50px -18px rgba(168,85,247,0.85)", ...arrasto.style }}
        >
          <span className="relative flex size-8 items-center justify-center rounded-full bg-neon-purple/15">
            <Wand2 className="size-4 text-neon-purple" />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-display text-xs font-bold uppercase tracking-wide text-white">
            Copiloto
          </span>
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-end sm:p-6 sm:pb-16">
          <button
            type="button"
            aria-label="Fechar copiloto"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-0"
          />

          <div
            role="dialog"
            aria-label="Copiloto Admin"
            className="glass-strong relative flex h-[85dvh] w-full max-w-md animate-modal-in flex-col overflow-hidden rounded-t-3xl border-white/12 sm:h-[620px] sm:max-h-[82dvh] sm:rounded-3xl"
            style={{ boxShadow: "0 40px 120px -40px rgba(168,85,247,0.6)" }}
          >
            <div
              className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(168,85,247,0.32) 0%, transparent 70%)",
              }}
            />

            {/* header */}
            <div className="relative flex items-center gap-3 border-b border-white/8 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-neon-purple/40 bg-neon-purple/10">
                <Terminal className="size-5 text-neon-purple" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold text-white">Copiloto Admin</div>
                <div className="flex items-center gap-1.5 font-sans text-[11px] text-white/40">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  conectado ao manual e aos dados do painel
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-colors hover:border-neon-red/50 hover:text-neon-red"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* mensagens */}
            <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-1.5 font-display text-xs font-bold text-neon-purple">
                      <Sparkles className="size-3.5" />
                      {primeiroNome ? `Fala, ${primeiroNome}.` : "Pronto para operar."}
                    </div>
                    <p className="mt-2 font-sans text-[13px] leading-relaxed text-white/60">
                      Pergunte qualquer coisa da operação: procedimento do painel (eu leio o
                      Manual do Admin por você) ou situação real (estoque, clientes, suporte,
                      OTP, faturas e recompensas vêm direto do banco).
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => enviar(s)}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left font-sans text-[12.5px] text-white/65 transition-colors hover:border-neon-purple/45 hover:text-white"
                      >
                        <Wand2 className="size-3.5 shrink-0 text-neon-purple" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const conteudo = textoDaMensagem(m);
                const meu = m.role === "user";
                if (!conteudo) return null;
                return (
                  <div key={m.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 font-sans text-[13px] leading-relaxed",
                        meu
                          ? "rounded-br-md border border-neon-purple/35 bg-neon-purple/15 text-white"
                          : "rounded-bl-md border border-white/10 bg-white/[0.05] text-white/75",
                      )}
                    >
                      {meu ? conteudo : <Formatado texto={limpar(conteudo)} />}
                    </div>
                  </div>
                );
              })}

              {ocupado && (
                <div className="flex items-center gap-2 font-sans text-[12px] text-white/40">
                  <Loader2 className="size-3.5 animate-spin text-neon-purple" />
                  consultando manual e banco...
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-neon-red/35 bg-neon-red/10 p-3 font-sans text-[12px] text-white/70">
                  Não consegui responder agora. Tente de novo em instantes.
                </div>
              )}

              <div ref={fim} />
            </div>

            {/* composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar();
              }}
              className="relative flex items-center gap-2 border-t border-white/8 bg-black/30 p-3 pb-[72px] sm:pb-3"
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Como faço... / Qual a situação de..."
                aria-label="Pergunta ao copiloto"
                data-testid="copiloto-input"
                className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 font-sans text-[13px] text-white placeholder:text-white/30 focus:border-neon-purple/50 focus:outline-none"
              />
              <NeonButton
                type="submit"
                accent="purple"
                size="sm"
                disabled={ocupado || !texto.trim()}
                className="!h-11 !w-11 !px-0"
                aria-label="Enviar"
              >
                {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </NeonButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
