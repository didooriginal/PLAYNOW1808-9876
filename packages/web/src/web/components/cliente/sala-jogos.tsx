import { Link } from "wouter";
import { useState } from "react";
import { Check, Copy, Gamepad2, Loader2, LogOut, Timer, Zap } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useCancelarJogos,
  useContratarJogos,
  useDevolverAcessoJogos,
  useMeuAcessoJogos,
  usePegarAcessoJogos,
} from "../../queries/jogos";

/**
 * SALA DE JOGOS (cliente).
 * Nada de abrir chamado e esperar: quem tem o adicional ativo clica em
 * "Liberar acesso agora" e recebe login e senha na hora, direto do pool.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Aceita "YYYY-MM-DD" (formato gravado) e devolve dd/mm/aaaa. */
function dataBr(valor: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function tempo(min: number) {
  if (min <= 0) return "expirando";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function CampoCopiavel({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm text-white">{valor}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(valor);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
          className="shrink-0 rounded-lg border border-white/12 p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
          aria-label={`Copiar ${label}`}
        >
          {copiado ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function SalaJogos() {
  const { data, isLoading } = useMeuAcessoJogos();
  const contratar = useContratarJogos();
  const cancelar = useCancelarJogos();
  const pegar = usePegarAcessoJogos();
  const devolver = useDevolverAcessoJogos();

  if (isLoading) return <p className="font-sans text-sm text-white/40">Carregando…</p>;

  /* ---------- não contratou ainda ---------- */
  if (!data?.contratado) {
    return (
      <GlassCard strong accent="red" className="p-8 text-center">
        <Gamepad2 className="mx-auto size-8 text-neon-red" />
        <h3 className="mt-4 font-display text-xl font-extrabold text-white">Sala de Jogos</h3>
        <p className="mx-auto mt-2 max-w-lg font-sans text-sm leading-relaxed text-white/50">
          Acesso a um pool exclusivo de contas para dia de jogo, com liberação automática pelo
          painel — sem abrir chamado, sem esperar o suporte. A vaga volta ao pool sozinha depois de{" "}
          {data?.horas ?? 12} horas.
        </p>
        <div className="mt-5 font-display text-3xl font-extrabold text-neon-red">
          {brl(data?.preco ?? 9.9)}
          <span className="font-sans text-sm font-normal text-white/40">/mês</span>
        </div>
        {contratar.isError && (
          <p className="mt-3 font-sans text-xs text-neon-red">{contratar.error?.message}</p>
        )}
        <NeonButton
          accent="red"
          className="mx-auto mt-5"
          disabled={contratar.isPending}
          onClick={() => contratar.mutate({})}
        >
          {contratar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Ativar adicional
        </NeonButton>
        <p className="mt-3 font-sans text-[11px] text-white/30">
          O valor entra na sua próxima fatura. Cancele quando quiser.
        </p>
        <Link
          to="/checkout?jogos=1"
          className="mt-2 inline-block font-sans text-[11px] text-neon-cyan underline underline-offset-2"
        >
          Prefere pagar agora por Pix?
        </Link>
      </GlassCard>
    );
  }

  /* ---------- contratado ---------- */
  return (
    <div className="space-y-5">
      <GlassCard accent="red" className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Gamepad2 className="size-6 text-neon-red" />
            <div>
              <div className="font-display text-base font-bold text-white">Adicional ativo</div>
              <div className="font-sans text-[11px] text-white/35">
                desde {dataBr(data.desde) || "hoje"} · {brl(data.preco)}/mês
              </div>
            </div>
          </div>
          <Pill accent={data.vagasLivres > 0 ? "cyan" : "red"}>
            {data.vagasLivres} tela(s) livre(s) agora
          </Pill>
        </div>

        {data.acesso ? (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Timer className="size-4 text-neon-cyan" />
                <span className="font-sans text-xs text-white/60">
                  Seu acesso expira em{" "}
                  <span className="font-semibold text-neon-cyan">
                    {tempo(data.acesso.minutosRestantes)}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => devolver.mutate({})}
                className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/55 hover:bg-white/5"
              >
                <LogOut className="mr-1 inline size-3" />
                Devolver a vaga
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <CampoCopiavel label="E-mail" valor={data.acesso.email} />
              <CampoCopiavel label="Senha" valor={data.acesso.senha} />
            </div>
            <p className="mt-3 font-sans text-[11px] leading-relaxed text-white/30">
              Não altere a senha nem os dados da conta. Ao expirar, a vaga volta para o rodízio e
              você pode pedir outra na hora.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            {pegar.isError && (
              <p className="mb-3 font-sans text-xs text-neon-red">{pegar.error?.message}</p>
            )}
            <NeonButton accent="red" disabled={pegar.isPending} onClick={() => pegar.mutate({})}>
              {pegar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Liberar acesso agora
            </NeonButton>
            <p className="mt-3 font-sans text-[11px] text-white/30">
              Liberação instantânea, válida por {data.horas}h. Sem passar pelo suporte.
            </p>
          </div>
        )}
      </GlassCard>

      {data.historico.length > 0 && (
        <GlassCard className="p-5">
          <span className="font-display text-sm font-bold text-white">Últimas liberações</span>
          <div className="mt-3 space-y-1.5">
            {data.historico.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="font-sans text-xs text-white/60">
                  {new Date(h.criadoEm).toLocaleString("pt-BR")}
                </span>
                <Pill accent={h.status === "ativa" ? "cyan" : "purple"}>{h.status}</Pill>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <button
        type="button"
        onClick={() => cancelar.mutate({})}
        className="font-sans text-[11px] text-white/30 underline-offset-2 hover:text-white/60 hover:underline"
      >
        Cancelar o adicional Sala de Jogos
      </button>
    </div>
  );
}

export default SalaJogos;
