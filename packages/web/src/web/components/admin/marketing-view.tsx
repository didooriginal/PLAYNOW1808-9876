import { useState } from "react";
import {
  Check,
  Copy,
  History,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Campo, TituloSecao } from "../ui/tooltip";
import { cn } from "../../lib/utils";
import { AJUDA } from "../../lib/ajuda-admin";
import {
  useMarketingTexts,
  useRemoverMarketingText,
  useSalvarMarketingText,
} from "../../queries/marketing";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

type Categoria = "geral" | "promo" | "suporte" | "boas_vindas";

const CATEGORIAS: { valor: Categoria; label: string }[] = [
  { valor: "geral", label: "Geral" },
  { valor: "promo", label: "Promoção" },
  { valor: "suporte", label: "Suporte" },
  { valor: "boas_vindas", label: "Boas-vindas" },
];

type Rascunho = { id?: number; titulo: string; conteudo: string; categoria: Categoria };

/**
 * MARKETING — biblioteca de textos prontos para WhatsApp/Instagram.
 * O botão de IA não inventa nada aqui: ele abre o Copiloto Admin (o mesmo
 * agente já usado no painel) com o pedido preenchido.
 */
export function MarketingView() {
  const { data: textos, isLoading } = useMarketingTexts();
  const salvar = useSalvarMarketingText();
  const remover = useRemoverMarketingText();

  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [promptIA, setPromptIA] = useState("");
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  function copiar(id: number, texto: string) {
    void navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  function pedirAoCopiloto() {
    window.dispatchEvent(
      new CustomEvent("ppn:abrir-copiloto", {
        detail: {
          prompt: `Escreva um texto de marketing da PLAYPLUSNOW para: ${promptIA.trim()}`,
        },
      }),
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <GlassCard strong accent="purple" className="p-5">
        <TituloSecao
          icone={<Megaphone className="size-4 text-neon-purple" />}
          ajuda={AJUDA["marketing.biblioteca"]}
          acao={
            <NeonButton
              accent="purple"
              size="sm"
              onClick={() => setEditando({ titulo: "", conteudo: "", categoria: "geral" })}
            >
              <Plus className="size-4" /> Novo texto
            </NeonButton>
          }
        >
          Textos e campanhas
        </TituloSecao>

        {editando && (
          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <Campo label="Título" ajuda={AJUDA["marketing.titulo"]} obrigatorio>
              <input
                className={inputCls}
                value={editando.titulo}
                onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                placeholder="Ex.: Promoção de inverno"
              />
            </Campo>
            <Campo label="Categoria" ajuda={AJUDA["marketing.categoria"]}>
              <select
                className={inputCls}
                value={editando.categoria}
                onChange={(e) =>
                  setEditando({ ...editando, categoria: e.target.value as Categoria })
                }
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Conteúdo" ajuda={AJUDA["marketing.conteudo"]} obrigatorio>
              <textarea
                className={cn(inputCls, "min-h-[150px]")}
                value={editando.conteudo}
                onChange={(e) => setEditando({ ...editando, conteudo: e.target.value })}
                placeholder="Escreva a mensagem que vai para o cliente…"
              />
            </Campo>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="px-4 py-2 font-sans text-sm text-white/40 hover:text-white"
              >
                Cancelar
              </button>
              <NeonButton
                accent="purple"
                size="sm"
                disabled={salvar.isPending || !editando.titulo.trim() || !editando.conteudo.trim()}
                onClick={() =>
                  salvar.mutate(editando, { onSuccess: () => setEditando(null) })
                }
              >
                {salvar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar texto
              </NeonButton>
            </div>
            {salvar.isError && (
              <p className="font-sans text-xs text-neon-red">{salvar.error.message}</p>
            )}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {isLoading && (
            <p className="py-8 text-center font-sans text-sm text-white/30">Carregando textos…</p>
          )}
          {!isLoading && !textos?.length && !editando && (
            <p className="py-8 text-center font-sans text-sm text-white/30">
              Nenhum texto salvo ainda. Crie o primeiro em "Novo texto".
            </p>
          )}
          {textos?.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-bold text-white">{t.titulo}</h4>
                    <Pill accent="purple" className="px-1.5 py-0 text-[9px]">
                      {CATEGORIAS.find((c) => c.valor === t.categoria)?.label ?? t.categoria}
                    </Pill>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/60">
                    {t.conteudo}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copiar(t.id, t.conteudo)}
                    aria-label={`Copiar o texto ${t.titulo}`}
                    className="p-2 text-white/40 hover:text-neon-cyan"
                  >
                    {copiadoId === t.id ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditando({
                        id: t.id,
                        titulo: t.titulo,
                        conteudo: t.conteudo,
                        categoria: (t.categoria as Categoria) ?? "geral",
                      })
                    }
                    aria-label={`Editar o texto ${t.titulo}`}
                    className="p-2 text-white/40 hover:text-white"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={remover.isPending}
                    onClick={() => {
                      if (confirm(`Excluir o texto "${t.titulo}"?`)) remover.mutate({ id: t.id });
                    }}
                    aria-label={`Excluir o texto ${t.titulo}`}
                    className="p-2 text-white/40 hover:text-neon-red"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="space-y-6">
        <GlassCard strong accent="cyan" className="p-5">
          <TituloSecao
            icone={<Sparkles className="size-4 text-neon-cyan" />}
            ajuda={AJUDA["marketing.copiloto"]}
          >
            Pedir ao Copiloto
          </TituloSecao>
          <p className="mt-2 font-sans text-xs leading-relaxed text-white/40">
            Descreva o que precisa. O Copiloto Admin abre com o pedido pronto — copie a resposta e
            salve aqui como texto.
          </p>
          <textarea
            className={cn(inputCls, "mt-4 min-h-[100px] text-xs")}
            placeholder="Ex.: promoção do plano anual com 20% de desconto…"
            value={promptIA}
            onChange={(e) => setPromptIA(e.target.value)}
          />
          <NeonButton
            accent="cyan"
            size="sm"
            className="mt-3 w-full"
            disabled={!promptIA.trim()}
            onClick={pedirAoCopiloto}
          >
            <Sparkles className="size-4" /> Abrir Copiloto
          </NeonButton>
        </GlassCard>

        <GlassCard className="p-5">
          <TituloSecao icone={<History className="size-4 text-white/40" />}>
            Dicas de envio
          </TituloSecao>
          <ul className="mt-4 space-y-3 font-sans text-[11px] leading-relaxed text-white/40">
            <li className="flex gap-2">
              <span className="text-neon-cyan">•</span>
              Emojis aumentam o engajamento no WhatsApp — sem exagero.
            </li>
            <li className="flex gap-2">
              <span className="text-neon-cyan">•</span>
              Texto curto e objetivo converte mais rápido.
            </li>
            <li className="flex gap-2">
              <span className="text-neon-cyan">•</span>
              Sempre feche com uma chamada clara para ação.
            </li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
