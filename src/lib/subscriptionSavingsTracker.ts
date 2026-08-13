/**
 * Subscription Savings Tracker
 *
 * Tracks cancelled subscriptions and calculates cumulative savings over time.
 * Uses localStorage scoped by user_id for persistence.
 *
 * Validates: Requirements 19.2
 */

// ============================================================================
// Types
// ============================================================================

export interface CancelledSubscription {
  id: string
  label: string
  monthlyAmount: number
  cancelledAt: string // ISO date string (YYYY-MM-DD)
  category: string
}

export interface SubscriptionSavings {
  subscription: CancelledSubscription
  monthsCancelled: number
  savedAmount: number
}

export interface SavingsSummary {
  totalActiveMonthly: number
  totalSavedFromCancellations: number
  items: SubscriptionSavings[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = 'folio_cancelled_subscriptions_'

// ============================================================================
// localStorage helpers
// ============================================================================

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

/**
 * Load cancelled subscriptions from localStorage for a given user.
 */
export function loadCancelledSubscriptions(userId: string): CancelledSubscription[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as CancelledSubscription[]
  } catch {
    return []
  }
}

/**
 * Save cancelled subscriptions to localStorage for a given user.
 */
export function saveCancelledSubscriptions(userId: string, items: CancelledSubscription[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(items))
  } catch {
    // localStorage full or unavailable — degrade gracefully
  }
}

// ============================================================================
// Core logic
// ============================================================================

/**
 * Add a cancelled subscription to the stored list.
 */
export function trackCancelledSubscription(
  userId: string,
  subscription: Omit<CancelledSubscription, 'cancelledAt'> & { cancelledAt?: string }
): CancelledSubscription[] {
  const existing = loadCancelledSubscriptions(userId)

  // Don't duplicate
  if (existing.some(s => s.id === subscription.id)) return existing

  const entry: CancelledSubscription = {
    id: subscription.id,
    label: subscription.label,
    monthlyAmount: subscription.monthlyAmount,
    cancelledAt: subscription.cancelledAt ?? new Date().toISOString().slice(0, 10),
    category: subscription.category,
  }

  const updated = [...existing, entry]
  saveCancelledSubscriptions(userId, updated)
  return updated
}

/**
 * Remove a cancelled subscription from tracking (e.g. if re-subscribed).
 */
export function untrackCancelledSubscription(userId: string, subscriptionId: string): CancelledSubscription[] {
  const existing = loadCancelledSubscriptions(userId)
  const updated = existing.filter(s => s.id !== subscriptionId)
  saveCancelledSubscriptions(userId, updated)
  return updated
}

/**
 * Calculate months elapsed since cancellation date. Uses calendar month
 * difference for a predictable, rounded result.
 */
export function getMonthsSinceCancellation(cancelledAt: string, now?: Date): number {
  const cancelled = new Date(cancelledAt + 'T00:00:00')
  const today = now ?? new Date()

  const yearDiff = today.getFullYear() - cancelled.getFullYear()
  const monthDiff = today.getMonth() - cancelled.getMonth()
  const totalMonths = yearDiff * 12 + monthDiff

  // If we haven't yet passed the day of the month, subtract one
  const dayAdjust = today.getDate() < cancelled.getDate() ? -1 : 0

  return Math.max(0, totalMonths + dayAdjust)
}

/**
 * Calculate savings for a single cancelled subscription.
 */
export function calculateSubscriptionSavings(
  subscription: CancelledSubscription,
  now?: Date
): SubscriptionSavings {
  const monthsCancelled = getMonthsSinceCancellation(subscription.cancelledAt, now)
  return {
    subscription,
    monthsCancelled,
    savedAmount: monthsCancelled * subscription.monthlyAmount,
  }
}

/**
 * Build a full savings summary including per-item breakdowns and totals.
 */
export function buildSavingsSummary(
  cancelledSubscriptions: CancelledSubscription[],
  activeMonthlyTotal: number,
  now?: Date
): SavingsSummary {
  const items = cancelledSubscriptions.map(sub => calculateSubscriptionSavings(sub, now))
  const totalSavedFromCancellations = items.reduce((sum, item) => sum + item.savedAmount, 0)

  return {
    totalActiveMonthly: activeMonthlyTotal,
    totalSavedFromCancellations,
    items,
  }
}

/**
 * Generate a warm, encouraging savings message for a single subscription.
 */
export function getSavingsCopy(savings: SubscriptionSavings): string {
  const { subscription, savedAmount, monthsCancelled } = savings
  if (monthsCancelled === 0) {
    return `Just cancelled ${subscription.label} — savings start next month!`
  }
  const amountStr = `$${savedAmount.toFixed(0)}`
  return `You've saved ${amountStr} since cancelling ${subscription.label} — nice!`
}
