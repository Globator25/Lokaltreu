const VERSION = "v1";
const PRECACHE = `pwa-precache-${VERSION}`;
const RUNTIME = `pwa-runtime-${VERSION}`;
const API_CACHE = `pwa-api-${VERSION}`;

const OFFLINE_URL = "/pwa/offline.html";

const DENYLIST_PATH_PREFIXES = [
  "/admin",
  "/admins",
  "/staff",
  "/staff-api",
  "/auth",
  "/tokens",
  "/.well-known/jwks.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![PRECACHE, RUNTIME, API_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isDeniedPath(pathname) {
  return DENYLIST_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isNavigationRequest(request, url) {
  return request.mode === "navigate" && url.pathname.startsWith("/pwa/");
}

function isStaticAsset(url, request) {
  if (request.destination && ["style", "script", "image", "font"].includes(request.destination)) {
    return true;
  }

  if (url.pathname.startsWith("/_next/static/")) return true;

  const ext = url.pathname.split(".").pop() || "";
  return [
    "css",
    "js",
    "png",
    "jpg",
    "jpeg",
    "svg",
    "webp",
    "ico",
    "woff",
    "woff2",
    "ttf",
    "eot",
    "map",
    "webmanifest",
    "json",
  ].includes(ext);
}

function isApiGet(request, url) {
  if (request.method !== "GET") return false;
  if (!isSameOrigin(url)) return false;
  if (isDeniedPath(url.pathname)) return false;
  if (request.headers && request.headers.get("authorization")) return false;

  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/dsr") ||
    url.pathname.startsWith("/referrals") ||
    url.pathname.startsWith("/stamps") ||
    url.pathname.startsWith("/rewards")
  );
}

async function networkFirst(request, cacheName, fallbackRequest) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackRequest) {
      const fallback = await caches.match(fallbackRequest);
      if (fallback) return fallback;
    }
    throw new Error("Network failed");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || fetchPromise;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method === "HEAD") return;

  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (isDeniedPath(url.pathname)) {
    return;
  }

  if (isNavigationRequest(request, url)) {
    // Network-first for navigation to keep content fresh; fallback to offline page.
    event.respondWith(networkFirst(request, RUNTIME, OFFLINE_URL));
    return;
  }

  if (isApiGet(request, url)) {
    // Network-first for API GET, fallback to cached response.
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  if (isStaticAsset(url, request)) {
    // Stale-while-revalidate for static assets to balance speed and freshness.
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }
});



