import { useState } from "react";
import { Check, Loader2, Mail, Plus, Star, Trash2, X } from "lucide-react";
import { AppIcon } from "../app-icon";
import { Ajuda, Campo } from "../ui/tooltip";
import { GlassCard, NeonButton } from "../ui/kit";
import { brl } from "@/lib/mock-data";
import {
  useAtualizarOpcaoApp,
  useCatalogoOpcoes,
  useCriarOpcaoApp,
  useRemoverOpcaoApp,
} from "../../queries/planos-apps";

/**
 * OPÇÕES DE UM APLICATIVO (variantes com preços diferentes).
 *
 * Existe porque um mesmo app pode ser vendido em versões diferentes
 * (Globoplay comum / Premium / Premium + Telecine). Em vez de três cards na
 * vitrine, o app continua sendo um só e o cliente escolhe a versão na hora de
 * contratar avulso.
 *
 * Duas regras que o admin precisa ter em mente e estão nos textos de ajuda:
 *  - cada opção tem o SEU estoque: cadastre a conta matriz com o slug da opção;
 *  - pacote é fechado — ele sempre entrega a opção marcada como padrão.
 */

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

type AppComOpcoes = NonNullable<ReturnType<typeof useCatalogoOpcoes>["data"]>[number];

export function ModalOpcoesApp({
  app,
  onFechar,
}: {
  app: { id: number; nome: string; slug: string };
  onFechar: () => void;
}) {
  const { data, isPending } = useCatalogoOpcoes();
  const criar = useCriarOpcaoApp();
  const atualizar = useAtualizarOpcaoApp();
  const remover = useRemoverOpcaoApp();

  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    preco: 0,
    precoAvulso: 0,
    entrega: "vaga" as "vaga" | "convite",
  });

  const atual = (data as AppComOpcoes[] | undefined)?.find((a) => a.id === app.id);
  const opcoes = atual?.opcoes ?? [];

  function salvarNovo() {
    criar.mutate(
      {
        aplicativoId: app.id,
        nome: form.nome,
        descricao: form.descricao,
        preco: form.preco,
        precoAvulso: form.precoAvulso || form.preco,
        entrega: form.entrega,
      },
      {
        onSuccess: () => {
          setNovo(false);
          setForm({ nome: "", descricao: "", preco: 0, precoAvulso: 0, entrega: "vaga" });
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <GlassCard strong accent="purple" className="my-8 w-full max-w-2xl bg-[#0b0b0f] p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppIcon id={app.slug} size="sm" active />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold text-white">
                  Opções de {app.nome}
                </h3>
                <Ajuda ajuda="app.opcoes" />
              </div>
              <p className="mt-0.5 font-sans text-xs text-white/40">
                Versões com preços diferentes. O cliente escolhe na contratação avulsa.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {opcoes.length === 0 && !isPending && (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 font-sans text-xs leading-relaxed text-white/45">
            Este app ainda não tem opções — ele é vendido com preço único. Ao cadastrar a
            primeira opção, o preço passa a vir dela e o cliente escolhe a versão no avulso.
          </p>
        )}

        {isPending ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-white/30" />
          </div>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {opcoes.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-white">{o.nome}</span>
                  {o.padrao && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neon-purple/15 px-2 py-0.5 font-sans text-[10px] font-semibold text-neon-purple">
                      <Star className="size-2.5" />
                      Padrão · vai nos pacotes
                    </span>
                  )}
                  {o.entrega === "convite" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neon-cyan/15 px-2 py-0.5 font-sans text-[10px] font-semibold text-neon-cyan">
                      <Mail className="size-2.5" />
                      Convite do provedor
                    </span>
                  )}
                  {!o.ativo && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 font-sans text-[10px] text-white/40">
                      Desativada
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-white/60">{brl(o.preco)}/mês</span>
                </div>

                {o.descricao && (
                  <p className="mt-1 font-sans text-[11px] leading-relaxed text-white/40">
                    {o.descricao}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-white/30">
                    estoque: {o.slug}
                  </span>

                  <label className="flex items-center gap-1 font-sans text-[10px] text-white/40">
                    R$
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={`Preço de ${o.nome}`}
                      defaultValue={o.preco}
                      onBlur={(e) => {
                        const preco = Number(e.target.value);
                        if (Number.isFinite(preco) && preco !== o.preco)
                          atualizar.mutate({ id: o.id, preco });
                      }}
                      className="w-16 rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 text-right font-mono text-[10px] text-white outline-none focus:border-neon-cyan/50"
                    />
                  </label>

                  <div className="ml-auto flex items-center gap-1.5">
                    {!o.padrao && (
                      <button
                        type="button"
                        aria-label={`Tornar ${o.nome} a opção padrão`}
                        onClick={() => atualizar.mutate({ id: o.id, padrao: true })}
                        className="rounded-lg border border-white/10 px-2 py-1 font-sans text-[10px] text-white/45 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
                      >
                        Tornar padrão
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={o.ativo ? `Desativar ${o.nome}` : `Ativar ${o.nome}`}
                      onClick={() => atualizar.mutate({ id: o.id, ativo: !o.ativo })}
                      className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:text-white"
                      style={o.ativo ? { color: "#34d399", borderColor: "#34d39955" } : undefined}
                    >
                      <Check className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover ${o.nome}`}
                      onClick={() => {
                        if (confirm(`Remover a opção "${o.nome}"? Só é possível se não houver conta matriz nem cliente ativo nela.`))
                          remover.mutate({ id: o.id });
                      }}
                      className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(remover.isError || atualizar.isError) && (
          <p className="mt-3 font-sans text-xs text-neon-red">
            {remover.error?.message ?? atualizar.error?.message}
          </p>
        )}

        {novo ? (
          <div className="mt-5 space-y-3 rounded-xl border border-neon-purple/25 bg-neon-purple/[0.04] p-4">
            <Campo label="Nome da opção" ajuda="app.opcaoNome" htmlFor="op-nome">
              <input
                id="op-nome"
                className={inputCls}
                placeholder="Premium + Telecine"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </Campo>

            <Campo label="O que muda nesta opção" ajuda="app.opcaoDescricao" htmlFor="op-desc">
              <input
                id="op-desc"
                className={inputCls}
                placeholder="Premium com os canais Telecine"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Preço PLAYPLUSNOW" ajuda="app.opcaoPreco" htmlFor="op-preco">
                <input
                  id="op-preco"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={form.preco || ""}
                  onChange={(e) => setForm((f) => ({ ...f, preco: Number(e.target.value) }))}
                />
              </Campo>
              <Campo label="Preço de mercado" ajuda="app.opcaoPrecoAvulso" htmlFor="op-avulso">
                <input
                  id="op-avulso"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={form.precoAvulso || ""}
                  onChange={(e) => setForm((f) => ({ ...f, precoAvulso: Number(e.target.value) }))}
                />
              </Campo>
            </div>

            <Campo label="Como o acesso é entregue" ajuda="app.opcaoEntrega" htmlFor="op-entrega">
              <select
                id="op-entrega"
                className={inputCls}
                value={form.entrega}
                onChange={(e) =>
                  setForm((f) => ({ ...f, entrega: e.target.value as "vaga" | "convite" }))
                }
              >
                <option value="vaga">Login e senha de uma conta matriz (padrão)</option>
                <option value="convite">Convite do provedor no e-mail do cliente</option>
              </select>
            </Campo>

            {criar.isError && (
              <p className="font-sans text-xs text-neon-red">{criar.error?.message}</p>
            )}

            <div className="flex gap-2">
              <NeonButton
                accent="purple"
                className="flex-1"
                disabled={!form.nome || criar.isPending}
                onClick={salvarNovo}
              >
                {criar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Salvar opção
              </NeonButton>
              <button
                type="button"
                onClick={() => setNovo(false)}
                className="rounded-xl border border-white/10 px-4 font-sans text-xs text-white/45 transition-colors hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2 font-sans text-xs text-white/50 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
          >
            <Plus className="size-3.5" />
            Nova opção
          </button>
        )}
      </GlassCard>
    </div>
  );
}
