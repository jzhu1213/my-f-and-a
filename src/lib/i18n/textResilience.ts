// ============================================================================
// Text Resilience Testing Utility
// ============================================================================
//
// Task 517.1 & 517.2 — Dynamic text length handling.
//
// Utilities for testing UI robustness with artificially stretched or shortened
// strings. German/French translations are typically 30–40% longer than English;
// Chinese/Japanese are often 50–70% shorter. These helpers simulate those
// extremes so layout issues (overflow, truncation, misalignment) surface during
// development rather than after shipping a new locale.
//
// Usage (dev only):
//   import { stretchString, shrinkString } from '@/lib/i18n/textResilience'
//   const longLabel = stretchString('Save', 2.0) // "Saveeee Saveeee"
//   const shortLabel = shrinkString('Transactions', 0.4) // "Tran"

/**
 * Stretch a string to simulate longer translations (e.g. German ~1.35×, doubled
 * for stress testing at 2.0×). Uses padding characters and repetition.
 *
 * @param text - The original English string
 * @param factor - Multiplier for length (1.0 = no change, 2.0 = double)
 * @returns A stretched pseudo-translation
 */
export function stretchString(text: string, factor: number = 2.0): string {
  if (factor <= 1.0 || text.length === 0) return text
  const targetLength = Math.ceil(text.length * factor)
  // Repeat the text and pad with accented chars to simulate translation weight
  const padChar = '\u00E9' // é — visually distinct from English, signals pseudo-locale
  const repeated = text.repeat(Math.ceil(factor))
  return repeated.slice(0, targetLength).padEnd(targetLength, padChar)
}

/**
 * Shrink a string to simulate shorter translations (e.g. CJK languages).
 *
 * @param text - The original English string
 * @param factor - Multiplier for length (0.4 = 40% of original)
 * @returns A truncated version of the string
 */
export function shrinkString(text: string, factor: number = 0.4): string {
  if (factor >= 1.0 || text.length === 0) return text
  const targetLength = Math.max(1, Math.ceil(text.length * factor))
  return text.slice(0, targetLength)
}

/**
 * Apply stretch/shrink to an entire translation bundle (Record<string, string>).
 * Useful for rendering the whole app in a pseudo-locale to find layout breaks.
 *
 * @param bundle - A translation resource (key → string)
 * @param factor - Length multiplier (>1 stretches, <1 shrinks)
 * @returns A new bundle with all values transformed
 */
export function transformBundle<T extends Record<string, string>>(
  bundle: T,
  factor: number
): T {
  const transform = factor >= 1.0 ? stretchString : shrinkString
  const result = {} as Record<string, string>
  for (const [key, value] of Object.entries(bundle)) {
    result[key] = transform(value, factor)
  }
  return result as T
}

/**
 * Standard test factors for common i18n stress scenarios.
 */
export const TEXT_RESILIENCE_FACTORS = {
  /** German-like expansion (~35% longer) */
  german: 1.35,
  /** French-like expansion (~40% longer) */
  french: 1.4,
  /** Stress test — double length */
  doubled: 2.0,
  /** CJK-like contraction (~40% of original) */
  cjk: 0.4,
  /** Minimal — single characters */
  minimal: 0.15,
} as const
