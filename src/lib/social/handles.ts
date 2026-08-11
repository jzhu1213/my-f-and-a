/**
 * Handle validation utilities for profile discovery (task 277.2).
 *
 * Handles are 3–20 lowercase alphanumeric + underscore characters.
 * The DB enforces uniqueness via a citext unique index; this module
 * provides client-side validation and normalization.
 */

/** Regex enforcing valid handle format: 3–20 chars, [a-z0-9_] only */
export const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/

/** Error messages for handle validation */
export const HANDLE_ERRORS = {
  length: 'Handles must be 3–20 characters',
  chars: 'Only lowercase letters, numbers, and underscores',
  collision: "That handle's taken — try another",
} as const

/**
 * Validate a handle string.
 * Returns `{ valid: true }` or `{ valid: false, error: string }`.
 */
export function validateHandle(handle: string): { valid: boolean; error?: string } {
  if (handle.length < 3 || handle.length > 20) {
    return { valid: false, error: HANDLE_ERRORS.length }
  }
  if (!HANDLE_REGEX.test(handle)) {
    return { valid: false, error: HANDLE_ERRORS.chars }
  }
  return { valid: true }
}

/**
 * Normalize user input into handle format:
 * - Strip leading `@` if present
 * - Lowercase everything
 */
export function normalizeHandle(input: string): string {
  const stripped = input.startsWith('@') ? input.slice(1) : input
  return stripped.toLowerCase()
}
