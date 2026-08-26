/**
 * Error monitoring utility — privacy-respecting crash & error reporting.
 *
 * Captures unhandled exceptions, promise rejections, render errors (via the
 * app-root error boundary), and Core Web Vitals degradations, then forwards
 * them to a monitoring service for the production deployment.
 *
 * Design principles (mirrors `src/lib/analytics.ts`):
 *  - **No-op in development**: keeps the console clean and prevents polluting
 *    the production dashboard with dev noise.
 *  - **No-op when unconfigured**: if `NEXT_PUBLIC_SENTRY_DSN` is unset, all
 *    functions become no-ops. Nothing is hardcoded — the DSN/endpoint always
 *    comes from the environment.
 *  - **Privacy by default**: emails and user IDs are scrubbed from messages,
 *    stack traces, and context before anything leaves the device. Event
 *    payloads must never carry raw PII.
 *  - **Graceful degradation**: reporting is fire-and-forget. Monitoring must
 *    never break the app.
 *  - **Environment tagging**: every event is tagged production vs. preview vs.
 *    development so dashboards can filter deploy targets.
 *
 * This module exposes a Sentry-compatible surface (`captureException`,
 * `captureMessage`, environment tags, breadcrumb-style context). If the full
 * Sentry SDK is adopted later, callers keep the same API and only this module's
 * internals change.
 *
 * Requirements: 33.4
 */

import type { Metric } from 'web-vitals'

// ============================================================================
// Constants
// ============================================================================

/**
 * Reporting endpoint / DSN. Sourced exclusively from the environment so no key
 * is ever hardcoded. When unset, the module no-ops.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

/**
 * Keys whose values are treated as PII and stripped from any context object
 * before reporting. Mirrors the guard in `analytics.ts`.
 */
const PII_KEYS = new Set([
  'email',
  'name',
  'phone',
  'address',
  'note',
  'notes',
  'amount',
  'password',
  'pin',
  'ssn',
  'userid',
  'user_id',
  'id',
])

/** Matches email addresses so they can be redacted from free-form strings. */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

/** Matches UUID v4-style identifiers (user IDs) for redaction from strings. */
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Web Vitals ratings we consider a degradation worth reporting. */
const POOR_RATINGS = new Set<Metric['rating']>(['poor'])

// ============================================================================
// Internal state
// ============================================================================

let initialized = false

// ============================================================================
// Environment helpers
// ============================================================================

/** Running on the server (no window)? */
function isServer(): boolean {
  return typeof window === 'undefined'
}

/** Running in development mode? */
function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Resolve the deploy environment for event tagging.
 *
 * Prefers the Vercel-provided value (exposed as `NEXT_PUBLIC_VERCEL_ENV`) which
 * distinguishes `production` from `preview`, falling back to `NODE_ENV`.
 */
function getEnvironment(): 'production' | 'preview' | 'development' {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
  if (vercelEnv === 'production' || vercelEnv === 'preview') return vercelEnv
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

/**
 * Whether reporting is active. Reporting is disabled on the server, in
 * development, and whenever no DSN is configured.
 */
function isEnabled(): boolean {
  return !isServer() && !isDev() && Boolean(DSN)
}

// ============================================================================
// PII scrubbing
// ============================================================================

/**
 * Redact emails and UUID-style user IDs from a free-form string (messages,
 * stack traces, breadcrumb text).
 */
export function scrubString(input: string): string {
  return input
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(UUID_RE, '[redacted-id]')
}

/**
 * Strip PII keys and redact PII values from a context object before reporting.
 * Non-string primitives are passed through; strings are scrubbed; nested
 * objects are recursively cleaned.
 */
export function scrubContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!context) return undefined
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (PII_KEYS.has(key.toLowerCase())) continue
    if (typeof value === 'string') {
      cleaned[key] = scrubString(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = scrubContext(value as Record<string, unknown>)
    } else {
      cleaned[key] = value
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

// ============================================================================
// Reporting transport
// ============================================================================

interface ErrorEvent {
  type: 'exception' | 'message' | 'web-vital'
  level: 'error' | 'warning' | 'info'
  environment: 'production' | 'preview' | 'development'
  message: string
  stack?: string
  context?: Record<string, unknown>
  url?: string
  timestamp: number
}

/**
 * Send an event to the monitoring endpoint. Fire-and-forget: uses `sendBeacon`
 * when available (survives page unload) and falls back to a keepalive fetch.
 */
function report(event: ErrorEvent): void {
  if (!DSN) return
  let body: string
  try {
    body = JSON.stringify(event)
  } catch {
    return
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(DSN, body)
      return
    }
    void fetch(DSN, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently ignore — monitoring must never break the app.
    })
  } catch {
    // Silently ignore transport failures.
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Report a caught exception (e.g. from the app-root error boundary or a
 * try/catch). PII is scrubbed from the message, stack, and context.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!isEnabled()) return

  const err = error instanceof Error ? error : new Error(String(error))
  report({
    type: 'exception',
    level: 'error',
    environment: getEnvironment(),
    message: scrubString(err.message || 'Unknown error'),
    stack: err.stack ? scrubString(err.stack) : undefined,
    context: scrubContext(context),
    url: typeof location !== 'undefined' ? scrubString(location.href) : undefined,
    timestamp: Date.now(),
  })
}

/**
 * Report an informational or warning message (non-exception).
 */
export function captureMessage(
  message: string,
  level: 'warning' | 'info' = 'info',
  context?: Record<string, unknown>
): void {
  if (!isEnabled()) return
  report({
    type: 'message',
    level,
    environment: getEnvironment(),
    message: scrubString(message),
    context: scrubContext(context),
    url: typeof location !== 'undefined' ? scrubString(location.href) : undefined,
    timestamp: Date.now(),
  })
}

/**
 * Forward a Core Web Vitals metric to the monitoring service so performance
 * degradations show up alongside errors. Only poorly-rated metrics are
 * reported to keep event volume low; the metric carries no PII.
 *
 * Wired from `src/lib/webVitals.ts` (Phase 20 Core Web Vitals tracking).
 */
export function reportPerformanceMetric(metric: Metric): void {
  if (!isEnabled()) return
  if (!POOR_RATINGS.has(metric.rating)) return
  report({
    type: 'web-vital',
    level: 'warning',
    environment: getEnvironment(),
    message: `Web Vital degraded: ${metric.name}`,
    context: {
      name: metric.name,
      value: Math.round(metric.value * 10000) / 10000,
      rating: metric.rating,
      navigationType: metric.navigationType,
    },
    url: typeof location !== 'undefined' ? scrubString(location.href) : undefined,
    timestamp: Date.now(),
  })
}

/**
 * Initialize global error monitoring.
 *
 * Installs listeners for uncaught errors and unhandled promise rejections so
 * silent async failures are surfaced. Safe to call multiple times — only the
 * first call installs listeners. No-ops on the server, in development, and when
 * no DSN is configured.
 *
 * Call once on app boot (e.g. from a client component in the root layout).
 */
export function initErrorMonitoring(): void {
  if (initialized) return
  if (!isEnabled()) return
  initialized = true

  // Uncaught synchronous/async errors that bubble to window.
  window.addEventListener('error', (event) => {
    captureException(event.error ?? event.message, { source: 'window.onerror' })
  })

  // Unhandled promise rejections (task 537.3).
  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason ?? 'Unhandled promise rejection', {
      source: 'unhandledrejection',
    })
  })
}

/**
 * Test whether monitoring is currently active. Exposed for diagnostics and the
 * launch checklist "sends a test event" verification.
 */
export function isMonitoringEnabled(): boolean {
  return isEnabled()
}
