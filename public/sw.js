const CACHE_VERSION = "v6";
const STATIC_CACHE = `bloc-static-${CACHE_VERSION}`;
const PAGES_CACHE = `bloc-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";
// NOTE: do NOT precache authenticated routes (/app*). Caching them at
// install time poisons the cache with the /auth redirect HTML when the
// worker installs while logged out, causing offline refresh to show the
// auth page. Only the public /offline fallback is precached; authed pages
// are cached at runtime after a successful (non-redirected) navigation.
const PRECACHE_URLS = [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch (e) {
        // offline page may not be available at install time (first deploy), ignore
      }
      // Precache app shell pages for offline navigation
      for (const url of PRECACHE_URLS) {
        try {
          await cache.add(new Request(url, { cache: "reload" }));
        } catch (e) {
          // pages may not be available at install time, ignore
        }
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("bloc-") && k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isAssetRequest(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/image/") ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|avif|woff2?|ttf|otf|css|js)$/i.test(url.pathname)
  );
}

function isAuthRequest(url) {
  return url.pathname.startsWith("/auth");
}

// Offline app-shell fallback for newly created notes.
// A brand-new /app/notes/<uuid> was never visited while online, so neither
// its document nor its RSC payload is in PAGES_CACHE. Without a fallback,
// router.push() to it offline ends in 503/offline page and the note never
// opens (old notes work because their RSC was cached at runtime).
// Return any previously cached /app shell so Next.js can boot and
// NoteEditor can load the note from localStorage by URL id.
async function findAppShellFallback(wantRsc) {
  const cache = await caches.open(PAGES_CACHE);
  let keys = [];
  try {
    keys = await cache.keys();
  } catch {
    return null;
  }
  const pathOf = (r) => {
    try {
      return new URL(r.url).pathname;
    } catch {
      return "";
    }
  };
  // NOTE: document (navigate) needs text/html, RSC needs text/x-component.
  // Returning the wrong kind breaks Next.js parsing — that is why v5 alone
  // still failed. Prefer same-component-tree note shells first.
  const rank = (p) => {
    if (p.startsWith("/app/notes/")) return 0;
    if (p === "/app/notes" || p === "/app/home" || p === "/app") return 1;
    if (p.startsWith("/app/")) return 2;
    return 9;
  };
  const ordered = keys
    .map((r) => ({ r, p: pathOf(r), rank: rank(pathOf(r)) }))
    .filter((x) => x.rank < 9)
    .sort((a, b) => a.rank - b.rank);
  for (const { r } of ordered) {
    let res = null;
    try {
      res = await cache.match(r);
    } catch {
      continue;
    }
    if (!res) continue;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isRsc = ct.includes("text/x-component") || ct.includes("multipart/mixed");
    const isDoc = ct.includes("text/html");
    if (wantRsc && isRsc) return res;
    if (!wantRsc && isDoc) return res;
  }
  // Last resort: exact shell match of the right kind (ignores content-type).
  for (const shell of ["/app/home", "/app", "/app/notes"]) {
    try {
      const hit = await cache.match(shell);
      if (hit) {
        const ct = (hit.headers.get("content-type") || "").toLowerCase();
        if (wantRsc && ct.includes("text/html")) continue;
        if (!wantRsc && !ct.includes("text/html")) continue;
        return hit;
      }
    } catch {}
  }
  return null;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin
  if (url.origin !== self.location.origin) return;
  if (isAuthRequest(url)) return;
  if (url.pathname === "/sw.js") return;

  // Skip dev/hot-reload requests entirely (passthrough, never cache).
  // Turbopack/webpack dev chunk URLs are stable across `next dev` restarts
  // while contents change — caching them breaks the module registry
  // ("module factory is not available").
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/_next/static/development") ||
    url.pathname.startsWith("/__nextjs_")
  ) {
    return;
  }

  // Navigation requests — network-first, fallback to cache then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(PAGES_CACHE);
          // Clone and cache successful navigations (only 200).
          // Never cache redirects (e.g. /app -> /auth) — response.url will
          // differ after following the redirect, or redirected=true.
          if (
            networkResponse &&
            networkResponse.ok &&
            !networkResponse.redirected
          ) {
            try {
              const resUrl = new URL(networkResponse.url);
              if (resUrl.pathname === url.pathname) {
                cache.put(request, networkResponse.clone());
              }
            } catch {
              // ignore URL parse errors, just don't cache
            }
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          // New note created offline: serve a cached app-shell DOCUMENT so
          // the editor can boot and read the note from localStorage.
          if (url.pathname.startsWith("/app/notes/")) {
            const shell = await findAppShellFallback(false);
            if (shell) return shell;
          }
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          // Last resort: return offline-like response
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }

  // Static assets — cache-first.
  // Excludes /_next/: dev chunk URLs are NOT content-hashed (stable across
  // `next dev` restarts with different contents), so cache-first serves stale
  // code and crashes module evaluation. /_next/ is handled network-first below.
  if (isAssetRequest(url) && !url.pathname.startsWith("/_next/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // For assets, if both cache and network fail, return error
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // RSC payloads, Next internals and dev chunks — network-first, fallback
  // to cache. MUST stay ahead of (and now exclusive over) the asset branch:
  // freshness wins for anything the framework versions by URL-stability.
  if (url.pathname.startsWith("/_next/") || request.headers.get("RSC") === "1") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          // New note RSC never cached: return a cached note RSC (same
          // component tree) so client navigation succeeds; NoteEditor
          // ignores a mismatched server prop and loads the local note.
          if (url.pathname.startsWith("/app/notes/")) {
            const shell = await findAppShellFallback(true);
            if (shell) return shell;
          }
          // Return a minimal RSC response for offline
          return new Response(null, { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }
});

// Push notifications handler (ready for future use)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: "1",
      },
    };
    event.waitUntil(self.registration.showNotification(data.title || "Bloc", options));
  } catch (e) {
    // ignore malformed push
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
