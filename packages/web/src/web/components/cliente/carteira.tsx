import { useState } from "react";
import {
  ArrowDownToLine,
  Award,
  Check,
  Copy,
  Gift,
  Loader2,
  Network,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { GlassCard, NeonButton, Pill, ProgressBar } from "../ui/kit";
import { QuemMeIndicou } from "./quem-me-indicou";
import {
  brlCarteira as brl,
  useBannersAfiliados,
  useMeuPainelAfiliado,
  useResgatar,
  useSimularResgate,
  useTornarAfiliado,
} from "../../queries/afiliados";

/**
 * CARTEIRA DO AFILIADO (cliente).
 * Link único, rede de indicados com status, saldo e — o ponto central — o
 * simulador que mostra lado a lado: sacar em Pix (com taxa) x transformar em
 * desconto na mensalidade (com bônus). O caminho do crédito é sempre melhor,
 * e a tela deixa isso óbvio na hora de decidir.
 */

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none";

export function CarteiraAfiliado() {
  const { data, isLoading } = useMeuPainelAfiliado();
  const banners = useBannersAfiliados();
  const simular = useSimularResgate();
  const resgatar = useResgatar();
  const ativarAfiliado = useTornarAfiliado();
  const [valor, setValor] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [copiado, setCopiado] = useState(false);

  if (isLoading) return <p className="font-sans text-sm text-white/40">Carregando carteira…</p>;

  const carteira = data?.carteira;
  const regras = data?.regras;
  const nivel = data?.nivel ?? 1;
  const afiliadoAtivo = data?.afiliadoAtivo ?? false;
  const numero = Number(valor.replace(",", ".")) || 0;
  const emDia = (data?.indicados ?? []).filter((i) => i.emDia).length;
  const total = data?.indicados.length ?? 0;

  const copiarLink = () => {
    void navigator.clipboard.writeText(data?.link ?? "");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  /**
   * CONVITE — cliente já chegou ao nível 3, mas ainda não aceitou virar
   * afiliado. Ele vê o convite (com banner promocional, quando existir) e só
   * destrava a carteira depois de ativar.
   */
  if (nivel >= 3 && !afiliadoAtivo) {
    return (
      <div className="space-y-6">
        {banners.data?.map((banner) => (
          <GlassCard
            key={banner.id}
            strong
            accent="purple"
            className="relative overflow-hidden p-0"
          >
            <div className="flex flex-col md:flex-row">
              <div className="h-40 md:h-auto md:w-1/3">
                <img
                  src={banner.imagemUrl}
                  alt={banner.titulo}
                  className="h-full w-full object-cover opacity-60"
                />
              </div>
              <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
                <div className="flex items-center gap-2">
                  <Award className="size-5 text-neon-purple" />
                  <span className="font-display text-xs font-bold uppercase tracking-widest text-neon-purple">
                    Exclusivo Nível {nivel}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-white">
                  {banner.titulo}
                </h2>
                <p className="mt-2 font-sans text-sm leading-relaxed text-white/60">
                  {banner.subtitulo}
                </p>
                <div className="mt-6">
                  <NeonButton
                    accent="purple"
                    onClick={() => ativarAfiliado.mutate({})}
                    disabled={ativarAfiliado.isPending}
                  >
                    {ativarAfiliado.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Gift className="size-4" />
                    )}
                    Ativar meu painel de afiliado
                  </NeonButton>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}

        {/* fallback quando nenhum banner está cadastrado */}
        {!banners.data?.length && (
          <GlassCard strong accent="purple" className="p-8 text-center">
            <Gift className="mx-auto size-12 text-neon-purple" />
            <h2 className="mt-4 font-display text-2xl font-extrabold text-white">
              Você atingiu o Nível {nivel}!
            </h2>
            <p className="mx-auto mt-2 max-w-md font-sans text-sm text-white/60">
              Como cliente VIP, você já pode se tornar afiliado oficial e ganhar comissões em
              dinheiro por cada indicação.
            </p>
            <div className="mt-8">
              <NeonButton
                accent="purple"
                size="lg"
                onClick={() => ativarAfiliado.mutate({})}
                disabled={ativarAfiliado.isPending}
              >
                {ativarAfiliado.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Quero ser afiliado"
                )}
              </NeonButton>
            </div>
          </GlassCard>
        )}

        {ativarAfiliado.error && (
          <p className="font-sans text-xs text-neon-red">{ativarAfiliado.error.message}</p>
        )}
      </div>
    );
  }

  /**
   * VISÃO RESTRITA — abaixo do nível 3 o cliente indica e ganha recompensas na
   * Jornada, mas ainda não tem carteira em dinheiro.
   */
  if (nivel < 3) {
    return (
      <div className="space-y-5">
        <GlassCard strong accent="cyan" className="p-6">
          <div className="flex items-center gap-2">
            <Network className="size-4 text-neon-cyan" />
            <span className="font-display text-sm font-bold text-white">Seu link de indicação</span>
          </div>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            Indique amigos e ganhe recompensas na sua Jornada do Cliente. Ao atingir o Nível 3, você
            poderá converter indicações em dinheiro.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-neon-cyan">
              {data?.link}
            </span>
            <NeonButton accent="cyan" onClick={copiarLink}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado" : "Copiar"}
            </NeonButton>
          </div>
          <p className="mt-3 font-sans text-[11px] text-white/40">
            Ou passe só o código{" "}
            <strong className="font-mono text-neon-cyan">{data?.codigo}</strong> — quem já se
            cadastrou pode informá-lo em “Alguém te indicou?”, e quem ainda vai se cadastrar digita
            no campo “Código de indicação” do cadastro.
          </p>
        </GlassCard>

        <QuemMeIndicou padrinho={data?.padrinho ?? null} />

        <GlassCard className="p-8 text-center">
          <TrendingUp className="mx-auto size-10 text-white/20" />
          <h3 className="mt-4 font-display text-lg font-bold text-white">Como ganhar dinheiro?</h3>
          <p className="mt-2 font-sans text-sm text-white/40">
            Continue indicando para subir de nível.
            <br />
            No <strong className="font-semibold text-white/70">Nível 3</strong>, liberamos saques em
            Pix e bônus de afiliado.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* -------- link -------- */}
      <GlassCard strong accent="cyan" className="p-6">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-neon-cyan" />
          <span className="font-display text-sm font-bold text-white">Seu link de indicação</span>
        </div>
        <p className="mt-1.5 font-sans text-xs text-white/40">
          Você ganha {regras?.percentual ?? 5}% de tudo que cada indicado pagar, todo mês, enquanto
          ele for cliente.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-neon-cyan">
            {data?.link}
          </span>
          <NeonButton
            accent="cyan"
            onClick={() => {
              void navigator.clipboard.writeText(data?.link ?? "");
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1600);
            }}
          >
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? "Copiado" : "Copiar"}
          </NeonButton>
        </div>
        <p className="mt-3 font-sans text-[11px] text-white/40">
          Ou passe só o código{" "}
          <strong className="font-mono text-neon-cyan">{data?.codigo}</strong> — quem já se cadastrou
          informa em “Alguém te indicou?”, e quem ainda vai se cadastrar digita no campo “Código de
          indicação” do cadastro.
        </p>
      </GlassCard>

      <QuemMeIndicou padrinho={data?.padrinho ?? null} />

      {/* -------- saldos -------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard accent="cyan" className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Disponível</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-neon-cyan">
            {brl(carteira?.disponivel ?? 0)}
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Pendente</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white/70">
            {brl(carteira?.pendente ?? 0)}
          </div>
          <div className="font-sans text-[11px] text-white/30">libera quando o indicado paga</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">
            Crédito na mensalidade
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-neon-purple">
            {brl(carteira?.creditoDisponivel ?? 0)}
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">Total ganho</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white">
            {brl(carteira?.totalGanho ?? 0)}
          </div>
        </GlassCard>
      </div>

      {/* -------- rede -------- */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-display text-sm font-bold text-white">Sua rede</span>
          <Pill accent={regras?.performanceLiberada ? "cyan" : "purple"}>
            {emDia}/{total} em dia · {carteira?.redeEmDia ?? 0}%
          </Pill>
        </div>
        <ProgressBar value={emDia} max={total || 1} className="mt-3" />
        <p className="mt-2 font-sans text-[11px] text-white/35">
          Com {regras?.metaRedeEmDia ?? 90}% da rede em dia você ganha{" "}
          <span className="text-neon-cyan">+{regras?.bonusPerformance ?? 1}%</span> de bônus de
          performance ao converter comissão em crédito.
        </p>

        <div className="mt-4 space-y-1.5">
          {(data?.indicados ?? []).map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <span className="truncate font-sans text-xs text-white/70">{i.nome}</span>
              <Pill accent={i.emDia ? "cyan" : "red"}>{i.emDia ? "Ativo" : "Atrasado"}</Pill>
            </div>
          ))}
          {!total && (
            <p className="font-sans text-xs text-white/35">
              Ninguém usou seu link ainda. Compartilhe e comece a receber.
            </p>
          )}
        </div>
      </GlassCard>

      {/* -------- resgate -------- */}
      <GlassCard strong accent="purple" className="p-6">
        <div className="flex items-center gap-2">
          <Gift className="size-4 text-neon-purple" />
          <span className="font-display text-sm font-bold text-white">Resgatar comissão</span>
        </div>
        <p className="mt-1.5 font-sans text-xs text-white/40">
          Sacar em Pix custa {brl(regras?.saqueTaxa ?? 0)} de taxa (mínimo{" "}
          {brl(regras?.saqueMinimo ?? 0)}). Virar crédito na mensalidade não tem taxa e ainda rende{" "}
          <span className="text-neon-purple">+{regras?.bonusCredito ?? 25}%</span>.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="Quanto quer resgatar?"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <NeonButton
            accent="purple"
            disabled={!numero || simular.isPending}
            onClick={() => simular.mutate({ valor: numero })}
          >
            {simular.isPending ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
            Simular
          </NeonButton>
        </div>

        {simular.isError && (
          <p className="mt-3 font-sans text-xs text-neon-red">{simular.error?.message}</p>
        )}

        {simular.data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-white/50" />
                <span className="font-display text-sm font-bold text-white/80">Sacar em Pix</span>
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold text-white">
                {brl(simular.data.saque.valorLiquido)}
              </div>
              <div className="font-sans text-[11px] text-white/35">
                {brl(simular.data.saque.valorBruto)} − taxa de {brl(simular.data.saque.taxa)}
              </div>
              <input
                className={`${inputCls} mt-3`}
                placeholder="Sua chave Pix"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
              />
              <button
                type="button"
                disabled={!simular.data.saque.permitido || !chavePix || resgatar.isPending}
                onClick={() => resgatar.mutate({ tipo: "saque", valor: numero, chavePix })}
                className="mt-2 w-full rounded-xl border border-white/12 px-3 py-2 font-sans text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
              >
                Pedir saque
              </button>
              {!simular.data.saque.permitido && (
                <p className="mt-2 font-sans text-[11px] text-neon-red">
                  Mínimo de {brl(simular.data.saque.minimo)} e nunca acima do saldo disponível.
                </p>
              )}
            </div>

            <div
              className="rounded-2xl border border-neon-purple/40 bg-neon-purple/10 p-4"
              style={{ boxShadow: "0 0 40px -18px rgba(168,85,247,0.9)" }}
            >
              <div className="flex items-center gap-2">
                <Gift className="size-4 text-neon-purple" />
                <span className="font-display text-sm font-bold text-white">
                  Virar crédito
                </span>
                <Pill accent="purple" className="!text-[10px]">
                  recomendado
                </Pill>
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold text-neon-purple">
                {brl(simular.data.credito.valorLiquido)}
              </div>
              <div className="font-sans text-[11px] text-white/45">
                {brl(simular.data.credito.valorBruto)} + bônus de {brl(simular.data.credito.bonus)}
                {simular.data.credito.bonusPerformance > 0 &&
                  ` + performance de ${brl(simular.data.credito.bonusPerformance)}`}
              </div>
              <button
                type="button"
                disabled={!simular.data.credito.permitido || resgatar.isPending}
                onClick={() => resgatar.mutate({ tipo: "credito", valor: numero, chavePix: "" })}
                className="mt-3 w-full rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 font-sans text-xs font-semibold text-white hover:bg-neon-purple/30 disabled:opacity-40"
              >
                {resgatar.isPending ? "Processando…" : "Abater na mensalidade"}
              </button>
              <p className="mt-2 font-sans text-[11px] text-white/35">
                Crédito instantâneo, sem taxa, aplicado na próxima fatura.
              </p>
            </div>
          </div>
        )}

        {resgatar.isError && (
          <p className="mt-3 font-sans text-xs text-neon-red">{resgatar.error?.message}</p>
        )}
        {resgatar.isSuccess && (
          <p className="mt-3 font-sans text-xs text-emerald-400">
            Resgate registrado. Acompanhe o status abaixo.
          </p>
        )}
      </GlassCard>

      {/* -------- extrato -------- */}
      <GlassCard className="p-5">
        <span className="font-display text-sm font-bold text-white">Extrato de comissões</span>
        <div className="mt-3 space-y-1.5">
          {(data?.extrato ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-sans text-xs text-white/70">
                  {c.indicado} · {c.competencia}
                </div>
                {c.motivoBloqueio && (
                  <div className="flex items-center gap-1 font-sans text-[10px] text-neon-red">
                    <ShieldAlert className="size-3" />
                    {c.motivoBloqueio}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-white/80">{brl(c.valor)}</span>
                <Pill accent={c.status === "bloqueada" ? "red" : c.status === "paga" ? "purple" : "cyan"}>
                  {c.status}
                </Pill>
              </div>
            </div>
          ))}
          {!data?.extrato.length && (
            <p className="font-sans text-xs text-white/35">
              Nenhuma comissão ainda — ela aparece quando o indicado paga a primeira fatura.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default CarteiraAfiliado;
