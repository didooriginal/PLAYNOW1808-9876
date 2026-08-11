import { Loader2, RefreshCw, ShieldAlert, Unlock, Wallet } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Ajuda } from "../ui/tooltip";
import {
  brlCarteira as brl,
  useLiberarComissao,
  useProcessarSaque,
  useReapurarComissoes,
  useResumoAfiliados,
} from "../../queries/afiliados";

/**
 * COMISSÕES E SAQUES (admin).
 * Comissão de 5% por fatura paga de indicado, apuração idempotente e
 * anti-fraude de rede: indicação feita do mesmo IP/dispositivo do afiliado
 * nasce bloqueada e só entra no saldo se o admin liberar.
 */

export function ComissoesView() {
  const { data, isLoading } = useResumoAfiliados();
  const liberar = useLiberarComissao();
  const processar = useProcessarSaque();
  const reapurar = useReapurarComissoes();

  if (isLoading) return <p className="font-sans text-sm text-white/40">Apurando comissões…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Comissões geradas</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white">
            {brl(data?.totalComissoes ?? 0)}
          </div>
        </GlassCard>
        <GlassCard accent="cyan" className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Liberadas (saldo)</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-neon-cyan">
            {brl(data?.liberadas ?? 0)}
          </div>
        </GlassCard>
        <GlassCard accent={data?.bloqueadas ? "red" : undefined} className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Bloqueadas (anti-fraude)</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-neon-red">
            {brl(data?.bloqueadas ?? 0)}
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Saques pendentes</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white">
            {data?.saquesPendentes ?? 0}
          </div>
        </GlassCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl font-sans text-xs text-white/40">
          Comissão de <span className="text-white/60">{data?.regras.comissaoPercentual ?? 5}%</span> por
          fatura paga do indicado. No resgate, o afiliado escolhe: Pix (taxa de{" "}
          {brl(data?.regras.saqueTaxa ?? 0)}, mínimo {brl(data?.regras.saqueMinimo ?? 0)}) ou crédito
          na mensalidade com <span className="text-white/60">+{data?.regras.bonusCredito ?? 25}%</span>{" "}
          de bônus (+{data?.regras.bonusPerformance ?? 1}% se a rede estiver{" "}
          {data?.regras.metaRedeEmDia ?? 90}% em dia).
        </p>
        <NeonButton accent="purple" onClick={() => reapurar.mutate({})} disabled={reapurar.isPending}>
          {reapurar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Reapurar redes
        </NeonButton>
      </div>

      {/* -------- fila de resgates -------- */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-neon-cyan" />
          <span className="font-display text-sm font-bold text-white">Resgates</span>
          <Ajuda ajuda="comissoes.resgates" lado="bottom" />
        </div>
        <div className="mt-4 space-y-2">
          {(data?.fila ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">
                  {s.nome ?? `Cliente #${s.clienteId}`}
                </div>
                <div className="truncate font-sans text-[11px] text-white/35">
                  {s.tipo === "saque"
                    ? `Pix ${s.chavePix || "sem chave"} · líquido ${brl(s.valorLiquido)} (taxa ${brl(s.taxa)})`
                    : `Crédito na mensalidade · ${brl(s.valorLiquido)}`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill accent={s.status === "pago" ? "cyan" : s.status === "recusado" ? "red" : "purple"}>
                  {s.status}
                </Pill>
                {s.tipo === "saque" && s.status === "pendente" && (
                  <>
                    <button
                      type="button"
                      onClick={() => processar.mutate({ id: s.id, status: "pago", observacao: "" })}
                      className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 font-sans text-[11px] text-emerald-300 hover:bg-emerald-400/20"
                    >
                      Marcar pago
                    </button>
                    <button
                      type="button"
                      onClick={() => processar.mutate({ id: s.id, status: "recusado", observacao: "" })}
                      className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/50 hover:bg-white/5"
                    >
                      Recusar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!data?.fila.length && (
            <p className="font-sans text-xs text-white/35">Nenhum resgate solicitado até agora.</p>
          )}
        </div>
      </GlassCard>

      {/* -------- anti-fraude -------- */}
      <GlassCard accent={data?.suspeitas.length ? "red" : undefined} className="p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-neon-red" />
          <span className="font-display text-sm font-bold text-white">
            Anti-fraude de rede
          </span>
          <Ajuda ajuda="comissoes.antifraude" lado="bottom" />
        </div>
        <p className="mt-1.5 font-sans text-xs text-white/40">
          Indicações feitas do mesmo IP ou dispositivo do afiliado ficam retidas. Libere só quando
          tiver certeza de que é gente diferente (ex.: casal na mesma casa).
        </p>
        <div className="mt-4 space-y-2">
          {(data?.suspeitas ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">
                  {s.afiliado} → {s.indicado}
                </div>
                <div className="truncate font-sans text-[11px] text-neon-red/80">{s.motivo}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-white/70">{brl(s.valor)}</span>
                <button
                  type="button"
                  onClick={() => liberar.mutate({ id: s.id })}
                  className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 font-sans text-[11px] text-neon-cyan hover:bg-neon-cyan/20"
                >
                  <Unlock className="mr-1 inline size-3" />
                  Liberar
                </button>
              </div>
            </div>
          ))}
          {!data?.suspeitas.length && (
            <p className="font-sans text-xs text-white/35">Nenhuma comissão retida. Rede limpa.</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default ComissoesView;
