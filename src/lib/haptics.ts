/**
 * Haptic feedback utility for Folio.
 *
 * Provides subtle vibration feedback on key actions when the device supports
 * it (via `navigator.vibrate`). Degrades silently on unsupported devices
 * (e.g. iOS Safari) — no errors, no fallback noise.
 *
 * Validates: Requirement 2.7
 */

export type HapticIntensity = "light" | "medium" | "success"

/** Vibration patterns (in milliseconds) for each intensity level. */
const PATTERNS: Record<HapticIntensity, number | number[]> = {
  /** Light tap — category selection, minor interactions. */
  light: 10,
  /** Medium pulse — expense logged, confirmations. */
  medium: 15,
  /** Success pattern — celebrations, milestones. */
  success: [10, 50, 10],
}

/**
 * Trigger a subtle haptic vibration if the device supports it.
 *
 * @param intensity - The feedback intensity/pattern to use.
 *   - `"light"` (10ms) — category taps, minor selections
 *   - `"medium"` (15ms) — expense logged, confirmations
 *   - `"success"` ([10, 50, 10]ms) — celebrations, milestones
 *
 * Silently no-ops if `navigator.vibrate` is unavailable.
 */
export function triggerHaptic(intensity: HapticIntensity = "medium"): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(PATTERNS[intensity])
    }
  } catch {
    // Silently degrade — haptic is a progressive enhancement.
  }
}
