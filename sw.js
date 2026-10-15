const SHELL_CACHE = "shayan-ai-shell-v10";
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Cross-origin requests (web search, fonts, model files) go straight to the network.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  // Network-first: new versions of the app show up right away; the cache is only the offline fallback.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const res = await fetch(e.request, { cache: "no-cache" });
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const cached = (await cache.match(e.request)) || (e.request.mode === "navigate" ? await cache.match("./index.html") : undefined);
      if (cached) return cached;
      return new Response("Offline — this request needs a network connection.", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      });
    }
  })());
});
