/* PLAYPLUSNOW — service worker mínimo do PWA.
   Estratégia: network-first com fallback de cache. Nunca cacheia API, auth
   nem arquivos internos do dev server (Vite/HMR). */

const CACHE = "ppn-v2";
const SHELL = ["/", "/dashboard", "/manifest.webmanifest", "/images/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function bypass(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.includes("hot-update") ||
    url.pathname === "/runable.js"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (bypass(url)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await caches.match("/dashboard");
          if (shell) return shell;
        }
        return new Response("Sem conexão", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});

/* ------------------------------------------------------------------ */
/* PUSH WEB                                                            */
/* ------------------------------------------------------------------ */

/* O servidor manda um JSON { titulo, corpo, url, tag }. Se vier vazio ou
   quebrado, mostra um aviso genérico — notificação nunca pode falhar calada. */
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }

  const titulo = dados.titulo || "PLAYPLUSNOW";
  const opcoes = {
    body: dados.corpo || "Você tem um aviso novo.",
    icon: "/images/icon-192.png",
    badge: "/images/icon-192.png",
    tag: dados.tag || "playplusnow",
    renotify: true,
    data: { url: dados.url || "/dashboard" },
  };

  /* Botão "Copiar código". O service worker NÃO tem acesso à área de
     transferência, então a ação não copia nada aqui: ela abre o painel com
     `copiar=1` e a página faz a cópia ao montar. Um toque, mesmo resultado.
     No iPhone o Safari ignora `actions` — o toque normal abre o app igual. */
  if (dados.acao === "copiar") {
    opcoes.actions = [{ action: "copiar", title: "Copiar código" }];
  }

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

/* Clique: se já existe uma aba do app aberta, foca e navega nela em vez de
   abrir uma nova. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let destino = (event.notification.data && event.notification.data.url) || "/dashboard";

  /* A ação "copiar" leva o mesmo destino com um sinalizador: quem copia é a
     página, assim que montar. */
  if (event.action === "copiar") {
    destino += (destino.includes("?") ? "&" : "?") + "copiar=1";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if (new URL(aba.url).origin === self.location.origin && "focus" in aba) {
          aba.navigate(destino).catch(() => undefined);
          return aba.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
