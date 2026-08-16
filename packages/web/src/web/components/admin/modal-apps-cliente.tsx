import { useState } from "react";
import { Loader2, Plus, Trash2, Unplug, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, type ServiceId } from "@/lib/mock-data";
import { AppIcon } from "../app-icon";
import { Ajuda, Campo, Tooltip } from "../ui/tooltip";
import { useAplicativos } from "../../queries/aplicativos";
import {
  useAdicionarAppAoCliente,
  useAppsDoCliente,
  useLiberarVaga,
  useRemoverAppDoCliente,
} from "../../queries/alocacoes";
import { useValorAutomatico } from "../../queries/usuarios";

/**
 * APPS DESTE CLIENTE
 * ------------------------------------------------------------------
 * Um popup só para responder a pergunta que o admin mais faz: "o que esse
 * cliente tem contratado e em qual conta matriz ele está?".
 *
 * Junta as três verdades que antes viviam em telas separadas — o direito
 * (assinatura/pacote), a vaga (alocação + matriz) e a espera (fila) — e deixa
 * agir dali mesmo: adicionar app (grava o direito E ocupa vaga real),
 * remover app (devolve a vaga ao estoque) e liberar só a vaga (mantém o
 * direito, útil quando a matriz vai ser trocada).
 *
 * O e-mail da matriz vem mascarado do servidor: o admin identifica a conta
 * sem a senha/e-mail completo aparecerem numa tela que costuma ficar aberta.
 */

const ROTULO_ORIGEM: Record<string, string> = {
  pacote: "Pacote",
  combo: "Combo",
  avulso: "Avulso",
  premio: "Prêmio",
};

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  ativo: {
    texto: "Ativo",
    classe: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  },
  aguardando: {
    texto: "Aguardando vaga",
    classe: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  },
  sem_vaga: {
    texto: "Sem vaga",
    classe: "border-neon-red/40 bg-neon-red/10 text-neon-red",
  },
  aguardando_pagamento: {
    texto: "Aguardando pagamento",
    classe: "border-neon-purple/40 bg-neon-purple/10 text-neon-purple",
  },
};

function dataCurta(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  const iso = typeof valor === "string" ? valor : valor.toISOString();
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return "—";
  return `${d}/${m}/${a}`;
}

export function ModalAppsCliente({
  cliente,
  onClose,
}: {
  cliente: { id: number; nome: string };
  onClose: () => void;
}) {
  const { data, isLoading } = useAppsDoCliente(cliente.id);
  const { data: catalogo } = useAplicativos();
  const adicionar = useAdicionarAppAoCliente();
  const remover = useRemoverAppDoCliente();
  const liberar = useLiberarVaga();
  const automatico = useValorAutomatico();
  const [abrindoAdicionar, setAbrindoAdicionar] = useState(false);

  /* app escolhido para adicionar: o admin decide AQUI se libera na hora ou só
     depois do pagamento, e confere quanto vai ser cobrado. */
  const [escolhido, setEscolhido] = useState<{
    slug: string;
    nome: string;
    preco: number;
  } | null>(null);
  const [liberacao, setLiberacao] = useState<"imediata" | "apos_pagamento">("apos_pagamento");
  const [cobrarPrimeiroMes, setCobrarPrimeiroMes] = useState(true);
  const [valorApp, setValorApp] = useState("");

  const precoDigitado = Number(valorApp.replace(",", ".")) || 0;
  const mensalidade = data?.mensalidade ?? 0;
  const novaMensalidade = escolhido ? mensalidade + precoDigitado : mensalidade;

  const itens = data?.itens ?? [];
  const jaTem = new Set(itens.map((i) => i.servico));
  const disponiveis = (catalogo ?? []).filter((a) => a.ativo && !jaTem.has(a.slug));
  const erro = adicionar.error?.message ?? remover.error?.message ?? liberar.error?.message;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b0f] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.22em] text-white/35">
              Apps deste cliente
              <Ajuda ajuda="cliente.apps" />
            </div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-white">
              {cliente.nome}
            </h3>
            <p className="mt-1 font-sans text-xs text-white/40">
              Direito contratado, conta matriz onde está alocado e vencimento de cada app.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid max-h-[52vh] gap-2 overflow-y-auto pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-neon-cyan" />
            </div>
          )}

          {!isLoading && itens.length === 0 && (
            <p className="py-8 text-center font-sans text-sm text-white/30">
              Este cliente ainda não tem nenhum app contratado.
            </p>
          )}

          {itens.map((item) => {
            const badge = ROTULO_STATUS[item.status] ?? ROTULO_STATUS.sem_vaga;
            const ocupado =
              (remover.isPending && remover.variables?.servico === item.servico) ||
              (liberar.isPending && liberar.variables?.id === item.alocacaoId);

            return (
              <div
                key={item.servico}
                data-testid={`app-cliente-${item.servico}`}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-3">
                  <AppIcon id={item.servico as ServiceId} size="sm" active />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold capitalize text-white">
                        {item.servico}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-sans text-[10px] text-white/45">
                        {ROTULO_ORIGEM[item.origem] ?? item.origem}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-sans text-[10px]",
                          badge.classe,
                        )}
                      >
                        {badge.texto}
                      </span>
                    </div>
                    <div className="mt-1 font-sans text-[11px] text-white/40">
                      {item.conta
                        ? `Matriz #${item.conta.id} · ${item.conta.rotulo} · ${item.conta.email}`
                        : "Nenhuma conta matriz alocada"}
                    </div>
                    <div className="mt-0.5 font-sans text-[11px] text-white/30">
                      Desde {dataCurta(item.desde)} · Vence{" "}
                      {dataCurta(item.proximaCobranca)}
                      {item.valor > 0 ? ` · ${brl(item.valor)}` : ""}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.alocacaoId && (
                      <Tooltip texto="cliente.removerApp" titulo="Liberar só a vaga" lado="left">
                        <button
                          type="button"
                          aria-label={`Liberar a vaga de ${item.servico} de ${cliente.nome}`}
                          disabled={ocupado}
                          onClick={() => {
                            if (
                              confirm(
                                `Liberar a vaga de ${item.servico}? O cliente continua com o direito e pode ser realocado em outra matriz.`,
                              )
                            ) {
                              liberar.mutate({ id: item.alocacaoId!, motivo: "manual" });
                            }
                          }}
                          className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan disabled:opacity-40"
                        >
                          <Unplug className="size-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip texto="cliente.removerApp" titulo="Remover app do cliente" lado="left">
                      <button
                        type="button"
                        aria-label={`Remover ${item.servico} de ${cliente.nome}`}
                        disabled={ocupado}
                        onClick={() => {
                          if (
                            confirm(
                              `Remover ${item.servico} de ${cliente.nome}? A vaga volta para o estoque e pode ser dada a quem está na fila.`,
                            )
                          ) {
                            remover.mutate({ clienteId: cliente.id, servico: item.servico });
                          }
                        }}
                        className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-red/50 hover:text-neon-red disabled:opacity-40"
                      >
                        {ocupado ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
              Adicionar app
              <Ajuda ajuda="cliente.adicionarApp" />
            </div>
            <button
              type="button"
              aria-label={
                abrindoAdicionar ? "Fechar lista de apps" : "Abrir lista de apps para adicionar"
              }
              onClick={() => setAbrindoAdicionar((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-sans text-[11px] text-white/60 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
            >
              <Plus className="size-3.5" />
              {abrindoAdicionar ? "Fechar" : "Escolher app"}
            </button>
          </div>

          {abrindoAdicionar && !escolhido && (
            <div className="mt-3 grid max-h-[26vh] gap-2 overflow-y-auto pr-1">
              {disponiveis.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    setEscolhido({ slug: app.slug, nome: app.nome, preco: app.preco ?? 0 });
                    setValorApp(String(app.preco ?? 0));
                    setLiberacao("apos_pagamento");
                    setCobrarPrimeiroMes(true);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition-all hover:border-neon-cyan/50 hover:bg-white/[0.06]"
                >
                  <AppIcon id={app.slug as ServiceId} size="sm" active />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-bold text-white">{app.nome}</div>
                    <div className="font-sans text-[10px] text-white/30">
                      Avulso · {brl(app.preco ?? 0)}/mês · ocupa uma vaga real
                    </div>
                  </div>
                  <Plus className="size-4 text-white/20" />
                </button>
              ))}
              {disponiveis.length === 0 && (
                <p className="py-6 text-center font-sans text-sm text-white/30">
                  O cliente já tem todos os apps do catálogo.
                </p>
              )}
            </div>
          )}

          {/* CONFIRMAÇÃO DA COBRANÇA — adicionar app mexe no bolso do cliente,
              então nada é gravado antes do admin ver o valor e escolher se o
              acesso sai agora ou só depois que o pagamento cair. */}
          {escolhido && (
            <div
              data-testid="cobranca-app-novo"
              className="mt-3 rounded-2xl border border-neon-cyan/25 bg-neon-cyan/[0.04] p-4"
            >
              <div className="flex items-center gap-3">
                <AppIcon id={escolhido.slug as ServiceId} size="sm" active />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-white">
                    {escolhido.nome}
                  </div>
                  <div className="font-sans text-[10px] text-white/35">
                    Avulso · entra na mensalidade a partir do mês que vem
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Escolher outro app"
                  onClick={() => setEscolhido(null)}
                  className="rounded-lg border border-white/10 px-2.5 py-1 font-sans text-[10px] text-white/50 hover:text-white"
                >
                  Trocar
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Campo label="Valor mensal do app" ajuda="cliente.valorApp">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={valorApp}
                    onChange={(e) => setValorApp(e.target.value)}
                    aria-label="Valor mensal do app"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-sm text-white focus:border-neon-cyan/50 focus:outline-none"
                  />
                </Campo>

                <Campo label="Liberação do acesso" ajuda="cliente.liberacaoApp">
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["imediata", "Liberar agora"],
                        ["apos_pagamento", "Após o pagamento"],
                      ] as const
                    ).map(([valor, texto]) => (
                      <button
                        key={valor}
                        type="button"
                        aria-pressed={liberacao === valor}
                        onClick={() => setLiberacao(valor)}
                        className={cn(
                          "rounded-xl border px-2 py-2 font-sans text-[11px] transition-colors",
                          liberacao === valor
                            ? "border-neon-cyan/50 bg-neon-cyan/12 text-neon-cyan"
                            : "border-white/10 text-white/50 hover:text-white",
                        )}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                </Campo>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 font-sans text-[11px] text-white/60">
                <input
                  type="checkbox"
                  checked={cobrarPrimeiroMes}
                  onChange={(e) => setCobrarPrimeiroMes(e.target.checked)}
                  aria-label="Cobrar o primeiro mês agora"
                  className="size-3.5 accent-[#22d3ee]"
                />
                Cobrar 1 mês cheio agora ({brl(precoDigitado)}) na fatura em aberto
                <Ajuda ajuda="cliente.primeiroMesApp" />
              </label>

              <div className="mt-3 rounded-xl border border-white/8 bg-black/30 p-3 font-sans text-[11px] text-white/55">
                Mensalidade: <span className="text-white/80">{brl(mensalidade)}</span> →{" "}
                <span className="font-bold text-neon-cyan">{brl(novaMensalidade)}</span>
                {data?.mensalidadeManual && (
                  <span className="ml-1 text-amber-300">
                    · valor travado à mão, o automático não vai alterar
                  </span>
                )}
                <div className="mt-1 text-white/35">
                  {liberacao === "imediata"
                    ? "O acesso sai na hora e a cobrança vai na fatura."
                    : "O app fica preso como “aguardando pagamento” e é liberado sozinho quando a fatura for paga."}
                </div>
              </div>

              <button
                type="button"
                disabled={adicionar.isPending}
                onClick={() =>
                  adicionar.mutate(
                    {
                      clienteId: cliente.id,
                      servico: escolhido.slug,
                      origem: "avulso",
                      ciclo: "mensal",
                      valor: precoDigitado,
                      liberacao,
                      cobrarPrimeiroMes,
                    },
                    {
                      onSuccess: () => {
                        setEscolhido(null);
                        setAbrindoAdicionar(false);
                      },
                    },
                  )
                }
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 py-2.5 font-sans text-xs font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/20 disabled:opacity-40"
              >
                {adicionar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Adicionar e cobrar
              </button>
            </div>
          )}
        </div>

        {/* mensalidade travada à mão: dá o caminho de volta para o automático */}
        {data?.mensalidadeManual && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 font-sans text-[11px] text-amber-300">
            <span className="flex items-center gap-1.5">
              Mensalidade travada à mão em {brl(mensalidade)} — adicionar ou remover app não
              muda esse valor.
              <Ajuda ajuda="cliente.valorManual" />
            </span>
            <button
              type="button"
              disabled={automatico.isPending}
              aria-label={`Voltar a mensalidade de ${cliente.nome} para o cálculo automático`}
              onClick={() => automatico.mutate({ id: cliente.id })}
              className="rounded-lg border border-amber-400/40 px-2.5 py-1 font-sans text-[10px] font-bold text-amber-200 hover:bg-amber-400/10 disabled:opacity-40"
            >
              {automatico.isPending ? "Recalculando…" : "Voltar ao automático"}
            </button>
          </div>
        )}

        {data && data.totalExtras > 0 && (
          <div className="mt-3 rounded-xl border border-neon-purple/25 bg-neon-purple/5 p-3 font-sans text-[11px] text-neon-purple">
            Adicionais aguardando pagamento: {brl(data.totalExtras)} —{" "}
            {data.extras.map((e) => e.descricao).join(" · ")}. Já estão somados na fatura em
            aberto.
          </div>
        )}

        {adicionar.data?.aguardandoPagamento && (
          <div className="mt-4 rounded-xl border border-neon-purple/25 bg-neon-purple/5 p-3 font-sans text-[11px] text-neon-purple">
            {adicionar.data.servico} entrou como “aguardando pagamento”
            {adicionar.data.cobrado > 0 ? ` e ${brl(adicionar.data.cobrado)} foram somados à fatura em aberto` : ""}
            . O acesso é liberado sozinho assim que o pagamento for confirmado.
          </div>
        )}

        {adicionar.data?.aguardando && (
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 font-sans text-[11px] text-amber-300">
            Sem vaga livre para {adicionar.data.servico}. O cliente entrou na fila de espera e o
            ADM foi avisado — assim que uma vaga abrir, ele é alocado automaticamente.
          </div>
        )}

        {erro && (
          <div className="mt-4 rounded-xl border border-neon-red/20 bg-neon-red/5 p-3 font-sans text-[11px] text-neon-red">
            {erro}
          </div>
        )}
      </div>
    </div>
  );
}
