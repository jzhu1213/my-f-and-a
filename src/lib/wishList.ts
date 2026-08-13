/**
 * Wish List — lightweight impulse-friendly tracking for things you want
 *
 * Answers: "When can I afford this?" by projecting your recent daily surplus
 * into the future and estimating days until you can cover an item.
 *
 * Persistence: Supabase `wish_items` table (owner-only RLS) with localStorage
 * offline fallback using the same pattern as offlineQueue.ts.
 *
 * Validates: Requirements 19.1, 6.x
 */

import { supabase } from './supabaseClient'
import type { Transaction, Budget, TransactionCategory } from '@/types'
import type { SaveUpInput, ContributionPeriod } from './saveUpPlanUtils'

// ============================================================================
// Types
// ============================================================================

export type WishPriority = 'want' | 'need' | 'dream'

export interface WishItem {
  id: string
  userId: string
  name: string
  amount: number
  category?: TransactionCategory
  imageUrl?: string
  link?: string
  priority: WishPriority
  createdAt: string
  savedSoFar: number
  isComplete: boolean
  /** Optional link to an existing save-up plan for syncing progress */
  saveUpPlanId?: string
}

/** Database row shape (snake_case columns in Supabase) */
export interface DbWishItem {
  id: string
  user_id: string
  name: string
  amount: number
  category: string | null
  image_url: string | null
  link: string | null
  priority: string
  created_at: string
  saved_so_far: number
  is_complete: boolean
  save_up_plan_id: string | null
}

// ============================================================================
// DB ↔ App mappers
// ============================================================================

function dbWishItemToApp(row: DbWishItem): WishItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    amount: row.amount,
    category: (row.category as TransactionCategory) || undefined,
    imageUrl: row.image_url || undefined,
    link: row.link || undefined,
    priority: row.priority as WishPriority,
    createdAt: row.created_at,
    savedSoFar: row.saved_so_far,
    isComplete: row.is_complete,
    saveUpPlanId: row.save_up_plan_id || undefined,
  }
}

function appWishItemToDb(item: Omit<WishItem, 'id' | 'createdAt'>): Omit<DbWishItem, 'id' | 'created_at'> {
  return {
    user_id: item.userId,
    name: item.name,
    amount: item.amount,
    category: item.category || null,
    image_url: item.imageUrl || null,
    link: item.link || null,
    priority: item.priority,
    saved_so_far: item.savedSoFar,
    is_complete: item.isComplete,
    save_up_plan_id: item.saveUpPlanId || null,
  }
}

// ============================================================================
// localStorage Offline Fallback
// ============================================================================

const WISH_LIST_STORAGE_KEY = 'folio-wish-list'

/** Read wish items from localStorage (offline fallback) */
export function getLocalWishItems(userId: string): WishItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WISH_LIST_STORAGE_KEY)
    if (!raw) return []
    const items = JSON.parse(raw) as WishItem[]
    return items.filter((item) => item.userId === userId)
  } catch {
    return []
  }
}

/** Persist wish items to localStorage */
function persistLocalWishItems(items: WishItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(WISH_LIST_STORAGE_KEY, JSON.stringify(items))
}

/** Add a wish item to localStorage */
export function addLocalWishItem(item: WishItem): void {
  const items = getAllLocalWishItems()
  items.push(item)
  persistLocalWishItems(items)
}

/** Update a wish item in localStorage */
export function updateLocalWishItem(id: string, updates: Partial<WishItem>): void {
  const items = getAllLocalWishItems()
  const idx = items.findIndex((i) => i.id === id)
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...updates }
    persistLocalWishItems(items)
  }
}

/** Delete a wish item from localStorage */
function deleteLocalWishItem(id: string): void {
  const items = getAllLocalWishItems().filter((i) => i.id !== id)
  persistLocalWishItems(items)
}

/** Read ALL local wish items (across all users) — internal helper */
function getAllLocalWishItems(): WishItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WISH_LIST_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WishItem[]
  } catch {
    return []
  }
}

// ============================================================================
// Supabase CRUD
// ============================================================================

/**
 * Fetch all wish items for a user. Falls back to localStorage when offline.
 */
export async function getWishItems(userId: string): Promise<WishItem[]> {
  const { data, error } = await supabase
    .from('wish_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching wish items:', error)
    // Fall back to localStorage
    return getLocalWishItems(userId)
  }

  const items = (data as DbWishItem[]).map(dbWishItemToApp)

  // Sync to localStorage for offline access
  persistLocalWishItems(items)

  return items
}

/**
 * Create a new wish item. Persists to Supabase and localStorage.
 */
export async function createWishItem(
  userId: string,
  input: {
    name: string
    amount: number
    category?: TransactionCategory
    imageUrl?: string
    link?: string
    priority: WishPriority
  }
): Promise<WishItem | null> {
  const { data, error } = await supabase
    .from('wish_items')
    .insert({
      user_id: userId,
      name: input.name,
      amount: input.amount,
      category: input.category || null,
      image_url: input.imageUrl || null,
      link: input.link || null,
      priority: input.priority,
      saved_so_far: 0,
      is_complete: false,
      save_up_plan_id: null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating wish item:', error)
    // Offline fallback: create locally with generated ID
    const localItem: WishItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      name: input.name,
      amount: input.amount,
      category: input.category,
      imageUrl: input.imageUrl,
      link: input.link,
      priority: input.priority,
      createdAt: new Date().toISOString(),
      savedSoFar: 0,
      isComplete: false,
    }
    addLocalWishItem(localItem)
    return localItem
  }

  const item = dbWishItemToApp(data as DbWishItem)
  addLocalWishItem(item)
  return item
}

/**
 * Update an existing wish item.
 */
export async function updateWishItem(
  userId: string,
  itemId: string,
  updates: Partial<Pick<WishItem, 'name' | 'amount' | 'category' | 'imageUrl' | 'link' | 'priority' | 'savedSoFar' | 'isComplete' | 'saveUpPlanId'>>
): Promise<WishItem | null> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount
  if (updates.category !== undefined) dbUpdates.category = updates.category || null
  if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl || null
  if (updates.link !== undefined) dbUpdates.link = updates.link || null
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority
  if (updates.savedSoFar !== undefined) dbUpdates.saved_so_far = updates.savedSoFar
  if (updates.isComplete !== undefined) dbUpdates.is_complete = updates.isComplete
  if (updates.saveUpPlanId !== undefined) dbUpdates.save_up_plan_id = updates.saveUpPlanId || null

  const { data, error } = await supabase
    .from('wish_items')
    .update(dbUpdates)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating wish item:', error)
    // Offline fallback
    updateLocalWishItem(itemId, updates)
    return null
  }

  const item = dbWishItemToApp(data as DbWishItem)
  updateLocalWishItem(itemId, item)
  return item
}

/**
 * Delete a wish item.
 */
export async function deleteWishItem(
  userId: string,
  itemId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('wish_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting wish item:', error)
    // Offline fallback: remove locally
    deleteLocalWishItem(itemId)
    return false
  }

  deleteLocalWishItem(itemId)
  return true
}

/**
 * Mark a wish item as complete.
 */
export async function markWishItemComplete(
  userId: string,
  itemId: string
): Promise<WishItem | null> {
  return updateWishItem(userId, itemId, { isComplete: true })
}

// ============================================================================
// 351.2 — "When can I afford this?" Projection
// ============================================================================

export interface WishProjection {
  /** Estimated number of days until the surplus covers the remaining amount */
  daysToAfford: number
  /** Average daily surplus over the last 14 days */
  averageDailySurplus: number
  /** Warm, encouraging message: "~12 days at your current pace" */
  message: string
  /** Whether there's enough data to make a meaningful projection */
  hasEnoughData: boolean
}

/**
 * Computes how many days until the user's daily surplus accumulates enough to
 * cover a wish item. Uses the average daily surplus over the last 14 days:
 *   surplus = (total budget allowance per day) − (actual daily spending)
 *
 * The average is: sum of daily surpluses over last 14 days / 14.
 *
 * @param wishItem - The wish item to project affordability for
 * @param transactions - Recent transactions (at least 14 days of history)
 * @param budgets - Current budget configuration
 * @param currentDate - Today's date (for testing determinism)
 * @returns Projection with days estimate and friendly message
 *
 * @pure Deterministic given same inputs.
 */
export function computeWishProjection(
  wishItem: WishItem,
  transactions: Transaction[],
  budgets: Budget[],
  currentDate: Date = new Date()
): WishProjection {
  const LOOKBACK_DAYS = 14
  const remaining = Math.max(0, wishItem.amount - wishItem.savedSoFar)

  // Already saved enough
  if (remaining <= 0) {
    return {
      daysToAfford: 0,
      averageDailySurplus: 0,
      message: "You've already saved enough — nice! 🎉",
      hasEnoughData: true,
    }
  }

  // Compute daily budget from budget limits
  const budgetsWithLimits = budgets.filter((b) => b.monthlyLimit > 0)
  const totalMonthlyBudget = budgetsWithLimits.reduce((sum, b) => {
    return sum + (b.period === 'weekly' ? b.monthlyLimit * 4.33 : b.monthlyLimit)
  }, 0)
  const dailyBudget = totalMonthlyBudget / 30

  // Compute average daily spending over the last 14 days
  const todayStr = formatDate(currentDate)
  const lookbackStart = subtractDays(currentDate, LOOKBACK_DAYS)
  const lookbackStartStr = formatDate(lookbackStart)

  const recentExpenses = transactions.filter((t) => {
    return (
      t.type === 'expense' &&
      t.date >= lookbackStartStr &&
      t.date < todayStr
    )
  })

  // Count days that have at least one transaction (to check data sufficiency)
  const daysWithData = new Set(recentExpenses.map((t) => t.date)).size
  const hasEnoughData = daysWithData >= 3

  const totalSpent = recentExpenses.reduce((sum, t) => sum + t.amount, 0)
  const averageDailySpending = totalSpent / LOOKBACK_DAYS

  // Daily surplus = daily budget − average daily spending
  const averageDailySurplus = dailyBudget - averageDailySpending

  // If surplus is zero or negative, user can't afford it at current pace
  if (averageDailySurplus <= 0) {
    return {
      daysToAfford: Infinity,
      averageDailySurplus: Math.max(0, averageDailySurplus),
      message: hasEnoughData
        ? "Keep going — your surplus will grow as you find your rhythm."
        : "Log a few more days to see your projection.",
      hasEnoughData,
    }
  }

  const daysToAfford = Math.ceil(remaining / averageDailySurplus)

  // Build friendly message
  const message = buildProjectionMessage(daysToAfford, hasEnoughData)

  return {
    daysToAfford,
    averageDailySurplus: Math.round(averageDailySurplus * 100) / 100,
    message,
    hasEnoughData,
  }
}

/**
 * Builds an encouraging, warm message for the projection.
 * Short and casual — never judgmental.
 */
function buildProjectionMessage(days: number, hasEnoughData: boolean): string {
  if (!hasEnoughData) {
    return "Log a few more days to see your projection."
  }
  if (days <= 1) {
    return "You could grab this tomorrow! ✨"
  }
  if (days <= 7) {
    return `~${days} days at your current pace — so close!`
  }
  if (days <= 30) {
    return `~${days} days at your current pace.`
  }
  if (days <= 90) {
    const weeks = Math.round(days / 7)
    return `~${weeks} weeks at your current pace.`
  }
  const months = Math.round(days / 30)
  return `~${months} months at your current pace. A save-up plan could help!`
}

// ============================================================================
// 351.3 — One-tap Save-Up Plan Linkage
// ============================================================================

/**
 * Converts a wish item into a SaveUpInput for the existing save-up plan system.
 * Pre-fills the target amount and calculates the weekly contribution rate based
 * on the user's average daily surplus.
 *
 * @param wishItem - The wish item to convert
 * @param transactions - Recent transactions (for surplus calculation)
 * @param budgets - Current budget configuration
 * @param currentDate - Today's date
 * @returns A SaveUpInput ready to pass to computeSaveUpPlan()
 */
export function convertWishToSaveUpPlan(
  wishItem: WishItem,
  transactions: Transaction[],
  budgets: Budget[],
  currentDate: Date = new Date()
): SaveUpInput {
  const projection = computeWishProjection(wishItem, transactions, budgets, currentDate)

  // Calculate weekly contribution from daily surplus (surplus × 7)
  // Minimum $5/week so there's always a meaningful plan
  const weeklyContribution = Math.max(5, Math.round(projection.averageDailySurplus * 7))

  return {
    targetAmount: wishItem.amount,
    currentAmount: wishItem.savedSoFar,
    contributionRate: weeklyContribution,
    period: 'weekly' as ContributionPeriod,
  }
}

/**
 * Links a wish item to an existing save-up plan by updating the saveUpPlanId.
 * After linking, progress syncs between the wish item and the plan.
 */
export async function linkWishToSaveUpPlan(
  userId: string,
  wishItemId: string,
  planId: string
): Promise<WishItem | null> {
  return updateWishItem(userId, wishItemId, { saveUpPlanId: planId })
}

/**
 * Syncs a wish item's savedSoFar with an external progress value
 * (e.g., from a linked save-up plan's current amount).
 * Also marks the item as complete if the saved amount meets or exceeds the target.
 */
export async function syncWishItemProgress(
  userId: string,
  wishItemId: string,
  currentSaved: number,
  targetAmount: number
): Promise<WishItem | null> {
  const isComplete = currentSaved >= targetAmount
  return updateWishItem(userId, wishItemId, {
    savedSoFar: currentSaved,
    isComplete,
  })
}

// ============================================================================
// Date helpers (simple, self-contained — avoids circular imports)
// ============================================================================

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}
