import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, ProgressBar } from "../ui/kit";
import { SeloSalvo, useSeloTransitorio } from "./salvamento";
import { Rotulo, Tooltip } from "../ui/tooltip";
import { brl, serviceById } from "@/lib/mock-data";
import {
  useContas,
  useEditarVagas,
  useRemoverConta,
  useReporConta,
} from "../../queries/contas";
import {
  useAlocarCliente,
  useClientesDisponiveis,
  useLiberarVaga,
  useMapaAlocacoes,
} from "../../queries/alocacoes";

type Conta = NonNullable<ReturnType<typeof useContas>["data"]>[number];
type Vinculo = NonNullable<
  ReturnType<typeof useMapaAlocacoes>["data"]
>[number][number];

/** dias até o vencimento da matriz — null quando não há data cadastrada */
export function diasParaVencer(iso: string) {
  if (!iso) return null;
  const alvo = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

const dataBR = (iso: string) =>
  iso ? iso.split("-").reverse().join("/") : "—";

/** tarja de alerta de vencimento: vermelha se vencida, âmbar se faltam ≤ 5 dias */
function VencimentoAlerta({ conta }: { conta: Conta }) {
  const dias = diasParaVencer(conta.dataVencimento);
  if (dias === null || dias > 5) return null;

  const vencida = dias < 0;
  const hex = vencida ? "#ff1f3d" : "#f59e0b";
  const texto = vencida
    ? `Assinatura vencida há ${Math.abs(dias)} dia(s)`
    : dias === 0
      ? "Vence hoje"
      : `Vence em ${dias} dia(s)`;

  return (
    <div
      className="relative mt-4 flex items-center gap-2 rounded-xl border px-3 py-2"
      style={{ borderColor: `${hex}55`, background: `${hex}14`, color: hex }}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="font-display text-[11px] font-bold uppercase tracking-wide">
        {texto}
      </span>
      <span className="ml-auto font-sans text-[10px] text-white/45">
        {dataBR(conta.dataVencimento)}
      </span>
    </div>
  );
}

/** lista de clientes vinculados + ação de liberar vaga individual */
function ClientesVinculados({
  conta,
  vinculos,
}: {
  conta: Conta;
  vinculos: Vinculo[];
}) {
  const [alocando, setAlocando] = useState(false);
  const [escolhido, setEscolhido] = useState<number | "">("");
  const disponiveis = useClientesDisponiveis(conta.id, alocando);
  const alocar = useAlocarCliente();
  const liberar = useLiberarVaga();
  const livres = conta.totalVagas - vinculos.length;

  return (
    <div className="relative mt-4 border-t border-white/8 pt-4">
      <div className="flex items-center gap-2">
        <Users className="size-3.5 text-white/35" />
        <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
          Clientes nesta conta ({vinculos.length})
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {vinculos.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                v.clienteStatus === "ativo"
                  ? "bg-emerald-400"
                  : v.clienteStatus === "pendente"
                    ? "bg-amber-400"
                    : "bg-neon-red",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[11px] font-bold text-white">
                {v.clienteNome}
              </div>
              <div className="truncate font-mono text-[9px] text-white/30">
                {v.clienteEmail}
              </div>
            </div>
            <Tooltip texto="conta.liberarVaga" titulo="Liberar vaga">
              <button
                type="button"
                aria-label={`Liberar vaga de ${v.clienteNome}`}
                disabled={liberar.isPending}
                onClick={() => liberar.mutate({ id: v.id, motivo: "manual" })}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/35 transition-colors hover:border-amber-400/50 hover:text-amber-300"
              >
                <UserMinus className="size-3" />
              </button>
            </Tooltip>
          </div>
        ))}
        {vinculos.length === 0 && (
          <p className="font-sans text-[11px] text-white/30">
            Nenhum cliente vinculado ainda.
          </p>
        )}
      </div>

      {alocando ? (
        <div className="mt-3 space-y-2">
          <select
            aria-label="Cliente que vai ocupar a vaga"
            value={escolhido}
            onChange={(e) =>
              setEscolhido(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-xs text-white focus:border-neon-cyan/50 focus:outline-none"
          >
            <option value="" className="bg-[#09090b]">
              Selecione o cliente...
            </option>
            {(disponiveis.data ?? []).map((c) => (
              <option key={c.id} value={c.id} className="bg-[#09090b]">
                {c.nome} · {c.email}
              </option>
            ))}
          </select>
          {alocar.isError && (
            <p className="font-sans text-[11px] text-neon-red">
              {alocar.error?.message}
            </p>
          )}
          <div className="flex gap-2">
            <NeonButton
              accent="cyan"
              size="sm"
              className="flex-1"
              disabled={!escolhido || alocar.isPending}
              onClick={() =>
                escolhido &&
                alocar.mutate(
                  { clienteId: Number(escolhido), contaId: conta.id },
                  {
                    onSuccess: () => {
                      setEscolhido("");
                      setAlocando(false);
                    },
                  },
                )
              }
            >
              {alocar.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Vincular
            </NeonButton>
            <button
              type="button"
              onClick={() => setAlocando(false)}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white"
              aria-label="Cancelar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <NeonButton
          accent="cyan"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          disabled={livres <= 0}
          onClick={() => setAlocando(true)}
        >
          <UserPlus className="size-3.5" />
          {livres > 0 ? "Vincular cliente" : "Sem vagas livres"}
        </NeonButton>
      )}
    </div>
  );
}

/** editor inline do total de vagas */
function EditorVagas({
  conta,
  onClose,
  onSalvo,
}: {
  conta: Conta;
  onClose: () => void;
  /** avisa o card para acender o selo "Salvo" depois que o editor fecha */
  onSalvo: () => void;
}) {
  const [valor, setValor] = useState(conta.totalVagas);
  const editar = useEditarVagas();

  return (
    <div className="relative mt-4 rounded-2xl border border-neon-purple/35 bg-neon-purple/8 p-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-wide text-neon-purple">
          Editar vagas
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-[11px] text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>
      <Rotulo
        ajuda="contas.totalVagas"
        htmlFor="conta-vagas"
        className="mt-2.5"
      >
        Total de vagas
      </Rotulo>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          aria-label="Diminuir"
          onClick={() => setValor((v) => Math.max(1, v - 1))}
          className="size-9 shrink-0 rounded-xl border border-white/12 font-display text-sm text-white/70 hover:text-white"
        >
          −
        </button>
        <input
          id="conta-vagas"
          type="number"
          min={1}
          max={50}
          aria-label="Total de vagas"
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-display text-sm font-bold text-white focus:border-neon-purple/60 focus:outline-none"
        />
        <button
          type="button"
          aria-label="Aumentar"
          onClick={() => setValor((v) => Math.min(50, v + 1))}
          className="size-9 shrink-0 rounded-xl border border-white/12 font-display text-sm text-white/70 hover:text-white"
        >
          +
        </button>
      </div>
      {editar.isError && (
        <p className="mt-2 font-sans text-[11px] text-neon-red">
          {editar.error?.message}
        </p>
      )}
      <NeonButton
        accent="purple"
        size="sm"
        className="mt-2.5 w-full"
        disabled={editar.isPending || valor === conta.totalVagas}
        onClick={() =>
          editar.mutate(
            { id: conta.id, totalVagas: valor },
            {
              onSuccess: () => {
                onSalvo();
                onClose();
              },
            },
          )
        }
      >
        {editar.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        Salvar vagas
      </NeonButton>
    </div>
  );
}

export function ContaMatrizCard({
  acc,
  vinculos,
}: {
  acc: Conta;
  vinculos: Vinculo[];
}) {
  const service = serviceById(acc.servico);
  const ocupadas = vinculos.length;
  const pct = Math.round((ocupadas / Math.max(acc.totalVagas, 1)) * 100);
  const full = ocupadas >= acc.totalVagas;
  const nearly = !full && pct >= 75;

  const [editando, setEditando] = useState(false);
  const [aberto, setAberto] = useState(false);

  const repor = useReporConta();
  const remover = useRemoverConta();
  const busy = repor.isPending || remover.isPending;

  /** selo "Salvo" do card: vagas editadas ou vagas repostas */
  const [salvos, setSalvos] = useState(0);
  const marcarSalvo = () => setSalvos((n) => n + 1);
  const selo = useSeloTransitorio({
    salvando: repor.isPending,
    erro: repor.isError
      ? (repor.error?.message ?? "Falha ao repor vagas")
      : null,
    sucessos: salvos,
  });

  const dias = diasParaVencer(acc.dataVencimento);
  const alerta = dias !== null && dias <= 5;

  return (
    <GlassCard
      hover
      className="relative flex flex-col overflow-hidden p-5"
      style={
        full || (dias !== null && dias < 0)
          ? {
              borderColor: "rgba(255,31,61,0.45)",
              boxShadow:
                "inset 0 1px 0 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(255,31,61,0.15), 0 0 34px -8px rgba(255,31,61,0.5)",
            }
          : alerta
            ? {
                borderColor: "rgba(245,158,11,0.45)",
                boxShadow:
                  "inset 0 1px 0 0 rgba(255,255,255,0.07), 0 0 30px -10px rgba(245,158,11,0.55)",
              }
            : undefined
      }
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 size-36 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${full ? "rgba(255,31,61,0.3)" : `${service.color}2b`} 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon id={acc.servico} size="sm" active={!full} />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-white">
              {acc.rotulo}
            </div>
            <div className="truncate font-mono text-[10px] text-white/30">
              {acc.email}
            </div>
          </div>
        </div>
        {full ? (
          <span
            className="shrink-0 rounded-full border border-neon-red/50 bg-neon-red/15 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-neon-red"
            style={{ boxShadow: "0 0 20px -6px #ff1f3d" }}
          >
            Esgotado
          </span>
        ) : nearly ? (
          <span className="shrink-0 rounded-full border border-amber-400/45 bg-amber-400/12 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Quase cheio
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Disponível
          </span>
        )}
      </div>

      <VencimentoAlerta conta={acc} />

      {/* lotação */}
      <div className="relative mt-5">
        <div className="flex items-end justify-between">
          <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
            Lotação
            {selo && <SeloSalvo estado={selo} />}
          </span>
          <span
            className="font-display text-lg font-extrabold"
            style={{ color: full ? "#ff1f3d" : nearly ? "#f59e0b" : "#22d3ee" }}
          >
            {ocupadas}/{acc.totalVagas}
            <span className="ml-1.5 font-sans text-[11px] font-medium text-white/35">
              vagas ocupadas
            </span>
          </span>
        </div>
        <ProgressBar value={ocupadas} max={acc.totalVagas} className="mt-2.5" />
        <div className="mt-2 flex items-center justify-between font-sans text-[11px] text-white/30">
          <span>{pct}% de ocupação</span>
          <span>
            {full
              ? "0 vagas livres"
              : `${acc.totalVagas - ocupadas} vaga(s) livre(s)`}
          </span>
        </div>
      </div>

      {/* meta */}
      <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-4 sm:grid-cols-4">
        {[
          {
            label: "Vencimento",
            value: dataBR(acc.dataVencimento),
            Icon: CalendarClock,
          },
          {
            label: "Cartão",
            value: acc.cartaoUtilizado || "—",
            Icon: CreditCard,
          },
          { label: "Custo", value: brl(acc.custo), Icon: null },
          { label: "Região", value: acc.regiao, Icon: null },
        ].map((m) => (
          <div key={m.label} className="min-w-0">
            <div className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/25">
              {m.label}
            </div>
            <div className="mt-0.5 truncate font-display text-xs font-bold text-white/80">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <EditorVagas
          conta={acc}
          onClose={() => setEditando(false)}
          onSalvo={marcarSalvo}
        />
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 font-sans text-[11px] text-white/50 transition-colors hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Users className="size-3.5" />
          {ocupadas} cliente(s) vinculado(s)
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && <ClientesVinculados conta={acc} vinculos={vinculos} />}

      <div className="relative mt-4 flex gap-2">
        <NeonButton
          accent="purple"
          variant="outline"
          size="sm"
          className="flex-1 whitespace-nowrap px-2"
          disabled={busy}
          onClick={() => setEditando((v) => !v)}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" />
          Editar vagas
        </NeonButton>
        <Tooltip
          texto="conta.liberarTodas"
          titulo="Repor vagas"
          className="flex-1"
        >
          <NeonButton
            accent="red"
            variant="outline"
            size="sm"
            className="w-full whitespace-nowrap px-2"
            disabled={busy || ocupadas === 0}
            onClick={() =>
              repor.mutate({ id: acc.id }, { onSuccess: marcarSalvo })
            }
          >
            {repor.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Repor
          </NeonButton>
        </Tooltip>
        <Tooltip texto="conta.copiarLogin" titulo="Copiar login">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:border-white/25 hover:text-white"
            aria-label="Copiar login"
            onClick={() =>
              navigator.clipboard
                ?.writeText(`${acc.email} · ${acc.senha}`)
                .catch(() => {})
            }
          >
            <Copy className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip texto="conta.excluir" titulo="Excluir conta matriz">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
            aria-label="Excluir conta matriz"
            disabled={busy}
            onClick={() => remover.mutate({ id: acc.id })}
          >
            <Trash2 className="size-3.5" />
          </button>
        </Tooltip>
      </div>
    </GlassCard>
  );
}

export default ContaMatrizCard;
