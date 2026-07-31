/**
 * Sharing Utilities
 *
 * Types and functions for optional read-only sharing of spending summaries.
 * Allows users to generate shareable links that give read-only access to a
 * high-level spending summary (no individual transaction details).
 *
 * Persistence: localStorage for MVP. In production, this would use a
 * Supabase table with RLS so shared data is accessible cross-device.
 *
 * Task 115.1 — Optional read-only sharing
 */

import type { Transaction, Budget } from '@/types'
import type { DailyAllowance, AllowanceStatus } from '@/types/folio'

// ============================================================================
// Types
// ============================================================================

export interface ShareLink {
  id: string
  userId: string
  label: string
  token: string
  createdAt: string
  isActive: boolean
  lastViewedAt: string | null
}

export interface SharedSummary {
  /** Overall budget health status */
  status: AllowanceStatus
  /** Spending total for the current week */
  weekSpendingTotal: number
  /** Daily allowance amount (safe to spend today) */
  dailyAllowanceAmount: number
  /** Daily budget baseline */
  dailyBudget: number
  /** Budget categories with percentage used (no dollar amounts of individual txns) */
  categoryBreakdown: CategorySummary[]
  /** ISO timestamp of when this summary was generated */
  generatedAt: string
  /** Label the user gave this share */
  label: string
}

export interface CategorySummary {
  category: string
  label: string
  emoji: string
  percentUsed: number
}

// ============================================================================
// Constants
// ============================================================================

const SHARE_LINKS_KEY = 'folio-share-links'
const SHARED_DATA_PREFIX = 'folio-shared-data-'

// ============================================================================
// Share Link CRUD
// ============================================================================

/**
 * Get all share links for the current user.
 */
export function getShareLinks(): ShareLink[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHARE_LINKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Create a new share link with a custom label.
 */
export function createShareLink(userId: string, label: string): ShareLink {
  const links = getShareLinks()
  const newLink: ShareLink = {
    id: crypto.randomUUID(),
    userId,
    label: label.trim() || 'Shared link',
    token: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isActive: true,
    lastViewedAt: null,
  }
  links.push(newLink)
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links))
  return newLink
}

/**
 * Revoke (deactivate) a share link by ID.
 */
export function revokeShareLink(id: string): void {
  const links = getShareLinks()
  const updated = links.map(link =>
    link.id === id ? { ...link, isActive: false } : link
  )
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(updated))
}

/**
 * Get active share links only.
 */
export function getActiveShareLinks(): ShareLink[] {
  return getShareLinks().filter(link => link.isActive)
}

/**
 * Build the shareable URL for a given token.
 */
export function getShareUrl(token: string): string {
  if (typeof window === 'undefined') return `/shared/${token}`
  return `${window.location.origin}/shared/${token}`
}

// ============================================================================
// Shared Summary Generation
// ============================================================================

/**
 * Generate a sanitized spending summary for sharing.
 * Shows high-level stats only — never individual transactions.
 */
export function getShareSummary(
  userId: string,
  transactions: Transaction[],
  budgets: Budget[],
  allowance: DailyAllowance | null,
  label: string
): SharedSummary {
  // Calculate week spending total (current Mon–Sun window)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)

  const weekExpenses = transactions.filter(t => {
    if (t.type !== 'expense') return false
    const txDate = new Date(t.date)
    return txDate >= weekStart && txDate <= now
  })
  const weekSpendingTotal = weekExpenses.reduce((sum, t) => sum + t.amount, 0)

  // Build category breakdown from budgets
  const categoryBreakdown: CategorySummary[] = budgets
    .filter(b => b.monthlyLimit > 0)
    .map(b => ({
      category: b.category,
      label: b.category.charAt(0).toUpperCase() + b.category.slice(1).replace(/_/g, ' '),
      emoji: getCategoryEmojiSimple(b.category),
      percentUsed: b.monthlyLimit > 0
        ? Math.round((b.spent / b.monthlyLimit) * 100)
        : 0,
    }))

  return {
    status: allowance?.status ?? 'healthy',
    weekSpendingTotal,
    dailyAllowanceAmount: allowance?.amount ?? 0,
    dailyBudget: allowance?.dailyBudget ?? 0,
    categoryBreakdown,
    generatedAt: new Date().toISOString(),
    label,
  }
}

/**
 * Store a shared summary keyed by token so the shared page can read it.
 * NOTE: In production this would be stored server-side (Supabase) so the
 * recipient doesn't need to be on the same device.
 */
export function storeSharedSummary(token: string, summary: SharedSummary): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHARED_DATA_PREFIX + token, JSON.stringify(summary))
}

/**
 * Retrieve a shared summary by token. Returns null if not found or revoked.
 */
export function getSharedSummary(token: string): SharedSummary | null {
  if (typeof window === 'undefined') return null
  try {
    // Check if the link is still active
    const links = getShareLinks()
    const link = links.find(l => l.token === token)
    if (link && !link.isActive) return null

    const raw = localStorage.getItem(SHARED_DATA_PREFIX + token)
    if (!raw) return null

    // Update lastViewedAt
    if (link) {
      link.lastViewedAt = new Date().toISOString()
      localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links))
    }

    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Update all active share links with the latest summary data.
 * Called whenever the user opens the sharing screen or data changes.
 */
export function refreshAllSharedSummaries(
  userId: string,
  transactions: Transaction[],
  budgets: Budget[],
  allowance: DailyAllowance | null
): void {
  const links = getActiveShareLinks()
  for (const link of links) {
    const summary = getShareSummary(userId, transactions, budgets, allowance, link.label)
    storeSharedSummary(link.token, summary)
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getCategoryEmojiSimple(category: string): string {
  const emojiMap: Record<string, string> = {
    food: '🍕',
    rent: '🏠',
    transport: '🚲',
    school: '📚',
    fun: '🎶',
    health: '💪',
    subscriptions: '🔄',
    gig: '⚡',
    income: '💵',
    other: '📦',
  }
  return emojiMap[category] ?? '📦'
}
