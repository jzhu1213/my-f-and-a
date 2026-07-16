import type { QuickTransaction } from '@/types/folio'
import type { TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  field: 'amount' | 'category' | 'note'
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ============================================================================
// Allowed categories derived from BUDGET_CATEGORIES
// ============================================================================

const ALLOWED_CATEGORIES: Set<TransactionCategory> = new Set(
  BUDGET_CATEGORIES.map((item) => item.category)
)

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Strips HTML tags, trims whitespace, and truncates to 60 characters.
 *
 * **Validates: Requirements 10.7**
 */
export function sanitizeNote(note: string): string {
  const stripped = note.replace(/<[^>]*>/g, '')
  const trimmed = stripped.trim()
  return trimmed.slice(0, 60)
}

/**
 * Returns a new QuickTransaction with the note sanitized (if present).
 * Does not modify the amount or category — those should fail validation if invalid.
 *
 * **Validates: Requirements 10.7**
 */
export function sanitizeTransaction(transaction: QuickTransaction): QuickTransaction {
  if (transaction.note === undefined) {
    return { ...transaction }
  }

  return {
    ...transaction,
    note: sanitizeNote(transaction.note),
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates a QuickTransaction and returns ALL errors found.
 * This allows the UI to show multiple validation messages at once.
 * The category selection is NOT cleared on failure (UI concern handled by returning
 * the specific field that failed).
 *
 * **Validates: Requirements 10.5, 10.6, 14.1, 14.5**
 */
export function validateTransaction(transaction: QuickTransaction): ValidationResult {
  const errors: ValidationError[] = []

  // Amount validation
  if (!Number.isFinite(transaction.amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a valid number' })
  } else if (transaction.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be greater than zero' })
  } else if (transaction.amount > 99999) {
    errors.push({ field: 'amount', message: 'Amount must not exceed $99,999' })
  }

  // Category validation
  if (!ALLOWED_CATEGORIES.has(transaction.category)) {
    errors.push({ field: 'category', message: 'Category must be from the allowed list' })
  }

  // Note validation (if provided)
  if (transaction.note !== undefined) {
    // Strip HTML before checking length
    const cleaned = transaction.note.replace(/<[^>]*>/g, '').trim()
    if (cleaned.length > 60) {
      errors.push({ field: 'note', message: 'Note must be 60 characters or fewer' })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
