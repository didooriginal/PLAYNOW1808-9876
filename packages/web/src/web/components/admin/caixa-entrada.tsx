import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Inbox,
  Loader2,
  Pin,
  Search,
  Trash2,
} from "lucide-react";
import { GlassCard, Pill } from "../ui/kit";
import { TituloSecao, Tooltip } from "../ui/tooltip";
import {
  haQuantoTempo,
  horaBr,
  useCaixaEntrada,
  useFixarEmail,
  useRemoverEmail,
} from "../../queries/codigos";

/**
 * CAIXA DE ENTRADA DO WEBHOOK.
 *
 * A fila de códigos só mostra um trecho de 180 caracteres do e-mail — e some
 * em 1 hora. Aqui o admin lê a MENSAGEM INTEIRA de tudo que chegou em
 * `/api/webhooks/email`, inclusive e-mail sem código nenhum (confirmação do
 * Gmail, aviso de novo aparelho, cobrança). Retenção de 7 dias; o que estiver
 * fixado nunca é apagado pela limpeza automática.
 */

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none";

/** Tira as tags quando o provedor manda o corpo em HTML. */
function textoLegivel(corpo: string) {
  if (!/<[a-z][\s\S]*>/i.test(corpo)) return corpo;
  return corpo
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function CaixaEntrada() {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const { data, isPending } = useCaixaEntrada(busca);
  const fixar = useFixarEmail();
  const remover = useRemoverEmail();

  const emails = data ?? [];

  return (
    <GlassCard strong accent="cyan" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloSecao ajuda="codigos.caixa" icone={<Inbox className="size-4 text-neon-cyan" />}>
          Caixa de entrada do webhook
        </TituloSecao>
        <Pill accent="cyan">{emails.length} mensagem(ns) · guardadas por 7 dias</Pill>
      </div>
      <p className="mt-1.5 font-sans text-xs text-white/40">
        Tudo que chega no endereço do webhook aparece aqui com o texto completo — inclusive e-mail
        sem código, como a confirmação de endereço do Gmail.
      </p>

      <Tooltip texto="codigos.buscaEmail" titulo="Buscar na caixa de entrada">
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            className={inputCls}
            aria-label="Buscar na caixa de entrada"
            placeholder="Buscar por remetente, assunto ou palavra do corpo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </Tooltip>

      {isPending ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="size-5 animate-spin text-neon-cyan" />
          <span className="font-sans text-sm text-white/45">Abrindo a caixa de entrada...</span>
        </div>
      ) : emails.length === 0 ? (
        <div className="py-10 text-center">
          <Inbox className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-display text-sm font-bold text-white">
            {busca ? "Nada encontrado com essa busca" : "Nenhum e-mail recebido ainda"}
          </p>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            Assim que a Cloudflare encaminhar uma mensagem para o webhook, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {emails.map((m) => {
            const expandido = aberto === m.id;
            const corpo = textoLegivel(m.corpo);
            return (
              <div
                key={m.id}
                className="rounded-xl border border-white/8 bg-white/[0.02] transition-colors hover:border-white/15"
              >
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    aria-label={`Abrir e-mail: ${m.assunto || "sem assunto"}`}
                    onClick={() => setAberto(expandido ? null : m.id)}
                    className="flex min-w-[220px] flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-white/35 ${expandido ? "rotate-180" : ""}`}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-display text-sm font-bold text-white">
                        {m.assunto || "(sem assunto)"}
                      </div>
                      <div className="truncate font-mono text-[10px] text-white/30">
                        de {m.remetente || "?"} · para {m.destinatario || "?"}
                      </div>
                    </div>
                  </button>

                  {m.codigo ? (
                    <Pill accent="cyan">código {m.codigo}</Pill>
                  ) : (
                    <Pill accent="red">sem código</Pill>
                  )}
                  {m.fixado ? <Pill accent="purple">fixado</Pill> : null}

                  <div className="min-w-[130px]">
                    <div className="font-sans text-xs text-white/70">{horaBr(m.recebidoEm)}</div>
                    <div className="font-sans text-[11px] text-white/35">
                      {haQuantoTempo(m.recebidoEm)}
                    </div>
                  </div>

                  <Tooltip texto="codigos.copiarEmail" titulo="Copiar e-mail">
                    <button
                      type="button"
                      aria-label="Copiar texto do e-mail"
                      onClick={() => {
                        void navigator.clipboard?.writeText(corpo);
                        setCopiado(m.id);
                        setTimeout(() => setCopiado(null), 1800);
                      }}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
                    >
                      {copiado === m.id ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </Tooltip>

                  <Tooltip texto="codigos.fixarEmail" titulo="Fixar mensagem">
                    <button
                      type="button"
                      aria-label={m.fixado ? "Desafixar mensagem" : "Fixar mensagem"}
                      disabled={fixar.isPending}
                      onClick={() => fixar.mutate({ id: m.id, fixado: !m.fixado })}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        m.fixado
                          ? "border-neon-purple/50 text-neon-purple"
                          : "border-white/10 text-white/40 hover:border-neon-purple/50 hover:text-neon-purple"
                      }`}
                    >
                      <Pin className="size-3.5" />
                    </button>
                  </Tooltip>

                  <Tooltip texto="codigos.excluirEmail" titulo="Apagar mensagem">
                    <button
                      type="button"
                      aria-label="Apagar mensagem"
                      disabled={remover.isPending}
                      onClick={() => remover.mutate({ id: m.id })}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Tooltip>
                </div>

                {expandido && (
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words border-t border-white/8 px-4 py-3 font-mono text-[11px] leading-relaxed text-white/70">
                    {corpo || "(mensagem vazia)"}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

export default CaixaEntrada;
