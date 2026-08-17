/**
 * Garden Progress — Pure computation for the progress garden visualization.
 *
 * Maps real engagement metrics to garden element growth stages. Each garden
 * element represents a sustained behavior or milestone category:
 * - Savings Tree: grows with goal completion progress (0–5 goals = stages 0–5)
 * - Tracking Flower: blooms with streak length (0/7/14/30/60/100 = petal stages)
 * - Consistency Grass: fills in with total active days (0/10/30/60/100/200)
 * - Challenge Bushes: grow with completed challenges (0/5/10/25)
 * - Awareness Pond: expands with total spending tracked (0/$1K/$5K/$10K/$50K)
 *
 * Garden never decays — growth stage is always max(current, previous).
 *
 * Requirements: 25.3
 */

// ============================================================================
// Types
// ============================================================================

export type GardenElementType =
  | 'savings_tree'
  | 'tracking_flower'
  | 'consistency_grass'
  | 'challenge_bushes'
  | 'awareness_pond'

export type Season = 'spring' | 'summer' | 'fall' | 'winter'

export interface GardenElement {
  /** Element identifier */
  type: GardenElementType
  /** Display name */
  label: string
  /** Current growth stage (0 = dormant, higher = more grown) */
  stage: number
  /** Maximum possible stage for this element */
  maxStage: number
  /** Friendly description of what drives this element */
  description: string
}

export interface GardenState {
  /** All garden elements with their current growth stages */
  elements: GardenElement[]
  /** Current season (affects visual palette) */
  season: Season
  /** How many elements are actively growing (stage > 0) */
  activeCount: number
  /** Total elements */
  totalCount: number
}

export interface GardenMetrics {
  /** Number of completed goals */
  completedGoals: number
  /** Current streak length in days */
  currentStreak: number
  /** Total active days tracked */
  totalActiveDays: number
  /** Number of completed challenges */
  completedChallenges: number
  /** Total spending amount tracked (dollars) */
  totalSpendingTracked: number
}

// ============================================================================
// Season Determination
// ============================================================================

/**
 * Determines the current season based on the month (Northern Hemisphere).
 * Spring: Mar–May, Summer: Jun–Aug, Fall: Sep–Nov, Winter: Dec–Feb.
 */
export function getSeason(date: Date = new Date()): Season {
  const month = date.getMonth() // 0-indexed
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

// ============================================================================
// Growth Stage Computation
// ============================================================================

/** Savings Tree: stages 0–5 based on completed goals (0/1/2/3/4/5) */
function computeSavingsTreeStage(completedGoals: number): number {
  if (completedGoals >= 5) return 5
  return Math.min(5, completedGoals)
}

/** Tracking Flower: stages 0–5 based on streak thresholds */
function computeTrackingFlowerStage(currentStreak: number): number {
  if (currentStreak >= 100) return 5
  if (currentStreak >= 60) return 4
  if (currentStreak >= 30) return 3
  if (currentStreak >= 14) return 2
  if (currentStreak >= 7) return 1
  return 0
}

/** Consistency Grass: stages 0–5 based on total active days */
function computeConsistencyGrassStage(totalActiveDays: number): number {
  if (totalActiveDays >= 200) return 5
  if (totalActiveDays >= 100) return 4
  if (totalActiveDays >= 60) return 3
  if (totalActiveDays >= 30) return 2
  if (totalActiveDays >= 10) return 1
  return 0
}

/** Challenge Bushes: stages 0–3 based on completed challenges */
function computeChallengeBushesStage(completedChallenges: number): number {
  if (completedChallenges >= 25) return 3
  if (completedChallenges >= 10) return 2
  if (completedChallenges >= 5) return 1
  return 0
}

/** Awareness Pond: stages 0–4 based on total spending tracked */
function computeAwarenessPondStage(totalSpendingTracked: number): number {
  if (totalSpendingTracked >= 50000) return 4
  if (totalSpendingTracked >= 10000) return 3
  if (totalSpendingTracked >= 5000) return 2
  if (totalSpendingTracked >= 1000) return 1
  return 0
}

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Computes the full garden state from the user's engagement metrics.
 * Garden never decays — only grows or stays the same.
 */
export function computeGardenState(metrics: GardenMetrics): GardenState {
  const elements: GardenElement[] = [
    {
      type: 'savings_tree',
      label: 'Savings Tree',
      stage: computeSavingsTreeStage(metrics.completedGoals),
      maxStage: 5,
      description: 'Grows with each savings goal you complete',
    },
    {
      type: 'tracking_flower',
      label: 'Tracking Flower',
      stage: computeTrackingFlowerStage(metrics.currentStreak),
      maxStage: 5,
      description: 'Blooms as your logging streak grows',
    },
    {
      type: 'consistency_grass',
      label: 'Consistency Grass',
      stage: computeConsistencyGrassStage(metrics.totalActiveDays),
      maxStage: 5,
      description: 'Fills in with each day you track',
    },
    {
      type: 'challenge_bushes',
      label: 'Challenge Bushes',
      stage: computeChallengeBushesStage(metrics.completedChallenges),
      maxStage: 3,
      description: 'Grow with each challenge you finish',
    },
    {
      type: 'awareness_pond',
      label: 'Awareness Pond',
      stage: computeAwarenessPondStage(metrics.totalSpendingTracked),
      maxStage: 4,
      description: 'Expands as you build spending awareness',
    },
  ]

  const activeCount = elements.filter((e) => e.stage > 0).length

  return {
    elements,
    season: getSeason(),
    activeCount,
    totalCount: elements.length,
  }
}

// ============================================================================
// Season Color Palettes (for SVG rendering)
// ============================================================================

export interface SeasonPalette {
  sky: string
  ground: string
  foliage: string
  water: string
  accent: string
}

export const SEASON_PALETTES: Record<Season, SeasonPalette> = {
  spring: {
    sky: '#1a1a3a',
    ground: '#1a2e1a',
    foliage: '#4ade80',
    water: '#60a5fa',
    accent: '#f9a8d4',
  },
  summer: {
    sky: '#1a1a2e',
    ground: '#1a2e1a',
    foliage: '#22c55e',
    water: '#38bdf8',
    accent: '#fbbf24',
  },
  fall: {
    sky: '#1f1a2e',
    ground: '#2e1f1a',
    foliage: '#fb923c',
    water: '#818cf8',
    accent: '#ef4444',
  },
  winter: {
    sky: '#12121f',
    ground: '#1a1a2e',
    foliage: '#94a3b8',
    water: '#a5b4fc',
    accent: '#e2e8f0',
  },
}
