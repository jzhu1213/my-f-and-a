/**
 * App Lock — optional biometric/PIN gate for cold-open.
 *
 * Folio can gate a *cold open* behind a device-local lock (biometric via
 * WebAuthn, or a numeric PIN). This is a privacy convenience, not account
 * security — auth still lives with Supabase. The lock is:
 *
 *   • OFF by default — the app always lands on Home with no forced setup.
 *   • Opt-in from Settings → Privacy & security (progressive disclosure).
 *   • Device-local — the PIN is stored only as a salted PBKDF2 hash in
 *     localStorage (never plaintext), and the biometric uses a WebAuthn
 *     credential id (no secret material leaves the authenticator).
 *   • Session-scoped once unlocked — unlocking marks the current tab session
 *     unlocked so in-app navigation never re-prompts; a fresh cold open
 *     (new tab / relaunch) locks again.
 *
 * This module keeps the security-relevant logic — PIN hashing/verification,
 * PIN validation, and lock-state gating — as pure, deterministic helpers so
 * they are trivially testable. The WebAuthn helpers are inherently
 * side-effectful (they talk to the platform authenticator) and are grouped
 * separately at the bottom, each SSR-guarded.
 *
 * Requirements: new (pairs with Group 27 security — task 192.1 App-level protection)
 */

// ============================================================================
// Types
// ============================================================================

/** How the user chose to unlock the app. */
export type AppLockMethod = "pin" | "biometric"

export interface AppLockPreferences {
  /** Whether the cold-open lock is enabled (opt-in, default false). */
  enabled: boolean
  /** The unlock method the user configured. */
  method: AppLockMethod
  /** Salted PBKDF2 hash of the PIN (hex). Null when no PIN is set. */
  pinHash: string | null
  /** Random per-user salt for the PIN hash (hex). Null when no PIN is set. */
  pinSalt: string | null
  /**
   * WebAuthn credential id (base64url) enrolled for biometric unlock.
   * Null when biometric isn't configured. We only need the id to trigger a
   * `navigator.credentials.get` challenge — no secret is stored here.
   */
  credentialId: string | null
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_app_lock_prefs"
const SESSION_UNLOCK_KEY = "folio_app_lock_unlocked"

/** PIN length bounds — short enough to be friendly, long enough to be useful. */
export const MIN_PIN_LENGTH = 4
export const MAX_PIN_LENGTH = 8

/** PBKDF2 work factor. High enough to slow brute force on a short PIN. */
const PBKDF2_ITERATIONS = 150_000
const PBKDF2_HASH = "SHA-256"
/** Derived key length in bits. */
const DERIVED_KEY_BITS = 256

export const DEFAULT_APP_LOCK_PREFERENCES: AppLockPreferences = {
  enabled: false,
  method: "pin",
  pinHash: null,
  pinSalt: null,
  credentialId: null,
}

// ============================================================================
// Persistence
// ============================================================================

/**
 * Load app-lock preferences from localStorage. Returns safe defaults (lock
 * disabled) on SSR, when nothing is stored, or when parsing fails — so the app
 * can never get wedged behind a corrupt lock config.
 */
export function getAppLockPreferences(): AppLockPreferences {
  if (typeof window === "undefined") return DEFAULT_APP_LOCK_PREFERENCES
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_APP_LOCK_PREFERENCES
    const parsed = JSON.parse(stored) as Partial<AppLockPreferences>
    return { ...DEFAULT_APP_LOCK_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_APP_LOCK_PREFERENCES
  }
}

/** Persist app-lock preferences to localStorage (fails silently). */
export function setAppLockPreferences(prefs: AppLockPreferences): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Fully disable and clear the lock — removes any stored PIN hash/salt and
 * biometric credential so no lock material lingers.
 */
export function clearAppLock(): void {
  setAppLockPreferences({ ...DEFAULT_APP_LOCK_PREFERENCES })
  clearSessionUnlock()
}

// ============================================================================
// Pure validation & gating
// ============================================================================

/**
 * Validate a candidate PIN. Deterministic and pure. A valid PIN is
 * {@link MIN_PIN_LENGTH}–{@link MAX_PIN_LENGTH} digits, numeric only.
 */
export function isValidPin(pin: string): boolean {
  if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) return false
  return /^[0-9]+$/.test(pin)
}

/**
 * Decide whether a cold open should be gated by the lock screen. Pure — takes
 * the stored preferences and whether this session was already unlocked.
 *
 * Locks only when:
 *  - the lock is enabled, AND
 *  - this session hasn't been unlocked yet, AND
 *  - the configured method actually has a credential set up (a PIN hash for
 *    'pin', a WebAuthn credential id for 'biometric'). This guards against a
 *    half-configured state ever trapping the user out.
 */
export function shouldLockOnColdOpen(
  prefs: AppLockPreferences,
  sessionUnlocked: boolean
): boolean {
  if (!prefs.enabled) return false
  if (sessionUnlocked) return false
  if (prefs.method === "pin") return prefs.pinHash !== null
  if (prefs.method === "biometric") return prefs.credentialId !== null
  return false
}

// ============================================================================
// Session unlock tracking (per-tab, cleared on cold open)
// ============================================================================

/**
 * Whether the current tab session has already been unlocked. Uses
 * sessionStorage so a new tab / relaunch (a true cold open) starts locked,
 * while in-app navigation within the session stays unlocked.
 */
export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(SESSION_UNLOCK_KEY) === "true"
  } catch {
    return false
  }
}

/** Mark the current session as unlocked (fails silently). */
export function markSessionUnlocked(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
  } catch {
    // fail silently
  }
}

/** Clear the session-unlocked flag (e.g. when disabling the lock). */
export function clearSessionUnlock(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY)
  } catch {
    // fail silently
  }
}

// ============================================================================
// PIN hashing — pure & deterministic given (pin, salt)
// ============================================================================

/**
 * Access the Web Crypto SubtleCrypto instance in a way that works in the
 * browser and in Node's test/build environment (globalThis.crypto).
 */
function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c || !c.subtle) {
    throw new Error("Web Crypto is unavailable in this environment")
  }
  return c.subtle
}

/** Convert bytes to a lowercase hex string. */
function bytesToHex(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0")
  }
  return out
}

/** Convert a hex string back to bytes. */
function hexToBytes(hex: string): Uint8Array {
  const len = Math.floor(hex.length / 2)
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * Generate a random 16-byte salt as hex. Side-effectful only in the sense that
 * it reads the CSPRNG; the returned salt is what makes {@link hashPin}
 * deterministic per user.
 */
export function generateSalt(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c || !c.getRandomValues) {
    throw new Error("Secure RNG is unavailable in this environment")
  }
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return bytesToHex(bytes)
}

/**
 * Derive a salted PBKDF2 hash of a PIN. Pure and deterministic: the same
 * (pin, salt) always yields the same hex digest. Never store the raw PIN.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const subtle = getSubtle()
  const enc = new TextEncoder()
  const keyMaterial = await subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  )
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    DERIVED_KEY_BITS
  )
  return bytesToHex(new Uint8Array(bits))
}

/**
 * Verify a candidate PIN against a stored salted hash. Pure and deterministic.
 * Uses a length-then-content comparison; input space is a short numeric PIN so
 * this is not a timing-sensitive secret in the cryptographic sense.
 */
export async function verifyPin(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!salt || !expectedHash) return false
  const actual = await hashPin(pin, salt)
  if (actual.length !== expectedHash.length) return false
  let mismatch = 0
  for (let i = 0; i < actual.length; i++) {
    mismatch |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Convenience helper: build the PIN fields for a fresh preferences object by
 * generating a salt and hashing the PIN. Returns the pieces to merge into
 * {@link AppLockPreferences}.
 */
export async function buildPinCredential(
  pin: string
): Promise<{ pinHash: string; pinSalt: string }> {
  const pinSalt = generateSalt()
  const pinHash = await hashPin(pin, pinSalt)
  return { pinHash, pinSalt }
}

// ============================================================================
// WebAuthn biometric helpers (side-effectful, SSR-guarded)
// ============================================================================

/** base64url encode raw bytes (for storing credential ids). */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** base64url decode to bytes (for replaying a stored credential id). */
function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * Whether this device likely supports a platform biometric authenticator
 * (Face ID / Touch ID / Windows Hello / Android biometric) via WebAuthn.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!("PublicKeyCredential" in window)) return false
  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return available === true
  } catch {
    return false
  }
}

/**
 * Enroll a platform-biometric credential and return its id (base64url) to
 * store in preferences. Returns null if the user cancels or enrollment fails.
 * The RP id defaults to the current hostname so the credential is bound to the
 * app origin. No server round-trip — this is a device-local convenience gate.
 */
export async function registerBiometric(
  label = "Folio"
): Promise<string | null> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return null
  }
  try {
    const challenge = new Uint8Array(32)
    window.crypto.getRandomValues(challenge)
    const userId = new Uint8Array(16)
    window.crypto.getRandomValues(userId)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: label, id: window.location.hostname },
        user: { id: userId, name: label, displayName: label },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null

    if (!credential) return null
    return bufferToBase64Url(credential.rawId)
  } catch {
    return null
  }
}

/**
 * Challenge the enrolled biometric credential to unlock. Returns true when the
 * platform authenticator verifies the user, false on cancel/failure.
 */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return false
  }
  if (!credentialId) return false
  try {
    const challenge = new Uint8Array(32)
    window.crypto.getRandomValues(challenge)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: base64UrlToBuffer(credentialId),
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    })

    return assertion !== null
  } catch {
    return false
  }
}
