/**
 * Split model types and mappers (tasks 282, 283).
 *
 * Defines the database-layer (snake_case) and app-layer (camelCase) interfaces
 * for the `splits` and `split_participants` tables, plus mapper functions to
 * convert between the two representations.
 *
 * Requirements: new, 14.3, 3.1 (extends)
 */

// ============================================================================
// Enum / Union Types
// ============================================================================

/** How a split's total is divided among participants */
export type SplitMethod = 'even' | 'custom' | 'percent' | 'shares'

/** Whether the split tracks a shared expense or shared income */
export type SplitType = 'expense' | 'income'

// ============================================================================
// Database-Layer Interfaces (snake_case, as stored in Supabase)
// ============================================================================

/** Raw row shape from the `splits` table */
export interface DbSplit {
  id: string
  owner_id: string
  linked_transaction_id: string | null
  total_amount: number
  type: SplitType
  split_method: SplitMethod
  note: string
  settled: boolean
  created_at: string
  /** ISO 4217 code of the original expense currency (task 426.1) */
  currency?: string | null
  /** Exchange rate at split creation time: home-currency per 1 unit of currency (task 426.1) */
  exchange_rate?: number | null
}

/** Raw row shape from the `split_participants` table */
export interface DbSplitParticipant {
  id: string
  split_id: string
  participant_user_id: string | null
  participant_name: string
  share_amount: number
  is_payer: boolean
  settled: boolean
  created_at: string
}

// ============================================================================
// App-Layer Interfaces (camelCase, used in React components and hooks)
// ============================================================================

/** App-level representation of a split */
export interface AppSplit {
  /** Unique split ID */
  id: string
  /** ID of the user who created the split */
  ownerId: string
  /** Optional link to the originating transaction */
  linkedTransactionId: string | null
  /** Total amount being split */
  totalAmount: number
  /** Whether this is an expense or income split */
  type: SplitType
  /** How the split is divided (even, custom, percent, shares) */
  splitMethod: SplitMethod
  /** Optional note/description */
  note: string
  /** Whether the entire split is settled */
  settled: boolean
  /** ISO timestamp of creation */
  createdAt: string
  /** ISO 4217 code of the original expense currency (task 426.1) */
  currency?: string
  /** Exchange rate at split creation time: home-currency per 1 unit of currency (task 426.1) */
  exchangeRate?: number
}

/** App-level representation of a split participant */
export interface AppSplitParticipant {
  /** Unique participant row ID */
  id: string
  /** The split this participant belongs to */
  splitId: string
  /** Linked user ID (null for name-only / non-account participants) */
  participantUserId: string | null
  /** Display name of the participant */
  participantName: string
  /** The amount this participant owes or is owed */
  shareAmount: number
  /** Whether this participant is the one who paid */
  isPayer: boolean
  /** Whether this participant has settled their share */
  settled: boolean
  /** ISO timestamp of creation */
  createdAt: string
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Convert a database split row to the app-layer representation.
 *
 * @param row - Raw row from the `splits` table
 * @returns App-level split object with camelCase keys
 */
export function mapSplitFromDb(row: DbSplit): AppSplit {
  return {
    id: row.id,
    ownerId: row.owner_id,
    linkedTransactionId: row.linked_transaction_id,
    totalAmount: Number(row.total_amount),
    type: row.type,
    splitMethod: row.split_method,
    note: row.note ?? '',
    settled: row.settled,
    createdAt: row.created_at,
    ...(row.currency ? { currency: row.currency } : {}),
    ...(row.exchange_rate != null ? { exchangeRate: Number(row.exchange_rate) } : {}),
  }
}

/**
 * Convert a database split participant row to the app-layer representation.
 *
 * @param row - Raw row from the `split_participants` table
 * @returns App-level split participant object with camelCase keys
 */
export function mapSplitParticipantFromDb(row: DbSplitParticipant): AppSplitParticipant {
  return {
    id: row.id,
    splitId: row.split_id,
    participantUserId: row.participant_user_id,
    participantName: row.participant_name,
    shareAmount: Number(row.share_amount),
    isPayer: row.is_payer,
    settled: row.settled,
    createdAt: row.created_at,
  }
}
