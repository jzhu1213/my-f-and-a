// ============================================================================
// Home Widgets — Pinned card system for the home screen
// ============================================================================
//
// Requirement 18.6 — Pinnable home cards
//
// Users can pin up to 3 compact, glanceable cards below the hero section.
// Cards are never auto-populated; all pinning is user-initiated. Stored in
// localStorage following the same opt-in pattern as uiPreferences.ts.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The types of cards a user can pin to the home screen.
 */
export type PinnedCardType =
  | 'goal_progress'
  | 'top_obligation'
  | 'savings_snapshot'
  | 'income_tracker'
  | 'spend_pace'
  | 'upcoming_bill'
  | 'shared_budget'
  | 'confidence'
  | 'progress_garden'

/**
 * A single pinned card configuration.
 */
export interface PinnedCard {
  type: PinnedCardType
  /** Optional per-card config (e.g. which goal to track). Reserved for future use. */
  config?: Record<string, unknown>
}

/** Maximum number of pinned cards allowed on the home screen. */
export const MAX_PINNED_CARDS = 3

/**
 * Card metadata — label, emoji, and description for each card type.
 * Used in the pin management UI and compact card headers.
 */
export const CARD_META: Record<PinnedCardType, { label: string; emoji: string; description: string }> = {
  goal_progress: {
    label: 'Goal Progress',
    emoji: '🎯',
    description: 'See how close you are to your savings goal',
  },
  top_obligation: {
    label: 'Top Obligation',
    emoji: '📋',
    description: 'Your highest upcoming bill or recurring expense',
  },
  savings_snapshot: {
    label: 'Savings Snapshot',
    emoji: '🐷',
    description: 'A quick glance at your total savings balance',
  },
  income_tracker: {
    label: 'Income Tracker',
    emoji: '💵',
    description: 'Track income received this month vs. expected',
  },
  spend_pace: {
    label: 'Spend Pace',
    emoji: '📈',
    description: 'Are you spending faster or slower than usual?',
  },
  upcoming_bill: {
    label: 'Upcoming Bill',
    emoji: '🔔',
    description: 'Your next bill due date and amount',
  },
  shared_budget: {
    label: 'Shared Budget',
    emoji: '🤝',
    description: 'See remaining balance in your shared budget',
  },
  confidence: {
    label: 'Confidence',
    emoji: '✨',
    description: 'Your money confidence tier and trend',
  },
  progress_garden: {
    label: 'Progress Garden',
    emoji: '🌱',
    description: 'A living garden that grows with your engagement',
  },
}

/** All available card types in display order. */
export const ALL_CARD_TYPES: PinnedCardType[] = [
  'goal_progress',
  'top_obligation',
  'savings_snapshot',
  'income_tracker',
  'spend_pace',
  'upcoming_bill',
  'shared_budget',
  'confidence',
  'progress_garden',
]

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'folio-pinned-home-cards'

/**
 * Reads the user's pinned cards from localStorage.
 * Returns an empty array by default (home screen stays minimal).
 */
export function getPinnedCards(): PinnedCard[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    // Validate and cap at MAX_PINNED_CARDS
    return parsed
      .filter(
        (item: unknown): item is PinnedCard =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          ALL_CARD_TYPES.includes((item as PinnedCard).type)
      )
      .slice(0, MAX_PINNED_CARDS)
  } catch {
    return []
  }
}

/**
 * Persists the user's pinned cards to localStorage.
 * Enforces the MAX_PINNED_CARDS limit.
 */
export function setPinnedCards(cards: PinnedCard[]): void {
  if (typeof window === 'undefined') return
  try {
    const capped = cards.slice(0, MAX_PINNED_CARDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Adds a card to the pinned list (if under the limit and not already pinned).
 * Returns the updated list.
 */
export function addPinnedCard(type: PinnedCardType, config?: Record<string, unknown>): PinnedCard[] {
  const current = getPinnedCards()
  if (current.length >= MAX_PINNED_CARDS) return current
  if (current.some(c => c.type === type)) return current
  const updated = [...current, { type, config }]
  setPinnedCards(updated)
  return updated
}

/**
 * Removes a card from the pinned list by type.
 * Returns the updated list.
 */
export function removePinnedCard(type: PinnedCardType): PinnedCard[] {
  const current = getPinnedCards()
  const updated = current.filter(c => c.type !== type)
  setPinnedCards(updated)
  return updated
}

/**
 * Reorders pinned cards by moving the card at `fromIndex` to `toIndex`.
 * Returns the updated list.
 */
export function reorderPinnedCards(fromIndex: number, toIndex: number): PinnedCard[] {
  const current = getPinnedCards()
  if (fromIndex < 0 || fromIndex >= current.length) return current
  if (toIndex < 0 || toIndex >= current.length) return current
  const updated = [...current]
  const [moved] = updated.splice(fromIndex, 1)
  updated.splice(toIndex, 0, moved)
  setPinnedCards(updated)
  return updated
}
