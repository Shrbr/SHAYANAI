const SHELL_CACHE = "shayan-ai-shell-v14";
const SHARE_CACHE = "shayan-ai-share-inbox";
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Share target: the phone's Share sheet POSTs text/link/files here. They are parked in a
// temporary cache (browser-only), then the app opens and imports + deletes them.
async function handleShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    await caches.delete(SHARE_CACHE);
    const cache = await caches.open(SHARE_CACHE);
    const meta = { title: String(form.get("title") || ""), text: String(form.get("text") || ""), url: String(form.get("url") || "") };
    await cache.put(new URL("share-inbox/meta", scope).href, new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
    const files = form.getAll("files").filter((f) => typeof f !== "string").slice(0, 4);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      await cache.put(new URL("share-inbox/file-" + i, scope).href, new Response(f, {
        headers: { "Content-Type": f.type || "application/octet-stream", "X-Name": encodeURIComponent(f.name || "file") }
      }));
    }
  } catch (err) { /* open the app anyway */ }
  try {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    open.forEach((c) => c.postMessage({ type: "share-ready" }));
  } catch (err) { /* no open windows */ }
  return Response.redirect(new URL("./?share=1", scope).href, 303);
}

self.addEventListener("fetch", (e) => {
  const reqUrl = new URL(e.request.url);
  // Some launchers deliver a share as a plain GET (?title=&text=&url=): bounce it to the app with the same params.
  if (e.request.method === "GET" && reqUrl.origin === self.location.origin && reqUrl.pathname.endsWith("/share-target")) {
    const target = new URL("./", self.registration.scope);
    target.searchParams.set("share", "1");
    ["title", "text", "url"].forEach((k) => { const v = reqUrl.searchParams.get(k); if (v) target.searchParams.set(k, v); });
    e.respondWith(Response.redirect(target.href, 303));
    return;
  }
  if (e.request.method === "POST" && reqUrl.origin === self.location.origin && reqUrl.pathname.endsWith("/share-target")) {
    e.respondWith(handleShare(e.request));
    return;
  }
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
