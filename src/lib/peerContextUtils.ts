// ============================================================================
// Peer Context — Pure, Deterministic "Typical for a Student" Framing (186.1)
// ============================================================================
//
// Turns a month of category spending into warm, anonymized context: "most
// students spend around $X here — you're right in the comfy middle". This is
// an OPT-IN feature (see `peerContextPreferences.ts`), off by default, and
// surfaced only behind Tools — never on the home screen.
//
// This module is a PURE function library: no side effects, no I/O, no Date.now.
// Callers pass the reference month and the transactions, mirroring the pattern
// in `yearInReview.ts` (183.1) and `termReview.ts` (184.1). That keeps it fully
// testable and deterministic.
//
// Design principles carried from the product guidelines:
//   • Warm and shame-free — spending ABOVE the typical range is framed as a
//     totally-fine personal choice, never a scolding or a failure.
//   • Never competitive — no leaderboard, no comparison to specific people, no
//     ranking, no pass/fail. Just gentle, rough, anonymized ranges.
//   • Progressive disclosure — surfaced behind Tools when enabled, never home.
// ============================================================================

import type { Transaction, TransactionCategory } from '@/types'
import type { PeerBand, PeerCategoryContext, PeerContextData } from '@/types/folio'
import { TRANSACTION_CATEGORIES } from '@/types'

// ── Tunables ─────────────────────────────────────────────────────────────────

/**
 * Minimum number of logged expenses in the month before context feels
 * meaningful. Below this we return `hasEnoughData: false` so the UI can show a
 * gentle "not yet" state instead of comparing against thin data.
 */
export const MIN_EXPENSES_FOR_CONTEXT = 3

/**
 * Rough, static monthly spending ranges for a "typical" college student, in
 * whole dollars. These are intentionally wide, ballpark figures — they exist to
 * reassure ("you're in the normal zone"), never to grade. No external calls,
 * no per-user data: fully deterministic and anonymized.
 *
 * Categories without a defined range (e.g. income) are simply skipped.
 */
export const TYPICAL_STUDENT_MONTHLY_RANGES: Partial<
  Record<TransactionCategory, { low: number; high: number }>
> = {
  food: { low: 150, high: 400 },
  rent: { low: 500, high: 1200 },
  transport: { low: 30, high: 150 },
  school: { low: 40, high: 300 },
  fun: { low: 40, high: 200 },
  health: { low: 20, high: 120 },
  subscriptions: { low: 15, high: 60 },
  other: { low: 30, high: 200 },
}

// ── Small internal helpers ─────────────────────────────────────────────────────

/** Month names for warm labels, indexed 0–11. */
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** Friendly "September 2024" from a "2024-09" key. */
function monthKeyToLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const idx = month - 1
  const name = MONTH_LABELS[idx] ?? ''
  return `${name} ${year}`.trim()
}

/** Emoji + friendly label for a category (falls back gracefully). */
function categoryMeta(category: TransactionCategory): { emoji: string; label: string } {
  const match = TRANSACTION_CATEGORIES.find(c => c.category === category)
  return match
    ? { emoji: match.emoji, label: match.label }
    : { emoji: '📦', label: 'Other' }
}

/** Whole-dollar display string, e.g. 1234.5 → "$1,235". */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

/**
 * Classifies a monthly spend against a typical range into a warm band.
 *
 * The `above` band uses a small 15% grace margin above the high end so a user
 * who is just barely over the range still reads as "typical" — we never want to
 * nudge someone into an "above" framing over a few dollars.
 */
function classifyBand(spend: number, low: number, high: number): PeerBand {
  if (spend < low) return 'lighter'
  if (spend > high * 1.15) return 'above'
  return 'typical'
}

/**
 * Builds the warm, shame-free one-liner for a category comparison.
 *
 * Every band is framed positively:
 *   • typical — "right in the comfy middle"
 *   • lighter — "nice and lean", a gentle compliment
 *   • above   — "totally fine if that's your thing", never a scolding
 */
function bandMessage(
  band: PeerBand,
  label: string,
  low: number,
  high: number
): string {
  const range = `${money(low)}–${money(high)}`
  const thing = label.toLowerCase()
  switch (band) {
    case 'typical':
      return `Most students spend around ${range} a month on ${thing} — you're right in the comfy middle.`
    case 'lighter':
      return `Most students spend around ${range} a month on ${thing}. You're running a little lighter — nice and easy.`
    case 'above':
      return `Typical is around ${range} a month on ${thing}. You're a bit above that, which is totally fine if it's your thing.`
  }
}

// ── Core computation ────────────────────────────────────────────────────────

/**
 * Computes encouraging, anonymized "typical for a student" context for a month.
 *
 * Pure and deterministic: identical inputs always yield identical output, and
 * no ambient clock is read. Callers pass the `monthKey` (YYYY-MM) to summarize.
 *
 * Only categories where the user actually spent are included, and only those
 * with a defined typical range. Nothing here ranks the user against other
 * people — it simply places their own spend inside a soft, reassuring band.
 *
 * @param transactions - All of the user's transactions (any dates; filtered here)
 * @param monthKey      - The month to summarize, as "YYYY-MM"
 * @returns A {@link PeerContextData} summary
 */
export function computePeerContext(
  transactions: Transaction[],
  monthKey: string
): PeerContextData {
  const monthLabel = monthKeyToLabel(monthKey)

  // Aggregate this month's expenses by category in a single pass.
  const spendByCategory = new Map<TransactionCategory, number>()
  let expenseCount = 0

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (!t.date.startsWith(`${monthKey}-`)) continue
    expenseCount += 1
    spendByCategory.set(t.category, (spendByCategory.get(t.category) ?? 0) + t.amount)
  }

  // Build a warm comparison for each spent category that has a typical range.
  // Sorted by spend (highest first) so the most relevant context leads.
  const categories: PeerCategoryContext[] = Array.from(spendByCategory.entries())
    .filter(([category, spend]) => spend > 0 && TYPICAL_STUDENT_MONTHLY_RANGES[category])
    .sort((a, b) => b[1] - a[1])
    .map(([category, monthlySpend]) => {
      const range = TYPICAL_STUDENT_MONTHLY_RANGES[category]!
      const meta = categoryMeta(category)
      const band = classifyBand(monthlySpend, range.low, range.high)
      return {
        category,
        label: meta.label,
        emoji: meta.emoji,
        monthlySpend,
        typicalLow: range.low,
        typicalHigh: range.high,
        band,
        message: bandMessage(band, meta.label, range.low, range.high),
      }
    })

  const hasEnoughData = expenseCount >= MIN_EXPENSES_FOR_CONTEXT && categories.length > 0

  return {
    monthLabel,
    hasEnoughData,
    intro:
      "Just for a little context — here's how your month sits against rough, anonymized student ranges. No rankings, no judgment.",
    categories,
    disclaimer:
      "These are ballpark ranges, not targets. Everyone's situation is different — spend where it matters to you.",
  }
}
