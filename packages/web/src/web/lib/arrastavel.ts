import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BOTÃO FLUTUANTE ARRASTÁVEL.
 * Deixa a tag do Copiloto/Assistente ser movida pela tela com mouse ou dedo.
 * A posição escolhida fica salva no localStorage, então o admin encontra o
 * botão no mesmo lugar na próxima visita. Enquanto ninguém arrastar, o botão
 * usa a posição padrão das classes do Tailwind (`pos === null`).
 *
 * Clique e arraste convivem: só viramos "arrasto" depois de 4px de movimento,
 * abaixo disso o onClick normal do botão dispara.
 */

type Pos = { x: number; y: number };

const MARGEM = 8;
const LIMIAR = 4;

function prender(p: Pos, el: HTMLElement | null): Pos {
  const l = el?.offsetWidth ?? 160;
  const a = el?.offsetHeight ?? 52;
  return {
    x: Math.min(Math.max(p.x, MARGEM), Math.max(MARGEM, window.innerWidth - l - MARGEM)),
    y: Math.min(Math.max(p.y, MARGEM), Math.max(MARGEM, window.innerHeight - a - MARGEM)),
  };
}

export function useArrastavel(chave: string) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const gesto = useRef({ ativo: false, moveu: false, px: 0, py: 0, ox: 0, oy: 0 });

  // posição salva da sessão anterior
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chave);
      if (!raw) return;
      const p = JSON.parse(raw) as Pos;
      if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
    } catch {
      /* localStorage indisponível — segue com a posição padrão */
    }
  }, [chave]);

  // tela redimensionou: traz o botão de volta pra área visível
  useEffect(() => {
    function onResize() {
      setPos((atual) => (atual ? prender(atual, ref.current) : atual));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    const r = el.getBoundingClientRect();
    gesto.current = { ativo: true, moveu: false, px: e.clientX, py: e.clientY, ox: r.left, oy: r.top };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesto.current;
    if (!g.ativo) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (!g.moveu && Math.abs(dx) < LIMIAR && Math.abs(dy) < LIMIAR) return;
    if (!g.moveu) {
      g.moveu = true;
      setArrastando(true);
    }
    setPos(prender({ x: g.ox + dx, y: g.oy + dy }, ref.current));
  }, []);

  const finalizar = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const g = gesto.current;
      if (!g.ativo) return;
      g.ativo = false;
      ref.current?.releasePointerCapture?.(e.pointerId);
      if (!g.moveu) return;
      setArrastando(false);
      setPos((atual) => {
        if (atual) {
          try {
            localStorage.setItem(chave, JSON.stringify(atual));
          } catch {
            /* sem persistência: a posição vale só nesta sessão */
          }
        }
        return atual;
      });
    },
    [chave],
  );

  // o clique que abre o painel só vale se o gesto não virou arrasto
  const onClickCapture = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (gesto.current.moveu) {
      e.preventDefault();
      e.stopPropagation();
      gesto.current.moveu = false;
    }
  }, []);

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : {};

  return {
    /** aplique no elemento arrastável */
    props: {
      ref,
      onPointerDown,
      onPointerMove,
      onPointerUp: finalizar,
      onPointerCancel: finalizar,
      onClickCapture,
    },
    /** posição livre (sobrescreve as classes de canto) */
    style,
    arrastando,
    /** volta pro canto padrão */
    resetar: useCallback(() => {
      setPos(null);
      try {
        localStorage.removeItem(chave);
      } catch {
        /* nada a limpar */
      }
    }, [chave]),
  };
}
