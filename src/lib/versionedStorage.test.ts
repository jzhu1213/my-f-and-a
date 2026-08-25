/**
 * Versioned Storage — Migration Path Tests (Task 522.4)
 *
 * Proves the versioned envelope + migration registry pattern works:
 * 1. Legacy unversioned data is auto-wrapped as version 1
 * 2. Registered migrations chain correctly (v1 → v2)
 * 3. Validated data is returned; invalid data returns null
 * 4. Migrated data is persisted so re-reads don't re-migrate
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  get,
  set,
  remove,
  registerMigrations,
  setCurrentVersion,
  clearMigrations,
  getCurrentVersion,
} from './versionedStorage'

// ============================================================================
// Test setup
// ============================================================================

// Simple mock localStorage
const store: Record<string, string> = {}

beforeEach(() => {
  // Clear state
  for (const key of Object.keys(store)) delete store[key]
  clearMigrations()

  // Mock localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
      get length() { return Object.keys(store).length },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
    writable: true,
    configurable: true,
  })
})

// ============================================================================
// Schemas for testing
// ============================================================================

const PrefsV1Schema = z.object({
  theme: z.string(),
  notifications: z.boolean(),
})

const PrefsV2Schema = z.object({
  theme: z.string(),
  notifications: z.boolean(),
  soundEnabled: z.boolean(),
})

// ============================================================================
// Tests
// ============================================================================

describe('versionedStorage', () => {
  describe('get — legacy unversioned data', () => {
    it('wraps legacy JSON data as version 1 and validates', () => {
      // Simulate legacy data (no versioned envelope)
      store['test-prefs'] = JSON.stringify({ theme: 'dark', notifications: true })
      setCurrentVersion('test-prefs', 1)

      const result = get('test-prefs', PrefsV1Schema)
      expect(result).toEqual({ theme: 'dark', notifications: true })
    })

    it('returns null for invalid legacy data', () => {
      store['test-prefs'] = JSON.stringify({ theme: 123, notifications: 'invalid' })
      setCurrentVersion('test-prefs', 1)

      const result = get('test-prefs', PrefsV1Schema)
      expect(result).toBeNull()
    })

    it('returns null when key does not exist', () => {
      setCurrentVersion('test-prefs', 1)
      const result = get('test-prefs', PrefsV1Schema)
      expect(result).toBeNull()
    })
  })

  describe('get — versioned envelope data', () => {
    it('reads correctly versioned data without re-migration', () => {
      store['test-prefs'] = JSON.stringify({
        version: 1,
        data: { theme: 'purple', notifications: false },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
      setCurrentVersion('test-prefs', 1)

      const result = get('test-prefs', PrefsV1Schema)
      expect(result).toEqual({ theme: 'purple', notifications: false })
    })
  })

  describe('migration — v1 → v2', () => {
    it('applies migration and returns upgraded data', () => {
      // Write v1 data in envelope format
      store['test-prefs'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      // Register v1 → v2 migration
      registerMigrations('test-prefs', {
        1: (v1Data) => {
          const data = v1Data as { theme: string; notifications: boolean }
          return { ...data, soundEnabled: true }
        },
      })
      setCurrentVersion('test-prefs', 2)

      const result = get('test-prefs', PrefsV2Schema)
      expect(result).toEqual({ theme: 'dark', notifications: true, soundEnabled: true })
    })

    it('persists migrated data so subsequent reads skip migration', () => {
      store['test-prefs'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      registerMigrations('test-prefs', {
        1: (v1Data) => {
          const data = v1Data as { theme: string; notifications: boolean }
          return { ...data, soundEnabled: false }
        },
      })
      setCurrentVersion('test-prefs', 2)

      // First read triggers migration
      get('test-prefs', PrefsV2Schema)

      // Check the persisted data is now v2
      const persisted = JSON.parse(store['test-prefs'])
      expect(persisted.version).toBe(2)
      expect(persisted.data.soundEnabled).toBe(false)
    })

    it('chains multiple migrations (v1 → v2 → v3)', () => {
      const V3Schema = z.object({
        theme: z.string(),
        notifications: z.boolean(),
        soundEnabled: z.boolean(),
        volume: z.number(),
      })

      store['test-prefs'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      registerMigrations('test-prefs', {
        1: (v1Data) => ({ ...(v1Data as object), soundEnabled: true }),
        2: (v2Data) => ({ ...(v2Data as object), volume: 80 }),
      })
      setCurrentVersion('test-prefs', 3)

      const result = get('test-prefs', V3Schema)
      expect(result).toEqual({
        theme: 'dark',
        notifications: true,
        soundEnabled: true,
        volume: 80,
      })
    })

    it('migrates legacy unversioned data through the full chain', () => {
      // Legacy data — no envelope
      store['test-prefs'] = JSON.stringify({ theme: 'light', notifications: false })

      registerMigrations('test-prefs', {
        1: (v1Data) => ({ ...(v1Data as object), soundEnabled: true }),
      })
      setCurrentVersion('test-prefs', 2)

      const result = get('test-prefs', PrefsV2Schema)
      expect(result).toEqual({ theme: 'light', notifications: false, soundEnabled: true })
    })
  })

  describe('set — write with validation', () => {
    it('writes validated data in versioned envelope', () => {
      setCurrentVersion('test-prefs', 1)
      const success = set('test-prefs', { theme: 'dark', notifications: true }, PrefsV1Schema)
      expect(success).toBe(true)

      const stored = JSON.parse(store['test-prefs'])
      expect(stored.version).toBe(1)
      expect(stored.data).toEqual({ theme: 'dark', notifications: true })
      expect(stored.updatedAt).toBeTruthy()
    })

    it('rejects invalid data and does not write', () => {
      setCurrentVersion('test-prefs', 1)
      // @ts-expect-error intentionally invalid
      const success = set('test-prefs', { theme: 123, notifications: 'bad' }, PrefsV1Schema)
      expect(success).toBe(false)
      expect(store['test-prefs']).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('removes a key from storage', () => {
      store['test-prefs'] = 'something'
      remove('test-prefs')
      expect(store['test-prefs']).toBeUndefined()
    })
  })

  describe('getCurrentVersion', () => {
    it('defaults to 1 when not explicitly set', () => {
      expect(getCurrentVersion('unregistered-key')).toBe(1)
    })
  })
})
