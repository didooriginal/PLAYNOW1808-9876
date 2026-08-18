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
