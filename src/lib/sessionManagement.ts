/**
 * Session management — a visible active-session list with revoke (task 192.1).
 *
 * Part of Group 27 (Trust, Privacy & Security): "a money app must feel safe".
 * This module lets a signed-in user *see* the devices where Folio is open on
 * their account and *revoke* access — a standard, reassuring control for any
 * money app.
 *
 * Design notes / honesty about capabilities:
 *   • Supabase's client SDK (anon key) can revoke sessions in bulk via
 *     `auth.signOut({ scope: 'others' | 'global' })`, but it cannot *list*
 *     sessions or revoke one specific foreign token on its own. So Folio keeps
 *     a lightweight, additive `user_sessions` table (one row per device) purely
 *     to render the list and last-seen metadata. Removing a row revokes that
 *     device from the registry; "Sign out all other devices" is the hard
 *     security guarantee that invalidates every other refresh token.
 *   • Each device gets a stable, random device id stored locally (no PII, no
 *     fingerprinting). The human-readable label is derived from the user agent.
 *   • Everything degrades gracefully: if the table doesn't exist yet, the UI
 *     still shows the current device synthesized locally, so nothing breaks on
 *     a backend that hasn't run the additive migration.
 *
 * The security-relevant string parsing (device labelling) and the last-seen
 * formatting are pure, deterministic helpers so they're trivially testable. The
 * Supabase CRUD lives in `supabaseData.ts` alongside the rest of the data layer.
 *
 * Suggested (additive, backward-compatible) table — run once in Supabase:
 *
 *   create table if not exists public.user_sessions (
 *     id          uuid primary key default gen_random_uuid(),
 *     user_id     uuid not null references auth.users(id) on delete cascade,
 *     device_id   text not null,
 *     label       text not null default 'Unknown device',
 *     user_agent  text,
 *     created_at  timestamptz not null default now(),
 *     last_seen_at timestamptz not null default now(),
 *     unique (user_id, device_id)
 *   );
 *   alter table public.user_sessions enable row level security;
 *   create policy "own sessions" on public.user_sessions
 *     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * Requirements: new (Group 27 — task 192.1 App-level protection)
 */

// ============================================================================
// Types
// ============================================================================

/** A single active session as shown in the session list. */
export interface ActiveSession {
  /** Stable per-device id (random, no PII). */
  deviceId: string
  /** Warm, human-readable label, e.g. "Chrome on Windows". */
  label: string
  /** Raw user agent captured when the session was recorded (optional). */
  userAgent?: string
  /** ISO timestamp of when this device was first seen. */
  createdAt: string
  /** ISO timestamp of the most recent activity. */
  lastSeenAt: string
  /** Whether this row is the device the user is currently looking at. */
  isCurrent: boolean
}

// ============================================================================
// Constants
// ============================================================================

const DEVICE_ID_KEY = "folio_device_id"

// ============================================================================
// Device identity (local, stable, no fingerprinting)
// ============================================================================

/**
 * Get — or lazily create — a stable random id for this browser/device. Stored
 * in localStorage so the same device keeps the same row across cold opens.
 * Returns an empty string on SSR (the caller only registers on the client).
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const generated = generateId()
    localStorage.setItem(DEVICE_ID_KEY, generated)
    return generated
  } catch {
    // localStorage unavailable — fall back to a volatile id for this load.
    return generateId()
  }
}

/** Generate a random id, preferring crypto.randomUUID when available. */
function generateId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    let hex = ""
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0")
    return hex
  }
  // Last-resort non-crypto fallback (only for environments without WebCrypto).
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// ============================================================================
// Device labelling — pure & deterministic
// ============================================================================

/**
 * Derive a friendly label from a user-agent string, e.g. "Safari on iPhone".
 * Pure and deterministic. Best-effort: falls back to "Unknown device" so the
 * list never shows an empty or scary row.
 */
export function describeDevice(userAgent: string | undefined | null): string {
  if (!userAgent) return "Unknown device"
  const ua = userAgent

  const os = detectOs(ua)
  const browser = detectBrowser(ua)

  if (browser && os) return `${browser} on ${os}`
  if (browser) return browser
  if (os) return os
  return "Unknown device"
}

/** Detect a coarse OS / device family from the user agent. Pure. */
function detectOs(ua: string): string | null {
  if (/iPhone/i.test(ua)) return "iPhone"
  if (/iPad/i.test(ua)) return "iPad"
  if (/Android/i.test(ua)) return "Android"
  if (/Windows/i.test(ua)) return "Windows"
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac"
  if (/CrOS/i.test(ua)) return "Chromebook"
  if (/Linux/i.test(ua)) return "Linux"
  return null
}

/** Detect a coarse browser family from the user agent. Pure. Order matters. */
function detectBrowser(ua: string): string | null {
  if (/Edg\//i.test(ua)) return "Edge"
  if (/OPR\/|Opera/i.test(ua)) return "Opera"
  if (/Firefox\//i.test(ua)) return "Firefox"
  // Chrome UAs also contain "Safari"; check Chrome first.
  if (/Chrome\//i.test(ua)) return "Chrome"
  if (/Safari\//i.test(ua)) return "Safari"
  return null
}

// ============================================================================
// Last-seen formatting — pure & deterministic
// ============================================================================

/**
 * Format a warm, human "last seen" label relative to `now`. Pure and
 * deterministic given both timestamps. Returns "Active now" for very recent
 * activity, then minutes / hours / days, then a short date for older sessions.
 */
export function formatLastSeen(lastSeenIso: string, now: Date = new Date()): string {
  const then = new Date(lastSeenIso).getTime()
  if (Number.isNaN(then)) return "Recently"

  const diffMs = now.getTime() - then
  if (diffMs < 0) return "Active now"

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 2) return "Active now"
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`

  return new Date(lastSeenIso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

/**
 * Build the descriptor for the current device (used when registering a session
 * and as a graceful fallback when the sessions table isn't available).
 */
export function describeCurrentDevice(): { deviceId: string; label: string; userAgent: string } {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
  return {
    deviceId: getDeviceId(),
    label: describeDevice(userAgent),
    userAgent,
  }
}
