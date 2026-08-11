// TAG FLUTUANTE DO WHATSAPP — landing page.
//
// Fica visível durante toda a rolagem (o botão do rodapé só aparece no fim da
// página). É ARRASTÁVEL com mouse ou dedo, porque em celular pequeno ele pode
// tampar um card de pacote: o visitante puxa para onde quiser e a posição fica
// salva no navegador dele. Duplo clique devolve ao canto padrão.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/mock-data";
import { useArrastavel } from "../../lib/arrastavel";

const MENSAGEM = "Olá! Vi o site da PLAYPLUSNOW e quero assinar um combo de streamings.";

export function WhatsappFlutuante() {
  const arrasto = useArrastavel("ppn:whatsapp:pos");
  const [visivel, setVisivel] = useState(false);

  // aparece depois do primeiro scroll pra não competir com o hero
  useEffect(() => {
    function onScroll() {
      setVisivel(window.scrollY > 240);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      {...arrasto.props}
      onClick={() => window.open(whatsappLink(MENSAGEM), "_blank", "noopener,noreferrer")}
      onDoubleClick={arrasto.resetar}
      data-testid="whatsapp-flutuante"
      aria-label="Falar no WhatsApp (arraste para mover)"
      className={cn(
        "fixed bottom-44 right-4 z-[69] flex touch-none select-none items-center gap-2 rounded-full border border-emerald-400/45 bg-black/70 p-2.5 backdrop-blur-xl sm:bottom-36 sm:right-6 sm:py-3 sm:pl-3 sm:pr-4",
        visivel ? "opacity-100" : "pointer-events-none opacity-0",
        arrasto.arrastando
          ? "scale-105 cursor-grabbing border-emerald-400"
          : "cursor-grab transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400",
      )}
      style={{ boxShadow: "0 18px 50px -18px rgba(52,211,153,0.8)", ...arrasto.style }}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-emerald-400/15">
        {/* glifo oficial do WhatsApp — lucide não tem a marca */}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-emerald-400">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13c-1.5 0-2.98-.4-4.27-1.17l-.31-.18-3.17.83.85-3.09-.2-.32a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.11 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01a.93.93 0 0 0-.67.31c-.23.25-.87.85-.87 2.08s.89 2.41 1.02 2.58c.12.16 1.75 2.79 4.25 3.81.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.5-.61 1.71-1.21.21-.6.21-1.11.15-1.21-.06-.11-.23-.17-.48-.29Z" />
        </svg>
      </span>
      {/* no celular fica só o ícone: o rótulo tampava o card dos pacotes */}
      <span className="hidden font-display text-xs font-bold uppercase tracking-wide text-white sm:inline">
        WhatsApp
      </span>
    </button>
  );
}
