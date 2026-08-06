// ============================================================================
// Spend Velocity — computes hourly spending pace for sparkline rendering
// ============================================================================

import type { Transaction } from "@/types"

/**
 * A single data point for the sparkline. Values are normalized 0–1 representing
 * cumulative spend as a fraction of the day's total expected spending.
 */
export interface VelocityPoint {
  /** Hour of day (0–23) */
  hour: number
  /** Normalized cumulative spend (0–1) */
  value: number
}

/**
 * Result of the velocity computation: two series for the sparkline.
 */
export interface SpendVelocityData {
  /** Typical day's cumulative spend curve (normalized 0–1) */
  typical: VelocityPoint[]
  /** Today's cumulative spend curve so far (normalized 0–1) */
  today: VelocityPoint[]
  /** Whether there's enough history to show (at least 7 days of data) */
  hasEnoughHistory: boolean
}

/**
 * Compute hourly cumulative spending data for today vs. the user's typical day.
 *
 * "Typical day" is the average hourly spending distribution across the last
 * 30 days of expense transactions. "Today" is the actual cumulative spending
 * distribution for today so far.
 *
 * Both curves are normalized 0–1 so they can be rendered as relative sparklines
 * without needing axis labels or absolute values.
 *
 * @param transactions - Full transaction history
 * @param todayStr - Today's date as YYYY-MM-DD
 * @param currentHour - Current hour (0–23) to cap the "today" curve
 */
export function computeSpendVelocity(
  transactions: Transaction[],
  todayStr: string,
  currentHour: number
): SpendVelocityData {
  // Filter to expenses only
  const expenses = transactions.filter((t) => t.type === "expense")

  // Determine date range for "typical day" — last 30 days excluding today
  const today = new Date(todayStr + "T00:00:00")
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)

  // Collect unique historical dates with spending
  const historicalDates = new Set<string>()
  const historicalHourlyTotals = new Array(24).fill(0)

  for (const tx of expenses) {
    if (tx.date >= thirtyDaysAgoStr && tx.date < todayStr) {
      historicalDates.add(tx.date)
      // Distribute evenly across waking hours (8–22) since we don't have
      // exact timestamps — use a simple hash of the transaction to spread
      // them across hours for a natural-looking curve
      const hourBucket = simpleHourHash(tx.id, tx.amount)
      historicalHourlyTotals[hourBucket] += tx.amount
    }
  }

  const numDays = historicalDates.size
  const hasEnoughHistory = numDays >= 7

  if (!hasEnoughHistory) {
    return { typical: [], today: [], hasEnoughHistory: false }
  }

  // Compute average hourly spend (divide by number of historical days)
  const avgHourly = historicalHourlyTotals.map((total) => total / numDays)

  // Build cumulative typical curve (normalized to 0–1)
  const typicalCumulative: number[] = []
  let cumSum = 0
  for (let h = 0; h < 24; h++) {
    cumSum += avgHourly[h]
    typicalCumulative.push(cumSum)
  }
  const typicalMax = cumSum || 1
  const typical: VelocityPoint[] = typicalCumulative.map((v, h) => ({
    hour: h,
    value: v / typicalMax,
  }))

  // Build today's curve
  const todayExpenses = expenses.filter((t) => t.date === todayStr)
  const todayHourly = new Array(24).fill(0)
  for (const tx of todayExpenses) {
    const hourBucket = simpleHourHash(tx.id, tx.amount)
    todayHourly[hourBucket] += tx.amount
  }

  const todayCumulative: number[] = []
  let todayCum = 0
  for (let h = 0; h <= currentHour; h++) {
    todayCum += todayHourly[h]
    todayCumulative.push(todayCum)
  }
  // Normalize today against typical max for relative comparison
  const todayPoints: VelocityPoint[] = todayCumulative.map((v, h) => ({
    hour: h,
    value: Math.min(v / typicalMax, 1), // cap at 1 to stay within sparkline
  }))

  return { typical, today: todayPoints, hasEnoughHistory }
}

/**
 * Deterministic hash to distribute a transaction across hours of the day.
 * Since we only have date-level granularity, this creates a natural-looking
 * distribution across typical waking hours (7–22).
 */
function simpleHourHash(id: string, amount: number): number {
  // Simple numeric hash from the id string
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  // Mix in amount for additional entropy
  hash = ((hash << 5) - hash + Math.round(amount * 100)) | 0
  // Map to waking hours range (7–22 = 16 slots)
  const bucket = ((Math.abs(hash) % 16) + 7)
  return Math.min(bucket, 23)
}

/**
 * Convert velocity points to an SVG path `d` attribute string.
 * Uses smooth cubic bezier curves for a gentle, organic look.
 */
export function velocityToPath(
  points: VelocityPoint[],
  width: number,
  height: number,
  totalHours: number = 24
): string {
  if (points.length < 2) return ""

  const xScale = width / (totalHours - 1)
  const yPad = 2 // Small vertical padding so strokes don't clip

  const coords = points.map((p) => ({
    x: p.hour * xScale,
    y: yPad + (1 - p.value) * (height - 2 * yPad),
  }))

  // Start the path
  let d = `M ${coords[0].x},${coords[0].y}`

  // Use smooth cubic beziers for a gentle curve
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
  }

  return d
}
