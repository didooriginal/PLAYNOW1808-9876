import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Copy,
  KeyRound,
  Loader2,
  Timer,
  Trash2,
  Webhook,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, accentHex } from "../ui/kit";
import { Ajuda, Campo, TituloSecao, Tooltip } from "../ui/tooltip";
import {
  useCodigos,
  useRegistrarEmailManual,
  useRemoverCodigo,
  useVincularCodigo,
  haQuantoTempo,
  horaBr,
  minutosRestantes,
} from "../../queries/codigos";
import { useUsuarios } from "../../queries/usuarios";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

const EXEMPLO = `De: info@account.netflix.com
Para: matriz.ntf01@playplusnow.com
Assunto: Seu código de acesso temporário

Olá! Use o código 481920 para completar o login. Ele expira em 15 minutos.`;

/** Colagem manual: o admin joga o e-mail inteiro aqui e o parser faz o resto. */
function ColarEmail() {
  const registrar = useRegistrarEmailManual();
  const [corpo, setCorpo] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  return (
    <GlassCard strong accent="purple" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloSecao
          ajuda="codigos.colar"
          icone={<ClipboardPaste className="size-4 text-neon-purple" />}
        >
          Colar e-mail recebido
        </TituloSecao>
        <button
          type="button"
          onClick={() => setCorpo(EXEMPLO)}
          className="font-sans text-[11px] text-white/40 underline-offset-2 hover:text-white hover:underline"
        >
          usar exemplo
        </button>
      </div>
      <p className="mt-1.5 font-sans text-xs text-white/40">
        Cole o e-mail completo (com as linhas <span className="font-mono">De:</span>,{" "}
        <span className="font-mono">Para:</span> e <span className="font-mono">Assunto:</span> se
        tiver). O sistema extrai o código de 4 a 6 dígitos, identifica o serviço e tenta vincular ao
        cliente.
      </p>

      <Campo
        label="Conteúdo do e-mail"
        ajuda="codigos.colar"
        htmlFor="codigos-corpo"
        className="mt-4"
      >
        <textarea
          id="codigos-corpo"
          className={`${inputCls} min-h-[132px] font-mono text-xs leading-relaxed`}
          placeholder="Cole aqui o conteúdo do e-mail..."
          value={corpo}
          onChange={(e) => {
            setCorpo(e.target.value);
            setOk(null);
          }}
        />
      </Campo>

      {registrar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">{registrar.error?.message}</p>
      )}
      {ok && <p className="mt-3 font-sans text-xs text-emerald-400">Código {ok} registrado.</p>}

      <NeonButton
        accent="purple"
        size="sm"
        className="mt-4"
        disabled={registrar.isPending || corpo.trim().length < 4}
        onClick={() =>
          registrar.mutate(
            { corpo, remetente: "", destinatario: "", assunto: "" },
            {
              onSuccess: (r) => {
                setOk(r.codigo);
                setCorpo("");
              },
            },
          )
        }
      >
        {registrar.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
        Extrair código
      </NeonButton>
    </GlassCard>
  );
}

/** Instrução do webhook — funciona com qualquer provedor de inbound email. */
function WebhookCard() {
  const [copiado, setCopiado] = useState(false);
  const url =
    typeof window === "undefined" ? "/api/webhooks/email" : `${window.location.origin}/api/webhooks/email`;

  return (
    <GlassCard accent="cyan" className="p-5">
      <TituloSecao
        ajuda="codigos.entradaAutomatica"
        icone={<Webhook className="size-4 text-neon-cyan" />}
      >
        Entrada automática
      </TituloSecao>
      <p className="mt-1.5 font-sans text-xs text-white/40">
        Aponte o inbound email do seu provedor para esta URL. Aceita JSON com{" "}
        <span className="font-mono text-white/60">from</span>,{" "}
        <span className="font-mono text-white/60">to</span>,{" "}
        <span className="font-mono text-white/60">subject</span> e{" "}
        <span className="font-mono text-white/60">text</span>.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        }}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left transition-colors hover:border-neon-cyan/40"
      >
        <span className="truncate font-mono text-[11px] text-neon-cyan">POST {url}</span>
        {copiado ? (
          <Check className="size-3.5 shrink-0 text-emerald-400" />
        ) : (
          <Copy className="size-3.5 shrink-0 text-white/40" />
        )}
      </button>
      <p className="mt-3 font-sans text-[11px] text-white/30">
        Opcional: defina <span className="font-mono">EMAIL_WEBHOOK_TOKEN</span> no .env e envie o
        header <span className="font-mono">x-webhook-token</span>.
      </p>
    </GlassCard>
  );
}

export function CodigosView() {
  const { data, isPending, isError, error } = useCodigos();
  const clientes = useUsuarios();
  const vincular = useVincularCodigo();
  const remover = useRemoverCodigo();
  const [copiado, setCopiado] = useState<number | null>(null);

  const codigos = data ?? [];
  const semDono = codigos.filter((c) => !c.clienteId).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Códigos na última hora",
            ajuda: "codigos.expira",
            value: String(codigos.length),
            sub: "apagados automaticamente após 60 min",
            accent: "cyan" as const,
          },
          {
            label: "Sem cliente vinculado",
            ajuda: "Códigos que chegaram numa conta compartilhada e o sistema não conseguiu atribuir. Escolha o cliente na lista ao lado do código.",
            value: String(semDono),
            sub: "conta compartilhada — vincule na mão",
            accent: "red" as const,
          },
          {
            label: "Vinculados",
            ajuda: "Códigos já entregues no painel do cliente certo, sem você fazer nada.",
            value: String(codigos.length - semDono),
            sub: "visíveis no painel do cliente",
            accent: "purple" as const,
          },
        ].map((s) => (
          <GlassCard key={s.label} accent={s.accent} className="p-5">
            <div className="flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
              <Ajuda ajuda={s.ajuda} />
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">{s.value}</div>
            <div className="mt-1 font-sans text-[11px]" style={{ color: accentHex[s.accent] }}>
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <ColarEmail />
        <WebhookCard />
      </div>

      {isError && (
        <GlassCard accent="red" className="p-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-neon-red" />
          <p className="mt-3 font-display text-sm font-bold text-white">
            Erro ao carregar a central
          </p>
          <p className="mt-1.5 font-sans text-xs text-white/45">{error?.message}</p>
        </GlassCard>
      )}

      {isPending ? (
        <GlassCard className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="size-5 animate-spin text-neon-cyan" />
          <span className="font-sans text-sm text-white/45">Buscando códigos...</span>
        </GlassCard>
      ) : codigos.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <KeyRound className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-display text-sm font-bold text-white">
            Nenhum código na última hora
          </p>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            Assim que um e-mail de verificação chegar pelo webhook — ou você colar um aqui — ele
            aparece nesta lista.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {codigos.map((c) => (
            <GlassCard key={c.id} hover className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <AppIcon id={c.servicoSlug} size="sm" active />
                <div className="min-w-[140px] flex-1">
                  <div className="font-display text-sm font-bold text-white">{c.servico}</div>
                  <div className="truncate font-mono text-[10px] text-white/30">
                    {c.destinatario || c.remetente || "origem desconhecida"}
                  </div>
                </div>

                <Tooltip texto="codigos.copiar" titulo="Copiar código">
                <button
                  type="button"
                  aria-label={`Copiar código ${c.codigo}`}
                  onClick={() => {
                    void navigator.clipboard?.writeText(c.codigo);
                    setCopiado(c.id);
                    setTimeout(() => setCopiado(null), 1800);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/[0.07] px-4 py-2 transition-colors hover:border-neon-cyan/60"
                >
                  <span className="font-display text-xl font-extrabold tracking-[0.22em] text-neon-cyan">
                    {c.codigo}
                  </span>
                  {copiado === c.id ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5 text-white/40" />
                  )}
                </button>
                </Tooltip>

                <div className="min-w-[150px]">
                  <div className="font-sans text-xs text-white/70">{horaBr(c.recebidoEm)}</div>
                  <div className="font-sans text-[11px] text-white/35">
                    {haQuantoTempo(c.recebidoEm)}
                  </div>
                </div>

                <Tooltip texto="codigos.expira" titulo="Validade do código">
                  <Pill
                    accent={minutosRestantes(c.recebidoEm) < 10 ? "red" : "cyan"}
                    icon={<Timer className="size-3" />}
                  >
                    expira em {minutosRestantes(c.recebidoEm)} min
                  </Pill>
                </Tooltip>

                <select
                  className={`${inputCls} max-w-[200px]`}
                  aria-label="Vincular o código a um cliente"
                  value={c.clienteId ?? ""}
                  disabled={vincular.isPending}
                  onChange={(e) =>
                    vincular.mutate({
                      id: c.id,
                      clienteId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="" className="bg-[#09090b]">
                    sem cliente
                  </option>
                  {(clientes.data ?? []).map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#09090b]">
                      {u.nome}
                    </option>
                  ))}
                </select>

                <Tooltip texto="codigos.descartar" titulo="Descartar código">
                  <button
                    type="button"
                    aria-label="Descartar código"
                    disabled={remover.isPending}
                    onClick={() => remover.mutate({ id: c.id })}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Tooltip>
              </div>

              {c.assunto && (
                <p className="mt-3 truncate font-sans text-[11px] text-white/30">
                  <span className="text-white/50">{c.assunto}</span> — {c.trecho}
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

export default CodigosView;
