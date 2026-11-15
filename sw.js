/* Microvida 3D — service worker
   Funciona sem internet depois do primeiro acesso. Arquivos do app: tenta a rede
   primeiro (para receber atualizações) e usa a cópia guardada quando estiver offline. */
const VERSAO = "microvida-v8";
const ARQUIVOS = [
  "./", "./index.html", "./manifest.webmanifest", "./icone.svg",
  "./css/estilo.css",
  "./js/vendor/three.min.js", "./js/vendor/OrbitControls.js", "./js/vendor/meshopt_decoder.js", "./modelos/corpo_imune.js",
  "./js/dados.js", "./js/modelos.js", "./js/simulacoes.js", "./js/app.js",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/icone-maskable-192.png", "./icones/icone-maskable-512.png",
  "./icones/apple-touch-icon.png", "./icones/favicon-32.png"
];

// cache: "reload" ignora o cache HTTP do navegador: guarda sempre a versão publicada agora
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("message", e => { if (e.data === "atualizar") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  // fontes do Google: guarda na primeira vez e reutiliza
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(VERSAO + "-fontes").then(async c => {
      const h = await c.match(req); if (h) return h;
      try { const r = await fetch(req); if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; } catch (err) { return h || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // arquivos do app: rede primeiro, cópia guardada se estiver offline
  e.respondWith((async () => {
    const c = await caches.open(VERSAO);
    try {
      const r = await fetch(req, { cache: "no-cache" }); // confere com o servidor (ETag), nunca usa cópia velha
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      const h = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("./index.html") : null);
      return h || Response.error();
    }
  })());
});
