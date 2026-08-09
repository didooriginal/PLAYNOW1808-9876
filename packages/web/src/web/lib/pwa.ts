// PWA — registro do service worker e captura do evento de instalação.
//
// O evento `beforeinstallprompt` dispara UMA vez, normalmente antes de o React
// montar. Guardamos o prompt aqui num singleton para o botão "Instalar App"
// conseguir usá-lo depois.

export type PromptDeInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptGuardado: PromptDeInstalacao | null = null;
const ouvintes = new Set<(p: PromptDeInstalacao | null) => void>();

function emitir() {
  for (const fn of ouvintes) fn(promptGuardado);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptGuardado = e as PromptDeInstalacao;
    emitir();
  });
  window.addEventListener("appinstalled", () => {
    promptGuardado = null;
    emitir();
  });
}

export function getPromptDeInstalacao() {
  return promptGuardado;
}

export function limparPromptDeInstalacao() {
  promptGuardado = null;
  emitir();
}

export function assinarPromptDeInstalacao(fn: (p: PromptDeInstalacao | null) => void) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

/** true quando o site já está rodando como app instalado */
export function estaInstalado() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

export function ehIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* PWA é progressivo: se falhar, o site continua funcionando normalmente */
    });
  });
}
