const CACHE_VERSION = "v4";
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
