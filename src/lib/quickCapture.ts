/**
 * Quick-capture intent reader — normalizes external entry-point launches into a
 * single, structured intent that the app can route through `naturalLogParser`.
 *
 * Two external entry points feed this module (task 180.1 — "Capture from anywhere"):
 *
 *  1. **OS share sheet** — via the Web Share Target API. `public/manifest.json`
 *     declares a `share_target` that maps the shared `title`/`text`/`url` onto
 *     query params on the app's start URL (GET). When the OS shares content to
 *     the installed PWA, the browser navigates to `/?title=…&text=…&url=…`.
 *
 *  2. **Assistant / app shortcuts** — PWA `shortcuts` in the manifest (long-press
 *     the icon on Android, right-click on Windows) and Siri/Google Assistant
 *     shortcuts. These invoke a deep link like
 *     `/?folioAction=quick-log&type=expense&ql=<dictated text>`.
 *
 * NATIVE-SHELL LIMITATION (documented honestly):
 *   Folio is a single-user PWA with no native app shell. True first-class
 *   Siri / Google Assistant *voice intents* (App Intents / App Actions) require
 *   a native iOS/Android wrapper that registers intent handlers with the OS.
 *   Without that shell we support assistants through the portable, cross-platform
 *   surface every assistant can drive: a query-param deep link the user wires up
 *   as a shortcut ("Hey Siri, log expense" → open URL with dictated text). If a
 *   native shell is added later, its intent handler should build the same
 *   `/?folioAction=quick-log&ql=…` URL so this module keeps working unchanged.
 *
 * Pure, deterministic, no side effects — safe to unit test.
 */

// ============================================================================
// Types
// ============================================================================

/** Where the capture originated. */
export type QuickCaptureSource = 'share' | 'assistant'

/** What kind of entry the user intends to log. */
export type QuickCaptureType = 'expense' | 'income'

export interface QuickCaptureIntent {
  /**
   * Free text to feed the natural-language log parser. May be an empty string
   * when a shortcut is launched without dictated text (in that case the caller
   * should just open the relevant sheet rather than parse).
   */
  rawText: string
  /** Which external surface launched the capture. */
  source: QuickCaptureSource
  /** Expense (default) or income. */
  type: QuickCaptureType
}

// ============================================================================
// Helpers
// ============================================================================

function toSearchParams(search: string | URLSearchParams): URLSearchParams {
  if (search instanceof URLSearchParams) return search
  // Accept both "?a=b" and "a=b" forms.
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

function normalizeType(raw: string | null): QuickCaptureType {
  return raw === 'income' ? 'income' : 'expense'
}

/**
 * Build the text to parse from shared fields. The amount usually lives in the
 * shared `text` or `title`; a bare shared `url` rarely contains a loggable
 * expense, so we only fall back to it when there is nothing else.
 */
function buildSharedText(title: string, text: string, url: string): string {
  const primary = [text, title]
    .map(s => s.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  if (primary) return primary
  return url.trim()
}

// ============================================================================
// Main reader
// ============================================================================

/**
 * Inspect the launch URL's query string and, if it represents an external
 * capture, return a normalized intent. Returns `null` for ordinary app loads.
 *
 * @param search - `window.location.search`, a raw query string, or URLSearchParams
 */
export function readQuickCaptureIntent(
  search: string | URLSearchParams
): QuickCaptureIntent | null {
  const params = toSearchParams(search)

  // ── Assistant / shortcut deep link (explicit marker) ─────────────────────
  // Distinguished by our own `folioAction=quick-log` marker or a `ql` param so
  // it can never be confused with an ordinary visit to "/".
  const isAssistant =
    params.get('folioAction') === 'quick-log' || params.has('ql')

  if (isAssistant) {
    const rawText = (params.get('ql') ?? params.get('text') ?? '').trim()
    return {
      rawText,
      source: 'assistant',
      type: normalizeType(params.get('type')),
    }
  }

  // ── OS share sheet (Web Share Target GET) ────────────────────────────────
  // Signalled by the presence of any of the shared fields declared in the
  // manifest `share_target.params`.
  const title = params.get('title') ?? ''
  const text = params.get('text') ?? ''
  const url = params.get('url') ?? ''

  if (title || text || url) {
    const rawText = buildSharedText(title, text, url)
    // Nothing meaningful was shared — treat as an ordinary load.
    if (!rawText) return null
    return {
      rawText,
      source: 'share',
      type: 'expense',
    }
  }

  return null
}
