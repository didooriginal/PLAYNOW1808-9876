import { Suspense, lazy, useEffect, useState } from "react";

/**
 * CARGA TARDIA DO ROBÔ DA VITRINE.
 *
 * O atendimento usa o SDK de IA (`ai` + `@ai-sdk/react`), que é o pedaço mais
 * pesado da landing. Ele não precisa estar pronto no primeiro frame: só existe
 * como botão flutuante. Então o chunk desce quando o navegador está ocioso —
 * ou imediatamente, se alguma seção disparar `ppn:vitrine` antes disso.
 */
const Assistente = lazy(() =>
  import("./assistente-visitante").then((m) => ({ default: m.AssistenteVisitante })),
);

export function AssistenteVisitanteLazy() {
  const [carregar, setCarregar] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const agendar = () => {
      if (!cancelado) setCarregar(true);
    };

    // pedido explícito chegou antes do chunk: carrega na hora e repassa o
    // evento depois que o componente real já está montado e escutando
    function aoPedir(e: Event) {
      window.removeEventListener("ppn:vitrine", aoPedir);
      const detail = (e as CustomEvent<{ pergunta?: string }>).detail;
      setCarregar(true);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ppn:vitrine", { detail }));
      }, 450);
    }
    window.addEventListener("ppn:vitrine", aoPedir);

    const idle = window.requestIdleCallback?.(agendar);
    const timer = window.setTimeout(agendar, 2_500);

    return () => {
      cancelado = true;
      window.removeEventListener("ppn:vitrine", aoPedir);
      window.clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
    };
  }, []);

  if (!carregar) return null;

  return (
    <Suspense fallback={null}>
      <Assistente />
    </Suspense>
  );
}

export default AssistenteVisitanteLazy;
