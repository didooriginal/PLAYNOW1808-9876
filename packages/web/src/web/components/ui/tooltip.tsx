import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { textoDeAjuda } from "@/lib/ajuda-admin";

/**
 * TOOLTIP GLOBAL DO PAINEL
 * ------------------------------------------------------------------
 * Um único componente para toda a ajuda contextual do admin. Decisões:
 *
 *  - renderizado em PORTAL no <body> com `position: fixed`. Os cards do painel
 *    usam `overflow-hidden` + `backdrop-blur`, o que cortaria/embaçaria um
 *    balão posicionado dentro deles;
 *  - abre no hover (mouse), no foco (teclado) e no toque (clique alterna) —
 *    tooltip que só responde a `:hover` é inacessível em tablet;
 *  - fecha com Escape, scroll e clique fora;
 *  - `aria-describedby` liga o balão ao gatilho, então leitor de tela lê a
 *    explicação junto do campo;
 *  - a posição é recalculada quando abre e faz flip automático quando não cabe
 *    acima/à direita, então serve tanto na sidebar quanto no rodapé da tela.
 *
 * Uso preferencial: `<Rotulo ajuda="contas.custoMensal">Custo mensal</Rotulo>`
 * com o texto vindo do dicionário em `lib/ajuda-admin.ts`, para a mesma palavra
 * significar a mesma coisa em todas as telas.
 */

type Lado = "top" | "bottom" | "left" | "right";

const ESPACO = 10; // distância entre gatilho e balão
const MARGEM = 12; // respiro mínimo da borda da viewport
const LARGURA = 268;

function calcular(alvo: DOMRect, balao: DOMRect, preferido: Lado) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const cabe: Record<Lado, boolean> = {
    top: alvo.top - balao.height - ESPACO > MARGEM,
    bottom: alvo.bottom + balao.height + ESPACO < vh - MARGEM,
    left: alvo.left - balao.width - ESPACO > MARGEM,
    right: alvo.right + balao.width + ESPACO < vw - MARGEM,
  };

  /** ordem de tentativa: preferido → oposto → eixo alternativo */
  const oposto: Record<Lado, Lado> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const lado =
    ([preferido, oposto[preferido], "bottom", "top", "right", "left"] as Lado[]).find(
      (l) => cabe[l],
    ) ?? preferido;

  let left = 0;
  let top = 0;

  if (lado === "top" || lado === "bottom") {
    left = alvo.left + alvo.width / 2 - balao.width / 2;
    top = lado === "top" ? alvo.top - balao.height - ESPACO : alvo.bottom + ESPACO;
  } else {
    left = lado === "left" ? alvo.left - balao.width - ESPACO : alvo.right + ESPACO;
    top = alvo.top + alvo.height / 2 - balao.height / 2;
  }

  return {
    lado,
    left: Math.min(Math.max(MARGEM, left), Math.max(MARGEM, vw - balao.width - MARGEM)),
    top: Math.min(Math.max(MARGEM, top), Math.max(MARGEM, vh - balao.height - MARGEM)),
  };
}

/* ------------------------------------------------------------------ */

export function Tooltip({
  texto,
  titulo,
  children,
  lado = "top",
  className,
}: {
  /** texto pronto ou chave do dicionário de ajuda */
  texto: ReactNode;
  titulo?: string;
  children: ReactNode;
  lado?: Lado;
  className?: string;
}) {
  const id = useId();
  /* aceita chave do dicionário ("gift.copiar") ou o texto pronto */
  const conteudo = typeof texto === "string" ? (textoDeAjuda(texto) ?? texto) : texto;
  const gatilho = useRef<HTMLSpanElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ lado: Lado; left: number; top: number } | null>(null);

  const reposicionar = useCallback(() => {
    if (!gatilho.current || !balao.current) return;
    setPos(
      calcular(
        gatilho.current.getBoundingClientRect(),
        balao.current.getBoundingClientRect(),
        lado,
      ),
    );
  }, [lado]);

  useLayoutEffect(() => {
    if (aberto) reposicionar();
  }, [aberto, reposicionar]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    /** toque fora fecha o balão aberto por toque */
    const foraDoGatilho = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!gatilho.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", foraDoGatilho);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", reposicionar);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", foraDoGatilho);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto, reposicionar]);

  return (
    <>
      <span
        ref={gatilho}
        className={cn("inline-flex", className)}
        aria-describedby={aberto ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setAberto(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setAberto(false);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onPointerDown={(e) => {
          /* toque/caneta: abre sem sequestrar o clique — o gatilho pode ser um
             botão de ação (copiar, remover) envolvido pelo tooltip. */
          if (e.pointerType !== "mouse") setAberto(true);
        }}
      >
        {children}
      </span>

      {aberto &&
        createPortal(
          <div
            ref={balao}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              width: LARGURA,
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              opacity: pos ? 1 : 0,
            }}
            className="pointer-events-none z-[120] rounded-2xl border border-white/12 bg-[#0b0c12]/95 p-3 shadow-[0_28px_70px_-24px_rgba(0,0,0,1)] backdrop-blur-xl transition-opacity duration-150"
          >
            {titulo && (
              <div className="mb-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-neon-cyan">
                {titulo}
              </div>
            )}
            <div className="font-sans text-[12px] leading-relaxed text-white/75">{conteudo}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * ÍCONE DE AJUDA — o "i" que acompanha todo label do painel.
 * `ajuda` aceita a chave do dicionário ("contas.custoMensal") ou o texto cru.
 */
export function Ajuda({
  ajuda,
  titulo,
  lado = "top",
  icone = "i",
  className,
}: {
  ajuda: string;
  titulo?: string;
  lado?: Lado;
  icone?: "i" | "?";
  className?: string;
}) {
  const texto = textoDeAjuda(ajuda);
  if (!texto) return null;

  return (
    <Tooltip texto={texto} titulo={titulo} lado={lado}>
      <button
        type="button"
        aria-label={`Ajuda: ${texto}`}
        tabIndex={0}
        className={cn(
          "inline-flex size-[15px] shrink-0 cursor-help items-center justify-center rounded-full border border-white/20 bg-white/[0.06] font-display text-[10px] font-bold leading-none text-white/45 transition-colors hover:border-neon-cyan/60 hover:bg-neon-cyan/15 hover:text-neon-cyan focus:outline-none focus-visible:border-neon-cyan focus-visible:text-neon-cyan",
          className,
        )}
      >
        {icone}
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */

/**
 * RÓTULO DE CAMPO — label padrão do painel, já com o ícone de ajuda.
 * Serve para input, select, textarea e switch: passe `htmlFor` quando o campo
 * tiver `id` para o clique no texto focar o campo.
 */
export function Rotulo({
  children,
  ajuda,
  htmlFor,
  sufixo,
  obrigatorio,
  lado,
  className,
}: {
  children: ReactNode;
  ajuda?: string;
  htmlFor?: string;
  /** conteúdo alinhado à direita, ex.: unidade ou contador */
  sufixo?: ReactNode;
  obrigatorio?: boolean;
  lado?: Lado;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45"
      >
        {children}
        {obrigatorio && <span className="ml-0.5 text-neon-red">*</span>}
      </label>
      {ajuda && <Ajuda ajuda={ajuda} lado={lado} />}
      {sufixo && <span className="ml-auto font-sans text-[10px] text-white/30">{sufixo}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * CAMPO — rótulo + ajuda + controle empilhados. Evita repetir o mesmo
 * `<div className="grid gap-1.5">` em todo formulário do painel.
 */
export function Campo({
  label,
  ajuda,
  htmlFor,
  sufixo,
  obrigatorio,
  dica,
  children,
  className,
}: {
  label: ReactNode;
  ajuda?: string;
  htmlFor?: string;
  sufixo?: ReactNode;
  obrigatorio?: boolean;
  /** texto auxiliar sempre visível, abaixo do controle */
  dica?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Rotulo ajuda={ajuda} htmlFor={htmlFor} sufixo={sufixo} obrigatorio={obrigatorio}>
        {label}
      </Rotulo>
      {children}
      {dica && <p className="font-sans text-[10px] leading-snug text-white/30">{dica}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * TÍTULO DE SEÇÃO com ajuda — cabeçalho dos blocos de configuração.
 */
export function TituloSecao({
  children,
  ajuda,
  icone,
  acao,
  className,
}: {
  children: ReactNode;
  ajuda?: string;
  icone?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icone}
      <span className="font-display text-sm font-bold text-white">{children}</span>
      {ajuda && <Ajuda ajuda={ajuda} lado="bottom" />}
      {acao && <span className="ml-auto">{acao}</span>}
    </div>
  );
}
