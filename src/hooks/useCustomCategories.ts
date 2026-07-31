import { useState, useEffect, useCallback } from 'react'
import type { CustomCategory } from '@/types/folio'
import {
  fetchCustomCategories,
  createCustomCategory,
  deleteCustomCategory,
  updateCustomCategory,
} from '@/lib/customCategories'

/**
 * Hook for managing user-defined custom categories.
 * Fetches on mount and exposes add/remove/update helpers.
 *
 * Requirements: 3.1, 12.3, new
 */
export interface UseCustomCategoriesReturn {
  customCategories: CustomCategory[]
  isLoading: boolean
  addCustomCategory: (label: string, emoji: string) => Promise<CustomCategory | null>
  removeCustomCategory: (id: string) => Promise<boolean>
  renameCustomCategory: (id: string, updates: { label?: string; emoji?: string }) => Promise<CustomCategory | null>
}

export function useCustomCategories(userId: string | null | undefined): UseCustomCategoriesReturn {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setCustomCategories([])
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const data = await fetchCustomCategories(userId)
        if (!cancelled) setCustomCategories(data)
      } catch (err) {
        console.error('Error loading custom categories:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  const addCustomCategory = useCallback(async (label: string, emoji: string): Promise<CustomCategory | null> => {
    if (!userId) return null

    const result = await createCustomCategory(userId, label, emoji)
    if (result) {
      setCustomCategories((prev) => [...prev, result])
    }
    return result
  }, [userId])

  const removeCustomCategory = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteCustomCategory(id)
    if (success) {
      setCustomCategories((prev) => prev.filter((c) => c.id !== id))
    }
    return success
  }, [])

  const renameCustomCategory = useCallback(async (id: string, updates: { label?: string; emoji?: string }): Promise<CustomCategory | null> => {
    const result = await updateCustomCategory(id, updates)
    if (result) {
      setCustomCategories((prev) => prev.map((c) => c.id === id ? result : c))
    }
    return result
  }, [])

  return {
    customCategories,
    isLoading,
    addCustomCategory,
    removeCustomCategory,
    renameCustomCategory,
  }
}
