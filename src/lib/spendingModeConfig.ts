/**
 * Budget Mode — a set of budget overrides that affect the allowance calculation.
 *
 * IMPORTANT: This is a DIFFERENT concept from the existing `SpendingMode`
 * (tracker/guided/structured) in `src/lib/spendingModes.ts`. That type is a
 * display/signal preference — it never changes numbers. BudgetMode DOES change
 * numbers: it overrides monthly limits and fixed expenses for different life phases.
 *
 * Persisted to localStorage (matches other preferences in this codebase).
 * Task 337.1
 */

import type { TransactionCategory } from '@/types'
import type { Budget } from '@/types'
import type { FixedExpense } from '@/lib/fixedExpenses'

// ============================================================================
// Types
// ============================================================================

/**
 * A category budget override — specifies a new monthly limit for a category.
 */
export interface CategoryBudgetOverride {
  category: TransactionCategory
  monthlyLimit: number
}

/**
 * A fixed expense override — specifies a modified amount for a fixed expense.
 */
export interface FixedExpenseOverride {
  /** The ID of the fixed expense to override */
  fixedExpenseId: string
  /** The overridden amount (0 to effectively disable the expense in this mode) */
  amount: number
}

/**
 * BudgetMode — a named set of budget overrides for a specific life phase.
 *
 * When active, its overrides take precedence over the base budget/expense values.
 * Base values are preserved — switching back restores them. Modes are purely an
 * override layer, not destructive.
 */
export interface BudgetMode {
  id: string
  /** User-visible name (e.g., "Break", "Summer Job") */
  name: string
  /** Emoji icon for display */
  icon: string
  /** Override monthly income (e.g., higher for summer job, lower for break) */
  monthlyBudgetOverride?: number
  /** Override specific fixed expenses */
  fixedExpenseOverrides?: FixedExpenseOverride[]
  /** Override specific category budget limits */
  categoryBudgetOverrides?: CategoryBudgetOverride[]
  /** Whether this mode is currently active */
  isActive: boolean
}

// ============================================================================
// Presets — common student life phases for quick entry
// ============================================================================

export const PRESET_BUDGET_MODES: BudgetMode[] = [
  {
    id: 'preset_semester',
    name: 'Semester',
    icon: '📚',
    isActive: false,
  },
  {
    id: 'preset_break',
    name: 'Break',
    icon: '🏖️',
    isActive: false,
  },
  {
    id: 'preset_summer_job',
    name: 'Summer Job',
    icon: '💼',
    isActive: false,
  },
  {
    id: 'preset_study_abroad',
    name: 'Study Abroad',
    icon: '✈️',
    isActive: false,
  },
]

// ============================================================================
// Persistence Helpers (localStorage)
// ============================================================================

const STORAGE_KEY = 'folio-budget-modes'
const ACTIVE_MODE_KEY = 'folio-active-budget-mode'

/**
 * Load all saved budget modes from localStorage.
 * Returns presets if nothing is stored.
 */
export function getBudgetModes(): BudgetMode[] {
  if (typeof window === 'undefined') return PRESET_BUDGET_MODES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return PRESET_BUDGET_MODES
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return PRESET_BUDGET_MODES
    return parsed as BudgetMode[]
  } catch {
    return PRESET_BUDGET_MODES
  }
}

/**
 * Save all budget modes to localStorage.
 */
function saveBudgetModesToStorage(modes: BudgetMode[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Get the active budget mode, or null if none is active.
 */
export function getActiveBudgetMode(): BudgetMode | null {
  if (typeof window === 'undefined') return null
  try {
    const activeId = localStorage.getItem(ACTIVE_MODE_KEY)
    if (!activeId) return null
    const modes = getBudgetModes()
    return modes.find(m => m.id === activeId) ?? null
  } catch {
    return null
  }
}

/**
 * Set the active budget mode by ID (or null to deactivate all modes).
 */
export function setActiveBudgetMode(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_MODE_KEY)
    } else {
      localStorage.setItem(ACTIVE_MODE_KEY, id)
    }
    // Update isActive flags on all modes
    const modes = getBudgetModes()
    const updated = modes.map(m => ({ ...m, isActive: m.id === id }))
    saveBudgetModesToStorage(updated)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Save (create or update) a budget mode.
 * If a mode with the same ID exists, it's replaced. Otherwise, it's appended.
 */
export function saveBudgetMode(mode: BudgetMode): void {
  if (typeof window === 'undefined') return
  try {
    const modes = getBudgetModes()
    const idx = modes.findIndex(m => m.id === mode.id)
    if (idx >= 0) {
      modes[idx] = mode
    } else {
      modes.push(mode)
    }
    saveBudgetModesToStorage(modes)
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Delete a budget mode by ID.
 * If the deleted mode was active, clears the active mode.
 */
export function deleteBudgetMode(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const modes = getBudgetModes()
    const updated = modes.filter(m => m.id !== id)
    saveBudgetModesToStorage(updated)
    // If the deleted mode was active, clear the active reference
    const activeId = localStorage.getItem(ACTIVE_MODE_KEY)
    if (activeId === id) {
      localStorage.removeItem(ACTIVE_MODE_KEY)
    }
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Generate a unique ID for a new custom budget mode.
 */
export function generateBudgetModeId(): string {
  return `bmode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// Override Application Helper (Task 337.3)
// ============================================================================

/**
 * Apply a budget mode's overrides to budgets and fixed expenses.
 * Returns modified copies — the originals are NOT mutated.
 *
 * This is the core integration point: the override layer sits between the raw
 * data and the allowance calculation. The `computeDailyAllowance` function
 * receives already-overridden values and doesn't need to know about modes.
 */
export function applyBudgetModeOverrides(
  budgets: Budget[],
  fixedExpenses: FixedExpense[],
  mode: BudgetMode | null
): { budgets: Budget[]; fixedExpenses: FixedExpense[] } {
  if (!mode) return { budgets, fixedExpenses }

  // Apply category budget overrides
  let overriddenBudgets = budgets
  if (mode.categoryBudgetOverrides && mode.categoryBudgetOverrides.length > 0) {
    const overrideMap = new Map(
      mode.categoryBudgetOverrides.map(o => [o.category, o.monthlyLimit])
    )
    overriddenBudgets = budgets.map(b => {
      const override = overrideMap.get(b.category)
      if (override !== undefined) {
        return { ...b, monthlyLimit: override }
      }
      return b
    })
  }

  // Apply fixed expense overrides
  let overriddenExpenses = fixedExpenses
  if (mode.fixedExpenseOverrides && mode.fixedExpenseOverrides.length > 0) {
    const overrideMap = new Map(
      mode.fixedExpenseOverrides.map(o => [o.fixedExpenseId, o.amount])
    )
    overriddenExpenses = fixedExpenses.map(e => {
      const override = overrideMap.get(e.id)
      if (override !== undefined) {
        return { ...e, amount: override }
      }
      return e
    })
  }

  return { budgets: overriddenBudgets, fixedExpenses: overriddenExpenses }
}
