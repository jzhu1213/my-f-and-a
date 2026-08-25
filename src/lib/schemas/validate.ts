/**
 * Schema validation utilities — wraps Zod for safe parsing with quarantine semantics.
 *
 * Task 520.1
 */

import type { ZodSchema } from 'zod'

/** Result of validating an array of items against a schema. */
export interface ValidateArrayResult<T> {
  /** Items that passed validation */
  valid: T[]
  /** Items that failed validation (original data preserved for debugging) */
  quarantined: unknown[]
  /** Total items processed */
  count: number
}

/**
 * Validate an array of items against a Zod schema.
 * Items that fail validation are quarantined (excluded) — the app never crashes.
 */
export function validateArray<T>(
  data: unknown[],
  schema: ZodSchema<T>,
  context?: string
): ValidateArrayResult<T> {
  const valid: T[] = []
  const quarantined: unknown[] = []

  for (const item of data) {
    const result = schema.safeParse(item)
    if (result.success) {
      valid.push(result.data)
    } else {
      quarantined.push(item)
    }
  }

  if (quarantined.length > 0 && context) {
    console.warn(`[Schema] Quarantined ${quarantined.length} rows from ${context}`)
  }

  return { valid, quarantined, count: data.length }
}

/**
 * Validate a single item against a Zod schema.
 * Returns the validated data or null if it fails.
 */
export function validateSingle<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context?: string
): T | null {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }
  if (context) {
    console.warn(`[Schema] Validation failed for ${context}:`, result.error.issues)
  }
  return null
}
