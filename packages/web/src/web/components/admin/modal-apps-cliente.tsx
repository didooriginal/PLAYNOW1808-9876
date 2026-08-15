import { useState } from "react";
import { Loader2, Plus, Trash2, Unplug, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, type ServiceId } from "@/lib/mock-data";
import { AppIcon } from "../app-icon";
import { Ajuda, Tooltip } from "../ui/tooltip";
import { useAplicativos } from "../../queries/aplicativos";
import {
  useAdicionarAppAoCliente,
  useAppsDoCliente,
  useLiberarVaga,
  useRemoverAppDoCliente,
} from "../../queries/alocacoes";

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
  const [abrindoAdicionar, setAbrindoAdicionar] = useState(false);

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

          {abrindoAdicionar && (
            <div className="mt-3 grid max-h-[26vh] gap-2 overflow-y-auto pr-1">
              {disponiveis.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  disabled={adicionar.isPending}
                  onClick={() =>
                    adicionar.mutate(
                      {
                        clienteId: cliente.id,
                        servico: app.slug,
                        origem: "avulso",
                        ciclo: "mensal",
                        valor: app.preco ?? 0,
                      },
                      { onSuccess: () => setAbrindoAdicionar(false) },
                    )
                  }
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition-all hover:border-neon-cyan/50 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  <AppIcon id={app.slug as ServiceId} size="sm" active />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-bold text-white">{app.nome}</div>
                    <div className="font-sans text-[10px] text-white/30">
                      Avulso · {brl(app.preco ?? 0)}/mês · ocupa uma vaga real
                    </div>
                  </div>
                  {adicionar.isPending && adicionar.variables?.servico === app.slug ? (
                    <Loader2 className="size-4 animate-spin text-neon-cyan" />
                  ) : (
                    <Plus className="size-4 text-white/20" />
                  )}
                </button>
              ))}
              {disponiveis.length === 0 && (
                <p className="py-6 text-center font-sans text-sm text-white/30">
                  O cliente já tem todos os apps do catálogo.
                </p>
              )}
            </div>
          )}
        </div>

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
