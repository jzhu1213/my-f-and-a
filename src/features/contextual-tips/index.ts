/**
 * Feature: Contextual Tips
 *
 * Inline financial tips, gentle nudges, and educational content that
 * replaces the old Learn tab with contextual, behaviour-triggered cards.
 */

// Components
export { ContextualTipCard } from '@/components/simplified/ContextualTipCard'

// Utilities
export { selectContextualTip } from '@/lib/tipUtils'
export type { UserContext as TipContext } from '@/lib/tipUtils'

// Types
export type { ContextualTip, TipType, TipTrigger } from '@/types/folio'
