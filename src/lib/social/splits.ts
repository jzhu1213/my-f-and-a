/**
 * Split data access layer (task 283).
 *
 * Provides Supabase CRUD functions for the `splits` and `split_participants`
 * tables. Mutations are offline-queue compatible — if a network call fails,
 * the operation is stored locally for background retry with optimistic updates.
 *
 * Follows the same patterns as `src/lib/social/friends.ts`.
 *
 * Requirements: new, 14.3
 */

import { supabase } from '../supabaseClient'
import { createReimbursement } from '../supabaseData'
import type { ReimbursementDirection } from '../reimbursements'
import {
  type AppSplit,
  type AppSplitParticipant,
  type DbSplit,
  type DbSplitParticipant,
  type SplitMethod,
  type SplitType,
  mapSplitFromDb,
  mapSplitParticipantFromDb,
} from './splits.types'

// ============================================================================
// Offline Queue Integration
// ============================================================================

const SPLIT_QUEUE_KEY = 'folio-split-queue'
const SPLIT_OPTIMISTIC_KEY = 'folio-split-optimistic'

interface SplitQueueItem {
  id: string
  action: 'create' | 'settle_participant' | 'settle_split' | 'delete'
  payload: Record<string, unknown>
  createdAt: string
}

/** Enqueue a failed split mutation for background retry */
function enqueueSplitOp(action: SplitQueueItem['action'], payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(SPLIT_QUEUE_KEY)
    const queue: SplitQueueItem[] = raw ? JSON.parse(raw) : []
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      action,
      payload,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(SPLIT_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage unavailable — silent fail
  }
}

// ============================================================================
// Optimistic Updates — localStorage-backed for immediate UI feedback
// ============================================================================

/** Store an optimistic split so the UI can show it immediately */
export function addOptimisticSplit(split: AppSplit): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(SPLIT_OPTIMISTIC_KEY)
    const list: AppSplit[] = raw ? JSON.parse(raw) : []
    list.push(split)
    localStorage.setItem(SPLIT_OPTIMISTIC_KEY, JSON.stringify(list))
  } catch {
    // silent
  }
}

/** Remove an optimistic split once server confirms */
export function removeOptimisticSplit(splitId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(SPLIT_OPTIMISTIC_KEY)
    if (!raw) return
    const list: AppSplit[] = JSON.parse(raw)
    const filtered = list.filter((s) => s.id !== splitId)
    localStorage.setItem(SPLIT_OPTIMISTIC_KEY, JSON.stringify(filtered))
  } catch {
    // silent
  }
}

/** Get all optimistic splits (for UI display alongside real data) */
export function getOptimisticSplits(): AppSplit[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SPLIT_OPTIMISTIC_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Read pending split operations (for retry logic) */
export function getSplitQueue(): SplitQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SPLIT_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Remove a successfully processed queue item */
export function removeSplitQueueItem(id: string): void {
  if (typeof window === 'undefined') return
  const queue = getSplitQueue().filter((item) => item.id !== id)
  localStorage.setItem(SPLIT_QUEUE_KEY, JSON.stringify(queue))
}

// ============================================================================
// Data Types for Create
// ============================================================================

/** Input for creating a new participant within a split */
export interface CreateSplitParticipantInput {
  /** Linked user ID (null for name-only participants) */
  participantUserId: string | null
  /** Display name */
  participantName: string
  /** Amount this participant owes or is owed */
  shareAmount: number
  /** Whether this participant is the payer */
  isPayer: boolean
}

/** Input for creating a new split */
export interface CreateSplitInput {
  /** Optional link to originating transaction */
  linkedTransactionId?: string | null
  /** Total amount being split */
  totalAmount: number
  /** Expense or income */
  type: SplitType
  /** How the split is divided */
  splitMethod: SplitMethod
  /** Optional note */
  note?: string
  /** Participants (including the payer) */
  participants: CreateSplitParticipantInput[]
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Create a new split with participants.
 *
 * Inserts into `splits` table, then inserts all participants into
 * `split_participants`. For linked participants (non-null participantUserId),
 * creates paired IOUs in the reimbursement ledger.
 *
 * Optimistic: adds the split to localStorage immediately.
 * On failure, queues for background retry.
 *
 * Returns the new AppSplit on success, or null on failure (queued for retry).
 */
export async function createSplit(
  input: CreateSplitInput
): Promise<{ split: AppSplit; participants: AppSplitParticipant[] } | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[createSplit] No authenticated user')
    return null
  }

  // Optimistic split for immediate UI feedback
  const optimisticId = `opt-split-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const optimisticSplit: AppSplit = {
    id: optimisticId,
    ownerId: userId,
    linkedTransactionId: input.linkedTransactionId ?? null,
    totalAmount: input.totalAmount,
    type: input.type,
    splitMethod: input.splitMethod,
    note: input.note ?? '',
    settled: false,
    createdAt: new Date().toISOString(),
  }
  addOptimisticSplit(optimisticSplit)

  // Insert the split row
  const { data: splitRow, error: splitError } = await supabase
    .from('splits')
    .insert({
      owner_id: userId,
      linked_transaction_id: input.linkedTransactionId ?? null,
      total_amount: input.totalAmount,
      type: input.type,
      split_method: input.splitMethod,
      note: input.note?.trim() ?? '',
      settled: false,
    })
    .select()
    .single()

  if (splitError || !splitRow) {
    console.error('[createSplit] split insert failed', splitError?.message)
    removeOptimisticSplit(optimisticId)
    enqueueSplitOp('create', { input })
    return null
  }

  const appSplit = mapSplitFromDb(splitRow as unknown as DbSplit)

  // Insert participants
  const participantRows = input.participants.map((p) => ({
    split_id: appSplit.id,
    participant_user_id: p.participantUserId,
    participant_name: p.participantName.trim(),
    share_amount: p.shareAmount,
    is_payer: p.isPayer,
    settled: p.isPayer, // payer is already "settled" by definition
  }))

  const { data: partData, error: partError } = await supabase
    .from('split_participants')
    .insert(participantRows)
    .select()

  if (partError || !partData) {
    console.error('[createSplit] participants insert failed', partError?.message)
    // Split row exists but participants failed — still return the split
    // The participants can be retried
    removeOptimisticSplit(optimisticId)
    return { split: appSplit, participants: [] }
  }

  const appParticipants = (partData as unknown as DbSplitParticipant[]).map(mapSplitParticipantFromDb)

  // Create paired IOUs for linked participants (task 283.3)
  await createPairedIOUs(userId, appSplit, appParticipants, input.participants)

  // Clear optimistic entry now that server confirmed
  removeOptimisticSplit(optimisticId)

  return { split: appSplit, participants: appParticipants }
}

/**
 * List all splits where the current user is the owner or a participant.
 * Returns splits ordered by creation date (newest first).
 */
export async function listSplitsForUser(): Promise<
  { split: AppSplit; participants: AppSplitParticipant[] }[]
> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return []

  // Fetch splits the user owns
  const { data: ownedSplits, error: ownedError } = await supabase
    .from('splits')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (ownedError) {
    console.error('[listSplitsForUser] owned splits query failed', ownedError.message)
    return []
  }

  // Also fetch splits where user is a participant (but not owner)
  const { data: participantRows, error: partError } = await supabase
    .from('split_participants')
    .select('split_id')
    .eq('participant_user_id', userId)

  if (partError) {
    console.error('[listSplitsForUser] participant lookup failed', partError.message)
  }

  const participantSplitIds = (participantRows ?? [])
    .map((r) => (r as { split_id: string }).split_id)
    .filter((id) => !(ownedSplits ?? []).some((s) => (s as { id: string }).id === id))

  let additionalSplits: unknown[] = []
  if (participantSplitIds.length > 0) {
    const { data: extra, error: extraError } = await supabase
      .from('splits')
      .select('*')
      .in('id', participantSplitIds)
      .order('created_at', { ascending: false })

    if (extraError) {
      console.error('[listSplitsForUser] additional splits failed', extraError.message)
    }
    additionalSplits = extra ?? []
  }

  const allSplitRows = [...(ownedSplits ?? []), ...additionalSplits] as unknown as DbSplit[]
  const allSplits = allSplitRows.map(mapSplitFromDb)

  if (allSplits.length === 0) return []

  // Fetch all participants for these splits in one query
  const splitIds = allSplits.map((s) => s.id)
  const { data: allParticipants, error: allPartError } = await supabase
    .from('split_participants')
    .select('*')
    .in('split_id', splitIds)

  if (allPartError) {
    console.error('[listSplitsForUser] bulk participant fetch failed', allPartError.message)
  }

  const participantsMap = new Map<string, AppSplitParticipant[]>()
  for (const row of (allParticipants ?? []) as unknown as DbSplitParticipant[]) {
    const mapped = mapSplitParticipantFromDb(row)
    const existing = participantsMap.get(mapped.splitId) ?? []
    existing.push(mapped)
    participantsMap.set(mapped.splitId, existing)
  }

  return allSplits.map((split) => ({
    split,
    participants: participantsMap.get(split.id) ?? [],
  }))
}

/**
 * Settle a single participant's share.
 * Marks the participant row as settled.
 *
 * Returns the updated participant on success, or null on failure (queued for retry).
 */
export async function settleParticipant(participantId: string): Promise<AppSplitParticipant | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[settleParticipant] No authenticated user')
    return null
  }

  const { data, error } = await supabase
    .from('split_participants')
    .update({ settled: true })
    .eq('id', participantId)
    .select()
    .single()

  if (error || !data) {
    console.error('[settleParticipant] update failed', error?.message)
    enqueueSplitOp('settle_participant', { participantId })
    return null
  }

  return mapSplitParticipantFromDb(data as unknown as DbSplitParticipant)
}

/**
 * Settle an entire split (marks the split and all participants as settled).
 *
 * Returns the updated split on success, or null on failure (queued for retry).
 */
export async function settleSplit(splitId: string): Promise<AppSplit | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[settleSplit] No authenticated user')
    return null
  }

  // Mark all participants as settled
  const { error: partError } = await supabase
    .from('split_participants')
    .update({ settled: true })
    .eq('split_id', splitId)

  if (partError) {
    console.error('[settleSplit] participant settle failed', partError.message)
    enqueueSplitOp('settle_split', { splitId })
    return null
  }

  // Mark the split itself as settled
  const { data, error } = await supabase
    .from('splits')
    .update({ settled: true })
    .eq('id', splitId)
    .select()
    .single()

  if (error || !data) {
    console.error('[settleSplit] split settle failed', error?.message)
    enqueueSplitOp('settle_split', { splitId })
    return null
  }

  return mapSplitFromDb(data as unknown as DbSplit)
}

/**
 * Delete a split and all its participants.
 * Only the split owner can delete.
 *
 * Returns true on success, false on failure (queued for retry).
 */
export async function deleteSplit(splitId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    console.error('[deleteSplit] No authenticated user')
    return false
  }

  // Delete participants first (FK constraint)
  const { error: partError } = await supabase
    .from('split_participants')
    .delete()
    .eq('split_id', splitId)

  if (partError) {
    console.error('[deleteSplit] participant delete failed', partError.message)
    enqueueSplitOp('delete', { splitId })
    return false
  }

  // Delete the split
  const { error } = await supabase
    .from('splits')
    .delete()
    .eq('id', splitId)
    .eq('owner_id', userId)

  if (error) {
    console.error('[deleteSplit] split delete failed', error.message)
    enqueueSplitOp('delete', { splitId })
    return false
  }

  return true
}

// ============================================================================
// Background Queue Processing
// ============================================================================

/**
 * Process pending items in the split queue (background retry).
 * Call this when connectivity is restored.
 */
export async function processSplitQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getSplitQueue()
  let succeeded = 0
  let failed = 0

  for (const item of queue) {
    let success = false

    switch (item.action) {
      case 'create': {
        const result = await createSplit(item.payload.input as CreateSplitInput)
        success = result !== null
        break
      }
      case 'settle_participant': {
        const result = await settleParticipant(item.payload.participantId as string)
        success = result !== null
        break
      }
      case 'settle_split': {
        const result = await settleSplit(item.payload.splitId as string)
        success = result !== null
        break
      }
      case 'delete': {
        success = await deleteSplit(item.payload.splitId as string)
        break
      }
    }

    if (success) {
      removeSplitQueueItem(item.id)
      succeeded++
    } else {
      failed++
    }
  }

  return { succeeded, failed }
}

// ============================================================================
// Paired IOU Bridge (task 283.3)
// ============================================================================

/**
 * Creates paired IOUs in the reimbursement ledger for linked participants.
 *
 * When a split participant has a `participantUserId` (is a linked friend):
 * - Payer side: creates `owed_to_me` (participant owes the payer)
 * - Ower side: creates `owed_by_me` (they owe the payer)
 *
 * Name-only participants (null `participantUserId`) keep single-sided behavior:
 * only the payer's ledger gets an `owed_to_me` entry.
 *
 * Links IOUs via `linkedTransactionId` using the split ID so each person
 * sees it in their own existing ledger.
 */
async function createPairedIOUs(
  payerUserId: string,
  split: AppSplit,
  participants: AppSplitParticipant[],
  inputParticipants: CreateSplitParticipantInput[]
): Promise<void> {
  // Find the payer participant to get their display name
  const payerParticipant = participants.find((p) => p.isPayer)
  const payerName = payerParticipant?.participantName ?? 'Someone'

  // Process each non-payer participant
  for (const participant of participants) {
    if (participant.isPayer) continue
    if (participant.shareAmount <= 0) continue

    // Find the matching input to get participantUserId
    const matchingInput = inputParticipants.find(
      (inp) =>
        inp.participantName === participant.participantName &&
        inp.participantUserId === participant.participantUserId &&
        !inp.isPayer
    )

    const linkedId = split.id
    const note = split.note
      ? `Split: ${split.note}`
      : `Split expense`

    // Payer side: this participant owes the payer
    await createReimbursement(payerUserId, {
      personName: participant.participantName,
      direction: 'owed_to_me' as ReimbursementDirection,
      amount: participant.shareAmount,
      note,
      linkedTransactionId: linkedId,
    })

    // If participant is a linked friend (has a userId), create the mirror entry
    const participantUserId = matchingInput?.participantUserId ?? participant.participantUserId
    if (participantUserId) {
      // Ower side: they owe the payer (shows as "owed_by_me" in their ledger)
      await createReimbursement(participantUserId, {
        personName: payerName,
        direction: 'owed_by_me' as ReimbursementDirection,
        amount: participant.shareAmount,
        note,
        linkedTransactionId: linkedId,
      })
    }
    // Name-only participants (null participantUserId): single-sided only (payer side already done)
  }
}
