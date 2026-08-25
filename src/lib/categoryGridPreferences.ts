import type { TransactionCategory } from '@/types'
import { BUDGET_CATEGORIES } from '@/types'
import { z } from 'zod'
import * as versionedStorage from './versionedStorage'

// ============================================================================
// Category Grid Preferences (Task 133.1)
// ============================================================================

/**
 * localStorage key for category grid customization.
 * Single-user-per-device app — no userId scoping needed.
 */
const STORAGE_KEY = 'folio-category-grid-prefs'

// ============================================================================
// Category Frequency Tracking (Task 339.1)
// ============================================================================

/** localStorage key for rolling 30-day frequency data. */
const FREQUENCY_STORAGE_KEY = 'folio-category-frequency'

/** localStorage key for sort mode preference. */
const SORT_MODE_STORAGE_KEY = 'folio-category-sort-mode'

/** Rolling window in milliseconds (30 days). */
const FREQUENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A single usage event for a category.
 * Stored as an array of timestamps per category for accurate rolling-window pruning.
 */
export interface CategoryFrequencyEntry {
  /** Matches TransactionCategory id */
  categoryId: string
  /** ISO date strings of each usage event within the window */
  timestamps: string[]
}

/** Sort mode for the category grid. */
export type CategorySortMode = 'manual' | 'auto'

/**
 * Records a category usage event. Increments the rolling count
 * and prunes entries older than 30 days.
 *
 * SSR-safe: no-op on the server.
 */
export function recordCategoryUsage(categoryId: string): void {
  if (typeof window === 'undefined') return
  try {
    const now = new Date().toISOString()
    const entries = loadFrequencyEntries()
    const existing = entries.find(e => e.categoryId === categoryId)

    if (existing) {
      existing.timestamps.push(now)
    } else {
      entries.push({ categoryId, timestamps: [now] })
    }

    // Prune old timestamps across all entries
    const cutoff = Date.now() - FREQUENCY_WINDOW_MS
    for (const entry of entries) {
      entry.timestamps = entry.timestamps.filter(
        ts => new Date(ts).getTime() >= cutoff
      )
    }

    // Remove entries with no remaining timestamps
    const pruned = entries.filter(e => e.timestamps.length > 0)
    versionedStorage.set(FREQUENCY_STORAGE_KEY, pruned, CategoryFrequencyArraySchema)
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Returns a Map of categoryId → usage count within the last 30 days.
 *
 * SSR-safe: returns empty map on the server.
 */
export function getCategoryFrequencies(): Map<string, number> {
  if (typeof window === 'undefined') return new Map()
  const entries = loadFrequencyEntries()
  const cutoff = Date.now() - FREQUENCY_WINDOW_MS
  const map = new Map<string, number>()

  for (const entry of entries) {
    const validCount = entry.timestamps.filter(
      ts => new Date(ts).getTime() >= cutoff
    ).length
    if (validCount > 0) {
      map.set(entry.categoryId, validCount)
    }
  }

  return map
}

/**
 * Loads raw frequency entries from localStorage via versioned storage.
 * Returns an empty array if none exist or on parse failure.
 */

const CategoryFrequencyEntrySchema = z.object({
  categoryId: z.string(),
  timestamps: z.array(z.string()),
})
const CategoryFrequencyArraySchema = z.array(CategoryFrequencyEntrySchema)

function loadFrequencyEntries(): CategoryFrequencyEntry[] {
  const stored = versionedStorage.get(FREQUENCY_STORAGE_KEY, CategoryFrequencyArraySchema)
  return (stored as CategoryFrequencyEntry[]) ?? []
}

/**
 * Loads the current sort mode preference.
 * Defaults to 'manual' if not set.
 *
 * SSR-safe: returns 'manual' on the server.
 */
export function loadSortMode(): CategorySortMode {
  if (typeof window === 'undefined') return 'manual'
  try {
    const stored = localStorage.getItem(SORT_MODE_STORAGE_KEY)
    if (stored === 'auto') return 'auto'
    return 'manual'
  } catch {
    return 'manual'
  }
}

/**
 * Saves the sort mode preference to localStorage.
 */
export function saveSortMode(mode: CategorySortMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SORT_MODE_STORAGE_KEY, mode)
  } catch {
    // Silently fail
  }
}

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
 * Loads saved category grid preferences from localStorage via versioned storage.
 * Returns null if no preferences exist (fallback to defaults).
 *
 * SSR-safe: returns null on the server.
 */

const CategoryGridPreferenceSchema = z.object({
  categoryId: z.string(),
  order: z.number(),
  customLabel: z.string().optional(),
  customEmoji: z.string().optional(),
  archived: z.boolean().optional(),
})
const CategoryGridPrefsArraySchema = z.array(CategoryGridPreferenceSchema)

export function loadCategoryGridPrefs(): CategoryGridPreference[] | null {
  if (typeof window === 'undefined') return null
  const stored = versionedStorage.get(STORAGE_KEY, CategoryGridPrefsArraySchema)
  if (!stored || stored.length === 0) return null
  return stored as CategoryGridPreference[]
}

/**
 * Saves category grid preferences to localStorage via versioned storage.
 * Silent failure if storage is unavailable.
 */
export function saveCategoryGridPrefs(prefs: CategoryGridPreference[]): void {
  if (typeof window === 'undefined') return
  versionedStorage.set(STORAGE_KEY, prefs, CategoryGridPrefsArraySchema)
}

/**
 * Resets category grid preferences (removes from localStorage).
 */
export function resetCategoryGridPrefs(): void {
  if (typeof window === 'undefined') return
  versionedStorage.remove(STORAGE_KEY)
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
