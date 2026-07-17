/**
 * Feature: Quick Log
 *
 * One-tap expense logging with smart suggestions sorted by usage frequency.
 * Includes the suggestion engine, category presets, and offline persistence.
 */

// Components
export { QuickLogArea } from '@/components/simplified/QuickLogArea'
export { SyncIndicator } from '@/components/simplified/SyncIndicator'

// Utilities
export {
  generateSmartSuggestions,
  getCategoryPresets,
} from '@/lib/suggestionUtils'
export {
  logQuickTransaction,
  getRecentRepeats,
} from '@/lib/transactionUtils'
export {
  validateTransaction,
  sanitizeNote,
  sanitizeTransaction,
} from '@/lib/transactionValidation'
export type { ValidationResult, ValidationError } from '@/lib/transactionValidation'

// Types
export type { QuickTransaction, SmartSuggestion } from '@/types/folio'
