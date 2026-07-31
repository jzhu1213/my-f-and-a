import type { TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'

// ============================================================================
// Category Grid Preferences (Task 133.1)
// ============================================================================

/**
 * localStorage key for category grid customization.
 * Single-user-per-device app — no userId scoping needed.
 */
const STORAGE_KEY = 'folio-category-grid-prefs'

/**
 * A single category's position and optional label/emoji overrides.
 */
export interface CategoryGridPreference {
  /** Matches TransactionCategory for built-in, or a custom category id */
  categoryId: string
  /** Display order (0-based, lower = first) */
  order: number
  /** User-defined label override (undefined = use default) */
  customLabel?: string
  /** User-defined emoji override (undefined = use default) */
  customEmoji?: string
  /** Whether the category is archived (hidden from quick-log grid but keeps history) */
  archived?: boolean
}

/**
 * Returns whether a category is archived based on saved preferences.
 * If no preferences are saved or the category is not found, defaults to false.
 */
export function isCategoryArchived(
  prefs: CategoryGridPreference[] | null,
  categoryId: string
): boolean {
  if (!prefs) return false
  const pref = prefs.find(p => p.categoryId === categoryId)
  return pref?.archived === true
}

/**
 * Loads saved category grid preferences from localStorage.
 * Returns null if no preferences exist (fallback to defaults).
 *
 * SSR-safe: returns null on the server.
 */
export function loadCategoryGridPrefs(): CategoryGridPreference[] | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as CategoryGridPreference[]
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Saves category grid preferences to localStorage.
 * Silent failure if storage is unavailable.
 */
export function saveCategoryGridPrefs(prefs: CategoryGridPreference[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Resets category grid preferences (removes from localStorage).
 */
export function resetCategoryGridPrefs(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail
  }
}

/**
 * Merges saved preferences with the current BUDGET_CATEGORIES list.
 * Handles cases where new categories were added after the user last saved.
 *
 * Returns an ordered array of { category, emoji, label } ready for rendering,
 * with custom overrides applied.
 */
export function mergePrefsWithDefaults(
  prefs: CategoryGridPreference[] | null
): { category: TransactionCategory; emoji: string; label: string }[] {
  if (!prefs || prefs.length === 0) {
    return [...BUDGET_CATEGORIES]
  }

  // Start with items that have prefs, in pref order
  const ordered: { category: TransactionCategory; emoji: string; label: string }[] = []
  const seenCategories = new Set<string>()

  // Sort prefs by order
  const sortedPrefs = [...prefs].sort((a, b) => a.order - b.order)

  for (const pref of sortedPrefs) {
    const defaultCat = BUDGET_CATEGORIES.find(c => c.category === pref.categoryId)
    if (defaultCat) {
      ordered.push({
        category: defaultCat.category,
        emoji: pref.customEmoji ?? defaultCat.emoji,
        label: pref.customLabel ?? defaultCat.label,
      })
      seenCategories.add(pref.categoryId)
    }
  }

  // Append any new categories that weren't in saved prefs (added after user last saved)
  for (const cat of BUDGET_CATEGORIES) {
    if (!seenCategories.has(cat.category)) {
      ordered.push({ ...cat })
    }
  }

  return ordered
}

/**
 * Converts the current rendered category list back to preferences for saving.
 */
export function categoriesToPrefs(
  categories: { category: TransactionCategory; emoji: string; label: string }[]
): CategoryGridPreference[] {
  return categories.map((cat, index) => {
    const defaultCat = BUDGET_CATEGORIES.find(c => c.category === cat.category)
    const pref: CategoryGridPreference = {
      categoryId: cat.category,
      order: index,
    }
    // Only store overrides if they differ from defaults
    if (defaultCat && cat.label !== defaultCat.label) {
      pref.customLabel = cat.label
    }
    if (defaultCat && cat.emoji !== defaultCat.emoji) {
      pref.customEmoji = cat.emoji
    }
    return pref
  })
}
