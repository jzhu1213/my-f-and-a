/**
 * Multi-Device Scenario Testing — Task 531
 *
 * Integration tests verifying:
 * 531.1 — Two-device conflict simulation (last-write-wins, delete-wins, notifications)
 * 531.2 — Extended offline usage (20+ ops, ordering, deduplication, failure handling)
 * 531.3 — Schema migration smoke test (auto-wrap, migration chain, validation)
 *
 * Requirements: 32.2, 32.3, 32.5
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { z } from 'zod'

// ============================================================================
// Mocks — must be hoisted before imports
// ============================================================================

vi.mock('@/lib/supabaseData', () => ({
  insertTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactionFull: vi.fn(),
}))

vi.mock('@/lib/offlineQueueDB', () => ({
  isIndexedDBAvailable: vi.fn(() => false),
  getAllItems: vi.fn(() => Promise.resolve([])),
  getItemsByUser: vi.fn(() => Promise.resolve([])),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  clearAll: vi.fn(),
  getCount: vi.fn(() => Promise.resolve(0)),
  findPendingByTransactionId: vi.fn(() => Promise.resolve(undefined)),
  replaceItemPayload: vi.fn(),
  migrateFromLocalStorage: vi.fn(() => Promise.resolve()),
}))

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionFull,
} from '@/lib/supabaseData'
import {
  checkForConflict,
  resolveConflictServerWins,
  handleDeleteWins,
  notifyConflictResolved,
  CONFLICT_RESOLVED_EVENT,
} from '@/lib/conflictResolution'
import {
  addToOfflineQueue,
  getOfflineQueue,
  clearOfflineQueue,
  processOfflineQueue,
  removeFromOfflineQueue,
  QUEUE_CHANGE_EVENT,
  QUEUE_SIZE_LIMIT,
  QUEUE_SIZE_WARNING_EVENT,
  type OfflineOperation,
  type PendingTransaction,
} from '@/lib/offlineQueue'
import {
  get,
  set,
  remove,
  registerMigrations,
  setCurrentVersion,
  clearMigrations,
  getCurrentVersion,
} from '@/lib/versionedStorage'

import type { Transaction } from '@/types'

// ============================================================================
// Test setup — localStorage mock
// ============================================================================

const store: Record<string, string> = {}

beforeEach(() => {
  // Clear localStorage mock
  for (const key of Object.keys(store)) delete store[key]

  // Clear versioned storage state
  clearMigrations()

  // Reset all mocks
  vi.clearAllMocks()

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

  // Mock window for events
  if (typeof window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: {
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        localStorage: (globalThis as unknown as { localStorage: Storage }).localStorage,
      },
      writable: true,
      configurable: true,
    })
  }
})

// ============================================================================
// Helpers
// ============================================================================

const TEST_USER = 'user-device-test-1'

function makeCreateOp(overrides: Partial<{ category: string; amount: number; date: string; note: string }> = {}): OfflineOperation {
  return {
    kind: 'create',
    payload: {
      category: overrides.category as 'food' ?? 'food',
      amount: overrides.amount ?? 12.50,
      type: 'expense',
      date: overrides.date ?? '2024-06-15',
      note: overrides.note,
    },
  }
}

function makeUpdateOp(transactionId: string, overrides: Partial<{ amount: number; category: string; date: string }> = {}): OfflineOperation {
  return {
    kind: 'update',
    payload: {
      transactionId,
      amount: overrides.amount ?? 25.00,
      category: overrides.category as 'food' ?? 'food',
      type: 'expense',
      date: overrides.date ?? '2024-06-15',
    },
  }
}

function makeDeleteOp(transactionId: string): OfflineOperation {
  return {
    kind: 'delete',
    payload: { transactionId },
  }
}

function makeServerTransaction(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    userId: TEST_USER,
    date: '2024-06-15',
    amount: 10,
    type: 'expense',
    category: 'food',
    accountType: 'personal',
    createdAt: '2024-06-15T08:00:00.000Z',
    ...overrides,
  }
}

// ============================================================================
// 531.1 — Two-device conflict simulation
// ============================================================================

describe('531.1 — Two-device conflict simulation', () => {
  describe('Both devices log different transactions offline', () => {
    it('both transactions appear after queue replay — no duplicates', async () => {
      const mockInsert = insertTransaction as Mock
      let callCount = 0
      mockInsert.mockImplementation(() => {
        callCount++
        return Promise.resolve(makeServerTransaction(`created-${callCount}`))
      })

      // Device A queues a create
      const opA = makeCreateOp({ amount: 8.00, note: 'Device A coffee' })
      addToOfflineQueue(TEST_USER, opA)

      // Device B queues a different create
      const opB = makeCreateOp({ amount: 15.00, note: 'Device B lunch', category: 'food' })
      addToOfflineQueue(TEST_USER, opB)

      // Verify both are queued
      const queue = getOfflineQueue()
      expect(queue).toHaveLength(2)
      expect(queue[0].operation.payload).toMatchObject({ amount: 8.00 })
      expect(queue[1].operation.payload).toMatchObject({ amount: 15.00 })

      // Process the queue (simulating reconnection)
      const result = await processOfflineQueue(TEST_USER)

      // Both should succeed — creates never conflict
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
      expect(mockInsert).toHaveBeenCalledTimes(2)

      // Queue should be empty after successful sync
      expect(getOfflineQueue()).toHaveLength(0)
    })
  })

  describe('Last-write-wins for edits', () => {
    it('server-wins when server has newer updatedAt', () => {
      const localUpdatedAt = '2024-06-15T10:00:00.000Z'
      const serverUpdatedAt = '2024-06-15T12:00:00.000Z' // Server is newer

      const hasConflict = checkForConflict(localUpdatedAt, serverUpdatedAt)
      expect(hasConflict).toBe(true)

      // Resolve: server wins
      const serverData = makeServerTransaction('tx-1', { amount: 99 })
      const resolution = resolveConflictServerWins(serverData)
      expect(resolution.conflict).toBe(true)
      if (resolution.conflict) {
        expect(resolution.resolution).toBe('server-wins')
        if (resolution.resolution === 'server-wins') {
          expect(resolution.serverData.amount).toBe(99)
        }
      }
    })

    it('client-wins when local is newer than server', () => {
      const localUpdatedAt = '2024-06-15T14:00:00.000Z' // Local is newer
      const serverUpdatedAt = '2024-06-15T10:00:00.000Z'

      const hasConflict = checkForConflict(localUpdatedAt, serverUpdatedAt)
      expect(hasConflict).toBe(false)
    })

    it('no conflict when timestamps are equal', () => {
      const timestamp = '2024-06-15T10:00:00.000Z'
      const hasConflict = checkForConflict(timestamp, timestamp)
      expect(hasConflict).toBe(false)
    })

    it('queue replay applies last-write-wins — server record newer discards local edit', async () => {
      const mockGetFull = getTransactionFull as Mock
      const mockUpdate = updateTransaction as Mock

      // Server has a newer updatedAt than our queued edit
      mockGetFull.mockResolvedValue(
        makeServerTransaction('tx-conflict', {
          amount: 50,
          updatedAt: '2024-06-15T15:00:00.000Z', // Server updated at 3pm
        } as Partial<Transaction> & { updatedAt: string })
      )

      // Queue an edit that was queued at 10am (older than server)
      const op = makeUpdateOp('tx-conflict', { amount: 30 })
      const item = addToOfflineQueue(TEST_USER, op)

      // Manually backdate the queuedAt to simulate it being old
      const queue = getOfflineQueue()
      const idx = queue.findIndex(q => q.id === item.id)
      queue[idx] = { ...queue[idx], queuedAt: '2024-06-15T10:00:00.000Z' }
      store['folio-offline-queue'] = JSON.stringify(queue)

      const result = await processOfflineQueue(TEST_USER)

      // The edit should be discarded (server wins) — counted as succeeded (resolved)
      expect(result.succeeded).toBe(1)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Delete-wins policy', () => {
    it('delete-wins when server record is gone', () => {
      const result = handleDeleteWins<Transaction>(false)
      expect(result.conflict).toBe(true)
      if (result.conflict) {
        expect(result.resolution).toBe('deleted')
      }
    })

    it('no conflict when server record still exists', () => {
      const result = handleDeleteWins<Transaction>(true)
      expect(result.conflict).toBe(false)
    })

    it('queue replay: edit on a deleted record is discarded', async () => {
      const mockGetFull = getTransactionFull as Mock
      const mockUpdate = updateTransaction as Mock

      // Server returns null — record was deleted on another device
      mockGetFull.mockResolvedValue(null)

      const op = makeUpdateOp('tx-deleted', { amount: 99 })
      addToOfflineQueue(TEST_USER, op)

      const result = await processOfflineQueue(TEST_USER)

      // Edit was discarded (delete-wins) — counted as succeeded (conflict resolved)
      expect(result.succeeded).toBe(1)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Conflict notification event', () => {
    it('fires CONFLICT_RESOLVED_EVENT when conflict is resolved', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      notifyConflictResolved({
        entityType: 'transaction',
        resolution: 'server-wins',
        message: 'Updated from another device',
      })

      expect(dispatchSpy).toHaveBeenCalledTimes(1)
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent
      expect(event.type).toBe(CONFLICT_RESOLVED_EVENT)
      expect(event.detail).toEqual({
        entityType: 'transaction',
        resolution: 'server-wins',
        message: 'Updated from another device',
      })
    })

    it('fires event for delete-wins resolution', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      notifyConflictResolved({
        entityType: 'transaction',
        resolution: 'deleted',
        message: 'Updated from another device',
      })

      expect(dispatchSpy).toHaveBeenCalledTimes(1)
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent
      expect(event.detail.resolution).toBe('deleted')
    })
  })
})

// ============================================================================
// 531.2 — Extended offline usage
// ============================================================================

describe('531.2 — Extended offline usage', () => {
  describe('20+ operations queued offline', () => {
    it('queues 20+ mixed operations and maintains order', () => {
      const ops: OfflineOperation[] = []

      // 10 creates
      for (let i = 0; i < 10; i++) {
        ops.push(makeCreateOp({ amount: i + 1, note: `create-${i}` }))
      }
      // 5 updates
      for (let i = 0; i < 5; i++) {
        ops.push(makeUpdateOp(`tx-${i}`, { amount: (i + 1) * 10 }))
      }
      // 5 deletes
      for (let i = 5; i < 10; i++) {
        ops.push(makeDeleteOp(`tx-${i}`))
      }

      // Queue all
      for (const op of ops) {
        addToOfflineQueue(TEST_USER, op)
      }

      const queue = getOfflineQueue()
      expect(queue.length).toBe(20)

      // Verify ordering preserved
      expect(queue[0].operation.kind).toBe('create')
      expect((queue[0].operation.payload as { note?: string }).note).toBe('create-0')
      expect(queue[10].operation.kind).toBe('update')
      expect(queue[15].operation.kind).toBe('delete')
    })

    it('all changes sync correctly when processOfflineQueue is called', async () => {
      const mockInsert = insertTransaction as Mock
      const mockUpdate = updateTransaction as Mock
      const mockDelete = deleteTransaction as Mock
      const mockGetFull = getTransactionFull as Mock

      mockInsert.mockResolvedValue(makeServerTransaction('new-1'))
      mockUpdate.mockResolvedValue(makeServerTransaction('tx-1', { amount: 50 }))
      mockDelete.mockResolvedValue(true)
      // For updates, server record exists and is older
      mockGetFull.mockResolvedValue(
        makeServerTransaction('tx-1', {
          createdAt: '2024-01-01T00:00:00.000Z',
        })
      )

      // Queue: 3 creates, 2 updates, 1 delete
      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 5 }))
      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 10 }))
      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 15 }))
      addToOfflineQueue(TEST_USER, makeUpdateOp('tx-1', { amount: 50 }))
      addToOfflineQueue(TEST_USER, makeUpdateOp('tx-2', { amount: 75 }))
      addToOfflineQueue(TEST_USER, makeDeleteOp('tx-3'))

      const result = await processOfflineQueue(TEST_USER)

      expect(result.succeeded).toBe(6)
      expect(result.failed).toBe(0)
      expect(mockInsert).toHaveBeenCalledTimes(3)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })
  })

  describe('Queue deduplication', () => {
    it('multiple edits to same transaction keep only the latest', () => {
      // Edit tx-1 three times — only final state should remain
      addToOfflineQueue(TEST_USER, makeUpdateOp('tx-1', { amount: 10 }))
      addToOfflineQueue(TEST_USER, makeUpdateOp('tx-1', { amount: 20 }))
      addToOfflineQueue(TEST_USER, makeUpdateOp('tx-1', { amount: 30 }))

      const queue = getOfflineQueue()
      // Deduplication: only 1 update for tx-1 with the latest amount
      const updates = queue.filter(
        q => q.operation.kind === 'update' &&
          (q.operation.payload as { transactionId: string }).transactionId === 'tx-1'
      )
      expect(updates).toHaveLength(1)
      expect((updates[0].operation.payload as { amount: number }).amount).toBe(30)
    })

    it('delete removes pending update for same transaction', () => {
      addToOfflineQueue(TEST_USER, makeUpdateOp('tx-5', { amount: 100 }))
      addToOfflineQueue(TEST_USER, makeDeleteOp('tx-5'))

      const queue = getOfflineQueue()
      // The update should be removed, only delete remains
      const updatesForTx5 = queue.filter(
        q => q.operation.kind === 'update' &&
          (q.operation.payload as { transactionId: string }).transactionId === 'tx-5'
      )
      expect(updatesForTx5).toHaveLength(0)

      const deletesForTx5 = queue.filter(
        q => q.operation.kind === 'delete' &&
          (q.operation.payload as { transactionId: string }).transactionId === 'tx-5'
      )
      expect(deletesForTx5).toHaveLength(1)
    })
  })

  describe('Failed items do not block the queue', () => {
    it('one failed item does not prevent others from syncing', async () => {
      const mockInsert = insertTransaction as Mock
      let callIdx = 0
      mockInsert.mockImplementation(() => {
        callIdx++
        // Second call fails
        if (callIdx === 2) return Promise.reject(new Error('Network error'))
        return Promise.resolve(makeServerTransaction(`new-${callIdx}`))
      })

      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 5, note: 'first' }))
      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 10, note: 'second-fails' }))
      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 15, note: 'third' }))

      const result = await processOfflineQueue(TEST_USER)

      // First and third succeed, second is retried (stays in queue with backoff)
      expect(result.succeeded).toBe(2)
      expect(mockInsert).toHaveBeenCalledTimes(3)
    })

    it('items with invalid payloads are marked failed but dont block', async () => {
      const mockInsert = insertTransaction as Mock
      mockInsert.mockResolvedValue(makeServerTransaction('new-valid'))

      // Add a valid create
      addToOfflineQueue(TEST_USER, makeCreateOp({ amount: 5 }))

      // Manually inject an invalid item (negative amount won't pass Zod validation)
      const queue = getOfflineQueue()
      const invalidItem: PendingTransaction = {
        id: 'invalid-1',
        userId: TEST_USER,
        operation: {
          kind: 'create',
          payload: {
            category: 'food',
            amount: -50, // Invalid: negative amount
            type: 'expense',
            date: '2024-06-15',
          },
        },
        retryCount: 0,
        createdAt: new Date().toISOString(),
        status: 'pending',
        queuedAt: new Date().toISOString(),
      }
      queue.unshift(invalidItem) // Put invalid first
      store['folio-offline-queue'] = JSON.stringify(queue)

      const result = await processOfflineQueue(TEST_USER)

      // Invalid item is marked failed, valid item still syncs
      expect(result.failed).toBe(1)
      expect(result.succeeded).toBe(1)
      expect(mockInsert).toHaveBeenCalledTimes(1) // Only the valid one
    })
  })

  describe('Queue size warning', () => {
    it('fires warning event when queue reaches QUEUE_SIZE_LIMIT', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      // Fill queue to the limit
      for (let i = 0; i < QUEUE_SIZE_LIMIT; i++) {
        addToOfflineQueue(TEST_USER, makeCreateOp({ amount: i + 1, note: `item-${i}` }))
      }

      // Check that the size warning event was dispatched
      const sizeWarnings = dispatchSpy.mock.calls.filter(
        call => (call[0] as CustomEvent).type === QUEUE_SIZE_WARNING_EVENT
      )
      expect(sizeWarnings.length).toBeGreaterThan(0)

      // The warning should have the count
      const lastWarning = sizeWarnings[sizeWarnings.length - 1][0] as CustomEvent
      expect(lastWarning.detail.count).toBeGreaterThanOrEqual(QUEUE_SIZE_LIMIT)
    })

    it('does not fire warning below the limit', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      // Add just a few items (well below limit)
      for (let i = 0; i < 5; i++) {
        addToOfflineQueue(TEST_USER, makeCreateOp({ amount: i + 1 }))
      }

      const sizeWarnings = dispatchSpy.mock.calls.filter(
        call => (call[0] as CustomEvent).type === QUEUE_SIZE_WARNING_EVENT
      )
      expect(sizeWarnings).toHaveLength(0)
    })
  })

  describe('Queue ordering via sequence', () => {
    it('items are returned in insertion order', () => {
      const timestamps: string[] = []

      for (let i = 0; i < 5; i++) {
        const item = addToOfflineQueue(TEST_USER, makeCreateOp({ amount: i + 1, note: `seq-${i}` }))
        timestamps.push(item.createdAt)
      }

      const queue = getOfflineQueue()

      // Verify ordering is maintained
      for (let i = 0; i < 5; i++) {
        const payload = queue[i].operation.payload as { note?: string }
        expect(payload.note).toBe(`seq-${i}`)
      }
    })
  })
})

// ============================================================================
// 531.3 — Schema migration smoke test
// ============================================================================

describe('531.3 — Schema migration smoke test', () => {
  // Test schemas
  const PrefsV1Schema = z.object({
    theme: z.string(),
    notifications: z.boolean(),
  })

  const PrefsV2Schema = z.object({
    theme: z.string(),
    notifications: z.boolean(),
    soundEnabled: z.boolean(),
  })

  const PrefsV3Schema = z.object({
    theme: z.string(),
    notifications: z.boolean(),
    soundEnabled: z.boolean(),
    volume: z.number(),
  })

  describe('Auto-wrap legacy data as version 1', () => {
    it('unversioned localStorage data is treated as version 1', () => {
      // Write legacy data (no envelope)
      store['user-prefs'] = JSON.stringify({ theme: 'dark', notifications: true })
      setCurrentVersion('user-prefs', 1)

      const result = get('user-prefs', PrefsV1Schema)
      expect(result).toEqual({ theme: 'dark', notifications: true })
    })

    it('wraps legacy data in versioned envelope after read', () => {
      store['user-prefs'] = JSON.stringify({ theme: 'purple', notifications: false })
      setCurrentVersion('user-prefs', 1)

      // First read triggers wrapping
      get('user-prefs', PrefsV1Schema)

      // Verify the stored data is now in envelope format
      // Note: since version didn't change (1 -> 1), it won't re-persist.
      // But if we set a migration that bumps it, it will persist.
      // Let's test with a migration to see the persistence:
      clearMigrations()
      store['user-prefs-2'] = JSON.stringify({ theme: 'light', notifications: true })
      registerMigrations('user-prefs-2', {
        1: (data) => ({ ...(data as object), soundEnabled: true }),
      })
      setCurrentVersion('user-prefs-2', 2)

      get('user-prefs-2', PrefsV2Schema)

      const persisted = JSON.parse(store['user-prefs-2'])
      expect(persisted.version).toBe(2)
      expect(persisted.data.soundEnabled).toBe(true)
    })
  })

  describe('Migration v1 → v2 runs automatically on read', () => {
    it('applies registered migration and returns upgraded data', () => {
      store['app-settings'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      registerMigrations('app-settings', {
        1: (v1Data) => {
          const data = v1Data as { theme: string; notifications: boolean }
          return { ...data, soundEnabled: false }
        },
      })
      setCurrentVersion('app-settings', 2)

      const result = get('app-settings', PrefsV2Schema)
      expect(result).toEqual({ theme: 'dark', notifications: true, soundEnabled: false })
    })

    it('chains migrations v1 → v2 → v3', () => {
      store['app-settings'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      registerMigrations('app-settings', {
        1: (v1Data) => ({ ...(v1Data as object), soundEnabled: true }),
        2: (v2Data) => ({ ...(v2Data as object), volume: 75 }),
      })
      setCurrentVersion('app-settings', 3)

      const result = get('app-settings', PrefsV3Schema)
      expect(result).toEqual({
        theme: 'dark',
        notifications: true,
        soundEnabled: true,
        volume: 75,
      })
    })
  })

  describe('Migrated data is validated against target schema', () => {
    it('returns null when migrated data fails validation', () => {
      store['bad-migrate'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      // Migration produces data that doesn't match V2Schema (missing soundEnabled)
      registerMigrations('bad-migrate', {
        1: (data) => data, // Identity — doesn't add soundEnabled
      })
      setCurrentVersion('bad-migrate', 2)

      const result = get('bad-migrate', PrefsV2Schema)
      expect(result).toBeNull() // Validation fails
    })

    it('does not crash on corrupt localStorage data', () => {
      store['corrupt-key'] = 'not valid json {{{['
      setCurrentVersion('corrupt-key', 1)

      const result = get('corrupt-key', PrefsV1Schema)
      expect(result).toBeNull()
    })

    it('returns null for data that passes migration but fails schema', () => {
      store['wrong-types'] = JSON.stringify({
        version: 1,
        data: { theme: 123, notifications: 'yes' }, // Wrong types
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
      setCurrentVersion('wrong-types', 1)

      const result = get('wrong-types', PrefsV1Schema)
      expect(result).toBeNull()
    })
  })

  describe('Persisted migrated envelope', () => {
    it('persists at new version so subsequent reads skip migration', () => {
      store['persist-test'] = JSON.stringify({
        version: 1,
        data: { theme: 'dark', notifications: true },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      let migrationCallCount = 0
      registerMigrations('persist-test', {
        1: (data) => {
          migrationCallCount++
          return { ...(data as object), soundEnabled: true }
        },
      })
      setCurrentVersion('persist-test', 2)

      // First read triggers migration
      const result1 = get('persist-test', PrefsV2Schema)
      expect(result1).toEqual({ theme: 'dark', notifications: true, soundEnabled: true })
      expect(migrationCallCount).toBe(1)

      // Verify persisted version is 2
      const persisted = JSON.parse(store['persist-test'])
      expect(persisted.version).toBe(2)

      // Second read should NOT re-run migration (data already at v2)
      const result2 = get('persist-test', PrefsV2Schema)
      expect(result2).toEqual({ theme: 'dark', notifications: true, soundEnabled: true })
      expect(migrationCallCount).toBe(1) // Still 1, not re-invoked
    })

    it('getCurrentVersion defaults to 1 for unregistered keys', () => {
      expect(getCurrentVersion('never-registered-key')).toBe(1)
    })
  })

  describe('Write with validation', () => {
    it('set validates data before writing', () => {
      setCurrentVersion('write-test', 1)
      const success = set('write-test', { theme: 'purple', notifications: true }, PrefsV1Schema)
      expect(success).toBe(true)

      const stored = JSON.parse(store['write-test'])
      expect(stored.version).toBe(1)
      expect(stored.data).toEqual({ theme: 'purple', notifications: true })
    })

    it('set rejects invalid data', () => {
      setCurrentVersion('write-test', 1)
      // @ts-expect-error intentionally invalid
      const success = set('write-test', { theme: 123, notifications: 'bad' }, PrefsV1Schema)
      expect(success).toBe(false)
      expect(store['write-test']).toBeUndefined()
    })

    it('remove deletes key from storage', () => {
      store['remove-test'] = 'some-value'
      remove('remove-test')
      expect(store['remove-test']).toBeUndefined()
    })
  })
})
