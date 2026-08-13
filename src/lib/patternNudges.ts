/**
 * Pattern-Based Notification Triggers — context-aware nudges driven by
 * spending history patterns.
 * ============================================================================
 *
 * Task 346.1, 346.2, 346.3. Detects patterns from the last 2–4 weeks of
 * transaction history and produces warm, non-judgmental nudge candidates
 * that integrate with the existing smart notification infrastructure.
 *
 * Pattern categories:
 *  - Recurring merchant at a time-of-day ("coffee time")
 *  - High-spend day-of-week (Fridays tend to be spendy)
 *  - Under-budget streaks (positive reinforcement)
 *  - Bill due with coverage context ("you're covered" vs "it's tight")
 *
 * Design:
 *  - Pure detection functions — no I/O inside the decision layer
 *  - Own preferences with per-category toggles + DND hours
 *  - Produces `NotificationPayload` objects for `fireSmartNotification()`
 *  - Integrates with `shouldSuppressNotification()` from engagementTracker
 *  - Requires 2+ weeks of history before activating (graceful silence below)
 *
 * Requirements: 18.7
 */

import type { Transaction } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"
import type { DailyAllowance } from "@/types/folio"
import type { NotificationPayload } from "@/lib/smartNotifications"
import { shouldSuppressNotification } from "./engagementTracker"
import { getOptimalNudgeTime } from "./notificationTimingIntelligence"

// ============================================================================
// Types
// ============================================================================

/** Per-category nudge toggles + do-not-disturb window. */
export interface PatternNudgePreferences {
  /** Spending pattern reminders — coffee time, high-spend day (default: enabled) */
  spendingRemindersEnabled: boolean
  /** Bill coverage context alerts — "you're covered" / "heads up" (default: enabled) */
  billAlertsEnabled: boolean
  /** Streak/encouragement nudges — under-budget streaks (default: enabled) */
  streaksEnabled: boolean
  /** Do-not-disturb start hour (0–23, default: 22 → 10 PM) */
  dndStartHour: number
  /** Do-not-disturb end hour (0–23, default: 8 → 8 AM) */
  dndEndHour: number
  /** Last fired keys to prevent duplicate nudges */
  lastFired: {
    /** ISO date the coffee-time nudge last fired */
    coffeeMerchant: string | null
    /** ISO date the high-spend-day nudge last fired */
    highSpendDay: string | null
    /** ISO date the streak nudge last fired */
    streak: string | null
    /** billId → ISO date for bill-coverage nudges */
    billCoverage: Record<string, string>
  }
}

/** A detected recurring merchant pattern (time-of-day + merchant note). */
export interface MerchantTimePattern {
  /** The merchant/note string (normalized) */
  merchant: string
  /** Typical hour of day (0–23) */
  typicalHour: number
  /** Number of occurrences in the analysis window */
  occurrences: number
  /** Average amount spent */
  averageAmount: number
}

/** A detected high-spend day-of-week pattern. */
export interface HighSpendDayPattern {
  /** Day of week (0 = Sunday, 6 = Saturday) */
  dayOfWeek: number
  /** Friendly label ("Fridays", "Saturdays", etc.) */
  dayLabel: string
  /** Average spend on this day vs overall average (ratio > 1.3 = "high") */
  spendRatio: number
  /** Average spend amount on this day */
  averageSpend: number
}

/** Nudge candidate produced by the pattern engine. */
export interface PatternNudgeCandidate {
  /** The nudge type for deduplication */
  type: "coffee_merchant" | "high_spend_day" | "bill_coverage" | "streak"
  /** The notification payload ready for firing */
  payload: NotificationPayload
  /** Priority (higher = more important, used when multiple candidates compete) */
  priority: number
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "folio_pattern_nudge_prefs"

/** Minimum weeks of history required for pattern detection to activate. */
const MIN_WEEKS_FOR_PATTERNS = 2

/** Minimum occurrences of a merchant in the window to be considered a pattern. */
const MIN_MERCHANT_OCCURRENCES = 3

/** Ratio threshold — a day-of-week must spend 1.3× the overall average to qualify. */
const HIGH_SPEND_DAY_RATIO = 1.3

/** Minimum consecutive under-budget days to trigger a streak nudge. */
const MIN_STREAK_DAYS = 5

const DAY_LABELS: Record<number, string> = {
  0: "Sundays",
  1: "Mondays",
  2: "Tuesdays",
  3: "Wednesdays",
  4: "Thursdays",
  5: "Fridays",
  6: "Saturdays",
}

const DEFAULT_PREFS: PatternNudgePreferences = {
  spendingRemindersEnabled: true,
  billAlertsEnabled: true,
  streaksEnabled: true,
  dndStartHour: 22,
  dndEndHour: 8,
  lastFired: {
    coffeeMerchant: null,
    highSpendDay: null,
    streak: null,
    billCoverage: {},
  },
}

// ============================================================================
// Persistence
// ============================================================================

/** Load pattern nudge preferences from localStorage. */
export function getPatternNudgePrefs(): PatternNudgePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFS
    const parsed = JSON.parse(stored) as Partial<PatternNudgePreferences>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      lastFired: {
        ...DEFAULT_PREFS.lastFired,
        ...(parsed.lastFired ?? {}),
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** Save pattern nudge preferences to localStorage. */
export function setPatternNudgePrefs(prefs: PatternNudgePreferences): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// DND check
// ============================================================================

/**
 * Returns true if the current hour falls within the user's do-not-disturb window.
 * Handles wrap-around (e.g., 22:00 → 08:00).
 */
export function isInDndWindow(currentHour: number, prefs: PatternNudgePreferences): boolean {
  const { dndStartHour, dndEndHour } = prefs
  if (dndStartHour === dndEndHour) return false // DND disabled (same start/end)

  if (dndStartHour < dndEndHour) {
    // Simple range (e.g., 9–17)
    return currentHour >= dndStartHour && currentHour < dndEndHour
  }
  // Wrap-around range (e.g., 22–8)
  return currentHour >= dndStartHour || currentHour < dndEndHour
}

// ============================================================================
// Pattern Detection (pure)
// ============================================================================

/**
 * Detect recurring merchant patterns from transaction history.
 * Looks for merchants that appear 3+ times in the analysis window with a
 * consistent time-of-day pattern (within a ±2 hour window).
 */
export function detectMerchantTimePatterns(
  transactions: Transaction[],
  windowWeeks: number = 4
): MerchantTimePattern[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowWeeks * 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Only expenses with notes, within the window
  const relevant = transactions.filter(
    (t) => t.type === "expense" && t.note && t.note.trim().length > 0 && t.date >= cutoffStr
  )

  // Group by normalized note
  const byMerchant = new Map<string, { hours: number[]; amounts: number[] }>()

  for (const tx of relevant) {
    const key = tx.note!.toLowerCase().trim()
    if (!byMerchant.has(key)) {
      byMerchant.set(key, { hours: [], amounts: [] })
    }
    const entry = byMerchant.get(key)!
    // Extract hour from createdAt (when the user actually logged it — proxy for time of purchase)
    const hour = new Date(tx.createdAt).getHours()
    entry.hours.push(hour)
    entry.amounts.push(tx.amount)
  }

  const patterns: MerchantTimePattern[] = []

  for (const [merchant, { hours, amounts }] of byMerchant) {
    if (hours.length < MIN_MERCHANT_OCCURRENCES) continue

    // Find the median hour as the "typical" time
    const sortedHours = [...hours].sort((a, b) => a - b)
    const medianHour = sortedHours[Math.floor(sortedHours.length / 2)]

    // Check that most occurrences cluster within ±2 hours of the median
    const clustered = hours.filter((h) => Math.abs(h - medianHour) <= 2).length
    if (clustered / hours.length < 0.6) continue // Not a consistent time pattern

    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length

    patterns.push({
      merchant,
      typicalHour: medianHour,
      occurrences: hours.length,
      averageAmount: Math.round(avgAmount * 100) / 100,
    })
  }

  // Sort by occurrences descending
  return patterns.sort((a, b) => b.occurrences - a.occurrences)
}

/**
 * Detect the highest-spend day-of-week from transaction history.
 * Returns days that are 1.3× the overall daily average.
 */
export function detectHighSpendDays(
  transactions: Transaction[],
  windowWeeks: number = 4
): HighSpendDayPattern[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowWeeks * 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const relevant = transactions.filter(
    (t) => t.type === "expense" && t.date >= cutoffStr
  )

  if (relevant.length < 7) return [] // Not enough data

  // Accumulate spend per day-of-week
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0] // Sun–Sat
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0]

  for (const tx of relevant) {
    const dayOfWeek = new Date(tx.date + "T12:00:00").getDay()
    dayTotals[dayOfWeek] += tx.amount
    dayCounts[dayOfWeek]++
  }

  // Count unique dates per day-of-week in the window
  const uniqueDatesPerDay: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>())
  for (const tx of relevant) {
    const dayOfWeek = new Date(tx.date + "T12:00:00").getDay()
    uniqueDatesPerDay[dayOfWeek].add(tx.date)
  }

  // Average spend per occurrence of each day-of-week
  const dayAverages = dayTotals.map((total, i) => {
    const numDays = uniqueDatesPerDay[i].size
    return numDays > 0 ? total / numDays : 0
  })

  // Overall average across all days
  const totalDays = uniqueDatesPerDay.reduce((sum, set) => sum + set.size, 0)
  const overallAvg = totalDays > 0 ? dayTotals.reduce((a, b) => a + b, 0) / totalDays : 0

  if (overallAvg <= 0) return []

  const patterns: HighSpendDayPattern[] = []

  for (let i = 0; i < 7; i++) {
    if (uniqueDatesPerDay[i].size < 2) continue // Need at least 2 instances of this weekday
    const ratio = dayAverages[i] / overallAvg
    if (ratio >= HIGH_SPEND_DAY_RATIO) {
      patterns.push({
        dayOfWeek: i,
        dayLabel: DAY_LABELS[i],
        spendRatio: Math.round(ratio * 100) / 100,
        averageSpend: Math.round(dayAverages[i] * 100) / 100,
      })
    }
  }

  return patterns.sort((a, b) => b.spendRatio - a.spendRatio)
}

/**
 * Compute the current under-budget streak (consecutive days where
 * spentToday ≤ dailyBudget). Returns 0 if today is already over budget.
 *
 * `dailySpendByDate` maps YYYY-MM-DD → total spent that day.
 * `dailyBudget` is the flat daily budget for comparison.
 */
export function computeUnderBudgetStreak(
  dailySpendByDate: Record<string, number>,
  dailyBudget: number,
  today: Date
): number {
  if (dailyBudget <= 0) return 0

  let streak = 0
  const check = new Date(today)

  // Walk backward from today
  for (let i = 0; i < 60; i++) {
    const dateStr = check.toISOString().slice(0, 10)
    const spent = dailySpendByDate[dateStr] ?? 0

    if (spent <= dailyBudget) {
      streak++
    } else {
      break
    }

    check.setDate(check.getDate() - 1)
  }

  return streak
}

// ============================================================================
// Nudge Generation (pure decision functions)
// ============================================================================

/** Round to a whole-dollar display string (e.g. 50 → "$50"). */
function formatDollars(amount: number): string {
  return `$${Math.max(0, Math.round(amount))}`
}

/**
 * Check if there's enough history to activate pattern detection.
 * Returns true if the transaction span covers at least MIN_WEEKS_FOR_PATTERNS weeks.
 */
export function hasEnoughHistory(transactions: Transaction[]): boolean {
  if (transactions.length < 5) return false

  const expenses = transactions.filter((t) => t.type === "expense")
  if (expenses.length < 5) return false

  const dates = expenses.map((t) => t.date).sort()
  const earliest = new Date(dates[0] + "T12:00:00")
  const latest = new Date(dates[dates.length - 1] + "T12:00:00")
  const daySpan = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)

  return daySpan >= MIN_WEEKS_FOR_PATTERNS * 7
}

/**
 * Generate the "coffee time" nudge — merchant + time-of-day pattern.
 *
 * "You usually grab coffee around now — you've got $X left today"
 */
export function generateMerchantTimeNudge(
  patterns: MerchantTimePattern[],
  currentHour: number,
  allowanceRemaining: number,
  prefs: PatternNudgePreferences,
  today: string
): PatternNudgeCandidate | null {
  if (!prefs.spendingRemindersEnabled) return null
  if (shouldSuppressNotification("patternCoffeeMerchant")) return null
  if (prefs.lastFired.coffeeMerchant === today) return null

  // Find a pattern whose typical hour is within ±1 hour of now
  const match = patterns.find(
    (p) => Math.abs(p.typicalHour - currentHour) <= 1
  )
  if (!match) return null

  // Capitalize merchant name for display
  const displayMerchant = match.merchant
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

  const body = `You usually grab ${displayMerchant} around now — you've got ${formatDollars(allowanceRemaining)} left today`

  return {
    type: "coffee_merchant",
    payload: {
      title: "Folio",
      body,
      tag: "folio-pattern-merchant-time",
    },
    priority: 2,
  }
}

/**
 * Generate the "high-spend day" nudge — day-of-week pattern.
 *
 * "Fridays tend to be your big-spend day — $X left for today"
 */
export function generateHighSpendDayNudge(
  patterns: HighSpendDayPattern[],
  currentDayOfWeek: number,
  allowanceRemaining: number,
  prefs: PatternNudgePreferences,
  today: string
): PatternNudgeCandidate | null {
  if (!prefs.spendingRemindersEnabled) return null
  if (shouldSuppressNotification("patternHighSpendDay")) return null
  if (prefs.lastFired.highSpendDay === today) return null

  const match = patterns.find((p) => p.dayOfWeek === currentDayOfWeek)
  if (!match) return null

  const body = `${match.dayLabel} tend to be your big-spend day — ${formatDollars(allowanceRemaining)} left for today`

  return {
    type: "high_spend_day",
    payload: {
      title: "Folio",
      body,
      tag: "folio-pattern-high-spend-day",
    },
    priority: 1,
  }
}

/**
 * Generate the "bill coverage" nudge — bill due + coverage context.
 *
 * "Bill due tomorrow — you're covered" or "Bill due tomorrow — heads up, it's tight"
 */
export function generateBillCoverageNudge(
  bills: FixedExpense[],
  allowanceRemaining: number,
  today: Date,
  prefs: PatternNudgePreferences
): PatternNudgeCandidate | null {
  if (!prefs.billAlertsEnabled) return null
  if (shouldSuppressNotification("patternBillCoverage")) return null

  const todayStr = today.toISOString().slice(0, 10)
  const currentDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  for (const bill of bills) {
    if (!bill.isActive) continue

    const effectiveDueDay = Math.min(bill.dueDay, daysInMonth)
    const daysUntilDue = effectiveDueDay - currentDay

    // Only nudge for tomorrow's bills
    if (daysUntilDue !== 1) continue

    // Already fired for this bill today
    if (prefs.lastFired.billCoverage[bill.id] === todayStr) continue

    const isCovered = allowanceRemaining >= bill.amount * 0.5 // generous threshold
    const body = isCovered
      ? `${bill.label} due tomorrow — you're covered`
      : `${bill.label} due tomorrow — heads up, it's tight`

    return {
      type: "bill_coverage",
      payload: {
        title: "Folio",
        body,
        tag: `folio-pattern-bill-${bill.id}`,
      },
      priority: 3, // High priority — bills are time-sensitive
    }
  }

  return null
}

/**
 * Generate the "under-budget streak" nudge — positive reinforcement.
 *
 * "You've stayed under budget 5 days running — nice streak"
 */
export function generateStreakNudge(
  streakDays: number,
  prefs: PatternNudgePreferences,
  today: string
): PatternNudgeCandidate | null {
  if (!prefs.streaksEnabled) return null
  if (shouldSuppressNotification("patternStreak")) return null
  if (prefs.lastFired.streak === today) return null
  if (streakDays < MIN_STREAK_DAYS) return null

  const body = `You've stayed under budget ${streakDays} days running — nice streak`

  return {
    type: "streak",
    payload: {
      title: "Folio",
      body,
      tag: "folio-pattern-streak",
    },
    priority: 0, // Lowest priority — celebratory, not urgent
  }
}

// ============================================================================
// Main orchestrator
// ============================================================================

/** Input context for generating pattern nudges. */
export interface PatternNudgeContext {
  transactions: Transaction[]
  bills: FixedExpense[]
  allowance: DailyAllowance
  dailySpendByDate: Record<string, number>
  now: Date
}

/**
 * Evaluate all pattern nudge rules and return the highest-priority candidate
 * (or null when nothing qualifies). Respects DND hours, per-category toggles,
 * deduplication, and timing intelligence (Task 347.1 — only fire nudges when
 * the current hour is near the user's detected active window).
 *
 * Pure decision function — persistence and firing happen at the call site.
 */
export function selectPatternNudge(
  context: PatternNudgeContext,
  prefs: PatternNudgePreferences
): PatternNudgeCandidate | null {
  const { transactions, bills, allowance, dailySpendByDate, now } = context

  // Respect do-not-disturb
  const currentHour = now.getHours()
  if (isInDndWindow(currentHour, prefs)) return null

  // Timing intelligence gate (Task 347.1): if we have confident data about
  // the user's active windows, only fire pattern nudges within ±1 hour of
  // the optimal nudge time. This prevents nudges at irrelevant hours.
  const timing = getOptimalNudgeTime()
  if (!timing.isFallback) {
    const hourDiff = Math.abs(currentHour - timing.hour)
    // Allow ±2 hour window around the detected optimal time
    if (hourDiff > 2 && hourDiff < 22) return null // (22 handles wrap-around near midnight)
  }

  // Need enough history for pattern detection
  if (!hasEnoughHistory(transactions)) return null

  const today = now.toISOString().slice(0, 10)
  const currentDayOfWeek = now.getDay()
  const remainingAmount = allowance.amount

  // Detect patterns
  const merchantPatterns = detectMerchantTimePatterns(transactions)
  const highSpendDays = detectHighSpendDays(transactions)
  const streak = computeUnderBudgetStreak(dailySpendByDate, allowance.dailyBudget, now)

  // Generate candidates
  const candidates: PatternNudgeCandidate[] = []

  const merchantNudge = generateMerchantTimeNudge(
    merchantPatterns,
    currentHour,
    remainingAmount,
    prefs,
    today
  )
  if (merchantNudge) candidates.push(merchantNudge)

  const highSpendNudge = generateHighSpendDayNudge(
    highSpendDays,
    currentDayOfWeek,
    remainingAmount,
    prefs,
    today
  )
  if (highSpendNudge) candidates.push(highSpendNudge)

  const billNudge = generateBillCoverageNudge(bills, remainingAmount, now, prefs)
  if (billNudge) candidates.push(billNudge)

  const streakNudge = generateStreakNudge(streak, prefs, today)
  if (streakNudge) candidates.push(streakNudge)

  if (candidates.length === 0) return null

  // Return highest priority candidate
  return candidates.sort((a, b) => b.priority - a.priority)[0]
}

// ============================================================================
// Duplicate prevention
// ============================================================================

/**
 * Mark a pattern nudge as fired today so it won't re-fire.
 * For bill-coverage, pass the bill's id.
 */
export function markPatternNudgeFired(
  type: PatternNudgeCandidate["type"],
  billId?: string
): void {
  const prefs = getPatternNudgePrefs()
  const today = new Date().toISOString().slice(0, 10)

  switch (type) {
    case "coffee_merchant":
      prefs.lastFired.coffeeMerchant = today
      break
    case "high_spend_day":
      prefs.lastFired.highSpendDay = today
      break
    case "streak":
      prefs.lastFired.streak = today
      break
    case "bill_coverage":
      if (billId) {
        prefs.lastFired.billCoverage[billId] = today
      }
      break
  }

  setPatternNudgePrefs(prefs)
}
