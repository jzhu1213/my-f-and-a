/**
 * Celebration dedup helpers — shared between celebrationEngine and
 * incomeEncouragement to avoid circular imports.
 *
 * Extracted from celebrationEngine.ts (Phase 11 task 356).
 * Uses versioned storage (Task 522.3).
 */

import { z } from 'zod'
import * as versionedStorage from './versionedStorage'

const STORAGE_KEY = 'folio_triggered_celebrations'

const TriggeredCelebrationsSchema = z.array(z.string())

/**
 * Gets the set of previously triggered celebration IDs from localStorage.
 */
function getTriggeredCelebrations(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  const stored = versionedStorage.get(STORAGE_KEY, TriggeredCelebrationsSchema)
  if (!stored) return new Set()
  return new Set(stored)
}

/**
 * Persists the set of triggered celebration IDs to localStorage.
 */
function saveTriggeredCelebrations(triggered: Set<string>): void {
  versionedStorage.set(STORAGE_KEY, [...triggered], TriggeredCelebrationsSchema)
}

/**
 * Marks a celebration as triggered so it won't fire again for the same event.
 */
export function markTriggered(id: string): void {
  const triggered = getTriggeredCelebrations()
  triggered.add(id)
  saveTriggeredCelebrations(triggered)
}

/**
 * Checks whether a celebration has already been triggered.
 */
export function hasBeenTriggered(id: string): boolean {
  return getTriggeredCelebrations().has(id)
}
