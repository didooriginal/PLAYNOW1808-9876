import { useState } from "react";
import {
  BadgePercent,
  CalendarClock,
  Check,
  Loader2,
  PiggyBank,
  Rocket,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { CobrancaPixCard } from "./cobranca-pix";
import {
  useAntecipar,
  useOpcoesRenovacao,
  useRenovar,
} from "../../queries/renovacao";
import type { Ciclo } from "../../queries/ciclos";
import { dataBr } from "../../queries/faturas";

/**
 * ÁREA DE PAGAMENTO DO CLIENTE — renovação e antecipação, tudo em Pix.
 *
 * Duas decisões que o cliente toma aqui:
 *  1. PERIODICIDADE: pagar mês a mês ou fechar trimestre/semestre/ano com
 *     desconto. Os valores vêm prontos de `renovacao.opcoes` — esta tela não
 *     calcula preço nenhum, só mostra o que o servidor mandou.
 *  2. ANTECIPAÇÃO: quitar a fatura do mês agora (desconto menor) ou adiantar o
 *     próximo mês (desconto maior). Vale só no Pix, e o percentual também vem
 *     do servidor.
 *
 * Gerada a cobrança, o bloco de Pix aparece embaixo e a tela vira sozinha para
 * "confirmado" quando a baixa chega pelo webhook.
 */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (fracao: number) => `${Math.round(fracao * 100)}%`;

/** competência "2026-09" → "09/2026": ninguém lê mês no formato ISO */
function mesBr(competencia: string) {
  const [ano, mes] = competencia.split("-");
  return mes ? `${mes}/${ano}` : competencia;
}

export function AreaPagamento() {
  const { data, isPending, isError, error } = useOpcoesRenovacao();
  const renovar = useRenovar();
  const antecipar = useAntecipar();
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);

  // uma cobrança viva por vez: a última gerada manda na tela
  const cobranca = renovar.data?.cobranca ?? antecipar.data?.cobranca ?? null;
  const gerando = renovar.isPending || antecipar.isPending;
  const erro = renovar.error?.message ?? antecipar.error?.message ?? null;

  if (isPending || isError || !data) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="font-sans text-sm text-white/45">
          {isPending
            ? "Carregando as formas de pagamento..."
            : (error?.message ??
              "Não foi possível carregar as opções de pagamento.")}
        </p>
      </GlassCard>
    );
  }

  if (data.mensalidade <= 0) {
    return (
      <GlassCard accent="cyan" className="p-8 text-center">
        <PiggyBank className="mx-auto size-6 text-neon-cyan" />
        <p className="mt-3 font-display text-sm font-bold text-white">
          Você ainda não tem uma mensalidade ativa
        </p>
        <p className="mt-1.5 font-sans text-xs text-white/45">
          Escolha um pacote em Novidades/Upgrades para liberar as opções de
          renovação e antecipação.
        </p>
      </GlassCard>
    );
  }

  const escolhido = ciclo ?? data.cicloAtual;
  const opcao =
    data.ciclos.find((c) => c.ciclo === escolhido) ?? data.ciclos[0]!;
  const { vigente, proximo } = data.antecipacao;

  /** só uma cobrança na tela: limpa a outra mutation antes de gerar */
  function gerarRenovacao() {
    antecipar.reset();
    renovar.mutate({ ciclo: escolhido });
  }

  function gerarAntecipacao(tipo: "vigente" | "proximo") {
    renovar.reset();
    antecipar.mutate({ tipo });
  }

  return (
    <div id="area-pagamento" className="space-y-5 scroll-mt-24">
      {/* ---------------- periodicidade ---------------- */}
      <GlassCard strong accent="cyan" className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-neon-cyan" />
            <span className="font-display text-sm font-bold text-white">
              Renovar meu plano
            </span>
          </div>
          <Pill accent="cyan">
            hoje: {data.ciclos.find((c) => c.atual)?.rotulo ?? "Mensal"}
          </Pill>
        </div>

        <p className="mt-1.5 font-sans text-xs text-white/40">
          Quanto mais meses de uma vez, menor a mensalidade. A próxima cobrança
          de hoje é{" "}
          {data.proximaCobranca ? dataBr(data.proximaCobranca) : "a definir"} —
          pagando adiantado ela é empurrada para frente.
        </p>

        <div
          className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          role="group"
          aria-label="Periodicidade da renovação"
        >
          {data.ciclos.map((o) => {
            const on = o.ciclo === escolhido;
            return (
              <button
                key={o.ciclo}
                type="button"
                data-testid={`renovar-${o.ciclo}`}
                aria-pressed={on}
                onClick={() => setCiclo(o.ciclo as Ciclo)}
                className={cn(
                  "rounded-2xl border p-3.5 text-left transition-all",
                  on
                    ? "border-neon-cyan/60 bg-neon-cyan/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-display text-sm font-bold",
                      on ? "text-white" : "text-white/70",
                    )}
                  >
                    {o.rotulo}
                  </span>
                  {on && <Check className="size-3.5 shrink-0 text-neon-cyan" />}
                </div>
                <div className="mt-2 font-display text-xl font-extrabold text-white">
                  {brl(o.total)}
                </div>
                <div className="font-sans text-[11px] text-white/40">
                  {brl(o.mensal)}/mês · {o.meses}{" "}
                  {o.meses === 1 ? "mês" : "meses"}
                </div>
                <div
                  className={cn(
                    "mt-1.5 font-sans text-[11px] font-semibold",
                    o.economia > 0 ? "text-neon-cyan" : "text-white/25",
                  )}
                >
                  {o.economia > 0
                    ? `economiza ${brl(o.economia)}`
                    : "sem desconto"}
                </div>
                {o.atual && (
                  <div className="mt-1 font-sans text-[10px] uppercase tracking-wider text-white/30">
                    seu ciclo atual
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              Total a pagar agora
            </div>
            <div className="mt-1 font-display text-2xl font-extrabold text-white">
              {brl(opcao.total)}
              <span className="ml-2 font-sans text-xs font-medium text-white/35">
                /{opcao.periodo}
              </span>
            </div>
          </div>
          <NeonButton accent="cyan" disabled={gerando} onClick={gerarRenovacao}>
            {renovar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            Gerar Pix da renovação
          </NeonButton>
        </div>
      </GlassCard>

      {/* ---------------- antecipação ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard accent="red" className="flex flex-col p-5">
          <div className="flex items-center gap-2">
            <BadgePercent className="size-4 text-neon-red" />
            <span className="font-display text-sm font-bold text-white">
              {vigente ? vigente.rotulo : "Antecipar a fatura em aberto"}
            </span>
          </div>
          {vigente ? (
            <>
              <p className="mt-1.5 font-sans text-xs text-white/40">
                Fatura de {mesBr(vigente.competencia)}, vence em{" "}
                {dataBr(vigente.vencimento)}. Pagando agora no Pix você abate{" "}
                {pct(vigente.percentual)}.
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-sans text-xs text-white/30 line-through">
                  {brl(vigente.original)}
                </span>
                <span className="font-display text-2xl font-extrabold text-white">
                  {brl(vigente.total)}
                </span>
                <span className="font-sans text-[11px] font-semibold text-neon-red">
                  −{brl(vigente.desconto)}
                </span>
              </div>
              <NeonButton
                accent="red"
                className="mt-4 w-full"
                disabled={gerando}
                onClick={() => gerarAntecipacao("vigente")}
              >
                {antecipar.isPending &&
                antecipar.variables?.tipo === "vigente" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BadgePercent className="size-4" />
                )}
                Antecipar com {pct(vigente.percentual)} off
              </NeonButton>
            </>
          ) : (
            <p className="mt-2 font-sans text-xs text-white/35">
              Nenhuma fatura aberta neste mês — está tudo em dia. Quando a
              próxima abrir, o desconto de antecipação aparece aqui.
            </p>
          )}
        </GlassCard>

        <GlassCard accent="purple" className="flex flex-col p-5">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-neon-purple" />
            <span className="font-display text-sm font-bold text-white">
              {proximo ? proximo.rotulo : "Adiantar o próximo mês"}
            </span>
          </div>
          {proximo ? (
            <>
              <p className="mt-1.5 font-sans text-xs text-white/40">
                Mensalidade de {mesBr(proximo.competencia)} paga antes de ser
                faturada: {pct(proximo.percentual)} off no Pix e sua cobrança
                vai para {dataBr(proximo.novoVencimento)}.
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-sans text-xs text-white/30 line-through">
                  {brl(proximo.original)}
                </span>
                <span className="font-display text-2xl font-extrabold text-white">
                  {brl(proximo.total)}
                </span>
                <span className="font-sans text-[11px] font-semibold text-neon-purple">
                  −{brl(proximo.desconto)}
                </span>
              </div>
              <NeonButton
                accent="purple"
                className="mt-4 w-full"
                disabled={gerando}
                onClick={() => gerarAntecipacao("proximo")}
              >
                {antecipar.isPending &&
                antecipar.variables?.tipo === "proximo" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                Adiantar com {pct(proximo.percentual)} off
              </NeonButton>
            </>
          ) : (
            <p className="mt-2 font-sans text-xs text-white/35">
              Disponível assim que sua mensalidade estiver definida.
            </p>
          )}
        </GlassCard>
      </div>

      {erro && (
        <GlassCard accent="red" className="p-4">
          <p className="font-sans text-xs text-neon-red">{erro}</p>
        </GlassCard>
      )}

      {cobranca && (
        <GlassCard strong accent="purple" className="p-6">
          <div className="font-display text-sm font-bold text-white">
            {renovar.data ? "Pix da renovação" : "Pix da antecipação"}
          </div>
          <p className="mt-1 font-sans text-xs text-white/40">
            {antecipar.data?.reaproveitada
              ? "Você já tinha um Pix aberto para este mês — reaproveitamos o mesmo código para não cobrar duas vezes."
              : "Pague no app do banco. A baixa é automática."}
          </p>
          <CobrancaPixCard
            key={cobranca.txid}
            cobranca={cobranca}
            accent={renovar.data ? "cyan" : "purple"}
          />
        </GlassCard>
      )}
    </div>
  );
}

export default AreaPagamento;
