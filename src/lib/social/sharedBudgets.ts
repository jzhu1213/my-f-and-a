/**
 * Shared Budgets data access layer (task 359).
 *
 * Collaborative budgets where friends contribute to and spend from a shared pool.
 * Unlike householdPool (which is completely separate from personal transactions),
 * shared budget contributions DEDUCT from each member's personal daily allowance.
 *
 * Key differences from householdPool:
 * - Contributions reduce personal allowance (via getActiveSharedBudgetContributions)
 * - Linked to the friend graph — members must be friends
 * - Transparent: both members see all expenses and remaining balance
 * - Notifications when budget is running low
 *
 * Persistence: Supabase-first with localStorage offline fallback.
 * Tables: `shared_budgets` + `shared_budget_members` + `shared_budget_expenses`
 * RLS ensures only members can see/mutate their shared budgets.
 *
 * Requirements: 19.5, 2.x, 14.4
 */

import { supabase } from '../supabaseClient'
import { createNotification } from './notifications'

// ============================================================================
// Types
// ============================================================================

/** Status of a shared budget */
export type SharedBudgetStatus = 'active' | 'archived'

// ── Database row types (snake_case) ─────────────────────────────────────────

/** Raw row from the `shared_budgets` table */
export interface DbSharedBudget {
  id: string
  name: string
  category: string
  monthly_limit: number
  current_spent: number
  status: SharedBudgetStatus
  created_by: string
  created_at: string
  updated_at: string
}

/** Raw row from the `shared_budget_members` table */
export interface DbSharedBudgetMember {
  id: string
  budget_id: string
  user_id: string
  contribution_amount: number
  joined_at: string
}

/** Raw row from the `shared_budget_expenses` table */
export interface DbSharedBudgetExpense {
  id: string
  budget_id: string
  logged_by: string
  amount: number
  note: string
  date: string
  created_at: string
}

// ── App-level types (camelCase) ─────────────────────────────────────────────

/** A member of a shared budget with their agreed contribution */
export interface SharedBudgetMember {
  id: string
  budgetId: string
  userId: string
  contributionAmount: number
  joinedAt: string
}

/** An expense logged against a shared budget */
export interface SharedBudgetExpense {
  id: string
  budgetId: string
  loggedBy: string
  amount: number
  note: string
  date: string
  createdAt: string
}

/** A shared budget with its members */
export interface SharedBudget {
  id: string
  name: string
  category: string
  monthlyLimit: number
  members: SharedBudgetMember[]
  currentSpent: number
  status: SharedBudgetStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Summary view for a shared budget */
export interface SharedBudgetSummary {
  budgetId: string
  name: string
  category: string
  monthlyLimit: number
  currentSpent: number
  remaining: number
  percentUsed: number
  memberCount: number
  isLow: boolean
}

// ============================================================================
// Mappers
// ============================================================================

/** Map a DB shared budget row to the app-level shape */
function mapDbSharedBudget(row: DbSharedBudget, members: SharedBudgetMember[] = []): SharedBudget {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    monthlyLimit: Number(row.monthly_limit),
    members,
    currentSpent: Number(row.current_spent),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Map a DB member row to the app-level shape */
function mapDbMember(row: DbSharedBudgetMember): SharedBudgetMember {
  return {
    id: row.id,
    budgetId: row.budget_id,
    userId: row.user_id,
    contributionAmount: Number(row.contribution_amount),
    joinedAt: row.joined_at,
  }
}

/** Map a DB expense row to the app-level shape */
function mapDbExpense(row: DbSharedBudgetExpense): SharedBudgetExpense {
  return {
    id: row.id,
    budgetId: row.budget_id,
    loggedBy: row.logged_by,
    amount: Number(row.amount),
    note: row.note ?? '',
    date: row.date,
    createdAt: row.created_at,
  }
}

// ============================================================================
// Friendly Error Copy
// ============================================================================

/** Warm, non-shaming error messages for shared budgets UI */
export const SHARED_BUDGET_ERRORS = {
  noConnection: "Couldn't reach the server — we'll try again when you're back online.",
  notFriends: "You'll need to be friends first before sharing a budget together.",
  alreadyMember: "They're already part of this shared budget.",
  notMember: "You're not a member of this shared budget.",
  budgetFull: "This budget already has its members set — try creating a new one.",
  createFailed: "Couldn't create the shared budget — give it another try in a moment.",
  fetchFailed: "Couldn't load shared budgets right now — try again in a moment.",
  expenseFailed: "Couldn't log that expense — we'll retry when you're back online.",
  unknown: 'Something went wrong on our end — give it another try in a moment.',
} as const

// ============================================================================
// Offline Queue Integration
// ============================================================================

const SHARED_BUDGET_QUEUE_KEY = 'folio-shared-budget-queue'
const SHARED_BUDGET_CACHE_KEY = 'folio-shared-budgets-cache'
const LOW_BALANCE_NOTIFIED_KEY = 'folio-shared-budget-low-notified'

/** Low balance threshold — notify when remaining drops below 20% of limit */
const LOW_BALANCE_THRESHOLD = 0.20

interface SharedBudgetQueueItem {
  id: string
  action: 'create' | 'update' | 'archive' | 'invite' | 'remove_member' | 'log_expense'
  payload: Record<string, unknown>
  createdAt: string
}

/** Enqueue a failed shared budget mutation for background retry */
export function enqueueSharedBudgetOp(
  action: SharedBudgetQueueItem['action'],
  payload: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(SHARED_BUDGET_QUEUE_KEY)
    const queue: SharedBudgetQueueItem[] = raw ? JSON.parse(raw) : []
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      action,
      payload,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(SHARED_BUDGET_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage unavailable — silent fail
  }
}

/** Read pending shared budget operations (for retry logic) */
export function getSharedBudgetQueue(): SharedBudgetQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHARED_BUDGET_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Remove a successfully processed queue item */
export function removeSharedBudgetQueueItem(id: string): void {
  if (typeof window === 'undefined') return
  const queue = getSharedBudgetQueue().filter((item) => item.id !== id)
  localStorage.setItem(SHARED_BUDGET_QUEUE_KEY, JSON.stringify(queue))
}

// ============================================================================
// localStorage Cache (offline fallback)
// ============================================================================

/** Cache shared budgets locally for offline display */
export function cacheSharedBudgets(budgets: SharedBudget[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SHARED_BUDGET_CACHE_KEY, JSON.stringify(budgets))
  } catch {
    // silent
  }
}

/** Read cached shared budgets (offline fallback) */
export function getCachedSharedBudgets(): SharedBudget[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHARED_BUDGET_CACHE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// ============================================================================
// Low Balance Notification Tracking
// ============================================================================

/** Track which budgets have already sent a low-balance notification this period */
export function hasLowBalanceBeenNotified(budgetId: string, period: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(LOW_BALANCE_NOTIFIED_KEY)
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    return map[budgetId] === period
  } catch {
    return false
  }
}

/** Mark a budget as having sent its low-balance notification for this period */
export function markLowBalanceNotified(budgetId: string, period: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(LOW_BALANCE_NOTIFIED_KEY)
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    map[budgetId] = period
    localStorage.setItem(LOW_BALANCE_NOTIFIED_KEY, JSON.stringify(map))
  } catch {
    // silent
  }
}

/** Get current budget period key (YYYY-MM) */
function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ============================================================================
// Data Access Functions — CRUD
// ============================================================================

/**
 * Create a new shared budget.
 * The creating user is automatically added as the first member.
 * Returns the new SharedBudget on success, or null on failure.
 */
export async function createSharedBudget(params: {
  name: string
  category: string
  monthlyLimit: number
  contributionAmount: number
}): Promise<SharedBudget | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[createSharedBudget] No authenticated user')
    return null
  }

  const { name, category, monthlyLimit, contributionAmount } = params

  // Insert the budget
  const { data: budgetData, error: budgetError } = await supabase
    .from('shared_budgets')
    .insert({
      name,
      category,
      monthly_limit: Math.round(monthlyLimit * 100) / 100,
      current_spent: 0,
      status: 'active',
      created_by: userId,
    })
    .select()
    .single()

  if (budgetError || !budgetData) {
    console.error('[createSharedBudget]', budgetError?.message)
    enqueueSharedBudgetOp('create', params)
    return null
  }

  const budget = budgetData as unknown as DbSharedBudget

  // Add the creator as the first member
  const { data: memberData, error: memberError } = await supabase
    .from('shared_budget_members')
    .insert({
      budget_id: budget.id,
      user_id: userId,
      contribution_amount: Math.round(contributionAmount * 100) / 100,
    })
    .select()
    .single()

  if (memberError) {
    console.error('[createSharedBudget] member insert failed', memberError.message)
  }

  const members: SharedBudgetMember[] = memberData
    ? [mapDbMember(memberData as unknown as DbSharedBudgetMember)]
    : []

  return mapDbSharedBudget(budget, members)
}

/**
 * Get all shared budgets the current user is a member of.
 * Falls back to localStorage cache if network is unavailable.
 */
export async function getSharedBudgets(): Promise<SharedBudget[]> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return getCachedSharedBudgets()

  // Find budget IDs where the user is a member
  const { data: memberRows, error: memberError } = await supabase
    .from('shared_budget_members')
    .select('budget_id')
    .eq('user_id', userId)

  if (memberError || !memberRows || memberRows.length === 0) {
    if (memberError) {
      console.error('[getSharedBudgets]', memberError.message)
      return getCachedSharedBudgets()
    }
    return []
  }

  const budgetIds = memberRows.map((r) => (r as { budget_id: string }).budget_id)

  // Fetch the budgets
  const { data: budgetRows, error: budgetError } = await supabase
    .from('shared_budgets')
    .select('*')
    .in('id', budgetIds)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (budgetError || !budgetRows) {
    console.error('[getSharedBudgets]', budgetError?.message)
    return getCachedSharedBudgets()
  }

  // Fetch all members for these budgets
  const { data: allMembers } = await supabase
    .from('shared_budget_members')
    .select('*')
    .in('budget_id', budgetIds)

  const membersByBudget = new Map<string, SharedBudgetMember[]>()
  for (const row of (allMembers ?? []) as unknown as DbSharedBudgetMember[]) {
    const mapped = mapDbMember(row)
    const existing = membersByBudget.get(mapped.budgetId) ?? []
    existing.push(mapped)
    membersByBudget.set(mapped.budgetId, existing)
  }

  const budgets = (budgetRows as unknown as DbSharedBudget[]).map((row) =>
    mapDbSharedBudget(row, membersByBudget.get(row.id) ?? [])
  )

  // Cache for offline fallback
  cacheSharedBudgets(budgets)

  return budgets
}

/**
 * Get a single shared budget by ID (with members).
 * Returns null if not found or user is not a member.
 */
export async function getSharedBudget(budgetId: string): Promise<SharedBudget | null> {
  const { data: budgetRow, error } = await supabase
    .from('shared_budgets')
    .select('*')
    .eq('id', budgetId)
    .single()

  if (error || !budgetRow) {
    console.error('[getSharedBudget]', error?.message)
    return null
  }

  const { data: memberRows } = await supabase
    .from('shared_budget_members')
    .select('*')
    .eq('budget_id', budgetId)

  const members = ((memberRows ?? []) as unknown as DbSharedBudgetMember[]).map(mapDbMember)

  return mapDbSharedBudget(budgetRow as unknown as DbSharedBudget, members)
}

/**
 * Update a shared budget's name, category, or monthly limit.
 * Only members can update. Returns the updated budget or null.
 */
export async function updateSharedBudget(
  budgetId: string,
  updates: { name?: string; category?: string; monthlyLimit?: number }
): Promise<SharedBudget | null> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.monthlyLimit !== undefined)
    dbUpdates.monthly_limit = Math.round(updates.monthlyLimit * 100) / 100

  const { data, error } = await supabase
    .from('shared_budgets')
    .update(dbUpdates)
    .eq('id', budgetId)
    .select()
    .single()

  if (error || !data) {
    console.error('[updateSharedBudget]', error?.message)
    enqueueSharedBudgetOp('update', { budgetId, ...updates })
    return null
  }

  // Re-fetch with members
  return getSharedBudget(budgetId)
}

/**
 * Archive a shared budget (soft delete).
 * Both members retain visibility but no new expenses can be logged.
 */
export async function archiveSharedBudget(budgetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('shared_budgets')
    .update({ status: 'archived' })
    .eq('id', budgetId)

  if (error) {
    console.error('[archiveSharedBudget]', error.message)
    enqueueSharedBudgetOp('archive', { budgetId })
    return false
  }

  return true
}

/**
 * Invite a friend as a member of a shared budget.
 * Validates that the invitee is an accepted friend.
 * Returns the new member on success, or null on failure.
 */
export async function inviteMember(params: {
  budgetId: string
  friendUserId: string
  contributionAmount: number
}): Promise<SharedBudgetMember | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[inviteMember] No authenticated user')
    return null
  }

  const { budgetId, friendUserId, contributionAmount } = params

  // Verify friendship exists
  const { data: friendship, error: friendError } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${userId})`
    )
    .limit(1)
    .single()

  if (friendError || !friendship) {
    console.error('[inviteMember] Not friends', friendError?.message)
    return null
  }

  // Check they're not already a member
  const { data: existingMember } = await supabase
    .from('shared_budget_members')
    .select('id')
    .eq('budget_id', budgetId)
    .eq('user_id', friendUserId)
    .limit(1)

  if (existingMember && existingMember.length > 0) {
    console.error('[inviteMember] Already a member')
    return null
  }

  // Insert the new member
  const { data, error } = await supabase
    .from('shared_budget_members')
    .insert({
      budget_id: budgetId,
      user_id: friendUserId,
      contribution_amount: Math.round(contributionAmount * 100) / 100,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[inviteMember]', error?.message)
    enqueueSharedBudgetOp('invite', params)
    return null
  }

  // Send notification to the invited friend
  const budget = await getSharedBudget(budgetId)
  if (budget) {
    await createNotification(friendUserId, 'friend_accepted', {
      sharedBudgetId: budgetId,
      sharedBudgetName: budget.name,
      message: `You've been added to the shared budget "${budget.name}"`,
    })
  }

  return mapDbMember(data as unknown as DbSharedBudgetMember)
}

/**
 * Remove a member from a shared budget.
 * Returns true on success, false on failure.
 */
export async function removeMember(budgetId: string, memberUserId: string): Promise<boolean> {
  const { error } = await supabase
    .from('shared_budget_members')
    .delete()
    .eq('budget_id', budgetId)
    .eq('user_id', memberUserId)

  if (error) {
    console.error('[removeMember]', error.message)
    enqueueSharedBudgetOp('remove_member', { budgetId, memberUserId })
    return false
  }

  return true
}

// ============================================================================
// Data Access Functions — Expenses (Task 359.2)
// ============================================================================

/**
 * Log an expense against a shared budget.
 * Either member can log. Updates current_spent on the budget.
 * Spending from the shared budget does NOT deduct from personal allowance —
 * it's already accounted for in the member's contribution.
 *
 * Returns the new expense on success, or null on failure.
 */
export async function logSharedExpense(params: {
  budgetId: string
  amount: number
  note?: string
  date?: string
}): Promise<SharedBudgetExpense | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[logSharedExpense] No authenticated user')
    return null
  }

  const { budgetId, amount, note = '', date } = params
  const expenseDate = date ?? new Date().toISOString().split('T')[0]
  const roundedAmount = Math.round(amount * 100) / 100

  // Verify user is a member of this budget
  const { data: membership } = await supabase
    .from('shared_budget_members')
    .select('id')
    .eq('budget_id', budgetId)
    .eq('user_id', userId)
    .limit(1)

  if (!membership || membership.length === 0) {
    console.error('[logSharedExpense] Not a member of this budget')
    return null
  }

  // Insert the expense
  const { data: expenseData, error: expenseError } = await supabase
    .from('shared_budget_expenses')
    .insert({
      budget_id: budgetId,
      logged_by: userId,
      amount: roundedAmount,
      note,
      date: expenseDate,
    })
    .select()
    .single()

  if (expenseError || !expenseData) {
    console.error('[logSharedExpense]', expenseError?.message)
    enqueueSharedBudgetOp('log_expense', params)
    return null
  }

  // Update current_spent on the budget
  const { error: updateError } = await supabase.rpc('increment_shared_budget_spent', {
    p_budget_id: budgetId,
    p_amount: roundedAmount,
  })

  if (updateError) {
    // Fallback: manually update current_spent
    const { data: budgetRow } = await supabase
      .from('shared_budgets')
      .select('current_spent')
      .eq('id', budgetId)
      .single()

    if (budgetRow) {
      const newSpent = Number((budgetRow as { current_spent: number }).current_spent) + roundedAmount
      await supabase
        .from('shared_budgets')
        .update({ current_spent: Math.round(newSpent * 100) / 100 })
        .eq('id', budgetId)
    }
  }

  // Check low balance and notify if needed
  await checkLowBalanceNotification(budgetId)

  return mapDbExpense(expenseData as unknown as DbSharedBudgetExpense)
}

/**
 * Get all expenses for a shared budget (ordered by date descending).
 * Both members see all expenses — full transparency.
 */
export async function getSharedExpenses(budgetId: string): Promise<SharedBudgetExpense[]> {
  const { data, error } = await supabase
    .from('shared_budget_expenses')
    .select('*')
    .eq('budget_id', budgetId)
    .order('date', { ascending: false })

  if (error) {
    console.error('[getSharedExpenses]', error.message)
    return []
  }

  return ((data ?? []) as unknown as DbSharedBudgetExpense[]).map(mapDbExpense)
}

// ============================================================================
// Data Access Functions — Transparency & Summary (Task 359.3)
// ============================================================================

/**
 * Get a summary of a shared budget: limit, spent, remaining, percent used.
 * Both members see the same real-time data — no hiding.
 */
export async function getSharedBudgetSummary(budgetId: string): Promise<SharedBudgetSummary | null> {
  const budget = await getSharedBudget(budgetId)
  if (!budget) return null

  const remaining = Math.max(0, Math.round((budget.monthlyLimit - budget.currentSpent) * 100) / 100)
  const percentUsed = budget.monthlyLimit > 0
    ? Math.round((budget.currentSpent / budget.monthlyLimit) * 100)
    : 0

  return {
    budgetId: budget.id,
    name: budget.name,
    category: budget.category,
    monthlyLimit: budget.monthlyLimit,
    currentSpent: budget.currentSpent,
    remaining,
    percentUsed: Math.min(percentUsed, 100),
    memberCount: budget.members.length,
    isLow: remaining <= budget.monthlyLimit * LOW_BALANCE_THRESHOLD,
  }
}

/**
 * Get activity log for a shared budget — all expenses with who logged them.
 * Provides full transparency: both members see everything.
 */
export async function getSharedBudgetActivity(budgetId: string): Promise<SharedBudgetExpense[]> {
  return getSharedExpenses(budgetId)
}

/**
 * Check if a shared budget is running low and send notifications to all members.
 * "Low" = remaining balance is ≤ 20% of the monthly limit.
 * Only sends once per budget period to avoid spam.
 */
export async function checkLowBalanceNotification(budgetId: string): Promise<boolean> {
  const period = getCurrentPeriod()

  // Skip if already notified this period
  if (hasLowBalanceBeenNotified(budgetId, period)) {
    return false
  }

  const budget = await getSharedBudget(budgetId)
  if (!budget || budget.status !== 'active') return false

  const remaining = budget.monthlyLimit - budget.currentSpent
  const isLow = remaining <= budget.monthlyLimit * LOW_BALANCE_THRESHOLD

  if (!isLow) return false

  // Mark as notified before sending (prevent duplicate sends)
  markLowBalanceNotified(budgetId, period)

  // Notify all members
  for (const member of budget.members) {
    await createNotification(member.userId, 'settle_reminder', {
      sharedBudgetId: budgetId,
      sharedBudgetName: budget.name,
      remaining: Math.round(remaining * 100) / 100,
      message: `Your shared budget "${budget.name}" is running low — $${Math.max(0, remaining).toFixed(2)} left`,
    })
  }

  return true
}

// ============================================================================
// Contribution Helper — for Daily Allowance Integration (Task 359.2)
// ============================================================================

/**
 * Get the total monthly contribution amount for a user across all active shared budgets.
 *
 * This is the key integration point with the daily allowance engine:
 * the caller (useHomeData hook) deducts this amount from the user's personal
 * monthly pool before computing the daily allowance.
 *
 * Spending from the shared budget does NOT deduct from personal allowance —
 * it's already accounted for here in the contribution.
 *
 * Falls back to localStorage cache if network is unavailable.
 */
export async function getActiveSharedBudgetContributions(userId?: string): Promise<number> {
  let effectiveUserId = userId

  if (!effectiveUserId) {
    const { data: session } = await supabase.auth.getSession()
    effectiveUserId = session?.session?.user?.id
    if (!effectiveUserId) return 0
  }

  // Fetch all active memberships for this user
  const { data: memberRows, error: memberError } = await supabase
    .from('shared_budget_members')
    .select('budget_id, contribution_amount')
    .eq('user_id', effectiveUserId)

  if (memberError || !memberRows) {
    console.error('[getActiveSharedBudgetContributions]', memberError?.message)
    // Fallback: estimate from cache
    const cached = getCachedSharedBudgets()
    let total = 0
    for (const budget of cached) {
      if (budget.status !== 'active') continue
      const member = budget.members.find((m) => m.userId === effectiveUserId)
      if (member) {
        total += member.contributionAmount
      }
    }
    return Math.round(total * 100) / 100
  }

  if (memberRows.length === 0) return 0

  // Filter to only active budgets
  const budgetIds = memberRows.map((r) => (r as { budget_id: string }).budget_id)

  const { data: activeBudgets, error: budgetError } = await supabase
    .from('shared_budgets')
    .select('id')
    .in('id', budgetIds)
    .eq('status', 'active')

  if (budgetError || !activeBudgets) {
    console.error('[getActiveSharedBudgetContributions]', budgetError?.message)
    return 0
  }

  const activeIds = new Set(activeBudgets.map((b) => (b as { id: string }).id))

  // Sum contributions only for active budgets
  let total = 0
  for (const row of memberRows as unknown as { budget_id: string; contribution_amount: number }[]) {
    if (activeIds.has(row.budget_id)) {
      total += Number(row.contribution_amount)
    }
  }

  return Math.round(total * 100) / 100
}

// ============================================================================
// Background Queue Processing
// ============================================================================

/**
 * Process pending items in the shared budget queue (background retry).
 * Call this when connectivity is restored.
 */
export async function processSharedBudgetQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getSharedBudgetQueue()
  let succeeded = 0
  let failed = 0

  for (const item of queue) {
    let success = false

    switch (item.action) {
      case 'create': {
        const result = await createSharedBudget(item.payload as {
          name: string
          category: string
          monthlyLimit: number
          contributionAmount: number
        })
        success = result !== null
        break
      }
      case 'update': {
        const { budgetId, ...updates } = item.payload as {
          budgetId: string
          name?: string
          category?: string
          monthlyLimit?: number
        }
        const result = await updateSharedBudget(budgetId, updates)
        success = result !== null
        break
      }
      case 'archive': {
        success = await archiveSharedBudget(item.payload.budgetId as string)
        break
      }
      case 'invite': {
        const result = await inviteMember(item.payload as {
          budgetId: string
          friendUserId: string
          contributionAmount: number
        })
        success = result !== null
        break
      }
      case 'remove_member': {
        success = await removeMember(
          item.payload.budgetId as string,
          item.payload.memberUserId as string
        )
        break
      }
      case 'log_expense': {
        const result = await logSharedExpense(item.payload as {
          budgetId: string
          amount: number
          note?: string
          date?: string
        })
        success = result !== null
        break
      }
    }

    if (success) {
      removeSharedBudgetQueueItem(item.id)
      succeeded++
    } else {
      failed++
    }
  }

  return { succeeded, failed }
}
