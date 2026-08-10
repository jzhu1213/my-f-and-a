import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadCategoryGridPrefs,
  saveCategoryGridPrefs,
  resetCategoryGridPrefs,
  mergePrefsWithDefaults,
  categoriesToPrefs,
  CategoryGridPreference,
} from './categoryGridPreferences'
import { BUDGET_CATEGORIES } from '@/types'

// Mock localStorage
const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('categoryGridPreferences', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
    vi.clearAllMocks()
  })

  describe('loadCategoryGridPrefs', () => {
    it('returns null when no prefs are stored', () => {
      expect(loadCategoryGridPrefs()).toBeNull()
    })

    it('returns parsed prefs when stored', () => {
      const prefs: CategoryGridPreference[] = [
        { categoryId: 'fun', order: 0 },
        { categoryId: 'food', order: 1 },
      ]
      mockStorage['folio-category-grid-prefs'] = JSON.stringify(prefs)

      const result = loadCategoryGridPrefs()
      expect(result).toEqual(prefs)
    })

    it('returns null for invalid JSON', () => {
      mockStorage['folio-category-grid-prefs'] = 'not-json{{'
      expect(loadCategoryGridPrefs()).toBeNull()
    })

    it('returns null for empty array', () => {
      mockStorage['folio-category-grid-prefs'] = '[]'
      expect(loadCategoryGridPrefs()).toBeNull()
    })
  })

  describe('saveCategoryGridPrefs', () => {
    it('saves prefs to localStorage', () => {
      const prefs: CategoryGridPreference[] = [
        { categoryId: 'food', order: 0, customLabel: 'Munchies' },
      ]
      saveCategoryGridPrefs(prefs)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'folio-category-grid-prefs',
        JSON.stringify(prefs)
      )
    })
  })

  describe('resetCategoryGridPrefs', () => {
    it('removes prefs from localStorage', () => {
      mockStorage['folio-category-grid-prefs'] = '[]'
      resetCategoryGridPrefs()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('folio-category-grid-prefs')
    })
  })

  describe('mergePrefsWithDefaults', () => {
    it('returns BUDGET_CATEGORIES when prefs is null', () => {
      const result = mergePrefsWithDefaults(null)
      expect(result).toEqual(BUDGET_CATEGORIES)
    })

    it('returns BUDGET_CATEGORIES when prefs is empty', () => {
      const result = mergePrefsWithDefaults([])
      expect(result).toEqual(BUDGET_CATEGORIES)
    })

    it('reorders categories based on prefs', () => {
      const prefs: CategoryGridPreference[] = [
        { categoryId: 'fun', order: 0 },
        { categoryId: 'food', order: 1 },
        { categoryId: 'rent', order: 2 },
        { categoryId: 'transport', order: 3 },
        { categoryId: 'school', order: 4 },
        { categoryId: 'health', order: 5 },
        { categoryId: 'subscriptions', order: 6 },
        { categoryId: 'other', order: 7 },
      ]
      const result = mergePrefsWithDefaults(prefs)
      expect(result[0].category).toBe('fun')
      expect(result[1].category).toBe('food')
    })

    it('applies custom emoji and label overrides', () => {
      const prefs: CategoryGridPreference[] = [
        { categoryId: 'food', order: 0, customEmoji: '🍔', customLabel: 'Eats' },
        { categoryId: 'rent', order: 1 },
        { categoryId: 'transport', order: 2 },
        { categoryId: 'school', order: 3 },
        { categoryId: 'fun', order: 4 },
        { categoryId: 'health', order: 5 },
        { categoryId: 'subscriptions', order: 6 },
        { categoryId: 'other', order: 7 },
      ]
      const result = mergePrefsWithDefaults(prefs)
      expect(result[0].emoji).toBe('🍔')
      expect(result[0].label).toBe('Eats')
      // Non-overridden category keeps defaults
      expect(result[1].emoji).toBe('🏠')
      expect(result[1].label).toBe('Rent & Bills')
    })

    it('appends new default categories not in saved prefs', () => {
      // Only save 3 categories — the rest should be appended
      const prefs: CategoryGridPreference[] = [
        { categoryId: 'fun', order: 0 },
        { categoryId: 'food', order: 1 },
        { categoryId: 'other', order: 2 },
      ]
      const result = mergePrefsWithDefaults(prefs)
      // First 3 are from prefs
      expect(result[0].category).toBe('fun')
      expect(result[1].category).toBe('food')
      expect(result[2].category).toBe('other')
      // Remaining should be appended (total = BUDGET_CATEGORIES.length)
      expect(result.length).toBe(BUDGET_CATEGORIES.length)
    })
  })

  describe('categoriesToPrefs', () => {
    it('converts categories to prefs with correct order', () => {
      const categories = [
        { category: 'fun' as const, emoji: '🎶', label: 'Fun' },
        { category: 'food' as const, emoji: '🍕', label: 'Food' },
      ]
      const prefs = categoriesToPrefs(categories)
      expect(prefs[0]).toEqual({ categoryId: 'fun', order: 0 })
      expect(prefs[1]).toEqual({ categoryId: 'food', order: 1 })
    })

    it('stores custom overrides only when different from default', () => {
      const categories = [
        { category: 'food' as const, emoji: '🍔', label: 'Munchies' },
        { category: 'rent' as const, emoji: '🏠', label: 'Rent & Bills' },
      ]
      const prefs = categoriesToPrefs(categories)
      // Food has overrides
      expect(prefs[0].customEmoji).toBe('🍔')
      expect(prefs[0].customLabel).toBe('Munchies')
      // Rent uses defaults — no overrides stored
      expect(prefs[1].customEmoji).toBeUndefined()
      expect(prefs[1].customLabel).toBeUndefined()
    })
  })
})
