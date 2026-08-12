import { useEffect, useRef, useState } from "react";
import { Check, CloudUpload, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Ajuda } from "../ui/tooltip";

/**
 * SELO DE SALVAMENTO + BOTÃO CONFIRMAR.
 *
 * O painel salva sozinho (cada campo grava ao sair/Enter), mas o dono da
 * operação pediu confirmação visível: sem um "Salvo" na tela ninguém tem
 * certeza se a alteração pegou, e a dúvida gera retrabalho.
 *
 * Estados:
 *  - "pendente": há mudança não gravada (o Confirmar fica ativo);
 *  - "salvando": requisição em curso;
 *  - "salvo": gravado no banco — é este o selo que o admin quer ver;
 *  - "erro": falhou, com a mensagem do servidor ao lado.
 */

export type EstadoSalvamento = "pendente" | "salvando" | "salvo" | "erro";

const SELOS: Record<EstadoSalvamento, { texto: string; classe: string }> = {
  pendente: {
    texto: "Alterações não confirmadas",
    classe: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  },
  salvando: {
    texto: "Salvando...",
    classe: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  },
  salvo: {
    texto: "Salvo",
    classe: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  },
  erro: {
    texto: "Não salvou",
    classe: "border-neon-red/45 bg-neon-red/10 text-neon-red",
  },
};

export function SeloSalvo({
  estado,
  className,
}: {
  estado: EstadoSalvamento;
  className?: string;
}) {
  const selo = SELOS[estado];
  return (
    <span
      aria-live="polite"
      data-testid={`selo-${estado}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-wider",
        selo.classe,
        className,
      )}
    >
      {estado === "salvando" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : estado === "salvo" ? (
        <Check className="size-3" strokeWidth={3} />
      ) : estado === "erro" ? (
        <TriangleAlert className="size-3" />
      ) : (
        <CloudUpload className="size-3" />
      )}
      {selo.texto}
    </span>
  );
}

/**
 * Barra de rodapé das telas de edição: selo do estado + botão Confirmar.
 * O auto-save continua funcionando; o Confirmar é a garantia manual de que
 * tudo que está na tela foi para o banco.
 */
export function BarraSalvamento({
  estado,
  onConfirmar,
  erro,
  ajuda = "salvamento.confirmar",
  rotulo = "Confirmar",
  className,
}: {
  estado: EstadoSalvamento;
  onConfirmar: () => void;
  erro?: string | null;
  ajuda?: string;
  rotulo?: string;
  className?: string;
}) {
  const bloqueado = estado === "salvando" || estado === "salvo";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SeloSalvo estado={estado} />
        <span className="truncate font-sans text-[11px] text-white/35">
          {estado === "erro" && erro
            ? erro
            : estado === "salvo"
              ? "Tudo gravado no banco."
              : "O painel salva sozinho — o Confirmar grava agora e mostra o selo."}
        </span>
        <Ajuda ajuda={ajuda} lado="top" />
      </div>

      <button
        type="button"
        data-testid="botao-confirmar"
        onClick={onConfirmar}
        disabled={bloqueado}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-sans text-xs font-semibold transition-colors",
          bloqueado
            ? "cursor-not-allowed border-white/8 text-white/25"
            : "border-emerald-400/45 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20",
        )}
      >
        {estado === "salvando" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" strokeWidth={3} />
        )}
        {estado === "salvo" ? "Confirmado" : rotulo}
      </button>
    </div>
  );
}

/**
 * AUTO-SAVE + CONFIRMAR NO MESMO ESTADO.
 *
 * A tela continua gravando sozinha alguns segundos depois da última tecla
 * (`atraso`), e o mesmo hook devolve o `confirmar` para o botão: quem quiser
 * garantia imediata clica, quem só está ajustando não precisa fazer nada.
 *
 * `mudou` é a única fonte de verdade do que está pendente — quando a mutation
 * termina e os dados voltam do servidor, `mudou` vira false e o selo passa
 * sozinho para "Salvo".
 */
export function useAutoSalvar({
  mudou,
  salvar,
  salvando,
  erro,
  atraso = 1500,
}: {
  mudou: boolean;
  salvar: () => void;
  salvando: boolean;
  erro?: string | null;
  atraso?: number;
}): { estado: EstadoSalvamento; confirmar: () => void } {
  /** ref para o timer não reiniciar por causa de uma nova identidade de função */
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpar = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    /** nada pendente, gravação em curso ou erro esperando ação: não agenda */
    if (!mudou || salvando || erro) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      salvarRef.current();
    }, atraso);
    return limpar;
  }, [mudou, salvando, erro, atraso]);

  const estado: EstadoSalvamento = erro
    ? "erro"
    : salvando
      ? "salvando"
      : mudou
        ? "pendente"
        : "salvo";

  return {
    estado,
    confirmar: () => {
      limpar();
      if (!salvando) salvarRef.current();
    },
  };
}

/**
 * SELO PARA GRAVAÇÃO PONTUAL (toggle, remover, criar).
 *
 * Aqui não existe rascunho para confirmar: o clique já grava. O que faltava era
 * o retorno visual — o selo aparece durante a requisição e some alguns segundos
 * depois do "Salvo", senão a tela fica coberta de selos verdes.
 *
 * `sucessos` é um contador que a tela incrementa no onSuccess de cada mutation,
 * assim dois cliques seguidos reacendem o selo em vez de passar batido.
 */
export function useSeloTransitorio({
  salvando,
  erro,
  sucessos,
  duracao = 2600,
}: {
  salvando: boolean;
  erro?: string | null;
  sucessos: number;
  duracao?: number;
}): EstadoSalvamento | null {
  const [recente, setRecente] = useState(false);

  useEffect(() => {
    if (sucessos <= 0) return;
    setRecente(true);
    const t = setTimeout(() => setRecente(false), duracao);
    return () => clearTimeout(t);
  }, [sucessos, duracao]);

  if (erro) return "erro";
  if (salvando) return "salvando";
  return recente ? "salvo" : null;
}
