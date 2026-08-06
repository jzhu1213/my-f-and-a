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
 * Task 193.1 — Hardening: expiry, revoke, and scope controls
 */

import type { Transaction, Budget } from '@/types'
import type { DailyAllowance, AllowanceStatus } from '@/types/folio'

// ============================================================================
// Types
// ============================================================================

/**
 * The distinct summary sections a recipient may be allowed to see. Scope lets
 * the user share only a subset (e.g. just overall status, not category detail).
 */
export type ShareSection = 'status' | 'weekSpending' | 'categories'

/** Every section, in display order. */
export const ALL_SHARE_SECTIONS: ShareSection[] = ['status', 'weekSpending', 'categories']

/**
 * What a recipient is allowed to do and see. Access is always read-only for
 * now; the explicit field leaves room for future modes without a breaking
 * change.
 */
export interface ShareScope {
  /** Recipients can only view — never edit. */
  access: 'read-only'
  /** Which summary sections the recipient can view. */
  sections: ShareSection[]
}

/** Default scope: read-only access to the full summary. */
export const DEFAULT_SHARE_SCOPE: ShareScope = {
  access: 'read-only',
  sections: [...ALL_SHARE_SECTIONS],
}

/** Friendly expiry presets offered when creating a link. */
export interface ExpiryOption {
  /** Days until expiry, or null for "never expires". */
  days: number | null
  /** Warm, short label for the option. */
  label: string
}

export const EXPIRY_OPTIONS: ExpiryOption[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: null, label: 'No expiry' },
]

export interface ShareLink {
  id: string
  userId: string
  label: string
  token: string
  createdAt: string
  isActive: boolean
  lastViewedAt: string | null
  /**
   * ISO timestamp when this link stops working, or null for no expiry.
   * Optional on read for backward compatibility with links created before
   * expiry existed (treated as "no expiry").
   */
  expiresAt?: string | null
  /** ISO timestamp the link was revoked, if it was. */
  revokedAt?: string | null
  /**
   * What the recipient can see. Optional on read for backward compatibility
   * with links created before scope existed (treated as full read-only scope).
   */
  scope?: ShareScope
}

/** A link's current lifecycle state, derived from its fields. */
export type ShareLinkStatus = 'active' | 'expired' | 'revoked'

/** Options for creating a hardened share link. */
export interface CreateShareLinkOptions {
  /** Days until the link expires; omit or null for "no expiry". */
  expiresInDays?: number | null
  /** What the recipient can see; defaults to full read-only scope. */
  scope?: ShareScope
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
  /**
   * The scope this summary was generated under. Sections not in scope are
   * blanked out at generation time so the stored data never exceeds what the
   * recipient is allowed to see. Optional for backward compatibility with
   * summaries stored before scope existed (treated as full scope).
   */
  scope?: ShareScope
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
// Normalization & lifecycle helpers
// ============================================================================

/**
 * Fill in defaults for links created before expiry/scope existed so the rest
 * of the code can treat every link uniformly (additive, backward-compatible).
 */
function normalizeShareLink(link: ShareLink): ShareLink {
  return {
    ...link,
    expiresAt: link.expiresAt ?? null,
    revokedAt: link.revokedAt ?? null,
    scope: normalizeScope(link.scope),
  }
}

/** Ensure a scope is well-formed, defaulting to full read-only access. */
function normalizeScope(scope: ShareScope | undefined): ShareScope {
  if (!scope || !Array.isArray(scope.sections) || scope.sections.length === 0) {
    return { ...DEFAULT_SHARE_SCOPE, sections: [...ALL_SHARE_SECTIONS] }
  }
  // Keep only known sections, preserving canonical order.
  const sections = ALL_SHARE_SECTIONS.filter(s => scope.sections.includes(s))
  return {
    access: 'read-only',
    sections: sections.length > 0 ? sections : [...ALL_SHARE_SECTIONS],
  }
}

/** True if the link has an expiry that has already passed. */
export function isShareLinkExpired(link: ShareLink, now: Date = new Date()): boolean {
  if (!link.expiresAt) return false
  const expiry = new Date(link.expiresAt).getTime()
  if (Number.isNaN(expiry)) return false
  return expiry <= now.getTime()
}

/** A link is usable only when it is active AND not expired. */
export function isShareLinkValid(link: ShareLink, now: Date = new Date()): boolean {
  return link.isActive && !isShareLinkExpired(link, now)
}

/** Derive the lifecycle state of a link for display. */
export function getShareLinkStatus(link: ShareLink, now: Date = new Date()): ShareLinkStatus {
  if (!link.isActive) return 'revoked'
  if (isShareLinkExpired(link, now)) return 'expired'
  return 'active'
}

/**
 * A short, warm description of a link's expiry state — e.g. "Expires in 5 days",
 * "No expiry", or "Expired 2 days ago".
 */
export function describeExpiry(link: ShareLink, now: Date = new Date()): string {
  if (!link.expiresAt) return 'No expiry'
  const expiry = new Date(link.expiresAt).getTime()
  if (Number.isNaN(expiry)) return 'No expiry'
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round((expiry - now.getTime()) / dayMs)
  if (diffDays > 1) return `Expires in ${diffDays} days`
  if (diffDays === 1) return 'Expires tomorrow'
  if (diffDays === 0) return 'Expires today'
  if (diffDays === -1) return 'Expired yesterday'
  return `Expired ${Math.abs(diffDays)} days ago`
}

// ============================================================================
// Share Link CRUD
// ============================================================================

/**
 * Get all share links for the current user (normalized for backward compat).
 */
export function getShareLinks(): ShareLink[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHARE_LINKS_KEY)
    const parsed: ShareLink[] = raw ? JSON.parse(raw) : []
    return parsed.map(normalizeShareLink)
  } catch {
    return []
  }
}

/**
 * Create a new share link with a custom label, optional expiry, and scope.
 *
 * @param options.expiresInDays Days until expiry; omit/null for no expiry.
 * @param options.scope What the recipient can view; defaults to full read-only.
 */
export function createShareLink(
  userId: string,
  label: string,
  options: CreateShareLinkOptions = {}
): ShareLink {
  const links = getShareLinks()

  const { expiresInDays = null, scope } = options
  let expiresAt: string | null = null
  if (typeof expiresInDays === 'number' && expiresInDays > 0) {
    expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  }

  const newLink: ShareLink = {
    id: crypto.randomUUID(),
    userId,
    label: label.trim() || 'Shared link',
    token: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isActive: true,
    lastViewedAt: null,
    expiresAt,
    revokedAt: null,
    scope: normalizeScope(scope),
  }
  links.push(newLink)
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links))
  return newLink
}

/**
 * Revoke (deactivate) a share link by ID. Takes effect immediately — any
 * subsequent recipient view is rejected. Also clears the stored summary so no
 * cached data lingers.
 */
export function revokeShareLink(id: string): void {
  const links = getShareLinks()
  const target = links.find(link => link.id === id)
  const updated = links.map(link =>
    link.id === id
      ? { ...link, isActive: false, revokedAt: new Date().toISOString() }
      : link
  )
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(updated))
  // Immediately purge the cached summary so revoked data can't be read.
  if (target && typeof window !== 'undefined') {
    localStorage.removeItem(SHARED_DATA_PREFIX + target.token)
  }
}

/**
 * Update the scope of an existing link (e.g. broaden or narrow what a
 * recipient can see). Returns the updated link, or null if not found.
 */
export function updateShareLinkScope(id: string, scope: ShareScope): ShareLink | null {
  const links = getShareLinks()
  const idx = links.findIndex(link => link.id === id)
  if (idx === -1) return null
  links[idx] = { ...links[idx], scope: normalizeScope(scope) }
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links))
  return links[idx]
}

/**
 * Get usable share links only — active and not expired.
 */
export function getActiveShareLinks(): ShareLink[] {
  return getShareLinks().filter(link => isShareLinkValid(link))
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
  label: string,
  scope: ShareScope = DEFAULT_SHARE_SCOPE
): SharedSummary {
  const activeScope = normalizeScope(scope)
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

  // Build category breakdown from budgets — only if in scope. When the
  // recipient isn't allowed to see categories, we never generate or store
  // that data, so it can't leak from the cache.
  const categoryBreakdown: CategorySummary[] = activeScope.sections.includes('categories')
    ? budgets
        .filter(b => b.monthlyLimit > 0)
        .map(b => ({
          category: b.category,
          label: b.category.charAt(0).toUpperCase() + b.category.slice(1).replace(/_/g, ' '),
          emoji: getCategoryEmojiSimple(b.category),
          percentUsed: b.monthlyLimit > 0
            ? Math.round((b.spent / b.monthlyLimit) * 100)
            : 0,
        }))
    : []

  const includeStatus = activeScope.sections.includes('status')
  const includeWeek = activeScope.sections.includes('weekSpending')

  return {
    status: allowance?.status ?? 'healthy',
    weekSpendingTotal: includeWeek ? weekSpendingTotal : 0,
    dailyAllowanceAmount: includeStatus ? allowance?.amount ?? 0 : 0,
    dailyBudget: includeStatus ? allowance?.dailyBudget ?? 0 : 0,
    categoryBreakdown,
    generatedAt: new Date().toISOString(),
    label,
    scope: activeScope,
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
    // Reject revoked or expired links before returning any data.
    const links = getShareLinks()
    const link = links.find(l => l.token === token)
    if (link && !isShareLinkValid(link)) {
      // Clean up any lingering cache for a link that's no longer usable.
      localStorage.removeItem(SHARED_DATA_PREFIX + token)
      return null
    }

    const raw = localStorage.getItem(SHARED_DATA_PREFIX + token)
    if (!raw) return null

    // Update lastViewedAt on the underlying link record.
    if (link) {
      link.lastViewedAt = new Date().toISOString()
      localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links))
    }

    const summary: SharedSummary = JSON.parse(raw)
    // Defense-in-depth: re-apply the link's current scope so narrowing scope
    // takes effect immediately even against a previously cached summary.
    return link ? applyScopeToSummary(summary, normalizeScope(link.scope)) : summary
  } catch {
    return null
  }
}

/**
 * Blank out any summary sections the scope doesn't permit. Keeps the recipient
 * view aligned with the latest scope even if the cached summary is broader.
 */
export function applyScopeToSummary(summary: SharedSummary, scope: ShareScope): SharedSummary {
  const sections = scope.sections
  return {
    ...summary,
    dailyAllowanceAmount: sections.includes('status') ? summary.dailyAllowanceAmount : 0,
    dailyBudget: sections.includes('status') ? summary.dailyBudget : 0,
    weekSpendingTotal: sections.includes('weekSpending') ? summary.weekSpendingTotal : 0,
    categoryBreakdown: sections.includes('categories') ? summary.categoryBreakdown : [],
    scope,
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
    const summary = getShareSummary(
      userId,
      transactions,
      budgets,
      allowance,
      link.label,
      normalizeScope(link.scope)
    )
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
