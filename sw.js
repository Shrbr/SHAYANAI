const SHELL_CACHE = "shayan-ai-shell-v1";
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
  e.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        if (res && res.ok && e.request.url.startsWith(self.location.origin)) {
          cache.put(e.request, res.clone());
        }
        return res;
      } catch (err) {
        if (cached) return cached;
        return new Response("Offline — this request needs a network connection.", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      }
    })
  );
});
