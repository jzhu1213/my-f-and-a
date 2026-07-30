import type { Transaction, TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import { parseDateLocal, formatDateLocal, addDaysLocal } from '@/lib/dateUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * A broad grouping for a subscription's service type. Used to spot overlapping
 * services (e.g. two video-streaming apps) and to tailor student-focused hints.
 */
export type SubscriptionServiceKind =
  | 'streaming'      // video streaming (Netflix, Hulu, Disney+, Max…)
  | 'music'          // music streaming (Spotify, Apple Music, YouTube Music…)
  | 'cloud'          // cloud storage (iCloud, Google One, Dropbox…)
  | 'ai'             // AI assistants (ChatGPT, Copilot, Claude…)
  | 'software'       // productivity / creative tools (Adobe, Microsoft 365…)
  | 'fitness'        // gym / fitness memberships
  | 'food_delivery'  // delivery passes (DashPass, Uber One, Instacart+…)
  | 'education'      // textbooks / learning (Chegg, Coursera, Audible…)
  | 'gaming'         // game passes (Game Pass, PlayStation Plus…)
  | 'shopping'       // shopping memberships (Amazon Prime…)
  | 'other'

/**
 * A detected subscription — either confirmed via recurringId or heuristically
 * identified from same-amount, same-note transaction patterns.
 *
 * The optional fields below carry student-specific intelligence. They are
 * always additive: existing callers that ignore them keep working unchanged.
 */
export interface DetectedSubscription {
  id: string
  label: string
  amount: number
  category: TransactionCategory
  lastCharged: string
  chargeCount: number
  frequency: 'monthly' | 'weekly' | 'annual'
  isConfirmed: boolean
  recurringId?: string
  /**
   * Broad service grouping when the label matches a known service. Used to
   * flag overlapping services (two streaming apps) and pick warm hints.
   */
  serviceKind?: SubscriptionServiceKind
  /**
   * True when this looks like a service that commonly offers a student plan
   * or discount (Spotify, Amazon Prime, Adobe, YouTube Premium, etc.).
   */
  isStudentEligible?: boolean
  /**
   * A short, warm, non-judgmental hint about a student discount opportunity,
   * e.g. "Spotify has a Student plan (~$5.99/mo) that includes Hulu."
   * Only present when `isStudentEligible` is true.
   */
  studentDiscountHint?: string
  /**
   * True when another detected subscription shares the same `serviceKind`
   * among overlap-prone kinds (streaming / music). Surfaced gently so the user
   * can decide whether they need both — never framed as a mistake.
   */
  isLikelyDuplicate?: boolean
  /**
   * True when the earliest charge under the same label looks like a free (or
   * heavily discounted) trial that later converted to a recurring paid charge.
   */
  isLikelyTrialConversion?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

/** Returns the emoji for a given category. */
export function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? '💼'
}

/**
 * Determines approximate frequency based on average gap between charges.
 * - Weekly: 5–10 day gaps
 * - Monthly: 25–40 day gaps
 * - Annual: 340–400 day gaps
 */
function inferFrequency(avgGapDays: number): 'weekly' | 'monthly' | 'annual' {
  if (avgGapDays <= 10) return 'weekly'
  if (avgGapDays <= 40) return 'monthly'
  return 'annual'
}

/**
 * Groups an array of values by a key derived from each item.
 */
function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!result[k]) result[k] = []
    result[k].push(item)
  }
  return result
}

/**
 * Calculates the average gap (in days) between sorted date strings.
 */
function averageGap(dates: string[]): number {
  if (dates.length < 2) return 30 // default to monthly
  const sorted = [...dates].sort()
  let totalGap = 0
  for (let i = 1; i < sorted.length; i++) {
    const d1 = new Date(sorted[i - 1]).getTime()
    const d2 = new Date(sorted[i]).getTime()
    totalGap += (d2 - d1) / (1000 * 60 * 60 * 24)
  }
  return totalGap / (sorted.length - 1)
}

// ============================================================================
// Student-Specific Service Intelligence
// ============================================================================

/**
 * A known subscription service the target demographic (college students /
 * young adults) commonly pays for. Matching is done by lowercase substring
 * against the transaction note/label, so brand variants ("spotify premium",
 * "SPOTIFY USA") all resolve to the same canonical entry.
 */
interface KnownService {
  /** Canonical service key (stable, used for grouping). */
  key: string
  /** Broad grouping for overlap detection and hints. */
  kind: SubscriptionServiceKind
  /** Lowercase substrings that identify this service in a note/label. */
  patterns: string[]
  /** Whether the service commonly offers a student plan/discount. */
  studentEligible: boolean
  /** Warm, shame-free hint about the student opportunity (if eligible). */
  studentDiscountHint?: string
}

/**
 * Catalog of common student / young-adult subscriptions. Ordered roughly by
 * how specific the patterns are; matching stops at the first hit.
 */
const KNOWN_SUBSCRIPTION_SERVICES: KnownService[] = [
  // ── Music ────────────────────────────────────────────────────────────
  {
    key: 'spotify', kind: 'music', patterns: ['spotify'], studentEligible: true,
    studentDiscountHint: 'Spotify has a Student plan (~$5.99/mo) that bundles Hulu — worth a look.',
  },
  {
    key: 'apple-music', kind: 'music', patterns: ['apple music'], studentEligible: true,
    studentDiscountHint: 'Apple Music offers a student rate (~$5.99/mo) with student verification.',
  },
  {
    key: 'youtube-music', kind: 'music', patterns: ['youtube music', 'yt music'], studentEligible: true,
    studentDiscountHint: 'YouTube Music has a discounted student plan if you verify enrollment.',
  },
  {
    key: 'tidal', kind: 'music', patterns: ['tidal'], studentEligible: true,
    studentDiscountHint: 'Tidal offers a student discount of roughly 50% off.',
  },
  // ── Streaming (video) ────────────────────────────────────────────────
  { key: 'netflix', kind: 'streaming', patterns: ['netflix'], studentEligible: false },
  {
    key: 'hulu', kind: 'streaming', patterns: ['hulu'], studentEligible: true,
    studentDiscountHint: 'Hulu has a student rate (~$1.99/mo), or you may get it free with Spotify Student.',
  },
  { key: 'disney-plus', kind: 'streaming', patterns: ['disney+', 'disney plus', 'disneyplus'], studentEligible: false },
  { key: 'max', kind: 'streaming', patterns: ['hbo max', 'hbomax', 'max.com', 'hbo'], studentEligible: false },
  {
    key: 'youtube-premium', kind: 'streaming', patterns: ['youtube premium', 'youtube tv', 'yt premium'], studentEligible: true,
    studentDiscountHint: 'YouTube Premium has a student plan at a reduced monthly rate.',
  },
  {
    key: 'paramount-plus', kind: 'streaming', patterns: ['paramount+', 'paramount plus'], studentEligible: false,
  },
  { key: 'peacock', kind: 'streaming', patterns: ['peacock'], studentEligible: false },
  { key: 'apple-tv', kind: 'streaming', patterns: ['apple tv'], studentEligible: false },
  { key: 'crunchyroll', kind: 'streaming', patterns: ['crunchyroll'], studentEligible: false },
  // ── AI assistants ────────────────────────────────────────────────────
  { key: 'chatgpt', kind: 'ai', patterns: ['chatgpt', 'openai'], studentEligible: false },
  { key: 'copilot', kind: 'ai', patterns: ['github copilot', 'copilot'], studentEligible: true,
    studentDiscountHint: 'GitHub Copilot is free for verified students through the Student Developer Pack.' },
  { key: 'claude', kind: 'ai', patterns: ['claude', 'anthropic'], studentEligible: false },
  // ── Cloud storage ────────────────────────────────────────────────────
  { key: 'icloud', kind: 'cloud', patterns: ['icloud', 'apple one', 'apple.com/bill'], studentEligible: false },
  { key: 'google-one', kind: 'cloud', patterns: ['google one', 'google storage'], studentEligible: false },
  { key: 'dropbox', kind: 'cloud', patterns: ['dropbox'], studentEligible: false },
  // ── Software / productivity ──────────────────────────────────────────
  {
    key: 'adobe', kind: 'software', patterns: ['adobe', 'creative cloud'], studentEligible: true,
    studentDiscountHint: 'Adobe Creative Cloud is ~60% off for students and teachers.',
  },
  {
    key: 'microsoft-365', kind: 'software', patterns: ['microsoft 365', 'office 365', 'microsoft365'], studentEligible: true,
    studentDiscountHint: 'Microsoft 365 is often free for students through your school email.',
  },
  {
    key: 'notion', kind: 'software', patterns: ['notion'], studentEligible: true,
    studentDiscountHint: 'Notion Plus is free for students with a school email.',
  },
  { key: 'canva', kind: 'software', patterns: ['canva'], studentEligible: true,
    studentDiscountHint: 'Canva offers free Pro access for eligible students.' },
  { key: 'grammarly', kind: 'software', patterns: ['grammarly'], studentEligible: false },
  { key: 'linkedin', kind: 'software', patterns: ['linkedin premium', 'linkedin'], studentEligible: false },
  // ── Fitness ──────────────────────────────────────────────────────────
  {
    key: 'gym', kind: 'fitness',
    patterns: ['gym', 'planet fitness', 'la fitness', 'crunch fitness', 'equinox', 'anytime fitness', 'classpass', 'peloton'],
    studentEligible: true,
    studentDiscountHint: 'Many gyms offer student memberships — and your campus rec center may be free.',
  },
  // ── Food / delivery passes ───────────────────────────────────────────
  {
    key: 'dashpass', kind: 'food_delivery', patterns: ['dashpass', 'doordash'], studentEligible: true,
    studentDiscountHint: 'DoorDash offers a discounted DashPass for students.',
  },
  {
    key: 'uber-one', kind: 'food_delivery', patterns: ['uber one', 'uber eats', 'ubereats', 'uber pass'], studentEligible: true,
    studentDiscountHint: 'Uber One has a student plan at roughly half price.',
  },
  {
    key: 'instacart', kind: 'food_delivery', patterns: ['instacart'], studentEligible: true,
    studentDiscountHint: 'Instacart+ offers a discounted student membership.',
  },
  { key: 'gopuff', kind: 'food_delivery', patterns: ['gopuff', 'go puff'], studentEligible: false },
  // ── Education / reading ──────────────────────────────────────────────
  {
    key: 'chegg', kind: 'education', patterns: ['chegg'], studentEligible: false,
  },
  { key: 'coursera', kind: 'education', patterns: ['coursera'], studentEligible: false },
  {
    key: 'audible', kind: 'education', patterns: ['audible'], studentEligible: true,
    studentDiscountHint: 'Audible has a student rate (~$9.95/mo) with verification.',
  },
  { key: 'kindle-unlimited', kind: 'education', patterns: ['kindle unlimited'], studentEligible: false },
  { key: 'nytimes', kind: 'education', patterns: ['nytimes', 'new york times', 'ny times'], studentEligible: true,
    studentDiscountHint: 'The New York Times has a heavily discounted student subscription.' },
  // ── Gaming ───────────────────────────────────────────────────────────
  { key: 'xbox-game-pass', kind: 'gaming', patterns: ['game pass', 'xbox'], studentEligible: false },
  { key: 'playstation-plus', kind: 'gaming', patterns: ['playstation', 'ps plus', 'psn'], studentEligible: false },
  { key: 'nintendo', kind: 'gaming', patterns: ['nintendo'], studentEligible: false },
  // ── Shopping ─────────────────────────────────────────────────────────
  {
    key: 'amazon-prime', kind: 'shopping', patterns: ['amazon prime', 'prime video', 'amzn'], studentEligible: true,
    studentDiscountHint: 'Amazon Prime Student is half price with a 6-month free trial (.edu email).',
  },
]

/** Normalizes a note/label for matching (lowercase, trimmed, collapsed spaces). */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Finds the first known service whose patterns match the given label.
 * Returns `undefined` when nothing matches.
 */
function matchKnownService(label: string): KnownService | undefined {
  const normalized = normalizeLabel(label)
  if (!normalized) return undefined
  return KNOWN_SUBSCRIPTION_SERVICES.find(svc =>
    svc.patterns.some(pattern => normalized.includes(pattern))
  )
}

/**
 * Detects whether the earliest charge under a given label looks like a free
 * or heavily-discounted trial that later converted to the recurring amount.
 *
 * Signal: the first same-label expense is $0 or ≤ 50% of the recurring amount,
 * and strictly less than it. Pure — reads only from the supplied expenses.
 */
function looksLikeTrialConversion(
  label: string,
  recurringAmount: number,
  expenses: Transaction[]
): boolean {
  if (recurringAmount <= 0) return false
  const normalized = normalizeLabel(label)
  if (!normalized) return false

  const related = expenses
    .filter(tx => normalizeLabel(tx.note ?? '') === normalized)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (related.length < 2) return false

  const firstAmount = related[0].amount
  return firstAmount < recurringAmount && firstAmount <= recurringAmount * 0.5
}

/**
 * Enriches detected subscriptions with student-specific intelligence:
 * service grouping, student-discount eligibility/hints, trial-conversion
 * flags, and duplicate/overlap flags across streaming & music services.
 *
 * Returns a new array; input subscriptions are not mutated. Pure function.
 */
function applyStudentIntelligence(
  subscriptions: DetectedSubscription[],
  expenses: Transaction[]
): DetectedSubscription[] {
  // First pass: per-subscription service metadata + trial detection.
  const enriched = subscriptions.map(sub => {
    const service = matchKnownService(sub.label)
    const next: DetectedSubscription = { ...sub }

    if (service) {
      next.serviceKind = service.kind
      if (service.studentEligible) {
        next.isStudentEligible = true
        if (service.studentDiscountHint) {
          next.studentDiscountHint = service.studentDiscountHint
        }
      }
    }

    if (looksLikeTrialConversion(sub.label, sub.amount, expenses)) {
      next.isLikelyTrialConversion = true
    }

    return next
  })

  // Second pass: flag overlapping services within overlap-prone kinds.
  // Two video-streaming apps (or two music apps) is a common student overspend
  // worth surfacing gently.
  const OVERLAP_KINDS: SubscriptionServiceKind[] = ['streaming', 'music']
  const countByKind = new Map<SubscriptionServiceKind, number>()
  for (const sub of enriched) {
    if (sub.serviceKind && OVERLAP_KINDS.includes(sub.serviceKind)) {
      countByKind.set(sub.serviceKind, (countByKind.get(sub.serviceKind) ?? 0) + 1)
    }
  }

  for (const sub of enriched) {
    if (
      sub.serviceKind &&
      OVERLAP_KINDS.includes(sub.serviceKind) &&
      (countByKind.get(sub.serviceKind) ?? 0) > 1
    ) {
      sub.isLikelyDuplicate = true
    }
  }

  return enriched
}

// ============================================================================
// Core Detection Logic
// ============================================================================

/**
 * Detects recurring subscriptions from transaction history.
 *
 * Strategy:
 * 1. Group confirmed recurring transactions by `recurringId`
 * 2. Heuristically detect unconfirmed recurring patterns:
 *    same note AND same amount, appearing 2+ times at roughly monthly intervals
 *    (28–35 day gaps on average)
 * 3. Deduplicate and return sorted by amount descending
 *
 * This is a pure function with no side effects.
 */
export function detectSubscriptions(transactions: Transaction[]): DetectedSubscription[] {
  const subscriptions: DetectedSubscription[] = []
  const seenIds = new Set<string>()

  // Only consider expense transactions
  const expenses = transactions.filter(tx => tx.type === 'expense')

  // ── Step 1: Confirmed recurring via recurringId ─────────────────────────
  const byRecurringId = groupBy(
    expenses.filter(tx => tx.recurringId),
    tx => tx.recurringId!
  )

  for (const [recurringId, txGroup] of Object.entries(byRecurringId)) {
    if (txGroup.length < 2) continue

    const sorted = [...txGroup].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const avgGap = averageGap(sorted.map(t => t.date))

    const sub: DetectedSubscription = {
      id: `confirmed-${recurringId}`,
      label: latest.note || `${latest.category} subscription`,
      amount: latest.amount,
      category: latest.category,
      lastCharged: latest.date,
      chargeCount: txGroup.length,
      frequency: inferFrequency(avgGap),
      isConfirmed: true,
      recurringId,
    }

    subscriptions.push(sub)
    seenIds.add(sub.id)

    // Track these transaction IDs so we don't double-count in heuristic step
    for (const tx of txGroup) {
      seenIds.add(tx.id)
    }
  }

  // ── Step 2: Heuristic detection ─────────────────────────────────────────
  // Group by (note + amount) for transactions without recurringId
  const heuristicCandidates = expenses.filter(
    tx => !tx.recurringId && tx.note && tx.note.trim().length > 0 && !seenIds.has(tx.id)
  )

  const byNoteAndAmount = groupBy(
    heuristicCandidates,
    tx => `${tx.note!.toLowerCase().trim()}|${tx.amount}`
  )

  for (const [key, txGroup] of Object.entries(byNoteAndAmount)) {
    if (txGroup.length < 2) continue

    const sorted = [...txGroup].sort((a, b) => a.date.localeCompare(b.date))
    const avgGap = averageGap(sorted.map(t => t.date))

    // Only consider monthly-ish patterns (28–35 day average gap)
    if (avgGap < 28 || avgGap > 35) continue

    const latest = sorted[sorted.length - 1]
    const subId = `heuristic-${key}`

    if (seenIds.has(subId)) continue

    subscriptions.push({
      id: subId,
      label: latest.note || 'Unknown subscription',
      amount: latest.amount,
      category: latest.category,
      lastCharged: latest.date,
      chargeCount: txGroup.length,
      frequency: 'monthly',
      isConfirmed: false,
    })

    seenIds.add(subId)
  }

  // ── Step 3: Enrich with student-specific intelligence ───────────────────
  // Service grouping, student-discount hints, trial-conversion detection, and
  // duplicate/overlap flags. Additive only — never changes existing fields.
  const enriched = applyStudentIntelligence(subscriptions, expenses)

  // ── Step 4: Sort by amount descending ───────────────────────────────────
  enriched.sort((a, b) => b.amount - a.amount)

  return enriched
}

// ============================================================================
// Summary Helpers
// ============================================================================

/**
 * Sums the monthly cost of all detected subscriptions.
 * Weekly subscriptions are multiplied by ~4.33, annual divided by 12.
 */
export function getMonthlySubscriptionTotal(subscriptions: DetectedSubscription[]): number {
  return subscriptions.reduce((sum, sub) => {
    switch (sub.frequency) {
      case 'weekly':
        return sum + sub.amount * 4.33
      case 'annual':
        return sum + sub.amount / 12
      case 'monthly':
      default:
        return sum + sub.amount
    }
  }, 0)
}

/**
 * Returns the subscriptions that likely have a student discount available,
 * so the audit surface can gently point out savings opportunities.
 * Pure — filters without mutating.
 */
export function getStudentSavingsOpportunities(
  subscriptions: DetectedSubscription[]
): DetectedSubscription[] {
  return subscriptions.filter(sub => sub.isStudentEligible && !!sub.studentDiscountHint)
}

/**
 * Returns the subscriptions flagged as overlapping (e.g. two streaming or two
 * music services), so the audit surface can nudge the user to consider whether
 * they need both. Pure — filters without mutating.
 */
export function getOverlappingSubscriptions(
  subscriptions: DetectedSubscription[]
): DetectedSubscription[] {
  return subscriptions.filter(sub => sub.isLikelyDuplicate)
}

// ============================================================================
// Renewal & Trial Alerts (Task 108.2)
// ============================================================================

/**
 * How many days ahead counts as "renewing soon". Small window so alerts stay
 * timely and gentle — a heads-up, never a nag.
 */
export const RENEWAL_SOON_WINDOW_DAYS = 3

/** The kind of upcoming-charge alert surfaced for a subscription. */
export type SubscriptionAlertKind = 'renewal_soon' | 'trial_ending'

/**
 * An informational heads-up about a subscription's next charge. Purely
 * advisory — never blocks anything.
 */
export interface SubscriptionAlert {
  /** The subscription this alert refers to. */
  subscription: DetectedSubscription
  /** Whether this is a plain renewal or a trial that's about to convert. */
  kind: SubscriptionAlertKind
  /** The next expected renewal/charge date as a YYYY-MM-DD local date string. */
  nextRenewalDate: string
  /** Whole days from `today` until the next charge (0 = today). */
  daysUntil: number
}

/**
 * Computes the next expected renewal date for a detected subscription from its
 * `lastCharged` date plus one billing cycle:
 * - monthly → +1 month (same day-of-month)
 * - weekly  → +7 days
 * - annual  → +1 year (same month/day)
 *
 * Returns a YYYY-MM-DD local date string. Pure — no I/O, no clock reads.
 */
export function getNextRenewalDate(sub: DetectedSubscription): string {
  const last = parseDateLocal(sub.lastCharged)

  let next: Date
  switch (sub.frequency) {
    case 'weekly':
      next = addDaysLocal(last, 7)
      break
    case 'annual':
      next = new Date(last.getFullYear() + 1, last.getMonth(), last.getDate())
      break
    case 'monthly':
    default:
      next = new Date(last.getFullYear(), last.getMonth() + 1, last.getDate())
      break
  }

  return formatDateLocal(next)
}

/**
 * Returns the whole-day difference between two YYYY-MM-DD local date strings
 * (`to - from`). Both are parsed at local midnight, so the result is exact.
 */
function daysBetween(from: string, to: string): number {
  const fromMs = parseDateLocal(from).getTime()
  const toMs = parseDateLocal(to).getTime()
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24))
}

/**
 * Builds gentle, informational alerts for subscriptions whose next charge is
 * imminent (within {@link RENEWAL_SOON_WINDOW_DAYS} days of `today`).
 *
 * - Subscriptions flagged `isLikelyTrialConversion` produce a `trial_ending`
 *   alert (the free/discounted trial is about to convert to full price).
 * - All other imminent renewals produce a `renewal_soon` alert.
 *
 * Alerts are returned soonest-first. Charges already in the past are skipped
 * (we only look forward). Pure — `today` is injected as a YYYY-MM-DD string so
 * callers control the clock and the function stays deterministic.
 */
export function getSubscriptionAlerts(
  subscriptions: DetectedSubscription[],
  today: string
): SubscriptionAlert[] {
  const alerts: SubscriptionAlert[] = []

  for (const sub of subscriptions) {
    const nextRenewalDate = getNextRenewalDate(sub)
    const daysUntil = daysBetween(today, nextRenewalDate)

    // Only look forward, and only within the small heads-up window.
    if (daysUntil < 0 || daysUntil > RENEWAL_SOON_WINDOW_DAYS) continue

    alerts.push({
      subscription: sub,
      kind: sub.isLikelyTrialConversion ? 'trial_ending' : 'renewal_soon',
      nextRenewalDate,
      daysUntil,
    })
  }

  // Soonest first so callers can surface the most urgent heads-up.
  alerts.sort((a, b) => a.daysUntil - b.daysUntil)

  return alerts
}
