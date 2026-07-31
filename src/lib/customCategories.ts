import { supabase } from './supabaseClient'
import { BUDGET_CATEGORIES } from '@/types'
import type { CustomCategory } from '@/types/folio'

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
  }))

  const custom: CategoryDisplayItem[] = customCategories.map((cat) => ({
    categoryValue: 'other', // Maps to 'other' for budget/accounting
    emoji: cat.emoji,
    label: cat.label,
    isCustom: true,
    customId: cat.id,
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
  }))
}

/**
 * Create a new custom category for a user.
 */
export async function createCustomCategory(
  userId: string,
  label: string,
  emoji: string
): Promise<CustomCategory | null> {
  const { data, error } = await supabase
    .from('custom_categories')
    .insert({
      user_id: userId,
      label,
      emoji,
    })
    .select()
    .single()

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
  updates: { label?: string; emoji?: string }
): Promise<CustomCategory | null> {
  const updatePayload: Record<string, string> = {}
  if (updates.label !== undefined) updatePayload.label = updates.label
  if (updates.emoji !== undefined) updatePayload.emoji = updates.emoji

  if (Object.keys(updatePayload).length === 0) return null

  const { data, error } = await supabase
    .from('custom_categories')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

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
  }
}
