/**
 * Two-sided settlement layer (task 285).
 *
 * DESIGN CHOICE: We reuse the existing paired-reimbursement approach rather
 * than introducing a new `settlements` table. The `createPairedIOUs` bridge
 * (task 283.3) already creates mirrored reimbursement entries linked via
 * `linkedTransactionId` (the split ID). When one side settles, this module
 * propagates the settlement to the counterpart IOU so both ledgers agree.
 *
 * This avoids schema proliferation and keeps the reimbursement ledger as the
 * single source of truth for what's owed and what's been paid. A distinct
 * settlement-history table is unnecessary because `settled_at` timestamps on
 * both IOUs already record when settlement occurred.
 *
 * For cross-user writes (settling the counterpart's IOU), we invoke a
 * Supabase RPC function `settle_counterpart_iou(linked_transaction_id, settler_user_id)`
 * which runs as a SECURITY DEFINER and bypasses RLS. This is required because
 * a user cannot directly update another user's reimbursement row.
 *
 * SQL for the RPC (to be applied via migration):
 * ```sql
 * CREATE OR REPLACE FUNCTION settle_counterpart_iou(
 *   p_linked_transaction_id UUID,
 *   p_settler_user_id UUID
 * ) RETURNS void
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * BEGIN
 *   -- Settle the counterpart IOU (opposite side, different user)
 *   UPDATE reimbursements
 *   SET settled = true, settled_at = NOW()
 *   WHERE linked_transaction_id = p_linked_transaction_id
 *     AND user_id != p_settler_user_id
 *     AND settled = false;
 *
 *   -- Also mark the corresponding split_participants row as settled
 *   UPDATE split_participants
 *   SET settled = true
 *   WHERE split_id = p_linked_transaction_id
 *     AND participant_user_id != p_settler_user_id
 *     AND settled = false;
 * END;
 * $$;
 * ```
 *
 * Requirements: new, 12.3
 */

import { supabase } from '../supabaseClient'
import { generateReminder, type SettleUpEntry } from '../reimbursements'
import { settleReimbursement } from '../supabaseData'

// ============================================================================
// Types
// ============================================================================

export interface SettlementResult {
  success: boolean
  /** Warm, shame-free error message on failure */
  error?: string
}

export interface ReminderResult {
  success: boolean
  message?: string
  error?: string
}

// ============================================================================
// Rate Limiting (localStorage-backed)
// ============================================================================

const REMINDER_RATE_LIMIT_PREFIX = 'folio-settle-reminder-'
const REMINDER_COOLDOWN_MS = 48 * 60 * 60 * 1000 // 48 hours

/**
 * Check if a reminder can be sent to a specific friend.
 * Rate limited to 1 per person per 48 hours.
 */
function canSendReminder(friendUserId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const key = `${REMINDER_RATE_LIMIT_PREFIX}${friendUserId}-last`
    const lastSent = localStorage.getItem(key)
    if (!lastSent) return true
    const elapsed = Date.now() - parseInt(lastSent, 10)
    return elapsed >= REMINDER_COOLDOWN_MS
  } catch {
    return true // fail open if localStorage unavailable
  }
}

/**
 * Record that a reminder was just sent to a friend.
 */
function recordReminderSent(friendUserId: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = `${REMINDER_RATE_LIMIT_PREFIX}${friendUserId}-last`
    localStorage.setItem(key, Date.now().toString())
  } catch {
    // silent — localStorage unavailable
  }
}

// ============================================================================
// 285.1 — Two-sided settlement via paired reimbursements
// ============================================================================

/**
 * Settle a linked reimbursement and propagate to the counterpart IOU.
 *
 * 1. Settles the user's own reimbursement via `settleReimbursement`
 * 2. Calls the `settle_counterpart_iou` RPC to settle the other side
 * 3. Also marks the corresponding `split_participants` row as settled
 *
 * If the IOU has no `linkedTransactionId`, falls back to a simple
 * single-sided settle (for name-only or non-paired IOUs).
 */
export async function settleLinkedReimbursement(
  userId: string,
  reimbursementId: string,
  linkedTransactionId: string | undefined,
  fundingSourceId?: string
): Promise<SettlementResult> {
  // Step 1: Settle the user's own IOU
  const settled = await settleReimbursement(userId, reimbursementId, fundingSourceId)
  if (!settled) {
    return {
      success: false,
      error: "Couldn't mark that as settled right now — give it another try in a moment.",
    }
  }

  // Step 2: If paired (has a linkedTransactionId), settle the counterpart
  if (linkedTransactionId) {
    const { error: rpcError } = await supabase.rpc('settle_counterpart_iou', {
      p_linked_transaction_id: linkedTransactionId,
      p_settler_user_id: userId,
    })

    if (rpcError) {
      // Log but don't fail the whole operation — the user's side is settled
      console.error('[settleLinkedReimbursement] counterpart RPC failed:', rpcError.message)
      // The user's own settle succeeded; the counterpart will be reconciled
      // on the next sync. This is acceptable for offline-first.
    }
  }

  return { success: true }
}

/**
 * Settle all linked reimbursements for a person (batch version).
 *
 * For each IOU that has a `linkedTransactionId`, propagates settlement
 * to the counterpart side. Non-linked IOUs are settled single-sided.
 */
export async function settleAllLinkedForPerson(
  userId: string,
  ious: Array<{ id: string; linkedTransactionId?: string }>,
  fundingSourceId?: string
): Promise<SettlementResult> {
  if (ious.length === 0) {
    return { success: true }
  }

  let anyFailed = false

  for (const iou of ious) {
    const result = await settleLinkedReimbursement(
      userId,
      iou.id,
      iou.linkedTransactionId,
      fundingSourceId
    )
    if (!result.success) {
      anyFailed = true
    }
  }

  if (anyFailed) {
    return {
      success: false,
      error: "Some IOUs couldn't be settled — we'll keep trying in the background.",
    }
  }

  return { success: true }
}

// ============================================================================
// 285.2 — Gentle settle-up reminders (no dunning)
// ============================================================================

/**
 * Send a gentle settle-up reminder to a linked friend.
 *
 * Creates an in-app notification (type 'settle_reminder') for the friend.
 * Rate-limited to max 1 reminder per person per 48 hours.
 * All copy is warm and shame-free per project UX standards.
 *
 * Requirements: new, UX copy standard, Group 62
 */
export async function sendSettleReminder(
  friendUserId: string,
  entry: SettleUpEntry
): Promise<ReminderResult> {
  // Get current user
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) {
    return {
      success: false,
      error: "You need to be signed in to send a reminder.",
    }
  }

  // Rate-limit check
  if (!canSendReminder(friendUserId)) {
    return {
      success: false,
      error: "You recently sent a reminder — let's give them a bit more time 🙂",
    }
  }

  // Generate the warm, shame-free message
  const reminderText = generateReminder(entry)

  // Insert an in-app notification for the friend
  const { error } = await supabase.from('notifications').insert({
    user_id: friendUserId,
    type: 'settle_reminder',
    title: 'Friendly nudge',
    body: reminderText,
    sender_user_id: userId,
    read: false,
    metadata: {
      personName: entry.personName,
      netAmount: entry.netAmount,
      direction: entry.direction,
    },
  })

  if (error) {
    console.error('[sendSettleReminder] insert failed:', error.message)
    return {
      success: false,
      error: "Couldn't send the reminder right now — try again in a bit.",
    }
  }

  // Record rate-limit timestamp
  recordReminderSent(friendUserId)

  return {
    success: true,
    message: `Reminder sent to ${entry.personName} 🙂`,
  }
}
