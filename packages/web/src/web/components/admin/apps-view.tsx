import { useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, accentHex } from "../ui/kit";
import { brl } from "@/lib/mock-data";
import {
  useAplicativos,
  useAtualizarAplicativo,
  useCriarAplicativo,
  useRemoverAplicativo,
} from "../../queries/aplicativos";

const TIPOS = [
  { id: "video", label: "Vídeo" },
  { id: "musica", label: "Música" },
  { id: "extra", label: "Extra" },
] as const;

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

function NovoAppForm({ onClose }: { onClose: () => void }) {
  const criar = useCriarAplicativo();
  const [form, setForm] = useState({
    nome: "",
    mono: "",
    cor: "#22d3ee",
    tipo: "video" as (typeof TIPOS)[number]["id"],
    precoAvulso: 0,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <GlassCard strong accent="purple" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-sm font-bold text-white">Novo aplicativo</div>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-xs text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className={inputCls}
          placeholder="Nome (ex.: Max)"
          value={form.nome}
          onChange={(e) => set("nome", e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Monograma (ex.: MX)"
          maxLength={4}
          value={form.mono}
          onChange={(e) => set("mono", e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Cor da marca"
            value={form.cor}
            onChange={(e) => set("cor", e.target.value)}
            className="size-10 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-transparent"
          />
          <input
            className={inputCls}
            placeholder="#22d3ee"
            value={form.cor}
            onChange={(e) => set("cor", e.target.value)}
          />
        </div>
        <select
          className={inputCls}
          value={form.tipo}
          onChange={(e) => set("tipo", e.target.value as typeof form.tipo)}
        >
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id} className="bg-[#09090b]">
              {t.label}
            </option>
          ))}
        </select>
        <input
          className={inputCls}
          type="number"
          step="0.01"
          placeholder="Preço avulso"
          value={form.precoAvulso}
          onChange={(e) => set("precoAvulso", Number(e.target.value))}
        />
      </div>

      {criar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">{criar.error?.message}</p>
      )}

      <NeonButton
        accent="purple"
        size="sm"
        className="mt-4"
        disabled={criar.isPending || !form.nome}
        onClick={() => criar.mutate(form, { onSuccess: onClose })}
      >
        {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Cadastrar aplicativo
      </NeonButton>
    </GlassCard>
  );
}

export function AppsView() {
  const { data, isPending, isError, error } = useAplicativos();
  const atualizar = useAtualizarAplicativo();
  const remover = useRemoverAplicativo();
  const [criando, setCriando] = useState(false);

  if (isError)
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <AlertTriangle className="mx-auto size-6 text-neon-red" />
        <p className="mt-3 font-display text-sm font-bold text-white">
          Erro ao carregar o catálogo
        </p>
        <p className="mt-1.5 font-sans text-xs text-white/45">{error?.message}</p>
      </GlassCard>
    );

  const apps = data ?? [];
  const ativos = apps.filter((a) => a.ativo).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Aplicativos", value: String(apps.length), sub: "no catálogo", accent: "cyan" as const },
          { label: "Ativos", value: String(ativos), sub: "disponíveis para pacotes", accent: "purple" as const },
          {
            label: "Valor avulso somado",
            value: brl(apps.reduce((s, a) => s + a.precoAvulso, 0)),
            sub: "referência de economia",
            accent: "red" as const,
          },
        ].map((s) => (
          <GlassCard key={s.label} accent={s.accent} className="p-5">
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">{s.value}</div>
            <div className="mt-1 font-sans text-[11px]" style={{ color: accentHex[s.accent] }}>
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="flex justify-end">
        {!criando && (
          <NeonButton accent="purple" size="sm" onClick={() => setCriando(true)}>
            <Plus className="size-4" />
            Novo aplicativo
          </NeonButton>
        )}
      </div>

      {criando && <NovoAppForm onClose={() => setCriando(false)} />}

      {isPending ? (
        <GlassCard className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="size-5 animate-spin text-neon-cyan" />
          <span className="font-sans text-sm text-white/45">Carregando catálogo...</span>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <GlassCard key={app.id} hover className="flex items-center gap-3 p-4">
              <AppIcon id={app.slug} size="sm" active={app.ativo} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold text-white">{app.nome}</div>
                <div className="truncate font-mono text-[10px] text-white/30">
                  {app.slug} · {TIPOS.find((t) => t.id === app.tipo)?.label ?? app.tipo} ·{" "}
                  {brl(app.precoAvulso)}
                </div>
              </div>
              <button
                type="button"
                aria-label={app.ativo ? "Desativar app" : "Ativar app"}
                title={app.ativo ? "Desativar" : "Ativar"}
                disabled={atualizar.isPending}
                onClick={() => atualizar.mutate({ id: app.id, ativo: !app.ativo })}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:text-white"
                style={app.ativo ? { color: "#34d399", borderColor: "#34d39955" } : undefined}
              >
                {app.ativo ? <Check className="size-3.5" /> : <Power className="size-3.5" />}
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
      )}

      {remover.isError && (
        <p className="font-sans text-xs text-neon-red">{remover.error?.message}</p>
      )}
    </div>
  );
}

export default AppsView;
