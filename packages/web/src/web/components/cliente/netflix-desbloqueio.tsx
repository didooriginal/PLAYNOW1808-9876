import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Clock,
  Loader2,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  Send,
  ShieldAlert,
  Timer,
  Tv,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useCancelarTv,
  useMinhaTelaNetflix,
  useSolicitarTv,
  haQuantoTempoTv,
  horaCurta,
} from "../../queries/netflix";
import { minutosRestantes } from "../../queries/codigos";

/**
 * DESBLOQUEAR TELA NETFLIX — central de auto-atendimento do cliente.
 *
 * A Netflix trava a sessao de duas formas e o cliente nunca sabe qual e a
 * dele. Por isso a tela comeca por um diagnostico visual ("o que aparece na
 * sua TV?") e so depois abre o metodo certo:
 *
 *   A) codigo enviado por e-mail  -> aparece aqui em segundos, e so copiar
 *   B) codigo na tela da TV (tv2) -> vai para a fila prioritaria do admin
 *
 * Objetivo: resolver em menos de 1 minuto, sem abrir chamado.
 */

const NETFLIX = "#e50914";

/** abre o assistente de IA com uma pergunta pronta */
function perguntarIa(pergunta: string) {
  window.dispatchEvent(new CustomEvent("ppn:assistente", { detail: { pergunta } }));
}

/* ------------------------------------------------------------------ */

function Passos({ itens }: { itens: string[] }) {
  return (
    <ol className="mt-4 space-y-2.5">
      {itens.map((passo, i) => (
        <li key={passo} className="flex gap-3">
          <span
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-display text-[11px] font-bold"
            style={{ borderColor: `${NETFLIX}66`, color: "#ff6b74", background: `${NETFLIX}18` }}
          >
            {i + 1}
          </span>
          <span className="font-sans text-[12.5px] leading-relaxed text-white/60">{passo}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* OPCAO A — codigo por e-mail                                         */
/* ------------------------------------------------------------------ */

function OpcaoEmail({
  codigos,
  atualizando,
  onAtualizar,
}: {
  codigos: Array<{ id: number; codigo: string; recebidoEm: Date | string }>;
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const [copiado, setCopiado] = useState<number | null>(null);
  const principal = codigos[0];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4" style={{ color: "#ff6b74" }} />
            <span className="font-display text-sm font-bold text-white">
              Código enviado para o e-mail da conta
            </span>
          </div>
          <button
            type="button"
            onClick={onAtualizar}
            data-testid="netflix-atualizar-codigo"
            className="flex items-center gap-1.5 font-sans text-[11px] text-white/40 transition-colors hover:text-white"
          >
            <RefreshCw className={atualizando ? "size-3 animate-spin" : "size-3"} />
            buscar de novo
          </button>
        </div>

        {principal ? (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-testid="netflix-copiar-codigo"
              onClick={() => {
                void navigator.clipboard?.writeText(principal.codigo);
                setCopiado(principal.id);
                setTimeout(() => setCopiado(null), 1800);
              }}
              className="flex items-center gap-3 rounded-2xl border px-5 py-3 transition-colors"
              style={{ borderColor: `${NETFLIX}66`, background: `${NETFLIX}14` }}
            >
              <span
                className="font-display text-3xl font-extrabold tracking-[0.22em]"
                style={{ color: "#ff6b74" }}
              >
                {principal.codigo}
              </span>
              {copiado === principal.id ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4 text-white/45" />
              )}
            </button>
            <div className="space-y-1.5">
              <Pill accent="cyan" icon={<Timer className="size-3" />}>
                expira em {minutosRestantes(principal.recebidoEm)} min
              </Pill>
              <div className="font-sans text-[11px] text-white/35">
                recebido {haQuantoTempoTv(principal.recebidoEm)} · toque no código para copiar
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-4">
            <p className="font-sans text-xs leading-relaxed text-amber-200/90">
              Nenhum código da Netflix chegou na última hora. Peça o envio na TV (botão{" "}
              <strong className="font-semibold">Enviar e-mail</strong>) e toque em{" "}
              <strong className="font-semibold">buscar de novo</strong> — ele aparece aqui em
              segundos, sem precisar acessar o e-mail da conta.
            </p>
          </div>
        )}

        {codigos.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-3">
            <span className="font-sans text-[11px] text-white/30">códigos anteriores:</span>
            {codigos.slice(1).map((c) => (
              <span key={c.id} className="font-mono text-[11px] text-white/40">
                {c.codigo} ({horaCurta(c.recebidoEm)})
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-white/45">
          Passo a passo na TV
        </div>
        <Passos
          itens={[
            'Na tela de bloqueio da TV, escolha "Enviar e-mail" (ou "Obter código por e-mail").',
            'A Netflix responde "E-mail enviado" e mostra o campo para digitar o código.',
            "Volte aqui e toque no código acima para copiar — ele chega em poucos segundos.",
            "Digite os 4 dígitos na TV e confirme. A tela libera na hora.",
            "Se o código não aparecer em 1 minuto, toque em buscar de novo antes de pedir suporte.",
          ]}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OPCAO B — codigo da TV (netflix.com/tv2)                            */
/* ------------------------------------------------------------------ */

type Solicitacao = {
  id: number;
  codigoTv: string;
  dispositivo: string;
  status: string;
  respostaAdmin: string;
  criadoEm: Date | string;
};

const ESTILO_STATUS: Record<string, { cls: string; rotulo: string }> = {
  pendente: {
    cls: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    rotulo: "aguardando aprovação",
  },
  aprovado: {
    cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    rotulo: "liberado",
  },
  recusado: { cls: "border-neon-red/40 bg-neon-red/10 text-neon-red", rotulo: "recusado" },
  cancelado: { cls: "border-white/15 bg-white/5 text-white/45", rotulo: "cancelado" },
};

function OpcaoTv({
  solicitacoes,
  pendente,
}: {
  solicitacoes: Solicitacao[];
  pendente: Solicitacao | null;
}) {
  const enviar = useSolicitarTv();
  const cancelar = useCancelarTv();
  const [codigo, setCodigo] = useState("");
  const [dispositivo, setDispositivo] = useState("");

  const limpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const valido = limpo.length >= 4;
  const ultima = solicitacoes[0];
  const aprovadaAgora =
    ultima?.status === "aprovado" &&
    Date.now() - new Date(ultima.criadoEm).getTime() < 30 * 60_000;

  return (
    <div className="space-y-4">
      {pendente ? (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-400/[0.07] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Loader2 className="size-4 animate-spin text-amber-300" />
              <span className="font-display text-sm font-bold text-white">
                Código enviado para a equipe
              </span>
            </div>
            <Pill accent="cyan" icon={<Clock className="size-3" />}>
              {haQuantoTempoTv(pendente.criadoEm)}
            </Pill>
          </div>
          <p className="mt-2 font-sans text-xs leading-relaxed text-white/55">
            Estamos autorizando o código{" "}
            <strong className="font-mono text-amber-200">{pendente.codigoTv}</strong> na conta.
            Deixe a tela da TV aberta — ela libera sozinha assim que aprovarmos. Esta tela
            atualiza automaticamente.
          </p>
          <div className="mt-4">
            <NeonButton
              accent="red"
              variant="outline"
              size="sm"
              data-testid="netflix-cancelar-tv"
              disabled={cancelar.isPending}
              onClick={() => cancelar.mutate({ id: pendente.id })}
            >
              {cancelar.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              Cancelar e enviar outro código
            </NeonButton>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-5">
          <div className="flex items-center gap-2">
            <Tv className="size-4" style={{ color: "#ff6b74" }} />
            <span className="font-display text-sm font-bold text-white">
              Digite o código que apareceu na TV
            </span>
          </div>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            É o código curto exibido junto do endereço{" "}
            <span className="font-mono text-white/60">netflix.com/tv2</span>.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div>
              <label
                htmlFor="codigo-tv"
                className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30"
              >
                Código da TV
              </label>
              <input
                id="codigo-tv"
                data-testid="netflix-input-tv"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 12))}
                placeholder="Ex.: 7K4M92"
                autoComplete="off"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center font-display text-xl font-extrabold tracking-[0.28em] text-white placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-white/25 focus:outline-none"
                style={{ borderColor: valido ? `${NETFLIX}88` : undefined }}
              />
            </div>
            <div>
              <label
                htmlFor="dispositivo-tv"
                className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30"
              >
                Onde apareceu (opcional)
              </label>
              <input
                id="dispositivo-tv"
                value={dispositivo}
                onChange={(e) => setDispositivo(e.target.value.slice(0, 80))}
                placeholder="Smart TV da sala"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none"
              />
            </div>
          </div>

          {enviar.isError && (
            <p className="mt-3 font-sans text-xs text-neon-red">{enviar.error?.message}</p>
          )}

          <div className="mt-4">
            <NeonButton
              accent="red"
              data-testid="netflix-enviar-tv"
              disabled={!valido || enviar.isPending}
              onClick={() => {
                enviar.mutate(
                  { codigoTv: limpo, dispositivo: dispositivo.trim() },
                  {
                    onSuccess: () => {
                      setCodigo("");
                      setDispositivo("");
                    },
                  },
                );
              }}
            >
              {enviar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Enviar código para liberação
            </NeonButton>
          </div>
        </div>
      )}

      {aprovadaAgora && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.08] p-5">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold text-white">
              Liberado! Volte para a TV
            </div>
            <p className="mt-0.5 font-sans text-xs text-white/55">
              {ultima.respostaAdmin ||
                "Código autorizado na conta. A tela da TV destrava em alguns segundos."}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-white/45">
          Passo a passo na TV
        </div>
        <Passos
          itens={[
            'Na TV, escolha a opção que mostra o endereço netflix.com/tv2 e um código curto.',
            "Anote o código exatamente como aparece (letras e números).",
            "Digite o código no campo acima e toque em Enviar código para liberação.",
            "Nós autorizamos pela conta principal — normalmente em poucos minutos.",
            "Quando o status aqui virar liberado, a tela da TV destrava sozinha. Não feche a TV.",
          ]}
        />
      </div>

      {solicitacoes.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Seus últimos envios
          </div>
          <div className="mt-3 divide-y divide-white/6">
            {solicitacoes.map((s) => {
              const estilo = ESTILO_STATUS[s.status] ?? ESTILO_STATUS.cancelado;
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="font-mono text-sm font-bold tracking-widest text-white/80">
                    {s.codigoTv}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-sans text-[11px] text-white/35">
                    {s.dispositivo || "dispositivo não informado"} · {haQuantoTempoTv(s.criadoEm)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest",
                      estilo.cls,
                    )}
                  >
                    {estilo.rotulo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SECAO                                                               */
/* ------------------------------------------------------------------ */

type Metodo = "email" | "tv";

export function DesbloquearNetflix() {
  const { data, isPending, isFetching, refetch } = useMinhaTelaNetflix();
  const [metodo, setMetodo] = useState<Metodo | null>(null);

  const pendente = (data?.pendente ?? null) as Solicitacao | null;
  const solicitacoes = (data?.solicitacoes ?? []) as Solicitacao[];
  const codigos = data?.codigos ?? [];

  // abre sozinho no metodo que ja esta em andamento — menos cliques para o cliente
  useEffect(() => {
    if (metodo || !data) return;
    if (pendente) setMetodo("tv");
    else if (codigos.length) setMetodo("email");
  }, [data, pendente, codigos.length, metodo]);

  const cenarios = useMemo(
    () => [
      {
        id: "email" as const,
        icone: Mail,
        titulo: "A TV fala em e-mail",
        tela: '"Enviamos um código para o e-mail da conta" ou "Estou viajando".',
        acao: "Pegar o código agora",
        badge: codigos.length ? "código disponível" : null,
      },
      {
        id: "tv" as const,
        icone: MonitorSmartphone,
        titulo: "A TV mostra netflix.com/tv2",
        tela: "Um código curto na tela junto com o endereço netflix.com/tv2.",
        acao: "Enviar o código da TV",
        badge: pendente ? "em análise" : null,
      },
    ],
    [codigos.length, pendente],
  );

  return (
    <GlassCard
      strong
      className="p-5 sm:p-6"
      style={{ borderColor: `${NETFLIX}44` }}
      data-testid="netflix-secao"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-2xl border"
            style={{ borderColor: `${NETFLIX}55`, background: `${NETFLIX}18` }}
          >
            <Tv className="size-5" style={{ color: "#ff6b74" }} />
          </span>
          <div>
            <h2 className="font-display text-lg font-extrabold text-white">
              Desbloquear Tela Netflix
            </h2>
            <p className="font-sans text-[11px] text-white/40">
              Resolva sozinho em menos de 1 minuto — sem abrir chamado.
            </p>
          </div>
        </div>
        {data?.conta && (
          <Pill accent="cyan">
            {data.conta.emManutencao ? "conta em manutenção" : "conta ativa"}
          </Pill>
        )}
      </div>

      {isPending ? (
        <div className="mt-6 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin" style={{ color: "#ff6b74" }} />
          <span className="font-sans text-xs text-white/40">Carregando sua conta Netflix...</span>
        </div>
      ) : !data?.temNetflix ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-sans text-xs leading-relaxed text-white/45">
            A Netflix não faz parte do seu pacote no momento. Fale com a equipe na aba
            Novidades/Upgrades para incluir.
          </p>
        </div>
      ) : (
        <>
          {/* diagnostico visual — o cliente escolhe pela tela que esta vendo */}
          <div className="mt-5">
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
              1. O que aparece na sua TV?
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {cenarios.map((c) => {
                const ativo = metodo === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`netflix-metodo-${c.id}`}
                    onClick={() => setMetodo(c.id)}
                    className={cn(
                      "group rounded-2xl border p-4 text-left transition-all",
                      ativo
                        ? "bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20",
                    )}
                    style={ativo ? { borderColor: `${NETFLIX}88` } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <c.icone
                          className="size-4 shrink-0"
                          style={{ color: ativo ? "#ff6b74" : undefined }}
                        />
                        <span className="font-display text-sm font-bold text-white">
                          {c.titulo}
                        </span>
                      </span>
                      {c.badge ? (
                        <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 font-sans text-[9px] uppercase tracking-widest text-emerald-300">
                          {c.badge}
                        </span>
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-white/25" />
                      )}
                    </div>
                    <p className="mt-2 font-sans text-[11.5px] leading-relaxed text-white/45">
                      {c.tela}
                    </p>
                    <span
                      className="mt-3 inline-block font-sans text-[11px] font-semibold"
                      style={{ color: ativo ? "#ff6b74" : "rgba(255,255,255,0.35)" }}
                    >
                      {c.acao}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {metodo && (
            <div className="mt-5">
              <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
                2. {metodo === "email" ? "Método por e-mail" : "Método por código de TV"}
              </div>
              <div className="mt-3">
                {metodo === "email" ? (
                  <OpcaoEmail
                    codigos={codigos}
                    atualizando={isFetching}
                    onAtualizar={() => void refetch()}
                  />
                ) : (
                  <OpcaoTv solicitacoes={solicitacoes} pendente={pendente} />
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4 pb-14 sm:pb-2 sm:pr-32">
            <ShieldAlert className="size-4 shrink-0 text-white/30" />
            <p className="min-w-0 flex-1 font-sans text-[11px] leading-relaxed text-white/35">
              Nunca troque a senha, o e-mail ou o telefone da conta Netflix — isso derruba todo
              mundo e o acesso precisa ser refeito.
            </p>
            <NeonButton
              accent="cyan"
              variant="outline"
              size="sm"
              data-testid="netflix-perguntar-ia"
              onClick={() =>
                perguntarIa(
                  metodo === "tv"
                    ? "Minha TV mostra o código do netflix.com/tv2. O que eu faço agora?"
                    : "Como desbloqueio a tela da Netflix pelo código enviado por e-mail?",
                )
              }
            >
              <Bot className="size-3.5" />
              Perguntar ao assistente
            </NeonButton>
          </div>
        </>
      )}
    </GlassCard>
  );
}

export default DesbloquearNetflix;
