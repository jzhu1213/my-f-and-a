// ============================================================================
// Resilient Fetch — wraps Supabase operations with timeout, retry, and
// structured error results. No unhandled promise rejections reach the user.
// Requirements: 28.6
// ============================================================================

// ── Types ──────────────────────────────────────────────────────────────────────

/** Structured error returned when a Supabase operation fails */
export interface ApiError {
  message: string           // User-friendly message
  isTransient: boolean      // Whether a retry might succeed
  code?: string             // Error code from Supabase/network
  originalError?: unknown   // For debugging
}

/** Discriminated result type — either success or structured failure */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

// ── Configuration ──────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000          // 10 second max per attempt
const MAX_RETRIES = 3              // 3 attempts total for transient errors
const BASE_BACKOFF_MS = 1_000      // Exponential backoff: 1s, 2s, 4s

// ── User-Facing Messages ───────────────────────────────────────────────────────

const MESSAGES = {
  network: "Couldn't reach the server — check your connection and try again",
  server: "Something went wrong on our end — trying again...",
  exhausted: "Still having trouble connecting. Your data is safe — we'll sync when you're back online.",
  unknown: "Something unexpected happened — please try again",
} as const

// ── Error Classification ───────────────────────────────────────────────────────

/**
 * Determines whether an error is transient (retry-eligible) or permanent.
 * Transient: network errors, timeouts, 5xx server errors.
 * Permanent: 4xx client errors (bad request, unauthorized, not found, etc.)
 */
function isTransientError(error: unknown): boolean {
  if (!error) return false

  // Timeout errors
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && error.message.includes('timeout')) return true

  // Network errors (fetch failures, no internet)
  if (error instanceof TypeError && error.message.includes('fetch')) return true
  if (error instanceof Error && error.message.includes('network')) return true
  if (error instanceof Error && error.message.includes('Failed to fetch')) return true

  // Supabase PostgrestError shape: { code, message, details, hint }
  const supaError = error as { code?: string; message?: string; status?: number }

  // HTTP status-based classification
  if (supaError.status !== undefined) {
    return supaError.status >= 500 || supaError.status === 0
  }

  // Supabase error codes — connection/timeout related
  if (supaError.code === 'PGRST301' || supaError.code === '57014') return true // timeout
  if (supaError.code === '08000' || supaError.code === '08006') return true // connection

  return false
}

/**
 * Builds a user-friendly message based on the error type.
 */
function getUserMessage(error: unknown, retriesRemaining: number): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return retriesRemaining > 0 ? MESSAGES.server : MESSAGES.network
  }
  if (error instanceof TypeError) {
    return MESSAGES.network
  }

  const supaError = error as { status?: number }
  if (supaError.status !== undefined && supaError.status >= 500) {
    return retriesRemaining > 0 ? MESSAGES.server : MESSAGES.exhausted
  }

  return MESSAGES.unknown
}

/**
 * Extracts a code string from various error shapes for structured logging.
 */
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof DOMException) return error.name
  const shaped = error as { code?: string; status?: number }
  if (shaped.code) return shaped.code
  if (shaped.status !== undefined) return `HTTP_${shaped.status}`
  return undefined
}

// ── Timeout Utility ────────────────────────────────────────────────────────────

/**
 * Races an operation against a timeout. Returns the operation result or throws
 * an AbortError if the timeout fires first.
 */
function withTimeout<T>(operation: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DOMException('Operation timed out', 'AbortError'))
    }, ms)

    operation()
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

// ── Sleep Utility ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Core Resilient Wrapper ─────────────────────────────────────────────────────

/**
 * Wraps a Supabase operation with timeout (10s), retry (3 attempts for transient
 * errors), and structured error results. Catches ALL promise rejections.
 *
 * @param operation - An async function that performs the Supabase call
 * @param operationName - A label for structured logging (e.g., 'getTransactions')
 * @returns ApiResult<T> — never throws
 */
export async function withResilience<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<ApiResult<T>> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await withTimeout(operation, TIMEOUT_MS)
      return { ok: true, data: result }
    } catch (err: unknown) {
      lastError = err
      const retriesRemaining = MAX_RETRIES - attempt - 1

      // Don't retry permanent errors
      if (!isTransientError(err)) {
        const message = getUserMessage(err, 0)
        console.error(`[resilientFetch] ${operationName} failed (permanent):`, err)
        return {
          ok: false,
          error: {
            message,
            isTransient: false,
            code: getErrorCode(err),
            originalError: err,
          },
        }
      }

      // Log the retry attempt
      if (retriesRemaining > 0) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
        console.warn(
          `[resilientFetch] ${operationName} attempt ${attempt + 1}/${MAX_RETRIES} failed (transient), retrying in ${backoff}ms...`
        )
        await sleep(backoff)
      }
    }
  }

  // All retries exhausted
  console.error(`[resilientFetch] ${operationName} failed after ${MAX_RETRIES} attempts:`, lastError)
  return {
    ok: false,
    error: {
      message: MESSAGES.exhausted,
      isTransient: true,
      code: getErrorCode(lastError),
      originalError: lastError,
    },
  }
}

// ── Supabase-Aware Wrapper ─────────────────────────────────────────────────────

/**
 * A convenience wrapper that handles the Supabase `{ data, error }` response
 * pattern. If Supabase returns an error in the response body (rather than
 * throwing), this classifies it and applies retry logic accordingly.
 *
 * @param operation - Async function returning Supabase `{ data, error }` shape
 * @param operationName - Label for structured logging
 * @returns ApiResult<T> — never throws
 */
export async function withSupabaseResilience<T>(
  operation: () => Promise<{ data: T; error: unknown }>,
  operationName: string
): Promise<ApiResult<T>> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await withTimeout(operation, TIMEOUT_MS)

      // Supabase returned successfully but with an error in the response
      if (error) {
        const retriesRemaining = MAX_RETRIES - attempt - 1

        if (!isTransientError(error)) {
          console.error(`[resilientFetch] ${operationName} failed (permanent):`, error)
          return {
            ok: false,
            error: {
              message: getUserMessage(error, 0),
              isTransient: false,
              code: getErrorCode(error),
              originalError: error,
            },
          }
        }

        lastError = error
        if (retriesRemaining > 0) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
          console.warn(
            `[resilientFetch] ${operationName} attempt ${attempt + 1}/${MAX_RETRIES} failed (transient), retrying in ${backoff}ms...`
          )
          await sleep(backoff)
          continue
        }
        break
      }

      return { ok: true, data }
    } catch (err: unknown) {
      lastError = err
      const retriesRemaining = MAX_RETRIES - attempt - 1

      if (!isTransientError(err)) {
        console.error(`[resilientFetch] ${operationName} failed (permanent):`, err)
        return {
          ok: false,
          error: {
            message: getUserMessage(err, 0),
            isTransient: false,
            code: getErrorCode(err),
            originalError: err,
          },
        }
      }

      if (retriesRemaining > 0) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt)
        console.warn(
          `[resilientFetch] ${operationName} attempt ${attempt + 1}/${MAX_RETRIES} failed (transient), retrying in ${backoff}ms...`
        )
        await sleep(backoff)
      }
    }
  }

  // All retries exhausted
  console.error(`[resilientFetch] ${operationName} failed after ${MAX_RETRIES} attempts:`, lastError)
  return {
    ok: false,
    error: {
      message: MESSAGES.exhausted,
      isTransient: true,
      code: getErrorCode(lastError),
      originalError: lastError,
    },
  }
}
