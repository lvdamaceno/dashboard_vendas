// Service worker do painel instalado como app (PWA).
// Sem internet, mostra a última versão do painel que abriu com sucesso (com o aviso
// "Sem internet" e a hora dos dados). Ao sair ou perder a sessão, essa cópia é apagada.
const CACHE = "dv-v3"; // página offline e ícones
const STATIC = "dv-static"; // JS/CSS do Next (nomes com hash, não mudam)
const DATA = "dv-dados"; // última versão do painel
const OFFLINE = "/offline.html";
const DASHBOARD = "/dashboard";
const MAX_STATIC = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = [CACHE, STATIC, DATA];
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// A página de login pede para apagar a cópia (logout / sessão expirada)
self.addEventListener("message", (event) => {
  if (event.data === "limpar-dados") event.waitUntil(caches.delete(DATA));
});

async function trimStatic(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC)).map((k) => cache.delete(k)));
}

async function staticAsset(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trimStatic(cache);
  }
  return res;
}

// Só guarda o painel que carregou os dados (a página marca com data-offline-ok);
// telas de erro ou de sessão expirada não substituem a última cópia boa
async function save(res) {
  const html = await res.text();
  if (!html.includes("data-offline-ok")) return;
  const cache = await caches.open(DATA);
  await cache.put(DASHBOARD, new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
}

async function dashboard(event) {
  try {
    const res = await fetch(event.request);
    // Redirecionou (sem sessão → login): apaga a cópia antiga
    if (res.redirected) await caches.delete(DATA);
    else if (res.ok) event.waitUntil(save(res.clone()).catch(() => undefined));
    return res;
  } catch {
    const saved = await caches.match(DASHBOARD, { cacheName: DATA, ignoreVary: true });
    return saved ?? caches.match(OFFLINE);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
    return;
  }
  if (request.mode !== "navigate") return;
  if (url.pathname === DASHBOARD) {
    event.respondWith(dashboard(event));
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
});
