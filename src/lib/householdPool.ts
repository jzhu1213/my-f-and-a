/**
 * Household Pool Utilities
 *
 * Types and functions for managing shared household/roommate expense pools.
 * A pool is a shared budget (e.g. "Groceries", "Utilities") that roommates
 * log expenses into together. Pool expenses are COMPLETELY SEPARATE from
 * personal transactions — they never flow into computeDailyAllowance or
 * affect the hero number.
 *
 * Persistence: localStorage for MVP (same pattern as sharedGoalUtils.ts).
 *
 * Task 170.1 — Household / roommate shared budget
 */

// ============================================================================
// Types
// ============================================================================

/** A household expense pool shared among roommates */
export interface HouseholdPool {
  id: string
  name: string
  emoji: string
  monthlyLimit: number
  members: HouseholdPoolMember[]
  shareToken: string
  createdAt: string
  isActive: boolean
}

/** A member of a household pool */
export interface HouseholdPoolMember {
  id: string
  name: string
  joinedAt: string
}

/** An expense logged to a household pool */
export interface HouseholdPoolExpense {
  id: string
  poolId: string
  amount: number
  category: string
  note: string
  loggedBy: string
  date: string
  createdAt: string
}

/** Summary statistics for a pool */
export interface HouseholdPoolSummary {
  totalBudget: number
  spentThisMonth: number
  remainingThisMonth: number
  perPersonShare: number
  expenseCount: number
}

// ============================================================================
// Constants
// ============================================================================

const POOLS_KEY = 'folio-household-pools'
const EXPENSES_KEY = 'folio-household-expenses'

// ============================================================================
// Storage Helpers
// ============================================================================

function loadPools(): HouseholdPool[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(POOLS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePools(pools: HouseholdPool[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(POOLS_KEY, JSON.stringify(pools))
}

function loadExpenses(): HouseholdPoolExpense[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(EXPENSES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveExpenses(expenses: HouseholdPoolExpense[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses))
}

// ============================================================================
// Pool CRUD
// ============================================================================

/**
 * Create a new household pool.
 */
export function createPool(name: string, emoji: string, monthlyLimit: number): HouseholdPool {
  const pools = loadPools()
  const pool: HouseholdPool = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Shared Pool',
    emoji: emoji || '🏠',
    monthlyLimit: Math.max(0, monthlyLimit),
    members: [],
    shareToken: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isActive: true,
  }
  pools.push(pool)
  savePools(pools)
  return pool
}

/**
 * Get a single pool by ID.
 */
export function getPool(id: string): HouseholdPool | null {
  const pools = loadPools()
  return pools.find(p => p.id === id && p.isActive) ?? null
}

/**
 * Get all active pools.
 */
export function getPools(): HouseholdPool[] {
  return loadPools().filter(p => p.isActive)
}

/**
 * Update a pool's name, emoji, or monthly limit.
 */
export function updatePool(
  id: string,
  updates: Partial<Pick<HouseholdPool, 'name' | 'emoji' | 'monthlyLimit'>>
): HouseholdPool | null {
  const pools = loadPools()
  const pool = pools.find(p => p.id === id && p.isActive)
  if (!pool) return null

  if (updates.name !== undefined) pool.name = updates.name.trim() || pool.name
  if (updates.emoji !== undefined) pool.emoji = updates.emoji || pool.emoji
  if (updates.monthlyLimit !== undefined) pool.monthlyLimit = Math.max(0, updates.monthlyLimit)

  savePools(pools)
  return { ...pool }
}

/**
 * Soft-delete a pool (mark as inactive).
 */
export function deletePool(id: string): boolean {
  const pools = loadPools()
  const pool = pools.find(p => p.id === id)
  if (!pool) return false
  pool.isActive = false
  savePools(pools)
  return true
}

// ============================================================================
// Member Management
// ============================================================================

/**
 * Add a member to a pool.
 */
export function addMember(poolId: string, name: string): HouseholdPoolMember | null {
  const pools = loadPools()
  const pool = pools.find(p => p.id === poolId && p.isActive)
  if (!pool) return null

  const member: HouseholdPoolMember = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Roommate',
    joinedAt: new Date().toISOString(),
  }
  pool.members.push(member)
  savePools(pools)
  return member
}

/**
 * Remove a member from a pool.
 */
export function removeMember(poolId: string, memberId: string): boolean {
  const pools = loadPools()
  const pool = pools.find(p => p.id === poolId && p.isActive)
  if (!pool) return false

  const idx = pool.members.findIndex(m => m.id === memberId)
  if (idx === -1) return false

  pool.members.splice(idx, 1)
  savePools(pools)
  return true
}

// ============================================================================
// Expense Logging
// ============================================================================

/**
 * Log an expense to a pool. This is completely separate from personal transactions.
 */
export function logPoolExpense(
  poolId: string,
  amount: number,
  category: string,
  loggedBy: string,
  note?: string
): HouseholdPoolExpense | null {
  if (amount <= 0) return null
  const pool = getPool(poolId)
  if (!pool) return null

  const expenses = loadExpenses()
  const expense: HouseholdPoolExpense = {
    id: crypto.randomUUID(),
    poolId,
    amount: Math.round(amount * 100) / 100,
    category: category || 'general',
    note: note?.trim() ?? '',
    loggedBy: loggedBy.trim() || 'Me',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  }
  expenses.push(expense)
  saveExpenses(expenses)
  return expense
}

/**
 * Get all expenses for a pool, sorted most recent first.
 */
export function getPoolExpenses(poolId: string): HouseholdPoolExpense[] {
  return loadExpenses()
    .filter(e => e.poolId === poolId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Get the total spent in the current month for a pool.
 */
export function getPoolSpentThisMonth(poolId: string): number {
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return loadExpenses()
    .filter(e => e.poolId === poolId && e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amount, 0)
}

// ============================================================================
// Summary
// ============================================================================

/**
 * Get a summary of a pool's current-month status.
 */
export function getPoolSummary(poolId: string): HouseholdPoolSummary | null {
  const pool = getPool(poolId)
  if (!pool) return null

  const spentThisMonth = getPoolSpentThisMonth(poolId)
  const memberCount = Math.max(1, pool.members.length + 1) // +1 for the user
  const expenses = getPoolExpenses(poolId)

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const expenseCount = expenses.filter(e => e.date.startsWith(monthPrefix)).length

  return {
    totalBudget: pool.monthlyLimit,
    spentThisMonth: Math.round(spentThisMonth * 100) / 100,
    remainingThisMonth: Math.round(Math.max(0, pool.monthlyLimit - spentThisMonth) * 100) / 100,
    perPersonShare: Math.round((spentThisMonth / memberCount) * 100) / 100,
    expenseCount,
  }
}

// ============================================================================
// Share Token
// ============================================================================

/**
 * Create (or regenerate) the share token for a pool.
 */
export function createPoolShareToken(poolId: string): string | null {
  const pools = loadPools()
  const pool = pools.find(p => p.id === poolId && p.isActive)
  if (!pool) return null

  pool.shareToken = crypto.randomUUID()
  savePools(pools)
  return pool.shareToken
}

/**
 * Look up a pool by its share token.
 */
export function getPoolByShareToken(token: string): HouseholdPool | null {
  const pools = loadPools()
  return pools.find(p => p.shareToken === token && p.isActive) ?? null
}

/**
 * Build the shareable URL for a household pool token.
 */
export function getPoolShareUrl(token: string): string {
  if (typeof window === 'undefined') return `/shared/pool/${token}`
  return `${window.location.origin}/shared/pool/${token}`
}
