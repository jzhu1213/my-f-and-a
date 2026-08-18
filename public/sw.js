/**
 * Folio Service Worker — PWA caching, offline support, and push notifications.
 *
 * Strategies:
 * - Precache: app shell + icon set for instant offline loading
 * - Runtime cache-first: /_next/static/ (immutable, content-hashed)
 * - Runtime network-first: Supabase API data (stale data > no data)
 * - Network-only: Supabase auth endpoints (never cache tokens)
 * - Stale-while-revalidate: same-origin non-hashed assets
 *
 * Requirements: 28.7 — Service worker & PWA optimization
 * Task 476 — Service worker strategy (precache, runtime caching, versioning)
 */

// eslint-disable-next-line no-restricted-globals
const sw = self

// ─── Cache Configuration ─────────────────────────────────────────────────────

const CACHE_VERSION = 2
const CACHE_SHELL = `folio-shell-v${CACHE_VERSION}`
const CACHE_STATIC = `folio-static-v${CACHE_VERSION}`
const CACHE_API = `folio-api-v${CACHE_VERSION}`

// All folio cache name prefixes (used during cleanup)
const FOLIO_CACHE_PREFIX = "folio-"

// Critical assets to precache for offline-first app shell experience.
// Next.js hashed chunks are cached at runtime (they change per build).
const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
]

// Maximum age for API cache entries (1 hour)
const API_CACHE_MAX_AGE_MS = 60 * 60 * 1000

// ─── Push event handler ──────────────────────────────────────────────────────
sw.addEventListener("push", (event) => {
  const defaultTitle = "Folio"
  const defaultBody = "How'd spending go today?"

  let title = defaultTitle
  let body = defaultBody
  let icon = "/icon-192.png"
  let tag = "folio-daily-reminder"

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || defaultTitle
      body = data.body || defaultBody
      if (data.icon) icon = data.icon
      if (data.tag) tag = data.tag
    } catch {
      body = event.data.text() || defaultBody
    }
  }

  const options = {
    body,
    icon,
    badge: "/icon-192.png",
    tag,
    renotify: false,
    silent: false,
    actions: FOLIO_NOTIFICATION_ACTIONS,
    data: { defaultUrl: "/" },
  }

  event.waitUntil(sw.registration.showNotification(title, options))
})

// ─── Actionable notifications (task 182.1) ────────────────────────────────────
const FOLIO_NOTIFICATION_ACTIONS = [
  { action: "log-expense", title: "Log expense" },
  { action: "view-allowance", title: "View allowance" },
]

const FOLIO_ACTION_URLS = {
  "log-expense": "/?folioAction=quick-log&type=expense",
  "view-allowance": "/",
}

// ─── Notification click handler ──────────────────────────────────────────────
sw.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const targetUrl =
    FOLIO_ACTION_URLS[event.action] || data.defaultUrl || "/"

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && "focus" in client) {
          if ("navigate" in client && targetUrl !== "/") {
            return client.focus().then((focused) =>
              focused && focused.navigate ? focused.navigate(targetUrl) : focused
            )
          }
          return client.focus()
        }
      }
      return sw.clients.openWindow(targetUrl)
    })
  )
})

// ─── Install ─────────────────────────────────────────────────────────────────

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  // Don't skipWaiting automatically — let the app control when to activate
  // the new SW via the SKIP_WAITING message (task 476.3).
})

// ─── Activate ────────────────────────────────────────────────────────────────

sw.addEventListener("activate", (event) => {
  // Clean up ALL old folio-* caches that don't match current version
  const currentCaches = new Set([CACHE_SHELL, CACHE_STATIC, CACHE_API])

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(FOLIO_CACHE_PREFIX) && !currentCaches.has(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => sw.clients.claim())
  )
})

// ─── Message handler (SKIP_WAITING for update prompt) ────────────────────────

sw.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    sw.skipWaiting()
    return
  }

  // Widget data update (existing functionality)
  if (event.data && event.data.type === "widgetDataUpdate") {
    cachedWidgetData = event.data.payload
    lastFreshTimestamp = Date.now()
  }
})

// ─── Widget Data Cache ───────────────────────────────────────────────────────

let cachedWidgetData = null
let lastFreshTimestamp = null

// ─── Fetch handler ───────────────────────────────────────────────────────────

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Widget data endpoint — respond from in-memory cache
  if (url.pathname === "/api/widget/daily-allowance" && cachedWidgetData) {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000
    const isStale = lastFreshTimestamp
      ? Date.now() - lastFreshTimestamp > TWO_HOURS_MS
      : false

    const responseData = {
      ...cachedWidgetData,
      offlineStale: isStale,
    }

    event.respondWith(
      new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      })
    )
    return
  }

  // ── Supabase auth endpoints — NETWORK ONLY (never cache tokens) ──
  if (isSupabaseAuthRequest(url, event.request)) {
    // Let it pass through to network without any caching
    return
  }

  // ── Supabase API data — NETWORK FIRST with cache fallback ──
  if (isSupabaseDataRequest(url)) {
    event.respondWith(networkFirstWithCacheFallback(event.request))
    return
  }

  // ── Next.js static assets (/_next/static/) — CACHE FIRST (immutable) ──
  if (url.origin === sw.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstForStatic(event.request))
    return
  }

  // ── Navigation requests — NETWORK FIRST, fallback to cached shell ──
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((shell) => shell || caches.match("/offline.html"))
      )
    )
    return
  }

  // ── Same-origin assets — STALE WHILE REVALIDATE ──
  if (url.origin === sw.location.origin) {
    event.respondWith(staleWhileRevalidate(event.request))
  }
})

// ─── Caching Strategy Helpers ────────────────────────────────────────────────

/**
 * Cache-first for immutable static assets (/_next/static/).
 * These are content-hashed, so once cached they never change.
 */
function cacheFirstForStatic(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached

    return fetch(request).then((response) => {
      // Only cache successful responses
      if (!response || response.status !== 200) return response

      const clone = response.clone()
      caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone))
      return response
    })
  })
}

/**
 * Network-first with cache fallback for API data.
 * Stale data is better than no data for the user experience.
 */
function networkFirstWithCacheFallback(request) {
  return fetch(request)
    .then((response) => {
      // Only cache successful GET responses
      if (
        response &&
        response.status === 200 &&
        request.method === "GET"
      ) {
        const clone = response.clone()
        caches.open(CACHE_API).then((cache) => cache.put(request, clone))
      }
      return response
    })
    .catch(() => {
      // Network failed — try cache
      return caches.match(request).then((cached) => {
        if (cached) return cached
        // No cache either — return a minimal error response
        return new Response(
          JSON.stringify({ error: "offline", message: "No cached data available" }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        )
      })
    })
}

/**
 * Stale-while-revalidate for same-origin non-hashed assets.
 */
function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request)
      .then((response) => {
        // Only cache successful basic responses
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone()
          caches.open(CACHE_SHELL).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => cached)

    return cached || fetchPromise
  })
}

// ─── Request Classification Helpers ──────────────────────────────────────────

/**
 * Check if a request is a Supabase auth endpoint (tokens, sessions, etc.)
 * These must NEVER be cached.
 */
function isSupabaseAuthRequest(url, request) {
  const href = url.href

  // Supabase auth endpoints contain /auth/ in their path
  if (href.includes("/auth/v1/") || href.includes("/auth/")) {
    return true
  }

  // Token refresh requests
  if (href.includes("/token") && href.includes("grant_type")) {
    return true
  }

  // Any request with authorization header to supabase that's auth-related
  if (url.hostname.includes("supabase") && url.pathname.includes("/auth")) {
    return true
  }

  return false
}

/**
 * Check if a request is a Supabase data API request (rest, realtime, storage).
 * These get network-first caching for offline resilience.
 */
function isSupabaseDataRequest(url) {
  // Supabase REST API
  if (url.hostname.includes("supabase") && url.pathname.includes("/rest/")) {
    return true
  }

  // Supabase storage
  if (url.hostname.includes("supabase") && url.pathname.includes("/storage/")) {
    return true
  }

  return false
}

// ─── Periodic Sync (Background Widget Refresh) ───────────────────────────────
sw.addEventListener("periodicsync", (event) => {
  if (event.tag === "widget-daily-allowance-refresh") {
    event.waitUntil(
      sw.clients.matchAll({ type: "window" }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "requestWidgetDataRefresh" })
        }
      })
    )
  }
})
