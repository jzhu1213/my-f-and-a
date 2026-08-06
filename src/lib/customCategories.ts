import { supabase } from './supabaseClient'
import { BUDGET_CATEGORIES } from '@/types'
import type { CustomCategory } from '@/types/folio'
import { getCategoryIconName, type IconName } from './icons'

/**
 * Default icon for a newly created custom category when the user hasn't picked
 * a specific glyph (Phase 6, task 234.2). Kept neutral so it reads as
 * "uncategorized custom" rather than borrowing another category's meaning.
 */
export const DEFAULT_CUSTOM_CATEGORY_ICON: IconName = 'category:fallback'

/**
 * Resolve the icon name for a custom category, or `null` when it should fall
 * back to its stored emoji (backward-compat for categories created before the
 * icon set existed). A category with neither an icon nor an emoji resolves to
 * the neutral default so it always renders something sensible.
 */
export function resolveCustomCategoryIcon(cat: Pick<CustomCategory, 'icon' | 'emoji'>): IconName | null {
  if (cat.icon) return cat.icon as IconName
  if (cat.emoji) return null // render the emoji fallback
  return DEFAULT_CUSTOM_CATEGORY_ICON
}

// ============================================================================
// Custom Categories — CRUD helpers and merge utility
// Requirements: 3.1, 12.3, new
// ============================================================================

/**
 * Unified display item combining built-in and custom categories.
 * Custom categories always use 'other' as the underlying TransactionCategory.
 */
export interface CategoryDisplayItem {
  /** The underlying TransactionCategory value used for transactions */
  categoryValue: string
  emoji: string
  label: string
  /** Whether this is a user-defined custom category */
  isCustom: boolean
  /** For custom categories, the original custom category ID */
  customId?: string
  /**
   * Resolved icon name for this item (Phase 6, task 234.1/234.2). For built-in
   * categories this is the registry icon; for custom categories it is the
   * chosen icon, or `null` when the emoji should be rendered as a fallback.
   */
  iconName: IconName | null
}

/**
 * Merges the built-in BUDGET_CATEGORIES with user-defined custom categories
 * into a unified display list for the category grid.
 */
export function mergeCategories(customCategories: CustomCategory[]): CategoryDisplayItem[] {
  const builtIn: CategoryDisplayItem[] = BUDGET_CATEGORIES.map((cat) => ({
    categoryValue: cat.category,
    emoji: cat.emoji,
    label: cat.label,
    isCustom: false,
    iconName: getCategoryIconName(cat.category),
  }))

  const custom: CategoryDisplayItem[] = customCategories.map((cat) => ({
    categoryValue: 'other', // Maps to 'other' for budget/accounting
    emoji: cat.emoji,
    label: cat.label,
    isCustom: true,
    customId: cat.id,
    iconName: resolveCustomCategoryIcon(cat),
  }))

  return [...builtIn, ...custom]
}

/**
 * Fetch all custom categories for a user.
 */
export async function fetchCustomCategories(userId: string): Promise<CustomCategory[]> {
  const { data, error } = await supabase
    .from('custom_categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching custom categories:', error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    emoji: row.emoji,
    userId: row.user_id,
    createdAt: row.created_at,
    // Forward-compatible: only present once an `icon` column exists; undefined
    // otherwise so existing emoji-only categories fall back gracefully.
    icon: row.icon ?? undefined,
  }))
}

/**
 * Create a new custom category for a user.
 */
export async function createCustomCategory(
  userId: string,
  label: string,
  emoji: string,
  icon?: string
): Promise<CustomCategory | null> {
  const basePayload: Record<string, string> = { user_id: userId, label, emoji }

  // Try with the chosen icon first. If the `icon` column doesn't exist yet in
  // the database, the insert errors — so we retry without it (task 234.2 keeps
  // this fully backward-compatible). The chosen icon still applies in-session
  // via the returned object, and the stored emoji is the graceful fallback.
  let response = await supabase
    .from('custom_categories')
    .insert(icon ? { ...basePayload, icon } : basePayload)
    .select()
    .single()

  if (response.error && icon) {
    response = await supabase
      .from('custom_categories')
      .insert(basePayload)
      .select()
      .single()
  }

  const { data, error } = response
  if (error) {
    console.error('Error creating custom category:', error)
    return null
  }

  return {
    id: data.id,
    label: data.label,
    emoji: data.emoji,
    userId: data.user_id,
    createdAt: data.created_at,
    icon: data.icon ?? icon ?? undefined,
  }
}

/**
 * Delete a custom category by ID.
 */
export async function deleteCustomCategory(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('custom_categories')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting custom category:', error)
    return false
  }

  return true
}

/**
 * Update a custom category's label and/or emoji.
 */
export async function updateCustomCategory(
  id: string,
  updates: { label?: string; emoji?: string; icon?: string }
): Promise<CustomCategory | null> {
  // Fields that always exist on the table.
  const basePayload: Record<string, string> = {}
  if (updates.label !== undefined) basePayload.label = updates.label
  if (updates.emoji !== undefined) basePayload.emoji = updates.emoji

  const withIcon: Record<string, string> = { ...basePayload }
  if (updates.icon !== undefined) withIcon.icon = updates.icon

  if (Object.keys(withIcon).length === 0) return null

  // Try with the icon field; if the column is absent the update errors and we
  // retry with only the guaranteed columns (task 234.2 backward-compat).
  let response = await supabase
    .from('custom_categories')
    .update(withIcon)
    .eq('id', id)
    .select()
    .single()

  if (response.error && updates.icon !== undefined && Object.keys(basePayload).length > 0) {
    response = await supabase
      .from('custom_categories')
      .update(basePayload)
      .eq('id', id)
      .select()
      .single()
  }

  const { data, error } = response
  if (error) {
    console.error('Error updating custom category:', error)
    return null
  }

  return {
    id: data.id,
    label: data.label,
    emoji: data.emoji,
    userId: data.user_id,
    createdAt: data.created_at,
    icon: data.icon ?? updates.icon ?? undefined,
  }
}
