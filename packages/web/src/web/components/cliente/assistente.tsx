// ASSISTENTE PLAPLUSNOW — chat flutuante do painel do cliente.
// Bottom sheet no celular, painel ancorado no canto no desktop.
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Loader2, MessageCircleQuestion, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NeonButton } from "../ui/kit";

const SUGESTOES = [
  "Como entro na Netflix?",
  "Quais apps eu tenho?",
  "Quando vence minha fatura?",
  "Como funciona a indicação?",
];

function textoDaMensagem(m: { parts?: Array<{ type: string; text?: string }> }) {
  return (m.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

/** markdown mínimo: **negrito** e `código` — o modelo usa só isso */
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

export function AssistenteIA({ cliente }: { cliente: { nome: string; apps: number } }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/messages" }),
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

  function enviar(pergunta?: string) {
    const conteudo = (pergunta ?? texto).trim();
    if (!conteudo || ocupado) return;
    setTexto("");
    sendMessage({ text: conteudo });
  }

  const primeiroNome = cliente.nome.split(" ")[0] ?? "";

  return (
    <>
      {/* botão flutuante — acima da nav mobile e ao lado do badge Runable */}
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          data-testid="abrir-assistente"
          aria-label="Abrir assistente PLAPLUSNOW"
          className="group fixed bottom-28 right-4 z-[70] flex items-center gap-2 rounded-full border border-neon-cyan/45 bg-black/70 py-3 pl-3 pr-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-neon-cyan sm:bottom-20 sm:right-6"
          style={{ boxShadow: "0 18px 50px -18px rgba(34,211,238,0.85)" }}
        >
          <span className="relative flex size-8 items-center justify-center rounded-full bg-neon-cyan/15">
            <Bot className="size-4 text-neon-cyan" />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-display text-xs font-bold uppercase tracking-wide text-white">
            Ajuda
          </span>
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-end sm:p-6 sm:pb-16">
          <button
            type="button"
            aria-label="Fechar assistente"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-0"
          />

          <div
            role="dialog"
            aria-label="Assistente PLAPLUSNOW"
            className="glass-strong relative flex h-[82dvh] w-full max-w-md animate-modal-in flex-col overflow-hidden rounded-t-3xl border-white/12 sm:h-[600px] sm:max-h-[80dvh] sm:rounded-3xl"
            style={{ boxShadow: "0 40px 120px -40px rgba(34,211,238,0.6)" }}
          >
            <div
              className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)" }}
            />

            {/* header */}
            <div className="relative flex items-center gap-3 border-b border-white/8 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10">
                <Bot className="size-5 text-neon-cyan" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold text-white">Assistente PLAPLUSNOW</div>
                <div className="flex items-center gap-1.5 font-sans text-[11px] text-white/40">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  online · responde na hora
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
                    <div className="flex items-center gap-1.5 font-display text-xs font-bold text-neon-cyan">
                      <Sparkles className="size-3.5" />
                      Oi{primeiroNome ? `, ${primeiroNome}` : ""}!
                    </div>
                    <p className="mt-2 font-sans text-[13px] leading-relaxed text-white/60">
                      Eu cuido de dúvidas do seu painel: como entrar em cada um dos seus{" "}
                      {cliente.apps} apps, códigos de verificação, faturas e a sua jornada de
                      recompensas. Sem fila e sem esperar atendente.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => enviar(s)}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left font-sans text-[12.5px] text-white/65 transition-colors hover:border-neon-cyan/45 hover:text-white"
                      >
                        <MessageCircleQuestion className="size-3.5 shrink-0 text-neon-cyan" />
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
                          ? "rounded-br-md border border-neon-red/35 bg-neon-red/15 text-white"
                          : "rounded-bl-md border border-white/10 bg-white/[0.05] text-white/75",
                      )}
                    >
                      {meu ? conteudo : <Formatado texto={conteudo} />}
                    </div>
                  </div>
                );
              })}

              {ocupado && (
                <div className="flex items-center gap-2 font-sans text-[12px] text-white/40">
                  <Loader2 className="size-3.5 animate-spin text-neon-cyan" />
                  consultando seu painel...
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-neon-red/35 bg-neon-red/10 p-3 font-sans text-[12px] text-white/70">
                  Não consegui responder agora. Tente de novo em instantes ou use a aba Suporte.
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
              className="relative flex items-center gap-2 border-t border-white/8 bg-black/30 p-3 pb-[76px] sm:pb-3"
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva sua dúvida..."
                aria-label="Sua dúvida"
                data-testid="assistente-input"
                className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 font-sans text-[13px] text-white placeholder:text-white/30 focus:border-neon-cyan/50 focus:outline-none"
              />
              <NeonButton
                type="submit"
                accent="cyan"
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
