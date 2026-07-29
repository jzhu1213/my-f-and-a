// ============================================================================
// Date Utilities — Pure Functions
// ============================================================================

/**
 * Returns a human-friendly relative date label.
 * - "Today" for the current date
 * - "Yesterday" for the previous date
 * - A short format like "Jun 15" otherwise
 *
 * Expects `dateStr` in ISO date format (YYYY-MM-DD).
 */
export function getRelativeDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
