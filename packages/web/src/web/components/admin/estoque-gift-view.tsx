import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Gift,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Ticket,
  X,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Ajuda, Campo, Tooltip, TituloSecao } from "../ui/tooltip";
import {
  useCadastrarLoteGift,
  useCodigosGift,
  useConfirmarUsoGift,
  useDevolverGift,
  useMarcarGiftEmUso,
  useRemoverGift,
  useResumoEstoqueGift,
  useRevelarGift,
  useAlternarAppGift,
} from "../../queries/estoque-gift";

/**
 * ESTOQUE DE GIFT CARDS
 * ------------------------------------------------------------------
 * Onde os CÓDIGOS comprados ficam guardados até virarem saldo numa conta
 * matriz. Regras de ouro da tela:
 *  - o código nunca aparece por padrão: fica mascarado, com botão de revelar;
 *  - copiar é o caminho principal (zero digitação = zero erro de digitação);
 *  - ao copiar, o código já vira `em uso`, para dois admins não brigarem;
 *  - só "confirmei que apliquei" transforma em `utilizado` e credita saldo.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

const ROTULO_STATUS: Record<string, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  utilizado: "Utilizado",
};

type StatusGift = "disponivel" | "em_uso" | "utilizado";

/* ------------------------------------------------------------------ */
/* CADASTRO EM LOTE                                                    */
/* ------------------------------------------------------------------ */

function CadastroLote({ catalogo }: { catalogo: { slug: string; nome: string }[] }) {
  const cadastrar = useCadastrarLoteGift();
  const [provider, setProvider] = useState(catalogo[0]?.slug ?? "netflix");
  const [valor, setValor] = useState("");
  const [codigos, setCodigos] = useState("");
  const [obs, setObs] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  const linhas = codigos.split(/\r?\n/).filter((l) => l.trim()).length;

  const enviar = () => {
    setOk(null);
    cadastrar.mutate(
      {
        provider,
        valorPadrao: Number(valor.replace(",", ".")) || 0,
        codigos,
        observacao: obs,
      },
      {
        onSuccess: (r) => {
          setCodigos("");
          setOk(
            `${r.inseridos} código(s) cadastrado(s) — ${brl(r.valorInserido)} em estoque.` +
              (r.duplicados ? ` ${r.duplicados} duplicado(s) ignorado(s).` : "") +
              (r.invalidas ? ` ${r.invalidas} linha(s) inválida(s).` : ""),
          );
        },
      },
    );
  };

  return (
    <GlassCard strong accent="purple" className="p-5">
      <TituloSecao
        icone={<Plus className="size-4 text-neon-purple" />}
        ajuda="gift.codigos"
      >
        Cadastrar lote
      </TituloSecao>
      <p className="mt-1.5 font-sans text-xs text-white/40">
        Um código por linha. Para valores diferentes no mesmo lote, use{" "}
        <span className="font-mono text-white/60">CODIGO;70</span> ou{" "}
        <span className="font-mono text-white/60">CODIGO;70;nota fiscal 123</span>. Códigos repetidos
        são ignorados automaticamente.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Campo label="Provedor" ajuda="gift.provider" htmlFor="lote-provider" obrigatorio>
          <select
            id="lote-provider"
            className={inputCls}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {catalogo.map((a) => (
              <option key={a.slug} value={a.slug} className="bg-[#0b0b12]">
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Valor de face" ajuda="gift.valorPadrao" htmlFor="lote-valor" sufixo="R$ / cartão">
          <input
            id="lote-valor"
            className={inputCls}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="70"
            inputMode="decimal"
          />
        </Campo>
      </div>

      <Campo
        className="mt-2"
        label="Códigos"
        ajuda="gift.codigos"
        htmlFor="lote-codigos"
        obrigatorio
        sufixo={linhas > 0 ? `${linhas} linha(s)` : undefined}
      >
        <textarea
          id="lote-codigos"
          className={`${inputCls} min-h-[132px] font-mono text-xs leading-relaxed`}
          placeholder={"XXXX-XXXX-XXXX-1234\nYYYY-YYYY-YYYY-5678;100\n"}
          value={codigos}
          onChange={(e) => {
            setCodigos(e.target.value);
            setOk(null);
          }}
        />
      </Campo>
      <Campo className="mt-2" label="Observação do lote" ajuda="gift.observacaoLote" htmlFor="lote-obs">
        <input
          id="lote-obs"
          className={inputCls}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="fornecedor, nota — opcional"
        />
      </Campo>

      {cadastrar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">{cadastrar.error?.message}</p>
      )}
      {ok && <p className="mt-3 font-sans text-xs text-emerald-400">{ok}</p>}

      <NeonButton
        accent="purple"
        className="mt-4 w-full"
        disabled={cadastrar.isPending || !codigos.trim()}
        onClick={enviar}
      >
        {cadastrar.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Cadastrar {linhas > 0 ? `${linhas} código(s)` : "lote"}
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/* LINHA DE CÓDIGO — mascarado, revelar, copiar                        */
/* ------------------------------------------------------------------ */

export function LinhaCodigo({
  card,
  contaId,
  onAplicado,
  compacto = false,
}: {
  card: {
    id: number;
    provider: string;
    value: number;
    status: string;
    mascara: string;
    observacao: string;
  };
  /** conta matriz alvo — quando vem da Gestão de Contas */
  contaId?: number;
  onAplicado?: () => void;
  compacto?: boolean;
}) {
  const revelar = useRevelarGift();
  const marcar = useMarcarGiftEmUso();
  const confirmar = useConfirmarUsoGift();
  const devolver = useDevolverGift();
  const remover = useRemoverGift();

  const [aberto, setAberto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const puxarCodigo = async () => {
    if (aberto) return aberto;
    const r = await revelar.mutateAsync({ id: card.id });
    setAberto(r.code);
    return r.code;
  };

  /** COPIAR = a ação principal. Copia, revela e já reserva o código. */
  const copiar = async () => {
    setErro(null);
    try {
      const code = await puxarCodigo();
      await navigator.clipboard.writeText(code);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
      if (card.status === "disponivel") marcar.mutate({ id: card.id, contaId });
    } catch {
      setErro("Não foi possível copiar. Revele o código e copie manualmente.");
    }
  };

  const cor =
    card.status === "disponivel" ? "cyan" : card.status === "em_uso" ? "purple" : "red";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-3">
        {!compacto && <AppIcon id={card.provider} size="sm" />}
        <span className="min-w-[9.5rem] font-mono text-sm tracking-wider text-white/80">
          {aberto ?? card.mascara}
        </span>
        <span className="font-display text-sm font-bold text-white">{brl(card.value)}</span>
        <Tooltip texto="gift.status" titulo="Situação do código">
          <Pill accent={cor as "cyan" | "purple" | "red"}>{ROTULO_STATUS[card.status]}</Pill>
        </Tooltip>

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip texto="gift.mascara" titulo={aberto ? "Ocultar código" : "Revelar código"}>
            <button
              type="button"
              aria-label={aberto ? "Ocultar código" : "Revelar código"}
              onClick={() => {
                if (aberto) setAberto(null);
                else void puxarCodigo();
              }}
              className="rounded-lg border border-white/12 p-2 text-white/50 hover:bg-white/5 hover:text-white"
            >
              {revelar.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : aberto ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </Tooltip>
          <Tooltip texto="gift.copiar" titulo="Copiar código">
            <button
              type="button"
              aria-label="Copiar código"
              onClick={() => void copiar()}
              className="rounded-lg border border-white/12 p-2 text-white/50 hover:bg-white/5 hover:text-white"
            >
              {copiado ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </Tooltip>
          {card.status === "em_uso" && (
            <Tooltip texto="gift.devolver" titulo="Devolver ao estoque">
              <button
                type="button"
                aria-label="Devolver ao estoque"
                onClick={() => devolver.mutate({ id: card.id })}
                className="rounded-lg border border-white/12 p-2 text-white/50 hover:bg-white/5 hover:text-white"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </Tooltip>
          )}
          {card.status !== "utilizado" && !compacto && (
            <Tooltip texto="gift.remover" titulo="Remover código">
              <button
                type="button"
                aria-label="Remover código"
                onClick={() => remover.mutate({ id: card.id })}
                className="rounded-lg border border-white/12 p-2 text-white/40 hover:bg-neon-red/10 hover:text-neon-red"
              >
                <Trash2 className="size-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {card.observacao && (
        <p className="mt-2 font-sans text-[11px] text-white/35">{card.observacao}</p>
      )}
      {erro && <p className="mt-2 font-sans text-[11px] text-neon-red">{erro}</p>}

      {card.status !== "utilizado" && (contaId || card.status === "em_uso") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <NeonButton
            accent="cyan"
            size="sm"
            disabled={confirmar.isPending}
            onClick={() =>
              confirmar.mutate(
                { id: card.id, contaId, creditar: true },
                { onSuccess: () => onAplicado?.() },
              )
            }
          >
            {confirmar.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Confirmei que apliquei
          </NeonButton>
          <Ajuda ajuda="gift.confirmar" />
          <span className="font-sans text-[11px] text-white/35">
            {contaId
              ? `credita ${brl(card.value)} no saldo desta conta`
              : "abra pela Gestão de Contas para creditar o saldo"}
          </span>
          {confirmar.isError && (
            <span className="font-sans text-[11px] text-neon-red">
              {confirmar.error?.message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VIEW PRINCIPAL                                                      */
/* ------------------------------------------------------------------ */

export function EstoqueGiftView() {
  const resumo = useResumoEstoqueGift();
  const [provider, setProvider] = useState<string>("");
  const [status, setStatus] = useState<StatusGift | "">("disponivel");
  const codigos = useCodigosGift({
    provider: provider || undefined,
    status: status || undefined,
  });

  const provedores = resumo.data?.provedores ?? [];
  const totais = resumo.data?.totais;
  const catalogo = useMemo(() => resumo.data?.catalogo ?? [], [resumo.data]);
  const disponiveis = resumo.data?.disponiveis ?? [];
  const alternarApp = useAlternarAppGift();
  const [adicionando, setAdicionando] = useState("");

  return (
    <div className="grid gap-5">
      {/* faixa de totais */}
      <GlassCard strong accent="cyan" className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TituloSecao icone={<Ticket className="size-4 text-neon-cyan" />} ajuda="secao.estoquegift">
            Estoque de gift cards
          </TituloSecao>
          <Pill accent="cyan" icon={<ShieldCheck className="size-3" />}>
            códigos com visibilidade restrita
          </Pill>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              rotulo: "Disponível",
              valor: brl(totais?.disponivelValor ?? 0),
              cor: "text-neon-cyan",
              ajuda: "gift.disponivelValor",
            },
            {
              rotulo: "Códigos livres",
              valor: String(totais?.disponivelQtd ?? 0),
              cor: "text-white",
              ajuda: "Quantos códigos estão prontos para uso, somando todos os provedores.",
            },
            {
              rotulo: "Em uso",
              valor: String(totais?.emUsoQtd ?? 0),
              cor: "text-neon-purple",
              ajuda: "Códigos que alguém copiou e ainda não confirmou. Se ninguém aplicou, devolva ao estoque.",
            },
            {
              rotulo: "Já aplicado",
              valor: brl(totais?.utilizadoValor ?? 0),
              cor: "text-white/60",
              ajuda: "Total histórico já resgatado e creditado no saldo das contas matrizes.",
            },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-xl bg-white/[0.03] px-3 py-3">
              <div className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-white/35">
                {k.rotulo}
                <Ajuda ajuda={k.ajuda} lado="bottom" />
              </div>
              <div className={`mt-1 font-display text-lg font-extrabold ${k.cor}`}>{k.valor}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* saldo por provedor */}
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 font-sans text-[11px] uppercase tracking-wider text-white/35">
              Apps na tela
              <Ajuda ajuda="gift.apps" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select
                aria-label="Escolher aplicativo para adicionar ao estoque de gift card"
                value={adicionando}
                onChange={(e) => setAdicionando(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-xs text-white focus:border-neon-cyan/50 focus:outline-none"
              >
                <option value="" className="bg-[#09090b]">
                  Escolher aplicativo…
                </option>
                {disponiveis.map((a) => (
                  <option key={a.slug} value={a.slug} className="bg-[#09090b]">
                    {a.nome}
                  </option>
                ))}
              </select>
              <NeonButton
                accent="cyan"
                size="sm"
                disabled={!adicionando || alternarApp.isPending}
                onClick={() =>
                  alternarApp.mutate(
                    { slug: adicionando, ativo: true },
                    { onSuccess: () => setAdicionando("") },
                  )
                }
              >
                {alternarApp.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Adicionar app
              </NeonButton>
            </div>
          </div>
          {alternarApp.isError && (
            <p className="font-sans text-xs text-neon-red">{alternarApp.error?.message}</p>
          )}
          {resumo.isPending && (
            <GlassCard className="p-8 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-white/40" />
            </GlassCard>
          )}
          {!resumo.isPending && provedores.length === 0 && (
            <GlassCard className="p-8 text-center font-sans text-sm text-white/40">
              Nenhum provedor com estoque ainda. Cadastre o primeiro lote ao lado.
            </GlassCard>
          )}
          {provedores.map((p) => (
            <GlassCard key={p.provider} hover className="p-4">
              <button
                type="button"
                onClick={() => setProvider((atual) => (atual === p.provider ? "" : p.provider))}
                className="flex w-full flex-wrap items-center gap-3 text-left"
              >
                <AppIcon id={p.provider} size="md" active={provider === p.provider} />
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white">{p.nome}</div>
                  <div className="font-sans text-[11px] text-white/35">
                    {p.contas} conta(s) · custo {brl(p.custoMensal)}/mês
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="flex items-center justify-end gap-1.5 font-display text-xl font-extrabold text-neon-cyan">
                    {brl(p.disponivelValor)}
                  </div>
                  <div className="font-sans text-[11px] text-white/35">
                    {p.disponivelQtd} livre(s)
                    {p.emUsoQtd ? ` · ${p.emUsoQtd} em uso` : ""}
                    {p.disponivelQtd > 0 && p.mesesDeFolga !== null
                      ? ` · ${p.mesesDeFolga} m de folga`
                      : ""}
                  </div>
                </div>
              </button>
              <div className="mt-2 flex items-center justify-end gap-2">
                <Ajuda ajuda="gift.mesesFolga" />
                <button
                  type="button"
                  aria-label={`Remover ${p.nome} do estoque de gift cards`}
                  disabled={alternarApp.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `Remover ${p.nome} da tela de gift cards? Os códigos já usados continuam no histórico.`,
                      )
                    ) {
                      alternarApp.mutate({ slug: p.provider, ativo: false });
                    }
                  }}
                  className="rounded-lg border border-white/10 px-2.5 py-1 font-sans text-[11px] text-white/40 transition-colors hover:border-neon-red/40 hover:text-neon-red"
                >
                  <X className="mr-1 inline size-3" />
                  Remover
                </button>
              </div>
            </GlassCard>
          ))}
        </div>

        <CadastroLote catalogo={catalogo} />
      </div>

      {/* lista de códigos */}
      <GlassCard strong className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Gift className="size-4 text-neon-red" />
          <span className="font-display text-sm font-bold text-white">Códigos</span>
          <Ajuda ajuda="gift.mascara" lado="bottom" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Ajuda ajuda="gift.status" lado="bottom" icone="?" />
            <select
              aria-label="Filtrar por provedor"
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-sans text-[11px] text-white focus:outline-none"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="" className="bg-[#0b0b12]">
                Todos os provedores
              </option>
              {provedores.map((p) => (
                <option key={p.provider} value={p.provider} className="bg-[#0b0b12]">
                  {p.nome}
                </option>
              ))}
            </select>
            {(["disponivel", "em_uso", "utilizado", ""] as const).map((s) => (
              <button
                key={s || "todos"}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-2.5 py-1.5 font-sans text-[11px] transition-colors ${
                  status === s
                    ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                    : "border-white/12 text-white/50 hover:bg-white/5"
                }`}
              >
                {s ? ROTULO_STATUS[s] : "Todos"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {codigos.isPending && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-white/40" />
            </div>
          )}
          {codigos.data?.length === 0 && (
            <p className="py-8 text-center font-sans text-sm text-white/35">
              Nenhum código com esse filtro.
            </p>
          )}
          {codigos.data?.map((c) => (
            <LinhaCodigo key={c.id} card={c} />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
