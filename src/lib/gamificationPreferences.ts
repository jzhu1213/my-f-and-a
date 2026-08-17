// ============================================================================
// Gamification Preferences — master toggle + per-feature controls for
// streaks, challenges, milestones, progress garden, and celebration intensity.
// ============================================================================
//
// Follows the same localStorage getter/setter pattern as uiPreferences.ts.
// When the master toggle (gamificationEnabled) is OFF, all sub-features are
// treated as OFF regardless of their individual settings.
//
// Requirements: 25.5

// ============================================================================
// Types
// ============================================================================

/** Celebration intensity level — separate from reduced-motion. */
export type CelebrationIntensity = 'full' | 'subtle' | 'off'

/** Complete gamification preferences shape. */
export interface GamificationPreferences {
  /** Master toggle — off = zero gamification UI anywhere. */
  gamificationEnabled: boolean
  /** Streak counter on home screen. */
  streakCounterEnabled: boolean
  /** Challenges feature. */
  challengesEnabled: boolean
  /** Milestone celebrations feature. */
  milestoneCelebrationsEnabled: boolean
  /** Progress garden visualization. */
  progressGardenEnabled: boolean
  /**
   * Celebration style:
   * - 'full': confetti + overlay + message
   * - 'subtle': brief message only
   * - 'off': no celebrations
   */
  celebrationIntensity: CelebrationIntensity
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'folio-gamification-prefs'

const DEFAULT_PREFS: GamificationPreferences = {
  gamificationEnabled: true,
  streakCounterEnabled: true,
  challengesEnabled: true,
  milestoneCelebrationsEnabled: true,
  progressGardenEnabled: true,
  celebrationIntensity: 'full',
}

// ============================================================================
// Persistence — getters & setters
// ============================================================================

/**
 * Load gamification preferences from localStorage.
 * Returns defaults (all ON, celebration = full) for new users.
 */
export function getGamificationPreferences(): GamificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFS
    const parsed = JSON.parse(stored) as Partial<GamificationPreferences>
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return DEFAULT_PREFS
  }
}

/**
 * Persist gamification preferences to localStorage.
 */
export function setGamificationPreferences(prefs: GamificationPreferences): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// Convenience helpers — resolved (respects master toggle)
// ============================================================================

/**
 * Returns whether the streak counter should be visible.
 * True only when BOTH the master toggle AND streakCounterEnabled are ON.
 */
export function isStreakCounterActive(): boolean {
  const prefs = getGamificationPreferences()
  return prefs.gamificationEnabled && prefs.streakCounterEnabled
}

/**
 * Returns whether challenges are active.
 */
export function isChallengesActive(): boolean {
  const prefs = getGamificationPreferences()
  return prefs.gamificationEnabled && prefs.challengesEnabled
}

/**
 * Returns whether milestone celebrations are active.
 */
export function isMilestoneCelebrationsActive(): boolean {
  const prefs = getGamificationPreferences()
  return prefs.gamificationEnabled && prefs.milestoneCelebrationsEnabled
}

/**
 * Returns whether the progress garden is active.
 */
export function isProgressGardenActive(): boolean {
  const prefs = getGamificationPreferences()
  return prefs.gamificationEnabled && prefs.progressGardenEnabled
}

/**
 * Returns the effective celebration intensity.
 * If the master toggle is OFF, returns 'off' regardless of the stored value.
 */
export function getEffectiveCelebrationIntensity(): CelebrationIntensity {
  const prefs = getGamificationPreferences()
  if (!prefs.gamificationEnabled) return 'off'
  return prefs.celebrationIntensity
}
