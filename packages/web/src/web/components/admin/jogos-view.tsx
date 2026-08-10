import { useState } from "react";
import { Gamepad2, Loader2, Plus, Power, Timer, Users, X } from "lucide-react";
import { GlassCard, NeonButton, Pill, ProgressBar } from "../ui/kit";
import {
  useAlternarClienteJogos,
  useCadastrarContaJogos,
  useAlternarPoolJogos,
  usePainelJogos,
  useRevogarJogos,
} from "../../queries/jogos";

/**
 * SALA DE JOGOS (admin) — o admin só abastece o pool.
 * A liberação para o cliente é automática: quem tem o adicional ativo pega
 * o acesso sozinho no painel e a vaga volta sozinha quando expira.
 */

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-red/50 focus:outline-none";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function tempoRestante(min: number) {
  if (min <= 0) return "expirando";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function NovaConta() {
  const criar = useCadastrarContaJogos();
  const [form, setForm] = useState({
    rotulo: "",
    servico: "jogos",
    email: "",
    senha: "",
    totalVagas: "4",
    custoMensal: "",
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <GlassCard strong accent="red" className="p-5">
      <div className="flex items-center gap-2">
        <Plus className="size-4 text-neon-red" />
        <span className="font-display text-sm font-bold text-white">Nova conta no pool</span>
      </div>
      <p className="mt-1.5 font-sans text-xs text-white/40">
        Contas exclusivas da Sala de Jogos. Quanto mais vagas, mais clientes simultâneos em dia de
        pico — o rodízio é automático.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input className={inputCls} placeholder="Rótulo (Sala de Jogos — Conta 01)" value={form.rotulo} onChange={set("rotulo")} />
        <input className={inputCls} placeholder="Serviço (jogos)" value={form.servico} onChange={set("servico")} />
        <input className={inputCls} placeholder="E-mail de login" value={form.email} onChange={set("email")} />
        <input className={inputCls} placeholder="Senha" value={form.senha} onChange={set("senha")} />
        <input className={inputCls} placeholder="Vagas" inputMode="numeric" value={form.totalVagas} onChange={set("totalVagas")} />
        <input className={inputCls} placeholder="Custo mensal" inputMode="decimal" value={form.custoMensal} onChange={set("custoMensal")} />
      </div>

      {criar.isError && <p className="mt-3 font-sans text-xs text-neon-red">{criar.error?.message}</p>}

      <NeonButton
        accent="red"
        className="mt-4"
        disabled={criar.isPending || !form.rotulo || !form.email || !form.senha}
        onClick={() =>
          criar.mutate(
            {
              rotulo: form.rotulo,
              servico: form.servico || "jogos",
              email: form.email,
              senha: form.senha,
              totalVagas: Number(form.totalVagas) || 4,
              custoMensal: Number(form.custoMensal.replace(",", ".")) || 0,
            },
            { onSuccess: () => setForm({ rotulo: "", servico: "jogos", email: "", senha: "", totalVagas: "4", custoMensal: "" }) },
          )
        }
      >
        {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Cadastrar conta
      </NeonButton>
    </GlassCard>
  );
}

export function JogosView() {
  const { data, isLoading } = usePainelJogos();
  const alternarPool = useAlternarPoolJogos();
  const revogar = useRevogarJogos();
  const alternarCliente = useAlternarClienteJogos();

  if (isLoading) return <p className="font-sans text-sm text-white/40">Carregando Sala de Jogos…</p>;

  const p = data;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="p-5">
          <Gamepad2 className="size-5 text-neon-red" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{p?.assinantes.length ?? 0}</div>
          <div className="font-sans text-xs text-white/40">clientes com o adicional</div>
        </GlassCard>
        <GlassCard className="p-5">
          <Users className="size-5 text-neon-cyan" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {p?.ocupadas ?? 0}/{p?.totalVagas ?? 0}
          </div>
          <div className="font-sans text-xs text-white/40">telas em uso agora</div>
          <ProgressBar value={p?.ocupadas ?? 0} max={p?.totalVagas || 1} className="mt-3" />
        </GlassCard>
        <GlassCard className="p-5">
          <Timer className="size-5 text-neon-purple" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{p?.horas ?? 12}h</div>
          <div className="font-sans text-xs text-white/40">validade de cada liberação</div>
        </GlassCard>
        <GlassCard accent="red" className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Receita do adicional</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-neon-red">
            {brl(p?.receitaMensal ?? 0)}
          </div>
          <div className="font-sans text-xs text-white/40">{brl(p?.preco ?? 0)} por cliente/mês</div>
        </GlassCard>
      </div>

      <NovaConta />

      <GlassCard className="p-5">
        <span className="font-display text-sm font-bold text-white">Pool de contas</span>
        <p className="mt-1.5 font-sans text-xs text-white/40">
          Ligue ou desligue uma conta do rodízio sem apagar nada. Conta desligada continua no
          estoque geral.
        </p>
        <div className="mt-4 space-y-2">
          {(p?.pool ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">{c.rotulo}</div>
                <div className="truncate font-sans text-[11px] text-white/35">
                  {c.email} · {c.vagasOcupadas}/{c.totalVagas} vagas
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill accent={c.aceitaNovos ? "cyan" : "red"}>
                  {c.aceitaNovos ? "recebendo" : "pausada"}
                </Pill>
                <button
                  type="button"
                  onClick={() => alternarPool.mutate({ contaId: c.id, pool: false })}
                  className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
                >
                  <Power className="mr-1 inline size-3" />
                  Tirar do pool
                </button>
              </div>
            </div>
          ))}
          {!p?.pool.length && (
            <p className="font-sans text-xs text-white/35">
              Nenhuma conta no pool ainda. Cadastre a primeira acima.
            </p>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <span className="font-display text-sm font-bold text-white">Liberações ativas</span>
        <div className="mt-4 space-y-2">
          {(p?.liberacoes ?? []).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">{l.cliente}</div>
                <div className="font-sans text-[11px] text-white/35">
                  expira em {tempoRestante(l.minutosRestantes)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revogar.mutate({ liberacaoId: l.id })}
                className="rounded-lg border border-neon-red/35 px-3 py-1.5 font-sans text-[11px] text-neon-red hover:bg-neon-red/10"
              >
                <X className="mr-1 inline size-3" />
                Revogar
              </button>
            </div>
          ))}
          {!p?.liberacoes.length && (
            <p className="font-sans text-xs text-white/35">Nenhuma tela em uso neste momento.</p>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <span className="font-display text-sm font-bold text-white">Assinantes do adicional</span>
        <div className="mt-4 space-y-2">
          {(p?.assinantes ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">{a.nome}</div>
                <div className="truncate font-sans text-[11px] text-white/35">
                  {a.email} · desde {a.desde || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => alternarCliente.mutate({ clienteId: a.id, ativo: false })}
                className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
              >
                Desativar
              </button>
            </div>
          ))}
          {!p?.assinantes.length && (
            <p className="font-sans text-xs text-white/35">
              Ninguém contratou o adicional ainda. Ele aparece no painel do cliente por {brl(p?.preco ?? 0)}/mês.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default JogosView;
