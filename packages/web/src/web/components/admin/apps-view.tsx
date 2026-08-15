import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsDown,
  ChevronsUp,
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
  useAutoSalvar,
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
function PrecoInline({
  app,
}: {
  app: { id: number; nome: string; preco: number };
}) {
  const atualizar = useAtualizarAplicativo();
  const [valor, setValor] = useState(String(app.preco));

  const preco = Number(valor);
  const valido = Number.isFinite(preco) && preco >= 0;
  const mudou = valido && preco !== app.preco;

  const { estado, confirmar } = useAutoSalvar({
    mudou,
    salvando: atualizar.isPending,
    erro: atualizar.isError
      ? (atualizar.error?.message ?? "Falha ao salvar")
      : null,
    salvar: () => atualizar.mutate({ id: app.id, preco, precoAvulso: preco }),
  });

  /** o "Salvo" fica visível alguns segundos e sai: 20 cards com selo fixo viram ruído */
  const [recemSalvo, setRecemSalvo] = useState(false);
  useEffect(() => {
    if (!atualizar.isSuccess) return;
    setRecemSalvo(true);
    const t = setTimeout(() => setRecemSalvo(false), 2600);
    return () => clearTimeout(t);
  }, [atualizar.isSuccess, atualizar.data]);

  const salvarAgora = () => {
    if (!valido) {
      setValor(String(app.preco));
      atualizar.reset();
      return;
    }
    if (mudou) confirmar();
  };

  return (
    <span className="flex items-center gap-1 text-white/45">
      R$
      <input
        type="number"
        step="0.01"
        min="0"
        aria-label={`Preço avulso de ${app.nome}`}
        value={valor}
        onChange={(e) => {
          atualizar.reset();
          setValor(e.target.value);
        }}
        onBlur={salvarAgora}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-14 rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 text-right font-mono text-[10px] text-white outline-none transition-colors focus:border-neon-cyan/50"
      />
      <span className="text-white/20">/mês</span>
      {(estado !== "salvo" || recemSalvo) && (
        <SeloSalvo estado={estado} className="ml-1 px-1.5 py-0.5 text-[9px]" />
      )}
      {estado === "erro" && (
        <span className="font-sans text-[9px] text-neon-red">
          {atualizar.error?.message}
        </span>
      )}
    </span>
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
                  className="flex items-center gap-3 p-4"
                >
                  <AppIcon id={app.slug} size="sm" active={app.ativo} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold text-white">
                      {app.nome}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/30">
                      <span className="truncate">{app.slug}</span>
                      <span className="text-white/15">·</span>
                      <PrecoInline app={app} />
                    </div>
                  </div>
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
