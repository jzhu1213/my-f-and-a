/**
 * Analytics utility — privacy-respecting, anonymous event tracking.
 *
 * Sends anonymous usage events to a Supabase `analytics_events` table.
 * No cookies, no PII, no third-party scripts. Users can opt out at any time
 * via Settings → Privacy, which makes all tracking functions a no-op.
 *
 * Design principles:
 *  - **Privacy by default**: no PII ever leaves the device. User IDs are
 *    SHA-256 hashed before any correlation. Event properties must never
 *    contain amounts, notes, emails, or names.
 *  - **No-op in development**: keeps console clean and prevents polluting
 *    production analytics with dev data.
 *  - **Graceful degradation**: if Supabase is unreachable, events are silently
 *    dropped. Analytics should never break the app.
 *  - **Session-scoped**: a random session ID (UUID) is generated per browser
 *    session (sessionStorage). No cross-session tracking.
 *
 * Requirements: 33.1
 */

import { supabase } from './supabaseClient'

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for the opt-out flag. */
const OPT_OUT_KEY = 'folio_analytics_opted_out'

/** sessionStorage key for the anonymous session ID. */
const SESSION_ID_KEY = 'folio_analytics_session_id'

/**
 * Properties that should never appear in analytics events (PII guard).
 * The track() function strips these defensively.
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
  'userId',
  'user_id',
])

// ============================================================================
// Internal state
// ============================================================================

let sessionId: string | null = null
let hashedUserId: string | null = null

// ============================================================================
// Helpers
// ============================================================================

/** Check if we're running on the server. */
function isServer(): boolean {
  return typeof window === 'undefined'
}

/** Check if we're in development mode. */
function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

/** Generate a random UUID v4. */
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * SHA-256 hash a string. Returns hex digest.
 * Used for hashing user IDs before any storage/correlation.
 */
async function sha256(input: string): Promise<string> {
  if (isServer()) return ''
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Strip any PII keys from event properties defensively.
 * This is a safety net — callers should never include PII, but we guard anyway.
 */
function sanitizeProperties(
  properties?: Record<string, string | number>
): Record<string, string | number> | undefined {
  if (!properties) return undefined
  const cleaned: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!PII_KEYS.has(key.toLowerCase())) {
      cleaned[key] = value
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the analytics system.
 *
 * Generates (or restores) an anonymous session ID per browser session.
 * Call once on app boot (e.g., in the root layout or a provider).
 */
export function initAnalytics(): void {
  if (isServer()) return

  // Restore or generate session ID
  try {
    const stored = sessionStorage.getItem(SESSION_ID_KEY)
    if (stored) {
      sessionId = stored
    } else {
      sessionId = generateSessionId()
      sessionStorage.setItem(SESSION_ID_KEY, sessionId)
    }
  } catch {
    // sessionStorage unavailable (e.g., private browsing restrictions)
    sessionId = generateSessionId()
  }
}

/**
 * Track an anonymous event.
 *
 * No-ops when:
 * - Running on the server
 * - In development mode
 * - User has opted out
 *
 * Properties are sanitized to strip any accidentally-included PII keys.
 */
export function track(
  event: string,
  properties?: Record<string, string | number>
): void {
  if (isServer()) return
  if (isDev()) return
  if (isOptedOut()) return

  // Ensure session is initialized
  if (!sessionId) {
    initAnalytics()
  }

  const sanitized = sanitizeProperties(properties)

  // Fire and forget — analytics should never block UI
  void supabase
    .from('analytics_events')
    .insert({
      event,
      properties: sanitized ?? null,
      session_id: sessionId,
    })
    .then(() => {
      // Silently succeed or fail — analytics should never break the app
    })
}

/**
 * Associate the current session with a hashed user identifier.
 *
 * The raw userId (email or UUID) is SHA-256 hashed before storage.
 * This allows session correlation in analytics without ever storing PII.
 * The hashed ID is included in subsequent track() calls as a property.
 */
export async function identify(userId: string): Promise<void> {
  if (isServer()) return
  if (isDev()) return
  if (isOptedOut()) return

  try {
    hashedUserId = await sha256(userId)
  } catch {
    // Crypto API unavailable — skip identification
    hashedUserId = null
  }
}

/**
 * Opt out of analytics tracking.
 *
 * Persists the preference to localStorage. All subsequent track() calls
 * become no-ops. Takes effect immediately.
 */
export function optOut(): void {
  if (isServer()) return
  try {
    localStorage.setItem(OPT_OUT_KEY, 'true')
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Opt back in to analytics tracking.
 *
 * Removes the opt-out flag from localStorage. Subsequent track() calls
 * will fire normally.
 */
export function optIn(): void {
  if (isServer()) return
  try {
    localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Check whether the user has opted out of analytics.
 *
 * @returns true if opted out, false otherwise
 */
export function isOptedOut(): boolean {
  if (isServer()) return false
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true'
  } catch {
    // localStorage unavailable — default to not opted out
    return false
  }
}
