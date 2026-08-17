import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsDown,
  ChevronsUp,
  Gift,
  Loader2,
  ListOrdered,
  Layers,
  Plus,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { Ajuda, Campo, TituloSecao } from "../ui/tooltip";
import { GlassCard, NeonButton, accentHex } from "../ui/kit";
import { brl } from "@/lib/mock-data";
import {
  useAplicativos,
  useAtualizarAplicativo,
  useCriarAplicativo,
  useRemoverAplicativo,
  useReordenarAplicativos,
} from "../../queries/aplicativos";
import { ComboBuilder } from "./combo-builder";
import { ModalOpcoesApp } from "./modal-opcoes-app";
import { useCatalogoOpcoes } from "../../queries/planos-apps";
import {
  BarraSalvamento,
  SeloSalvo,
  type EstadoSalvamento,
} from "./salvamento";

const TIPOS = [
  { id: "video", label: "Vídeo" },
  { id: "musica", label: "Música" },
  { id: "extra", label: "Extra" },
] as const;

/** categorias comerciais do catálogo — organizam a vitrine e o painel */
export const CATEGORIAS = [
  { id: "streaming", label: "Streaming", accent: "red" as const },
  { id: "esportes", label: "Esportes", accent: "cyan" as const },
  { id: "produtividade", label: "Produtividade", accent: "purple" as const },
  { id: "musica", label: "Música", accent: "cyan" as const },
  { id: "iptv", label: "IPTV", accent: "red" as const },
  { id: "asiatico", label: "Conteúdo Asiático", accent: "purple" as const },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]["id"];

export const rotuloCategoria = (id: string) =>
  CATEGORIAS.find((c) => c.id === id)?.label ?? "Outros";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

function NovoAppForm({ onClose }: { onClose: () => void }) {
  const criar = useCriarAplicativo();
  const [form, setForm] = useState({
    nome: "",
    mono: "",
    cor: "#22d3ee",
    tipo: "video" as (typeof TIPOS)[number]["id"],
    categoria: "streaming" as CategoriaId,
    preco: 0,
    precoAvulso: 0,
    temGiftCard: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <GlassCard strong accent="purple" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <TituloSecao ajuda="Cadastre aqui um serviço novo. Ele só aparece na vitrine e pode entrar em pacotes depois de existir neste catálogo.">
          Novo aplicativo
        </TituloSecao>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-xs text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Nome" ajuda="app.nome" htmlFor="app-nome" obrigatorio>
          <input
            id="app-nome"
            className={inputCls}
            placeholder="ex.: Max"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </Campo>
        <Campo
          label="Monograma"
          ajuda="app.mono"
          htmlFor="app-mono"
          sufixo="até 4 letras"
        >
          <input
            id="app-mono"
            className={inputCls}
            placeholder="ex.: MX"
            maxLength={4}
            value={form.mono}
            onChange={(e) => set("mono", e.target.value)}
          />
        </Campo>
        <Campo label="Cor da marca" ajuda="app.cor" htmlFor="app-cor">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Cor da marca"
              value={form.cor}
              onChange={(e) => set("cor", e.target.value)}
              className="size-10 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-transparent"
            />
            <input
              id="app-cor"
              className={inputCls}
              placeholder="#22d3ee"
              value={form.cor}
              onChange={(e) => set("cor", e.target.value)}
            />
          </div>
        </Campo>
        <Campo label="Tipo de mídia" ajuda="app.tipo" htmlFor="app-tipo">
          <select
            id="app-tipo"
            className={inputCls}
            aria-label="Tipo de mídia"
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value as typeof form.tipo)}
          >
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#09090b]">
                {t.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Categoria" ajuda="app.categoria" htmlFor="app-categoria">
          <select
            id="app-categoria"
            className={inputCls}
            aria-label="Categoria"
            value={form.categoria}
            onChange={(e) => set("categoria", e.target.value as CategoriaId)}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#09090b]">
                {c.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          label="Preço avulso"
          ajuda="app.precoAvulso"
          htmlFor="app-preco"
          sufixo="R$ / mês"
        >
          <input
            id="app-preco"
            className={inputCls}
            type="number"
            step="0.01"
            aria-label="Preço avulso"
            placeholder="0,00"
            value={form.preco}
            onChange={(e) => {
              const v = Number(e.target.value);
              set("preco", v);
              set("precoAvulso", v);
            }}
          />
        </Campo>
        <label
          htmlFor="app-gift"
          className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
        >
          <input
            id="app-gift"
            type="checkbox"
            checked={form.temGiftCard}
            onChange={(e) => set("temGiftCard", e.target.checked)}
            className="size-4 accent-[#22d3ee]"
          />
          <span className="font-sans text-xs text-white/70">Tem gift card</span>
          <Ajuda ajuda="app.temGiftCard" />
        </label>
      </div>

      {criar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">
          {criar.error?.message}
        </p>
      )}

      <NeonButton
        accent="purple"
        size="sm"
        className="mt-4"
        disabled={criar.isPending || !form.nome}
        onClick={() => criar.mutate(form, { onSuccess: onClose })}
      >
        {criar.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Cadastrar aplicativo
      </NeonButton>
    </GlassCard>
  );
}

/**
 * Edição rápida do preço avulso direto no card.
 *
 * Grava sozinha (Enter, ao sair do campo ou 1,5s depois da última tecla) e
 * mostra o selo do estado ao lado — sem o selo o admin não tem como saber se o
 * número novo pegou, já que o card não recarrega visivelmente.
 */
function EditorPrecos({
  app,
}: {
  app: { id: number; nome: string; preco: number; precoAvulso: number };
}) {
  const atualizar = useAtualizarAplicativo();
  const [venda, setVenda] = useState(String(app.preco));
  const [mercado, setMercado] = useState(String(app.precoAvulso));

  /** o servidor é a verdade: quando o app recarrega, os campos acompanham */
  useEffect(() => {
    setVenda(String(app.preco));
    setMercado(String(app.precoAvulso));
  }, [app.preco, app.precoAvulso]);

  const nVenda = Number(venda);
  const nMercado = Number(mercado);
  const validoVenda = venda.trim() !== "" && Number.isFinite(nVenda) && nVenda >= 0;
  const validoMercado = mercado.trim() !== "" && Number.isFinite(nMercado) && nMercado >= 0;
  const valido = validoVenda && validoMercado;
  const mudou = nVenda !== app.preco || nMercado !== app.precoAvulso;

  const estado: EstadoSalvamento = atualizar.isError
    ? "erro"
    : atualizar.isPending
      ? "salvando"
      : mudou
        ? "pendente"
        : "salvo";

  const salvar = () => {
    if (!valido || !mudou) return;
    atualizar.mutate({ id: app.id, preco: nVenda, precoAvulso: nMercado });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      salvar();
    }
    if (e.key === "Escape") {
      atualizar.reset();
      setVenda(String(app.preco));
      setMercado(String(app.precoAvulso));
    }
  };

  const campoCls =
    "w-full rounded-lg border bg-white/[0.04] py-1.5 pl-7 pr-2 text-right font-mono text-xs text-white outline-none transition-colors focus:border-neon-cyan/60";

  return (
    <div
      className={
        mudou
          ? "rounded-xl border border-amber-400/40 bg-amber-400/[0.06] p-2.5"
          : "rounded-xl border border-white/8 bg-white/[0.02] p-2.5"
      }
    >
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-1 font-sans text-[9px] font-semibold uppercase tracking-wider text-white/40">
            Nosso preço
            <Ajuda ajuda="app.precoVenda" lado="top" />
          </span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/30">
              R$
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              aria-label={`Nosso preço de ${app.nome}`}
              value={venda}
              onChange={(e) => {
                atualizar.reset();
                const v = e.target.value;
                setVenda(v);
                /* espelha no mercado só quando ele ainda não foi definido —
                   assim o comparativo de economia nunca zera sozinho */
                if (Number(mercado) === 0) setMercado(v);
              }}
              onKeyDown={aoTeclar}
              className={`${campoCls} ${validoVenda ? "border-white/12" : "border-neon-red/60"}`}
            />
          </span>
        </label>

        <label className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-1 font-sans text-[9px] font-semibold uppercase tracking-wider text-white/40">
            Mercado
            <Ajuda ajuda="app.precoMercado" lado="top" />
          </span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/30">
              R$
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              aria-label={`Preço de mercado de ${app.nome}`}
              value={mercado}
              onChange={(e) => {
                atualizar.reset();
                setMercado(e.target.value);
              }}
              onKeyDown={aoTeclar}
              className={`${campoCls} ${validoMercado ? "border-white/12" : "border-neon-red/60"}`}
            />
          </span>
        </label>

        <button
          type="button"
          onClick={salvar}
          disabled={!mudou || !valido || atualizar.isPending}
          aria-label={`Salvar preços de ${app.nome}`}
          className={
            !mudou || !valido || atualizar.isPending
              ? "flex h-[30px] shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border border-white/8 px-2.5 font-sans text-[11px] font-semibold text-white/25"
              : "flex h-[30px] shrink-0 items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-400/12 px-2.5 font-sans text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/22"
          }
        >
          {atualizar.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
          Salvar
        </button>
      </div>

      <div className="mt-1.5 flex min-h-[16px] items-center gap-1.5">
        <SeloSalvo estado={estado} className="px-1.5 py-0.5 text-[9px]" />
        <span className="truncate font-sans text-[9px] text-white/30">
          {estado === "erro"
            ? (atualizar.error?.message ?? "Falha ao salvar")
            : !valido
              ? "Preço inválido."
              : mudou
                ? "Clique em Salvar (ou Enter) para gravar."
                : nMercado > nVenda
                  ? `Cliente economiza ${brl(nMercado - nVenda)}/mês.`
                  : "Sem economia exibida na vitrine."}
        </span>
      </div>
    </div>
  );
}

/**
 * ORDEM DA GRADE DA LANDING.
 *
 * A vitrine (`Monte seu próprio Combo`) exibe os apps exatamente na ordem
 * gravada aqui — `aplicativos.listar` ordena por `ordem` e a landing respeita a
 * lista como veio. Usamos setas em vez de arrastar porque no celular o
 * drag-and-drop erra a mira, e essa tela é usada muito do celular.
 *
 * A ordem só vai para o banco quando o admin clica em Confirmar: mexer em 20
 * apps salvando a cada clique geraria 20 gravações e um estado intermediário
 * visível na landing.
 */
function OrdemDaGrade({
  apps,
  onFechar,
}: {
  apps: { id: number; nome: string; slug: string; ativo: boolean }[];
  onFechar: () => void;
}) {
  const reordenar = useReordenarAplicativos();
  const original = useMemo(() => apps.map((a) => a.id), [apps]);
  const [ordem, setOrdem] = useState<number[]>(original);

  const porId = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const mudou =
    ordem.length !== original.length ||
    ordem.some((id, i) => id !== original[i]);

  const estado: EstadoSalvamento = reordenar.isPending
    ? "salvando"
    : reordenar.isError
      ? "erro"
      : mudou
        ? "pendente"
        : "salvo";

  /** move um app `delta` posições (ou para a ponta, com `extremo`) */
  function mover(id: number, delta: number, extremo = false) {
    setOrdem((atual) => {
      const de = atual.indexOf(id);
      if (de < 0) return atual;
      const para = extremo ? (delta < 0 ? 0 : atual.length - 1) : de + delta;
      if (para < 0 || para >= atual.length) return atual;
      const copia = [...atual];
      copia.splice(de, 1);
      copia.splice(para, 0, id);
      return copia;
    });
  }

  return (
    <GlassCard strong accent="cyan" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloSecao ajuda="ordem.grade">Ordem da grade na landing</TituloSecao>
        <button
          type="button"
          onClick={onFechar}
          className="font-sans text-xs text-white/40 hover:text-white"
        >
          fechar
        </button>
      </div>

      <p className="mt-1.5 font-sans text-xs text-white/40">
        O primeiro da lista é o primeiro card que o visitante vê no montador de
        combos. Suba os apps que mais vendem — nada muda na vitrine até você
        confirmar.
      </p>

      <ol className="mt-4 space-y-2">
        {ordem.map((id, i) => {
          const app = porId.get(id);
          if (!app) return null;
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
            >
              <span className="w-7 shrink-0 text-center font-mono text-[11px] text-white/30">
                {i + 1}
              </span>
              <AppIcon id={app.slug} size="sm" active={app.ativo} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-semibold text-white">
                  {app.nome}
                </div>
                <div className="font-mono text-[10px] text-white/25">
                  {app.ativo
                    ? app.slug
                    : `${app.slug} · inativo (fora da vitrine)`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <BotaoMover
                  rotulo={`Mandar ${app.nome} para o topo`}
                  desabilitado={i === 0}
                  onClick={() => mover(id, -1, true)}
                >
                  <ChevronsUp className="size-3.5" />
                </BotaoMover>
                <BotaoMover
                  rotulo={`Subir ${app.nome}`}
                  desabilitado={i === 0}
                  onClick={() => mover(id, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </BotaoMover>
                <BotaoMover
                  rotulo={`Descer ${app.nome}`}
                  desabilitado={i === ordem.length - 1}
                  onClick={() => mover(id, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </BotaoMover>
                <BotaoMover
                  rotulo={`Mandar ${app.nome} para o fim`}
                  desabilitado={i === ordem.length - 1}
                  onClick={() => mover(id, 1, true)}
                >
                  <ChevronsDown className="size-3.5" />
                </BotaoMover>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            reordenar.reset();
            setOrdem(original);
          }}
          disabled={!mudou}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 font-sans text-xs text-white/45 transition-colors enabled:hover:border-white/25 enabled:hover:text-white disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" />
          Desfazer alterações
        </button>
        <BarraSalvamento
          className="min-w-[280px] flex-1"
          estado={estado}
          erro={reordenar.error?.message}
          ajuda="ordem.confirmar"
          rotulo="Confirmar ordem"
          onConfirmar={() => reordenar.mutate({ ids: ordem })}
        />
      </div>
    </GlassCard>
  );
}

function BotaoMover({
  rotulo,
  desabilitado,
  onClick,
  children,
}: {
  rotulo: string;
  desabilitado: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors enabled:hover:border-neon-cyan/50 enabled:hover:text-neon-cyan disabled:opacity-25"
    >
      {children}
    </button>
  );
}

export function AppsView() {
  const { data, isPending, isError, error } = useAplicativos();
  const atualizar = useAtualizarAplicativo();
  const remover = useRemoverAplicativo();
  const [criando, setCriando] = useState(false);
  const [ordenando, setOrdenando] = useState(false);
  /** app cujas opções (variantes) estão sendo editadas */
  const [vendoOpcoes, setVendoOpcoes] = useState<{ id: number; nome: string; slug: string } | null>(
    null,
  );
  // só para exibir a contagem de opções no card — a edição vive no modal
  const { data: catalogoOpcoes } = useCatalogoOpcoes();
  const [filtro, setFiltro] = useState<"todas" | CategoriaId>("todas");

  const apps = data ?? [];
  const ativos = apps.filter((a) => a.ativo).length;

  /** apps agrupados por categoria, respeitando a ordem comercial de CATEGORIAS */
  const grupos = useMemo(() => {
    const visiveis =
      filtro === "todas" ? apps : apps.filter((a) => a.categoria === filtro);
    return CATEGORIAS.map((cat) => ({
      ...cat,
      itens: visiveis
        .filter((a) => a.categoria === cat.id)
        .sort((a, b) => a.preco - b.preco || a.nome.localeCompare(b.nome)),
    })).filter((g) => g.itens.length > 0);
  }, [apps, filtro]);

  if (isError)
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <AlertTriangle className="mx-auto size-6 text-neon-red" />
        <p className="mt-3 font-display text-sm font-bold text-white">
          Erro ao carregar o catálogo
        </p>
        <p className="mt-1.5 font-sans text-xs text-white/45">
          {error?.message}
        </p>
      </GlassCard>
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            ajuda: "Total de apps no catálogo, ativos e inativos.",
            label: "Aplicativos",
            value: String(apps.length),
            sub: `${CATEGORIAS.length} categorias`,
            accent: "cyan" as const,
          },
          {
            ajuda: "app.ativo",
            label: "Ativos",
            value: String(ativos),
            sub: "disponíveis para pacotes",
            accent: "purple" as const,
          },
          {
            ajuda: "app.precoAvulso",
            label: "Valor avulso somado",
            value: brl(apps.reduce((s, a) => s + a.precoAvulso, 0)),
            sub: "referência de economia",
            accent: "red" as const,
          },
        ].map((s) => (
          <GlassCard key={s.label} accent={s.accent} className="p-5">
            <div className="flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
              <Ajuda ajuda={s.ajuda} lado="bottom" />
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">
              {s.value}
            </div>
            <div
              className="mt-1 font-sans text-[11px]"
              style={{ color: accentHex[s.accent] }}
            >
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <ComboBuilder apps={apps} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[{ id: "todas" as const, label: "Todas" }, ...CATEGORIAS].map(
            (c) => {
              const total =
                c.id === "todas"
                  ? apps.length
                  : apps.filter((a) => a.categoria === c.id).length;
              const on = filtro === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFiltro(c.id)}
                  className={
                    on
                      ? "rounded-full border border-neon-purple/60 bg-neon-purple/[0.12] px-3.5 py-1.5 font-sans text-xs font-semibold text-white"
                      : "rounded-full border border-white/10 px-3.5 py-1.5 font-sans text-xs text-white/45 transition-colors hover:border-white/25 hover:text-white"
                  }
                >
                  {c.label} <span className="text-white/30">{total}</span>
                </button>
              );
            },
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!ordenando && apps.length > 1 && (
            <NeonButton
              accent="cyan"
              size="sm"
              onClick={() => setOrdenando(true)}
            >
              <ListOrdered className="size-4" />
              Ordenar grade da landing
            </NeonButton>
          )}
          {!criando && (
            <NeonButton
              accent="purple"
              size="sm"
              onClick={() => setCriando(true)}
            >
              <Plus className="size-4" />
              Novo aplicativo
            </NeonButton>
          )}
        </div>
      </div>

      {criando && <NovoAppForm onClose={() => setCriando(false)} />}

      {ordenando && (
        <OrdemDaGrade apps={apps} onFechar={() => setOrdenando(false)} />
      )}

      {isPending ? (
        <GlassCard className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="size-5 animate-spin text-neon-cyan" />
          <span className="font-sans text-sm text-white/45">
            Carregando catálogo...
          </span>
        </GlassCard>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-sm font-bold tracking-tight text-white">
                {grupo.label}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold"
                style={{
                  color: accentHex[grupo.accent],
                  background: `${accentHex[grupo.accent]}18`,
                }}
              >
                {grupo.itens.length}
              </span>
              <div className="h-px flex-1 bg-white/[0.07]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {grupo.itens.map((app) => (
                <GlassCard
                  key={app.id}
                  hover
                  className="flex flex-col gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                  <AppIcon id={app.slug} size="sm" active={app.ativo} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold text-white">
                      {app.nome}
                    </div>
                    <div className="truncate font-mono text-[10px] text-white/30">
                      {app.slug}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={
                      app.temGiftCard
                        ? `Tirar ${app.nome} do estoque de gift cards`
                        : `Marcar que ${app.nome} tem gift card`
                    }
                    disabled={atualizar.isPending}
                    onClick={() =>
                      atualizar.mutate({
                        id: app.id,
                        temGiftCard: !app.temGiftCard,
                      })
                    }
                    className={
                      app.temGiftCard
                        ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                        : "flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-cyan/40 hover:text-neon-cyan"
                    }
                  >
                    <Gift className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Opções de ${app.nome}`}
                    onClick={() =>
                      setVendoOpcoes({ id: app.id, nome: app.nome, slug: app.slug })
                    }
                    className="relative flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
                  >
                    <Layers className="size-3.5" />
                    {(() => {
                      const n =
                        catalogoOpcoes?.find((c) => c.id === app.id)?.opcoes.filter((o) => o.ativo)
                          .length ?? 0;
                      return n > 1 ? (
                        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-neon-purple font-sans text-[9px] font-bold text-white">
                          {n}
                        </span>
                      ) : null;
                    })()}
                  </button>
                  <button
                    type="button"
                    aria-label={app.ativo ? "Desativar app" : "Ativar app"}
                    title={app.ativo ? "Desativar" : "Ativar"}
                    disabled={atualizar.isPending}
                    onClick={() =>
                      atualizar.mutate({ id: app.id, ativo: !app.ativo })
                    }
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:text-white"
                    style={
                      app.ativo
                        ? { color: "#34d399", borderColor: "#34d39955" }
                        : undefined
                    }
                  >
                    {app.ativo ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Power className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Remover app"
                    disabled={remover.isPending}
                    onClick={() => remover.mutate({ id: app.id })}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  </div>

                  <EditorPrecos app={app} />
                </GlassCard>
              ))}
            </div>
          </section>
        ))
      )}

      {remover.isError && (
        <p className="font-sans text-xs text-neon-red">
          {remover.error?.message}
        </p>
      )}

      {vendoOpcoes && (
        <ModalOpcoesApp app={vendoOpcoes} onFechar={() => setVendoOpcoes(null)} />
      )}
    </div>
  );
}

export default AppsView;
