/**
 * Folio Service Worker — PWA push notification support.
 *
 * Currently supports:
 * - Displaying local notifications triggered by the app's own timer/scheduler
 * - Handling notification click to focus/open the app
 *
 * Native push (Firebase Cloud Messaging or Web Push API with a backend server)
 * is a future phase. This SW currently supports local scheduled notifications
 * via the app's own timer when the PWA is open or in the background.
 *
 * Requirements: Task 77 — Gentle re-engagement without nagging
 */

// eslint-disable-next-line no-restricted-globals
const sw = self

// ─── Push event handler ──────────────────────────────────────────────────────
// Displays a notification when a push message is received.
// For now, the app fires these locally; a future server-based push can also
// trigger this handler.
sw.addEventListener("push", (event) => {
  const defaultTitle = "Folio"
  const defaultBody = "How'd spending go today?"

  let title = defaultTitle
  let body = defaultBody
  let icon = "/icon-192.png"

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || defaultTitle
      body = data.body || defaultBody
      if (data.icon) icon = data.icon
    } catch {
      // If data isn't JSON, use text as body
      body = event.data.text() || defaultBody
    }
  }

  const options = {
    body,
    icon,
    badge: "/icon-192.png",
    tag: "folio-daily-reminder",
    renotify: false,
    // Warm, non-intrusive — no vibration pattern
    silent: false,
  }

  event.waitUntil(sw.registration.showNotification(title, options))
})

// ─── Notification click handler ──────────────────────────────────────────────
// Focuses the app window if already open, or opens it.
sw.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && "focus" in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      return sw.clients.openWindow("/")
    })
  )
})

// ─── Install & Activate ──────────────────────────────────────────────────────
sw.addEventListener("install", () => {
  sw.skipWaiting()
})

sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim())
})

// ─── Widget Data Cache ───────────────────────────────────────────────────────
// Stores the latest daily allowance data sent from the main app thread.
// The PWA widget (Windows 11 Edge) reads this via the /api/widget/daily-allowance
// endpoint, which the SW intercepts and responds to from cache.

let cachedWidgetData = null

// Listen for messages from the main app thread to update widget data
sw.addEventListener("message", (event) => {
  if (event.data && event.data.type === "widgetDataUpdate") {
    cachedWidgetData = event.data.payload
  }
})

// Intercept widget data requests and respond from cache
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (url.pathname === "/api/widget/daily-allowance" && cachedWidgetData) {
    event.respondWith(
      new Response(JSON.stringify(cachedWidgetData), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      })
    )
  }
})

// ─── Periodic Sync (Background Widget Refresh) ───────────────────────────────
// When the browser supports periodic background sync, refresh widget data.
// This keeps the widget current even when the app isn't open.
sw.addEventListener("periodicsync", (event) => {
  if (event.tag === "widget-daily-allowance-refresh") {
    event.waitUntil(
      // Notify all open clients to recalculate and send fresh widget data
      sw.clients.matchAll({ type: "window" }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "requestWidgetDataRefresh" })
        }
      })
    )
  }
})
