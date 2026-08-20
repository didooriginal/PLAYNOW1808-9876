import { lazy, Suspense, useEffect, useState } from "react";
import { SiteHeader } from "../components/site-header";
import { Hero } from "../components/landing/hero";
import { AssistenteVisitanteLazy } from "../components/landing/assistente-visitante-lazy";
import { WhatsappFlutuante } from "../components/landing/whatsapp-flutuante";
import { NeonBackdrop } from "../components/ui/kit";

/**
 * Performance: so o Hero entra no bundle inicial. Todo o resto da landing
 * (e o rodape) vive em um chunk separado que comeca a baixar depois que o
 * navegador fica ocioso ou no primeiro sinal de interacao/scroll.
 * Os dois lazy apontam para o mesmo arquivo, entao e um unico download.
 */
const AbaixoDaDobra = lazy(() => import("../components/landing/abaixo-da-dobra"));
const Rodape = lazy(() =>
  import("../components/landing/abaixo-da-dobra").then((m) => ({ default: m.Rodape })),
);

function useCarregarResto() {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (pronto) return;

    let cancelado = false;
    const liberar = () => {
      if (!cancelado) setPronto(true);
    };

    // qualquer sinal de que o usuario quer ver mais adiante
    const eventos = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
    for (const ev of eventos) {
      window.addEventListener(ev, liberar, { once: true, passive: true });
    }

    // ou simplesmente quando o navegador ficar ocioso
    const idle = window.requestIdleCallback;
    const id = idle
      ? idle(liberar, { timeout: 2000 })
      : window.setTimeout(liberar, 600);

    return () => {
      cancelado = true;
      for (const ev of eventos) window.removeEventListener(ev, liberar);
      if (idle && window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, [pronto]);

  return pronto;
}

function Index() {
  const mostrarResto = useCarregarResto();

  return (
    <div className="relative min-h-screen">
      <NeonBackdrop />
      <SiteHeader />
      <main className="pb-24 lg:pb-0">
        <Hero />
        {mostrarResto ? (
          <Suspense fallback={<div className="min-h-[60vh]" />}>
            <AbaixoDaDobra />
          </Suspense>
        ) : (
          <div className="min-h-[60vh]" />
        )}
      </main>
      {mostrarResto ? (
        <Suspense fallback={null}>
          <Rodape />
        </Suspense>
      ) : null}

      {/* flutuantes arrastaveis: robo de pre-venda + tag do WhatsApp */}
      <AssistenteVisitanteLazy />
      <WhatsappFlutuante />
    </div>
  );
}

export default Index;
