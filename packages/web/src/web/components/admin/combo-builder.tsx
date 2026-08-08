import { useMemo, useState } from "react";
import { Loader2, Monitor, Plus, Sparkles, Store, Trash2, Users } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, accentHex } from "../ui/kit";
import { brl } from "@/lib/mock-data";
import {
  useAtualizarCombo,
  useCombosAdmin,
  useCriarCombo,
  useRemoverCombo,
} from "../../queries/combos";

type AppMinimo = {
  id: number;
  slug: string;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none";

/** switch compacto usado nas opções de visibilidade do combo */
function Toggle({
  on,
  onClick,
  label,
  icon,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "flex items-center gap-2 rounded-xl border border-neon-cyan/50 bg-neon-cyan/[0.1] px-3 py-2 font-sans text-xs font-semibold text-white"
          : "flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 font-sans text-xs text-white/40 transition-colors hover:border-white/25 hover:text-white"
      }
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * COMBO INTELIGENTE.
 * O admin marca 2+ apps e digita o preço promocional. A soma dos avulsos e o
 * desconto são calculados na hora (e recalculados no servidor ao salvar), então
 * o "de/por" mostrado ao cliente nunca é digitado à mão.
 */
export function ComboBuilder({ apps }: { apps: AppMinimo[] }) {
  const combos = useCombosAdmin();
  const criar = useCriarCombo();
  const atualizar = useAtualizarCombo();
  const remover = useRemoverCombo();

  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    preco: 0,
    ciclo: "mensal" as "mensal" | "anual",
    visivelLanding: true,
    visivelCliente: true,
    destaque: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const disponiveis = useMemo(
    () => apps.filter((a) => a.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [apps],
  );

  const somaAvulsa = useMemo(
    () =>
      Math.round(
        sel.reduce((s, slug) => s + (apps.find((a) => a.slug === slug)?.preco ?? 0), 0) * 100,
      ) / 100,
    [sel, apps],
  );
  const desconto =
    somaAvulsa > 0 && form.preco > 0 ? Math.round((1 - form.preco / somaAvulsa) * 100) : 0;

  const alternar = (slug: string) =>
    setSel((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  const limpar = () => {
    setSel([]);
    setForm({
      nome: "",
      descricao: "",
      preco: 0,
      ciclo: "mensal",
      visivelLanding: true,
      visivelCliente: true,
      destaque: false,
    });
  };

  const lista = combos.data ?? [];

  return (
    <GlassCard strong accent="cyan" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-neon-cyan" />
            <span className="font-display text-sm font-bold text-white">Combo Inteligente</span>
            {lista.length > 0 && (
              <span className="rounded-full bg-neon-cyan/15 px-2 py-0.5 font-sans text-[10px] font-semibold text-neon-cyan">
                {lista.length}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            Escolha 2 ou mais apps, defina o preço promocional e o desconto aparece sozinho na
            landing e no painel do cliente.
          </p>
        </div>
        <NeonButton
          accent="cyan"
          size="sm"
          onClick={() => {
            setAberto((v) => !v);
            if (aberto) limpar();
          }}
        >
          {aberto ? "Fechar" : <><Plus className="size-4" /> Montar combo</>}
        </NeonButton>
      </div>

      {aberto && (
        <div className="mt-5 space-y-4 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
          <div>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              1. Selecione os aplicativos
            </div>
            <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
              {disponiveis.map((app) => {
                const on = sel.includes(app.slug);
                return (
                  <button
                    key={app.slug}
                    type="button"
                    onClick={() => alternar(app.slug)}
                    className={
                      on
                        ? "flex items-center gap-2 rounded-xl border border-neon-cyan/60 bg-neon-cyan/[0.12] px-2.5 py-1.5"
                        : "flex items-center gap-2 rounded-xl border border-white/10 px-2.5 py-1.5 transition-colors hover:border-white/25"
                    }
                  >
                    <AppIcon id={app.slug} size="xs" active={on} />
                    <span className="font-sans text-xs text-white">{app.nome}</span>
                    <span className="font-mono text-[10px] text-white/35">{brl(app.preco)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={inputCls}
              placeholder="Nome do combo"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Chamada curta (opcional)"
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
            />
            <input
              className={inputCls}
              type="number"
              step="0.01"
              aria-label="Preço promocional"
              placeholder="Preço promocional"
              value={form.preco}
              onChange={(e) => set("preco", Number(e.target.value))}
            />
            <select
              className={inputCls}
              aria-label="Ciclo de cobrança"
              value={form.ciclo}
              onChange={(e) => set("ciclo", e.target.value as "mensal" | "anual")}
            >
              <option value="mensal" className="bg-[#09090b]">
                Mensal
              </option>
              <option value="anual" className="bg-[#09090b]">
                Anual
              </option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Toggle
              on={form.visivelLanding}
              onClick={() => set("visivelLanding", !form.visivelLanding)}
              label="Mostrar na landing"
              icon={<Store className="size-3.5" />}
            />
            <Toggle
              on={form.visivelCliente}
              onClick={() => set("visivelCliente", !form.visivelCliente)}
              label="Sugerir ao cliente"
              icon={<Users className="size-3.5" />}
            />
            <Toggle
              on={form.destaque}
              onClick={() => set("destaque", !form.destaque)}
              label="Destaque"
              icon={<Sparkles className="size-3.5" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
            <div>
              <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
                Soma avulsa
              </div>
              <div className="font-display text-lg font-extrabold text-white/60 line-through">
                {brl(somaAvulsa)}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
                Combo
              </div>
              <div className="font-display text-lg font-extrabold text-neon-cyan">
                {brl(form.preco)}
              </div>
            </div>
            {desconto > 0 && (
              <Pill accent="red" icon={<Sparkles className="size-3" />}>
                {desconto}% OFF · economia de {brl(somaAvulsa - form.preco)}
              </Pill>
            )}
          </div>

          {criar.isError && (
            <p className="font-sans text-xs text-neon-red">{criar.error?.message}</p>
          )}

          <NeonButton
            accent="cyan"
            size="sm"
            disabled={criar.isPending || sel.length < 2 || !form.nome || form.preco <= 0}
            onClick={() =>
              criar.mutate(
                { ...form, apps: sel },
                {
                  onSuccess: () => {
                    limpar();
                    setAberto(false);
                  },
                },
              )
            }
          >
            {criar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Salvar combo
          </NeonButton>
        </div>
      )}

      {lista.length > 0 && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {lista.map((combo) => (
            <div
              key={combo.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              style={combo.destaque ? { borderColor: `${accentHex.cyan}55` } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold text-white">
                    {combo.nome}
                  </div>
                  <div className="font-sans text-[11px] text-white/35">
                    {combo.apps.length} apps · {combo.ciclo} ·{" "}
                    <span className="text-white/25 line-through">{brl(combo.precoCheio)}</span>{" "}
                    <span className="font-semibold text-neon-cyan">{brl(combo.preco)}</span>{" "}
                    {combo.economiaPct > 0 && (
                      <span className="text-neon-red">({combo.economiaPct}% OFF)</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remover combo"
                  disabled={remover.isPending}
                  onClick={() => remover.mutate({ id: combo.id })}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {combo.apps.map((slug) => (
                  <AppIcon key={slug} id={slug} size="xs" />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Toggle
                  on={combo.visivelLanding}
                  onClick={() =>
                    atualizar.mutate({ id: combo.id, visivelLanding: !combo.visivelLanding })
                  }
                  label="Landing"
                  icon={<Store className="size-3.5" />}
                />
                <Toggle
                  on={combo.visivelCliente}
                  onClick={() =>
                    atualizar.mutate({ id: combo.id, visivelCliente: !combo.visivelCliente })
                  }
                  label="Painel do cliente"
                  icon={<Monitor className="size-3.5" />}
                />
                <Toggle
                  on={combo.ativo}
                  onClick={() => atualizar.mutate({ id: combo.id, ativo: !combo.ativo })}
                  label={combo.ativo ? "Ativo" : "Inativo"}
                  icon={<Sparkles className="size-3.5" />}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

export default ComboBuilder;
