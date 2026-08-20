import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientesDisponiveis } from "../../queries/alocacoes";

type Cliente = { id: number; nome: string; email: string };

/**
 * Campo de busca de cliente para vincular numa conta matriz.
 * Substitui o <select> gigante: digita nome, e-mail ou #id e a lista filtra no servidor.
 */
export function SeletorCliente({
  contaId,
  valor,
  onEscolher,
  autoFocus = false,
}: {
  contaId: number;
  valor: Cliente | null;
  onEscolher: (cliente: Cliente | null) => void;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  // espera o admin parar de digitar antes de bater no servidor
  useEffect(() => {
    const t = setTimeout(() => setTermo(texto), 250);
    return () => clearTimeout(t);
  }, [texto]);

  const consulta = useClientesDisponiveis(contaId, aberto, termo, 30);
  const itens = useMemo(() => consulta.data?.itens ?? [], [consulta.data]);
  const total = consulta.data?.total ?? 0;
  const escondidos = Math.max(0, total - itens.length);

  useEffect(() => setMarcado(0), [termo]);

  // clique fora fecha a lista
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function escolher(c: Cliente) {
    onEscolher(c);
    setTexto("");
    setTermo("");
    setAberto(false);
  }

  if (valor) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-neon-cyan/40 bg-neon-cyan/[0.06] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[11px] font-bold text-white">{valor.nome}</div>
          <div className="truncate font-mono text-[9px] text-white/40">{valor.email}</div>
        </div>
        <button
          type="button"
          aria-label="Trocar de cliente"
          data-testid={`trocar-cliente-${contaId}`}
          onClick={() => {
            onEscolher(null);
            setAberto(true);
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={caixa} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-neon-cyan/50">
        {consulta.isFetching ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-neon-cyan" />
        ) : (
          <Search className="size-3.5 shrink-0 text-white/30" />
        )}
        <input
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={`lista-clientes-${contaId}`}
          aria-label="Buscar cliente por nome, e-mail ou #id"
          data-testid={`busca-cliente-${contaId}`}
          placeholder="Buscar por nome, e-mail ou #id..."
          value={texto}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAberto(true);
              setMarcado((m) => Math.min(m + 1, Math.max(itens.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMarcado((m) => Math.max(m - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const alvo = itens[marcado];
              if (alvo) escolher(alvo);
            } else if (e.key === "Escape") {
              setAberto(false);
            }
          }}
          className="w-full bg-transparent py-2 font-sans text-xs text-white placeholder:text-white/25 focus:outline-none"
        />
      </div>

      {aberto && (
        <div
          id={`lista-clientes-${contaId}`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#09090b]/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          {itens.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={i === marcado}
              onMouseEnter={() => setMarcado(i)}
              onClick={() => escolher(c)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                i === marcado ? "bg-neon-cyan/10" : "hover:bg-white/[0.04]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[11px] font-bold text-white">
                  {c.nome}
                </div>
                <div className="truncate font-mono text-[9px] text-white/35">{c.email}</div>
              </div>
              <span className="shrink-0 font-mono text-[9px] text-white/20">#{c.id}</span>
            </button>
          ))}

          {!consulta.isLoading && itens.length === 0 && (
            <p className="px-2 py-3 text-center font-sans text-[11px] text-white/30">
              {termo ? `Nenhum cliente para "${termo}".` : "Nenhum cliente livre para esta conta."}
            </p>
          )}

          {consulta.isLoading && itens.length === 0 && (
            <p className="px-2 py-3 text-center font-sans text-[11px] text-white/30">Buscando...</p>
          )}

          {escondidos > 0 && (
            <p className="px-2 py-1.5 font-sans text-[10px] text-white/25">
              +{escondidos} cliente(s) fora da lista — refine a busca.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
