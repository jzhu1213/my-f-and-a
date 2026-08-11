/**
 * Household Pool Utilities
 *
 * Types and functions for managing shared household/roommate expense pools.
 * A pool is a shared budget (e.g. "Groceries", "Utilities") that roommates
 * log expenses into together. Pool expenses are COMPLETELY SEPARATE from
 * personal transactions — they never flow into computeDailyAllowance or
 * affect the hero number.
 *
 * Persistence: Supabase-first with localStorage fallback (offline/unauthenticated).
 * On first authenticated load, local pools migrate to the server once.
 *
 * NOTE: `monthlyLimit` and `isActive` are LOCAL-ONLY fields. The DB schema
 * does not store them — they live in a separate localStorage map keyed by
 * pool ID (`folio-pool-local-meta`). This keeps backward compat without
 * schema changes.
 *
 * Task 170.1 — Household / roommate shared budget
 * Task 289.1 — Persist pools + members + entries to Supabase
 */

import { supabase } from './supabaseClient'

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
  /** Owner user ID (mapped from DB owner_id). Null for local-only pools. */
  ownerId?: string | null
}

/** A member of a household pool */
export interface HouseholdPoolMember {
  id: string
  name: string
  joinedAt: string
  /** Linked user ID if the member is a registered user */
  userId?: string | null
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
const LOCAL_META_KEY = 'folio-pool-local-meta'
const MIGRATION_FLAG_KEY = 'folio-pool-migrated-to-server'
const POOL_QUEUE_KEY = 'folio-pool-queue'

// ============================================================================
// Local Meta — monthlyLimit + isActive stored separately
// ============================================================================

interface PoolLocalMeta {
  monthlyLimit: number
  isActive: boolean
}

function loadLocalMeta(): Record<string, PoolLocalMeta> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalMeta(meta: Record<string, PoolLocalMeta>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_META_KEY, JSON.stringify(meta))
}

function getPoolMeta(poolId: string): PoolLocalMeta {
  const meta = loadLocalMeta()
  return meta[poolId] ?? { monthlyLimit: 0, isActive: true }
}

function setPoolMeta(poolId: string, updates: Partial<PoolLocalMeta>): void {
  const meta = loadLocalMeta()
  meta[poolId] = { ...getPoolMeta(poolId), ...updates }
  saveLocalMeta(meta)
}

// ============================================================================
// Offline Queue — failed mutations queued for background retry
// ============================================================================

interface PoolQueueItem {
  id: string
  action: 'create_pool' | 'update_pool' | 'delete_pool' | 'add_member' | 'remove_member' | 'log_expense'
  payload: Record<string, unknown>
  createdAt: string
}

function enqueuePoolOp(action: PoolQueueItem['action'], payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(POOL_QUEUE_KEY)
    const queue: PoolQueueItem[] = raw ? JSON.parse(raw) : []
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      action,
      payload,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(POOL_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // silent
  }
}

export function getPoolQueue(): PoolQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(POOL_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function removePoolQueueItem(id: string): void {
  if (typeof window === 'undefined') return
  const queue = getPoolQueue().filter(item => item.id !== id)
  localStorage.setItem(POOL_QUEUE_KEY, JSON.stringify(queue))
}

// ============================================================================
// localStorage Helpers (legacy + fallback)
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
// Auth Helper
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: session } = await supabase.auth.getSession()
    return session?.session?.user?.id ?? null
  } catch {
    return null
  }
}

// ============================================================================
// DB → App Mapping
// ============================================================================

interface DbPool {
  id: string
  owner_id: string
  name: string
  emoji: string
  share_token: string
  created_at: string
}

interface DbPoolMember {
  id: string
  pool_id: string
  user_id: string | null
  name: string
  joined_at: string
}

interface DbPoolEntry {
  id: string
  pool_id: string
  added_by: string | null
  label: string
  amount: number
  paid_by: string | null
  created_at: string
}

function mapPoolFromDb(row: DbPool, members: DbPoolMember[]): HouseholdPool {
  const meta = getPoolMeta(row.id)
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || '🏠',
    monthlyLimit: meta.monthlyLimit,
    members: members.map(m => ({
      id: m.id,
      name: m.name,
      joinedAt: m.joined_at,
      userId: m.user_id,
    })),
    shareToken: row.share_token,
    createdAt: row.created_at,
    isActive: meta.isActive,
    ownerId: row.owner_id,
  }
}

function mapEntryFromDb(row: DbPoolEntry): HouseholdPoolExpense {
  return {
    id: row.id,
    poolId: row.pool_id,
    amount: Number(row.amount),
    category: 'general',
    note: row.label || '',
    loggedBy: row.paid_by || 'Someone',
    date: row.created_at.split('T')[0],
    createdAt: row.created_at,
  }
}

// ============================================================================
// Migration — local → cloud (once)
// ============================================================================

/**
 * On first authenticated load: if local pools exist and no server pools
 * exist yet, upload local data once and flag as migrated.
 */
export async function migrateLocalPoolsToServer(): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return

  const userId = await getCurrentUserId()
  if (!userId) return

  const localPools = loadPools().filter(p => p.isActive)
  if (localPools.length === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    return
  }

  // Check if server already has pools for this user
  const { data: serverPools } = await supabase
    .from('pools')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)

  if (serverPools && serverPools.length > 0) {
    // Server already has data — don't overwrite
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    return
  }

  // Upload each local pool
  for (const pool of localPools) {
    const { data: insertedPool, error: poolErr } = await supabase
      .from('pools')
      .insert({
        owner_id: userId,
        name: pool.name,
        emoji: pool.emoji,
      })
      .select()
      .single()

    if (poolErr || !insertedPool) continue
    const newPool = insertedPool as unknown as DbPool

    // Preserve local meta for the new server ID
    setPoolMeta(newPool.id, { monthlyLimit: pool.monthlyLimit, isActive: pool.isActive })

    // Upload members
    if (pool.members.length > 0) {
      const memberRows = pool.members.map(m => ({
        pool_id: newPool.id,
        name: m.name,
      }))
      await supabase.from('pool_members').insert(memberRows)
    }

    // Upload expenses
    const localExpenses = loadExpenses().filter(e => e.poolId === pool.id)
    if (localExpenses.length > 0) {
      const entryRows = localExpenses.map(e => ({
        pool_id: newPool.id,
        added_by: userId,
        label: e.note || e.category || 'Expense',
        amount: e.amount,
        paid_by: e.loggedBy,
        created_at: e.createdAt,
      }))
      await supabase.from('pool_entries').insert(entryRows)
    }
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
}

// ============================================================================
// Pool CRUD — async, Supabase-first with localStorage fallback
// ============================================================================

/**
 * Create a new household pool.
 */
export async function createPool(name: string, emoji: string, monthlyLimit: number): Promise<HouseholdPool> {
  const trimmedName = name.trim() || 'Shared Pool'
  const poolEmoji = emoji || '🏠'
  const limit = Math.max(0, monthlyLimit)

  const userId = await getCurrentUserId()

  if (userId) {
    const { data, error } = await supabase
      .from('pools')
      .insert({
        owner_id: userId,
        name: trimmedName,
        emoji: poolEmoji,
      })
      .select()
      .single()

    if (!error && data) {
      const row = data as unknown as DbPool
      setPoolMeta(row.id, { monthlyLimit: limit, isActive: true })
      return mapPoolFromDb(row, [])
    }

    // Supabase failed — queue and fall through to local
    enqueuePoolOp('create_pool', { name: trimmedName, emoji: poolEmoji, monthlyLimit: limit })
  }

  // localStorage fallback
  const pools = loadPools()
  const pool: HouseholdPool = {
    id: crypto.randomUUID(),
    name: trimmedName,
    emoji: poolEmoji,
    monthlyLimit: limit,
    members: [],
    shareToken: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isActive: true,
    ownerId: userId,
  }
  pools.push(pool)
  savePools(pools)
  setPoolMeta(pool.id, { monthlyLimit: limit, isActive: true })
  return pool
}

/**
 * Get a single pool by ID.
 */
export async function getPool(id: string): Promise<HouseholdPool | null> {
  const userId = await getCurrentUserId()

  if (userId) {
    const { data: poolData, error: poolErr } = await supabase
      .from('pools')
      .select('*')
      .eq('id', id)
      .single()

    if (!poolErr && poolData) {
      const row = poolData as unknown as DbPool
      const { data: members } = await supabase
        .from('pool_members')
        .select('*')
        .eq('pool_id', id)

      const pool = mapPoolFromDb(row, (members ?? []) as unknown as DbPoolMember[])
      if (!pool.isActive) return null
      return pool
    }
  }

  // localStorage fallback
  const pools = loadPools()
  const meta = getPoolMeta(id)
  const local = pools.find(p => p.id === id)
  if (!local) return null
  if (!meta.isActive && !local.isActive) return null
  return { ...local, monthlyLimit: meta.monthlyLimit, isActive: meta.isActive }
}

/**
 * Get all active pools for the current user.
 */
export async function getPools(): Promise<HouseholdPool[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    // Fetch pools user owns
    const { data: ownedData, error: ownedErr } = await supabase
      .from('pools')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (!ownedErr && ownedData && ownedData.length > 0) {
      const poolIds = (ownedData as unknown as DbPool[]).map(p => p.id)

      // Batch-fetch all members for these pools
      const { data: allMembers } = await supabase
        .from('pool_members')
        .select('*')
        .in('pool_id', poolIds)

      const membersMap = new Map<string, DbPoolMember[]>()
      for (const m of (allMembers ?? []) as unknown as DbPoolMember[]) {
        const existing = membersMap.get(m.pool_id) ?? []
        existing.push(m)
        membersMap.set(m.pool_id, existing)
      }

      return (ownedData as unknown as DbPool[])
        .map(row => mapPoolFromDb(row, membersMap.get(row.id) ?? []))
        .filter(p => p.isActive)
    }

    // No server pools — check if there's any data at all
    if (!ownedErr) {
      // Authenticated but no pools on server — try migration then fall through to local
      await migrateLocalPoolsToServer()
    }
  }

  // localStorage fallback
  return loadPools().filter(p => p.isActive)
}

/**
 * Update a pool's name, emoji, or monthly limit.
 */
export async function updatePool(
  id: string,
  updates: Partial<Pick<HouseholdPool, 'name' | 'emoji' | 'monthlyLimit'>>
): Promise<HouseholdPool | null> {
  const userId = await getCurrentUserId()

  // Update local meta for monthlyLimit
  if (updates.monthlyLimit !== undefined) {
    setPoolMeta(id, { monthlyLimit: Math.max(0, updates.monthlyLimit) })
  }

  if (userId) {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim() || undefined
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji || undefined

    if (Object.keys(dbUpdates).length > 0) {
      const { data, error } = await supabase
        .from('pools')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

      if (!error && data) {
        const row = data as unknown as DbPool
        const { data: members } = await supabase
          .from('pool_members')
          .select('*')
          .eq('pool_id', id)
        return mapPoolFromDb(row, (members ?? []) as unknown as DbPoolMember[])
      }
    } else {
      // Only monthlyLimit changed — return current pool
      return getPool(id)
    }

    enqueuePoolOp('update_pool', { id, updates })
  }

  // localStorage fallback
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
 * Soft-delete a pool (mark as inactive locally, delete from server).
 */
export async function deletePool(id: string): Promise<boolean> {
  setPoolMeta(id, { isActive: false })

  const userId = await getCurrentUserId()

  if (userId) {
    const { error } = await supabase
      .from('pools')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)

    if (!error) return true

    enqueuePoolOp('delete_pool', { id })
  }

  // localStorage fallback
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
export async function addMember(poolId: string, name: string): Promise<HouseholdPoolMember | null> {
  const memberName = name.trim() || 'Roommate'
  const userId = await getCurrentUserId()

  if (userId) {
    const { data, error } = await supabase
      .from('pool_members')
      .insert({
        pool_id: poolId,
        name: memberName,
        // user_id left null — guest members don't have an account yet
      })
      .select()
      .single()

    if (!error && data) {
      const row = data as unknown as DbPoolMember
      return {
        id: row.id,
        name: row.name,
        joinedAt: row.joined_at,
        userId: row.user_id,
      }
    }

    enqueuePoolOp('add_member', { poolId, name: memberName })
  }

  // localStorage fallback
  const pools = loadPools()
  const pool = pools.find(p => p.id === poolId && p.isActive)
  if (!pool) return null

  const member: HouseholdPoolMember = {
    id: crypto.randomUUID(),
    name: memberName,
    joinedAt: new Date().toISOString(),
  }
  pool.members.push(member)
  savePools(pools)
  return member
}

/**
 * Remove a member from a pool.
 */
export async function removeMember(poolId: string, memberId: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    const { error } = await supabase
      .from('pool_members')
      .delete()
      .eq('id', memberId)
      .eq('pool_id', poolId)

    if (!error) return true

    enqueuePoolOp('remove_member', { poolId, memberId })
  }

  // localStorage fallback
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
 * Log an expense to a pool. Completely separate from personal transactions.
 */
export async function logPoolExpense(
  poolId: string,
  amount: number,
  category: string,
  loggedBy: string,
  note?: string
): Promise<HouseholdPoolExpense | null> {
  if (amount <= 0) return null

  const roundedAmount = Math.round(amount * 100) / 100
  const label = note?.trim() || category || 'Expense'
  const paidBy = loggedBy.trim() || 'Me'
  const userId = await getCurrentUserId()

  if (userId) {
    const { data, error } = await supabase
      .from('pool_entries')
      .insert({
        pool_id: poolId,
        added_by: userId,
        label,
        amount: roundedAmount,
        paid_by: paidBy,
      })
      .select()
      .single()

    if (!error && data) {
      return mapEntryFromDb(data as unknown as DbPoolEntry)
    }

    enqueuePoolOp('log_expense', { poolId, amount: roundedAmount, category, loggedBy: paidBy, note: label })
  }

  // localStorage fallback
  const pool = loadPools().find(p => p.id === poolId && p.isActive)
  if (!pool) return null

  const expenses = loadExpenses()
  const expense: HouseholdPoolExpense = {
    id: crypto.randomUUID(),
    poolId,
    amount: roundedAmount,
    category: category || 'general',
    note: note?.trim() ?? '',
    loggedBy: paidBy,
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
export async function getPoolExpenses(poolId: string): Promise<HouseholdPoolExpense[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    const { data, error } = await supabase
      .from('pool_entries')
      .select('*')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      return (data as unknown as DbPoolEntry[]).map(mapEntryFromDb)
    }
  }

  // localStorage fallback
  return loadExpenses()
    .filter(e => e.poolId === poolId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Get the total spent in the current month for a pool.
 */
export async function getPoolSpentThisMonth(poolId: string): Promise<number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const userId = await getCurrentUserId()

  if (userId) {
    const { data, error } = await supabase
      .from('pool_entries')
      .select('amount')
      .eq('pool_id', poolId)
      .gte('created_at', monthStart)

    if (!error && data) {
      return (data as { amount: number }[]).reduce((sum, e) => sum + Number(e.amount), 0)
    }
  }

  // localStorage fallback
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
export async function getPoolSummary(poolId: string): Promise<HouseholdPoolSummary | null> {
  const pool = await getPool(poolId)
  if (!pool) return null

  const spentThisMonth = await getPoolSpentThisMonth(poolId)
  const memberCount = Math.max(1, pool.members.length + 1) // +1 for the user
  const expenses = await getPoolExpenses(poolId)

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
export async function createPoolShareToken(poolId: string): Promise<string | null> {
  const userId = await getCurrentUserId()

  if (userId) {
    // The DB auto-generates share_token on create. To regenerate, we'd need
    // a raw SQL call or a function. For now, read the existing token.
    const { data, error } = await supabase
      .from('pools')
      .select('share_token')
      .eq('id', poolId)
      .single()

    if (!error && data) {
      return (data as { share_token: string }).share_token
    }
  }

  // localStorage fallback
  const pools = loadPools()
  const pool = pools.find(p => p.id === poolId && p.isActive)
  if (!pool) return null

  pool.shareToken = crypto.randomUUID()
  savePools(pools)
  return pool.shareToken
}

/**
 * Look up a pool by its share token.
 * Tries Supabase first (no auth needed for public share lookup),
 * then falls back to localStorage.
 */
export async function getPoolByShareToken(token: string): Promise<HouseholdPool | null> {
  // Try Supabase — share token lookup (RLS allows members/owners to read)
  try {
    const { data: poolData, error: poolErr } = await supabase
      .from('pools')
      .select('*')
      .eq('share_token', token)
      .single()

    if (!poolErr && poolData) {
      const row = poolData as unknown as DbPool
      const { data: members } = await supabase
        .from('pool_members')
        .select('*')
        .eq('pool_id', row.id)

      return mapPoolFromDb(row, (members ?? []) as unknown as DbPoolMember[])
    }
  } catch {
    // Network error — fall through to local
  }

  // localStorage fallback
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

// ============================================================================
// Background Queue Processing
// ============================================================================

/**
 * Process pending pool operations (background retry on connectivity restore).
 */
export async function processPoolQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getPoolQueue()
  let succeeded = 0
  let failed = 0

  for (const item of queue) {
    let success = false

    switch (item.action) {
      case 'create_pool': {
        const p = item.payload as { name: string; emoji: string; monthlyLimit: number }
        const result = await createPool(p.name, p.emoji, p.monthlyLimit)
        success = !!result
        break
      }
      case 'update_pool': {
        const p = item.payload as { id: string; updates: Partial<Pick<HouseholdPool, 'name' | 'emoji' | 'monthlyLimit'>> }
        const result = await updatePool(p.id, p.updates)
        success = result !== null
        break
      }
      case 'delete_pool': {
        success = await deletePool(item.payload.id as string)
        break
      }
      case 'add_member': {
        const p = item.payload as { poolId: string; name: string }
        const result = await addMember(p.poolId, p.name)
        success = result !== null
        break
      }
      case 'remove_member': {
        const p = item.payload as { poolId: string; memberId: string }
        success = await removeMember(p.poolId, p.memberId)
        break
      }
      case 'log_expense': {
        const p = item.payload as { poolId: string; amount: number; category: string; loggedBy: string; note: string }
        const result = await logPoolExpense(p.poolId, p.amount, p.category, p.loggedBy, p.note)
        success = result !== null
        break
      }
    }

    if (success) {
      removePoolQueueItem(item.id)
      succeeded++
    } else {
      failed++
    }
  }

  return { succeeded, failed }
}
