import { useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  PiggyBank,
  Plus,
  RefreshCw,
  Settings2,
  Wallet,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useAtualizarConta,
  useExtratoGift,
  useGiftcards,
  useLancarSaldo,
  useParametros,
  useSalvarParametro,
  useVarrerSaldos,
} from "../../queries/giftcards";

/**
 * GESTÃO DE CONTAS — o caixa das contas matrizes.
 * O admin nunca digita saldo final: lança "+R$ 70" e o servidor soma, com
 * extrato auditável. O alerta de saldo crítico dispara sozinho quando o saldo
 * não cobre o custo do mês mais a margem de segurança.
 */

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ------------------------------------------------------------------ */

function Lancamento({ contaId, nome }: { contaId: number; nome: string }) {
  const lancar = useLancarSaldo();
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"credito" | "debito" | "ajuste">("credito");
  const [obs, setObs] = useState("");

  const enviar = () => {
    const numero = Number(valor.replace(",", "."));
    if (!numero || numero <= 0) return;
    lancar.mutate(
      { contaId, tipo, valor: numero, observacao: obs || `Gift card em ${nome}` },
      { onSuccess: () => { setValor(""); setObs(""); } },
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <PiggyBank className="size-4 text-neon-cyan" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-white/70">
          Lançar saldo
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
        <select
          className={inputCls}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
        >
          <option value="credito">+ Crédito</option>
          <option value="debito">− Consumo</option>
          <option value="ajuste">= Ajuste</option>
        </select>
        <input
          className={inputCls}
          placeholder="70,00"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <NeonButton accent="cyan" onClick={enviar} disabled={lancar.isPending}>
          {lancar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Lançar
        </NeonButton>
      </div>
      <input
        className={`${inputCls} mt-2`}
        placeholder="Observação (ex.: gift card comprado no mercado)"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
      />
      {lancar.isError && (
        <p className="mt-2 font-sans text-xs text-neon-red">{lancar.error?.message}</p>
      )}
    </div>
  );
}

function Extrato({ contaId }: { contaId: number }) {
  const { data, isLoading } = useExtratoGift(contaId);
  if (isLoading) return <p className="mt-3 font-sans text-xs text-white/35">Carregando extrato…</p>;
  if (!data?.length)
    return <p className="mt-3 font-sans text-xs text-white/35">Nenhum lançamento ainda.</p>;

  return (
    <ul className="mt-3 space-y-1.5">
      {data.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate font-sans text-xs text-white/70">
              {m.observacao || (m.tipo === "credito" ? "Crédito" : "Consumo")}
            </div>
            <div className="font-sans text-[10px] text-white/30">
              {new Date(m.criadoEm).toLocaleString("pt-BR")} · {m.autor || "sistema"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={
                m.tipo === "debito"
                  ? "font-display text-sm font-bold text-neon-red"
                  : "font-display text-sm font-bold text-emerald-400"
              }
            >
              {m.tipo === "debito" ? "−" : "+"}
              {brl(m.valor)}
            </div>
            <div className="font-sans text-[10px] text-white/30">saldo {brl(m.saldoResultante)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ContaCard({
  conta,
}: {
  conta: NonNullable<ReturnType<typeof useGiftcards>["data"]>["contas"][number];
}) {
  const atualizar = useAtualizarConta();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(conta.nomeConta);
  const [custo, setCusto] = useState(String(conta.custoMensal));
  const [limite, setLimite] = useState(String(conta.alertaSaldoCritico));

  return (
    <GlassCard accent={conta.critico ? "red" : "cyan"} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon id={conta.servico} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-white">
              {conta.nomeConta}
            </div>
            <div className="truncate font-sans text-[11px] text-white/35">{conta.email}</div>
          </div>
        </div>
        {conta.critico ? (
          <Pill accent="red" icon={<AlertTriangle className="size-3" />}>
            Saldo crítico
          </Pill>
        ) : (
          <Pill accent="cyan">Ok</Pill>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.03] px-2 py-3">
          <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">Saldo</div>
          <div
            className={
              conta.critico
                ? "mt-1 font-display text-lg font-extrabold text-neon-red"
                : "mt-1 font-display text-lg font-extrabold text-white"
            }
          >
            {brl(conta.saldoGiftCard)}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-2 py-3">
          <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">
            Custo/mês
          </div>
          <div className="mt-1 font-display text-lg font-extrabold text-white/70">
            {brl(conta.custoMensal)}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-2 py-3">
          <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">Folga</div>
          <div className="mt-1 font-display text-lg font-extrabold text-neon-cyan">
            {conta.mesesDeFolga === null ? "—" : `${conta.mesesDeFolga} m`}
          </div>
        </div>
      </div>

      <p className="mt-3 font-sans text-[11px] text-white/35">
        Alerta abaixo de <span className="text-white/60">{brl(conta.limite)}</span>
        {conta.alertaSaldoCritico > 0 ? " (limite manual)" : " (custo do mês + margem)"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
        >
          {aberto ? "Fechar" : "Lançar / extrato"}
        </button>
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/60 hover:bg-white/5"
        >
          Editar dados
        </button>
      </div>

      {editando && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da conta" />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="Custo mensal" inputMode="decimal" />
            <input className={inputCls} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Alerta manual (0 = automático)" inputMode="decimal" />
          </div>
          <NeonButton
            accent="purple"
            disabled={atualizar.isPending}
            onClick={() =>
              atualizar.mutate(
                {
                  id: conta.id,
                  nomeConta: nome,
                  custoMensal: Number(custo.replace(",", ".")) || 0,
                  alertaSaldoCritico: Number(limite.replace(",", ".")) || 0,
                },
                { onSuccess: () => setEditando(false) },
              )
            }
          >
            {atualizar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </NeonButton>
        </div>
      )}

      {aberto && (
        <>
          <Lancamento contaId={conta.id} nome={conta.nomeConta} />
          <Extrato contaId={conta.id} />
        </>
      )}
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

const CAMPOS_PARAMETRO: { chave: string; label: string; sufixo: string; ajuda: string }[] = [
  { chave: "comissaoPercentual", label: "Comissão do afiliado", sufixo: "%", ajuda: "sobre cada fatura paga de um indicado" },
  { chave: "bonusCredito", label: "Bônus ao virar crédito", sufixo: "%", ajuda: "acréscimo quando o afiliado troca saque por desconto" },
  { chave: "bonusPerformance", label: "Bônus de performance", sufixo: "%", ajuda: "extra quando a rede está em dia" },
  { chave: "metaRedeEmDia", label: "Meta da rede em dia", sufixo: "%", ajuda: "% mínimo de indicados adimplentes" },
  { chave: "saqueMinimo", label: "Saque mínimo", sufixo: "R$", ajuda: "valor mínimo do resgate em Pix" },
  { chave: "saqueTaxa", label: "Taxa do saque", sufixo: "R$", ajuda: "custo fixo cobrado no resgate em Pix" },
  { chave: "margemSaldoCritico", label: "Margem do saldo crítico", sufixo: "%", ajuda: "folga sobre o custo mensal no alerta de gift card" },
  { chave: "alertaOcupacao", label: "Alerta de estoque", sufixo: "%", ajuda: "ocupação que dispara aviso de comprar matriz" },
  { chave: "falhasParaPausar", label: "Falhas p/ pausar conta", sufixo: "un", ajuda: "falhas em 30 dias que travam entrada de novos" },
  { chave: "winbackDias", label: "Win-back a partir de", sufixo: "dias", ajuda: "inatividade para a 1ª oferta de retorno" },
  { chave: "winbackDesconto", label: "Desconto do win-back", sufixo: "%", ajuda: "cupom base da régua de recuperação" },
  { chave: "precoSalaJogos", label: "Preço Sala de Jogos", sufixo: "R$", ajuda: "mensalidade do adicional" },
  { chave: "horasLiberacaoJogos", label: "Validade da liberação", sufixo: "h", ajuda: "duração do acesso da Sala de Jogos" },
];

function Parametros() {
  const { data } = useParametros();
  const salvar = useSalvarParametro();
  const [rascunho, setRascunho] = useState<Record<string, string>>({});

  if (!data) return null;
  const valores = data as unknown as Record<string, string | number>;

  return (
    <GlassCard strong accent="purple" className="p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-neon-purple" />
        <span className="font-display text-sm font-bold text-white">Parâmetros do negócio</span>
      </div>
      <p className="mt-1.5 font-sans text-xs text-white/40">
        Muda aqui e vale na hora, sem deploy. Comissão, bônus, taxas, margens e a régua de
        recuperação saem todos deste painel.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPOS_PARAMETRO.map((campo) => {
          const atual = String(valores[campo.chave] ?? "");
          const valor = rascunho[campo.chave] ?? atual;
          const sujo = valor !== atual;
          return (
            <div key={campo.chave} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
              <div className="font-sans text-[11px] font-semibold text-white/70">{campo.label}</div>
              <div className="mt-0.5 font-sans text-[10px] leading-snug text-white/30">{campo.ajuda}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setRascunho((r) => ({ ...r, [campo.chave]: e.target.value }))}
                />
                <span className="shrink-0 font-sans text-[11px] text-white/35">{campo.sufixo}</span>
              </div>
              {sujo && (
                <button
                  type="button"
                  onClick={() =>
                    salvar.mutate(
                      { chave: campo.chave, valor: Number(valor.replace(",", ".")) || 0 },
                      { onSuccess: () => setRascunho((r) => ({ ...r, [campo.chave]: undefined as unknown as string })) },
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-neon-purple/40 bg-neon-purple/10 px-3 py-1.5 font-sans text-[11px] text-neon-purple hover:bg-neon-purple/20"
                >
                  Salvar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

export function GestaoContasView() {
  const { data, isLoading } = useGiftcards();
  const varrer = useVarrerSaldos();

  const contas = data?.contas ?? [];
  const criticas = contas.filter((c) => c.critico);
  const saldoTotal = contas.reduce((s, c) => s + c.saldoGiftCard, 0);
  const custoTotal = contas.reduce((s, c) => s + c.custoMensal, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <Wallet className="size-5 text-neon-cyan" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{brl(saldoTotal)}</div>
          <div className="font-sans text-xs text-white/40">saldo total em gift cards</div>
        </GlassCard>
        <GlassCard className="p-5">
          <CreditCard className="size-5 text-neon-purple" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{brl(custoTotal)}</div>
          <div className="font-sans text-xs text-white/40">custo mensal das matrizes</div>
        </GlassCard>
        <GlassCard accent={criticas.length ? "red" : undefined} className="p-5">
          <AlertTriangle className={criticas.length ? "size-5 text-neon-red" : "size-5 text-white/30"} />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">{criticas.length}</div>
          <div className="font-sans text-xs text-white/40">contas em saldo crítico</div>
        </GlassCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl font-sans text-xs text-white/40">
          O alerta dispara quando o saldo fica abaixo do custo do mês mais{" "}
          <span className="text-white/60">{data?.margem ?? 20}%</span> de margem. Rode a varredura
          para jogar os avisos na Central de Alertas e no webhook.
        </p>
        <NeonButton accent="cyan" onClick={() => varrer.mutate({})} disabled={varrer.isPending}>
          {varrer.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Varrer saldos
        </NeonButton>
      </div>

      {isLoading && <p className="font-sans text-sm text-white/40">Carregando contas…</p>}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {contas.map((c) => (
          <ContaCard key={c.id} conta={c} />
        ))}
      </div>

      <Parametros />
    </div>
  );
}

export default GestaoContasView;
