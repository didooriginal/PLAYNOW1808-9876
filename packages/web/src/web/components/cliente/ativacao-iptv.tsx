import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MonitorSmartphone,
  Radio,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useCancelarMac,
  useEnviarMac,
  useMinhaAtivacaoIptv,
  dataHoraCurta,
  formatarMac,
  macCompleto,
} from "../../queries/iptv";

/**
 * ATIVAR IPTV — aba do painel do cliente.
 *
 * O IPTV nao tem login/senha: o app Fun Play e liberado pelo ENDERECO MAC do
 * aparelho. Esta tela repete, na ordem, os 3 passos do e-mail de boas-vindas
 * (baixar o app, achar o MAC no canto inferior direito, enviar aqui) e mostra
 * o andamento de cada aparelho enviado.
 */

const ESTILO: Record<string, { rotulo: string; classe: string }> = {
  pendente: {
    rotulo: "Aguardando ativação",
    classe: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  },
  ativado: {
    rotulo: "Ativado",
    classe: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  },
  recusado: { rotulo: "Não aceito", classe: "border-neon-red/40 bg-neon-red/10 text-neon-red" },
  cancelado: { rotulo: "Cancelado", classe: "border-white/15 bg-white/5 text-white/40" },
};

export function AtivacaoIptv() {
  const { data, isPending } = useMinhaAtivacaoIptv();
  const enviar = useEnviarMac();
  const cancelar = useCancelarMac();
  const [mac, setMac] = useState("");
  const [dispositivo, setDispositivo] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);

  const linkApp = data?.linkApp ?? "https://funplays.com.br/";
  const pedidos = data?.pedidos ?? [];
  const pronto = macCompleto(mac);

  function submeter() {
    if (!pronto || enviar.isPending) return;
    enviar.mutate(
      { mac, dispositivo },
      {
        onSuccess: () => {
          setMac("");
          setDispositivo("");
        },
      },
    );
  }

  async function copiar(id: number, valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* clipboard bloqueado pelo navegador: ignora */
    }
  }

  if (isPending) {
    return (
      <GlassCard className="p-10 text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-neon-cyan" />
        <p className="mt-3 font-sans text-sm text-white/40">Carregando sua ativação...</p>
      </GlassCard>
    );
  }

  if (data?.bloqueado) {
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <TriangleAlert className="mx-auto size-6 text-neon-red" />
        <p className="mt-3 font-display text-sm font-bold text-white">
          Ativação indisponível enquanto o pagamento está pendente
        </p>
        <p className="mt-1.5 font-sans text-xs text-white/45">
          Regularize a mensalidade na aba &ldquo;Pagar / Renovar&rdquo; e a ativação volta na hora.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* PASSO A PASSO — mesma ordem do e-mail que ele recebeu */}
      <GlassCard strong accent="cyan" className="p-6">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-neon-cyan" />
          <span className="font-display text-sm font-bold text-white">
            Como liberar seus canais ao vivo
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "1",
              titulo: "Baixe o app Fun Play",
              texto:
                "Instale no seu TV Box, Fire Stick, Smart TV ou celular. O site tem as versões e os links da Google Play e da App Store.",
            },
            {
              n: "2",
              titulo: "Ache o endereço MAC",
              texto:
                "Abra o aplicativo: o endereço MAC aparece no canto inferior direito da tela, no formato AA:BB:CC:DD:EE:FF.",
            },
            {
              n: "3",
              titulo: "Envie o MAC aqui",
              texto:
                "Cole o MAC no campo abaixo. Cadastramos no servidor e seus canais liberam — você é avisado neste painel.",
            },
          ].map((p) => (
            <div key={p.n} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex size-7 items-center justify-center rounded-full bg-neon-cyan/15 font-display text-xs font-bold text-neon-cyan">
                {p.n}
              </div>
              <div className="mt-3 font-display text-sm font-semibold text-white">{p.titulo}</div>
              <p className="mt-1 font-sans text-xs leading-relaxed text-white/45">{p.texto}</p>
            </div>
          ))}
        </div>
        <a
          href={linkApp}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 font-sans text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/20"
        >
          <Download className="size-3.5" />
          Baixar o app Fun Play
          <ExternalLink className="size-3" />
        </a>
      </GlassCard>

      {/* FORMULARIO DO MAC */}
      <GlassCard strong className="p-6">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="size-4 text-neon-purple" />
          <span className="font-display text-sm font-bold text-white">
            Enviar endereço MAC do aparelho
          </span>
        </div>

        {data && !data.temIptv && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 font-sans text-xs text-amber-200">
            Não encontramos um plano de canais ao vivo ativo na sua conta. Se você acabou de
            comprar, pode enviar o MAC normalmente — a ativação é conferida pela nossa equipe.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
              Endereço MAC
            </span>
            <input
              value={mac}
              onChange={(e) => setMac(formatarMac(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && submeter()}
              placeholder="AA:BB:CC:DD:EE:FF"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Endereço MAC que aparece no canto inferior direito do aplicativo"
              className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-mono text-sm tracking-[0.12em] text-white outline-none transition placeholder:text-white/20 focus:border-neon-cyan/60"
            />
          </label>
          <label className="block">
            <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
              Aparelho (opcional)
            </span>
            <input
              value={dispositivo}
              onChange={(e) => setDispositivo(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && submeter()}
              placeholder="TV Box da sala, Fire Stick..."
              aria-label="Onde o aplicativo está instalado"
              className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-sans text-sm text-white outline-none transition placeholder:text-white/20 focus:border-neon-cyan/60"
            />
          </label>
          <NeonButton
            accent="cyan"
            onClick={submeter}
            disabled={!pronto || enviar.isPending}
            className="w-full sm:w-auto"
          >
            {enviar.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enviar MAC"}
          </NeonButton>
        </div>

        <p className="mt-2 font-sans text-[11px] text-white/30">
          {mac && !pronto
            ? "Faltam dígitos: o MAC tem 12 caracteres (0-9 e A-F)."
            : "Digite só os números e letras — a gente coloca os dois-pontos automaticamente."}
        </p>

        {enviar.isError && (
          <p className="mt-3 rounded-xl border border-neon-red/30 bg-neon-red/10 p-3 font-sans text-xs text-neon-red">
            {enviar.error?.message}
          </p>
        )}
      </GlassCard>

      {/* HISTORICO DE APARELHOS */}
      <GlassCard strong className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <span className="font-display text-sm font-bold text-white">Meus aparelhos</span>
          {data?.pendente && (
            <Pill accent="red" icon={<Clock className="size-3" />}>
              1 aguardando
            </Pill>
          )}
        </div>

        {pedidos.length === 0 ? (
          <div className="p-8 text-center">
            <MonitorSmartphone className="mx-auto size-6 text-white/20" />
            <p className="mt-3 font-sans text-sm text-white/40">
              Você ainda não enviou nenhum endereço MAC.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {pedidos.map((p) => {
              const estilo = ESTILO[p.status] ?? ESTILO.pendente!;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tracking-[0.12em] text-white">
                        {p.mac}
                      </span>
                      <button
                        onClick={() => copiar(p.id, p.mac)}
                        aria-label="Copiar endereço MAC"
                        className="rounded-lg p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
                      >
                        {copiado === p.id ? (
                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="mt-1 font-sans text-[11px] text-white/35">
                      {p.dispositivo ? `${p.dispositivo} · ` : ""}enviado em{" "}
                      {dataHoraCurta(p.criadoEm)}
                      {p.ativadoEm ? ` · ativado em ${dataHoraCurta(p.ativadoEm)}` : ""}
                    </div>
                    {p.respostaAdmin && (
                      <p className="mt-1.5 font-sans text-xs leading-relaxed text-white/50">
                        {p.respostaAdmin}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${estilo.classe}`}
                  >
                    {estilo.rotulo}
                  </span>
                  {p.status === "pendente" && (
                    <button
                      onClick={() => cancelar.mutate({ id: p.id })}
                      disabled={cancelar.isPending}
                      aria-label="Cancelar esta solicitação"
                      className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/10 hover:text-neon-red"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VERSAO COMPACTA — vive DENTRO do card do app no painel do cliente. */
/* O IPTV nao entrega login/senha, entao o card nao pode ficar dizendo   */
/* "estamos preparando o seu acesso": o proprio card precisa ter o campo */
/* do MAC, o botao de baixar o Fun Play e a dica de onde achar o MAC.    */
/* ------------------------------------------------------------------ */

export function AtivacaoIptvCard() {
  const { data, isPending } = useMinhaAtivacaoIptv();
  const enviar = useEnviarMac();
  const cancelar = useCancelarMac();
  const [mac, setMac] = useState("");
  const [dispositivo, setDispositivo] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  const linkApp = data?.linkApp ?? "https://funplays.com.br/";
  const pronto = macCompleto(mac);
  const pedidos = (data?.pedidos ?? []).filter((p) => p.status !== "cancelado");
  const visiveis = verTodos ? pedidos : pedidos.slice(0, 2);

  function submeter() {
    if (!pronto || enviar.isPending) return;
    enviar.mutate(
      { mac, dispositivo },
      {
        onSuccess: () => {
          setMac("");
          setDispositivo("");
        },
      },
    );
  }

  if (isPending) {
    return (
      <div className="relative mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-6 text-center">
        <Loader2 className="mx-auto size-4 animate-spin text-neon-cyan" />
      </div>
    );
  }

  if (data?.bloqueado) {
    return (
      <div className="relative mt-5 rounded-xl border border-neon-red/35 bg-neon-red/10 p-4 text-center">
        <TriangleAlert className="mx-auto size-4 text-neon-red" />
        <p className="mt-2 font-display text-xs font-bold text-white">
          Ativação liberada após o pagamento
        </p>
        <p className="mt-1 font-sans text-[11px] text-white/50">
          Regularize a mensalidade e o campo do MAC volta na hora.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mt-5 space-y-3">
      {/* passo 1 — baixar o app */}
      <a
        href={linkApp}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-xl border border-neon-cyan/35 bg-neon-cyan/[0.08] p-3 transition hover:bg-neon-cyan/15"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neon-cyan/15">
          <Download className="size-4 text-neon-cyan" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xs font-bold text-white">
            1. Baixe o aplicativo Fun Play
          </div>
          <div className="mt-0.5 font-sans text-[11px] text-white/45">
            TV Box, Fire Stick, Smart TV ou celular
          </div>
        </div>
        <ExternalLink className="size-3.5 shrink-0 text-neon-cyan" />
      </a>

      {/* passo 2 — onde achar o MAC */}
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
        <div className="font-display text-xs font-bold text-white">2. Ache o endereço MAC</div>
        <p className="mt-1 font-sans text-[11px] leading-relaxed text-white/50">
          Abra o aplicativo: o MAC aparece no{" "}
          <strong className="text-white/80">canto inferior direito da tela</strong>, no formato{" "}
          <span className="font-mono text-white/80">AA:BB:CC:DD:EE:FF</span>.
        </p>
      </div>

      {/* passo 3 — o campo pra ele mandar pra gente */}
      <div className="rounded-xl border border-neon-purple/35 bg-neon-purple/[0.07] p-3">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="size-3.5 text-neon-purple" />
          <span className="font-display text-xs font-bold text-white">
            3. Envie o MAC para a gente
          </span>
        </div>
        <input
          value={mac}
          onChange={(e) => setMac(formatarMac(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && submeter()}
          placeholder="AA:BB:CC:DD:EE:FF"
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Endereço MAC que aparece no canto inferior direito do aplicativo"
          className="mt-2.5 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-center font-mono text-sm tracking-[0.16em] text-white outline-none transition placeholder:text-white/20 focus:border-neon-cyan/60"
        />
        <input
          value={dispositivo}
          onChange={(e) => setDispositivo(e.target.value.slice(0, 80))}
          onKeyDown={(e) => e.key === "Enter" && submeter()}
          placeholder="Qual aparelho? (opcional)"
          aria-label="Onde o aplicativo está instalado"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-sans text-xs text-white outline-none transition placeholder:text-white/20 focus:border-neon-cyan/60"
        />
        <NeonButton
          accent="cyan"
          size="sm"
          onClick={submeter}
          disabled={!pronto || enviar.isPending}
          className="mt-2.5 w-full"
        >
          {enviar.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Send className="size-3.5" />
              Enviar meu MAC
            </>
          )}
        </NeonButton>
        <p className="mt-1.5 text-center font-sans text-[10.5px] text-white/30">
          {mac && !pronto
            ? "Faltam dígitos: o MAC tem 12 caracteres (0-9 e A-F)."
            : "Digite só letras e números — os dois-pontos entram sozinhos."}
        </p>
        {enviar.isError && (
          <p className="mt-2 rounded-lg border border-neon-red/30 bg-neon-red/10 p-2 font-sans text-[11px] text-neon-red">
            {enviar.error?.message}
          </p>
        )}
      </div>

      {/* andamento dos aparelhos ja enviados */}
      {visiveis.length > 0 && (
        <div className="space-y-2">
          {visiveis.map((p) => {
            const estilo = ESTILO[p.status] ?? ESTILO.pendente!;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                {p.status === "ativado" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <Clock className="size-3.5 shrink-0 text-amber-300" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11.5px] tracking-[0.1em] text-white/85">
                    {p.mac}
                  </div>
                  <div className="font-sans text-[10.5px] text-white/35">
                    {p.dispositivo ? `${p.dispositivo} · ` : ""}
                    {estilo.rotulo.toLowerCase()} · {dataHoraCurta(p.criadoEm)}
                  </div>
                </div>
                {p.status === "pendente" && (
                  <button
                    type="button"
                    onClick={() => cancelar.mutate({ id: p.id })}
                    disabled={cancelar.isPending}
                    aria-label="Cancelar esta solicitação"
                    className="rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-neon-red"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {pedidos.length > 2 && (
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              className="w-full rounded-xl border border-white/8 py-1.5 font-sans text-[11px] text-white/40 transition hover:text-white"
            >
              {verTodos ? "Ver menos" : `Ver todos os ${pedidos.length} aparelhos`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
