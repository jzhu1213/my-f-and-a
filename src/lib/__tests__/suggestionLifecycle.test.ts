import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateSuggestedEntries,
  confirmSuggestedEntry,
  dismissSuggestedEntry,
  getPendingSuggestions,
  getPendingSuggestionsTotal,
} from '@/lib/suggestedEntries'
import type { SuggestedEntry } from '@/lib/suggestedEntries'
import {
  recordOutcome,
  shouldAutoDisable,
  getConsecutiveDismissals,
  getAutoDisableNotification,
} from '@/lib/correctionTracker'
import type { DetectedRecurrence } from '@/lib/recurrenceDetector'

// ============================================================================
// Helpers
// ============================================================================

/** Creates a confirmed recurrence with nextOccurrence on the given date. */
function makeRecurrence(overrides: Partial<DetectedRecurrence> = {}): DetectedRecurrence {
  return {
    id: 'recurrence-netflix',
    label: 'Netflix',
    amount: 15.99,
    predictedAmount: 15.99,
    category: 'subscriptions',
    frequency: 'monthly',
    nextOccurrence: '2024-03-15',
    confidence: 0.85,
    status: 'confirmed',
    lastOccurrence: '2024-02-15',
    occurrenceCount: 4,
    amountTolerance: 0,
    ...overrides,
  }
}

// ============================================================================
// Tests — Validates: Requirements 23.2, 23.3
// ============================================================================

describe('Suggestion Lifecycle — end-to-end', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // --------------------------------------------------------------------------
  // 1. Suggestion appears on predicted date
  // --------------------------------------------------------------------------
  describe('suggestion appears on predicted date', () => {
    it('generates a pending suggested entry when nextOccurrence matches today', () => {
      const today = new Date(2024, 2, 15) // March 15, 2024
      const recurrence = makeRecurrence({ nextOccurrence: '2024-03-15' })

      const newEntries = generateSuggestedEntries([recurrence], [], today)

      expect(newEntries).toHaveLength(1)
      const entry = newEntries[0]
      expect(entry.status).toBe('pending')
      expect(entry.label).toBe('Netflix')
      expect(entry.amount).toBe(15.99)
      expect(entry.category).toBe('subscriptions')
      expect(entry.date).toBe('2024-03-15')
      expect(entry.recurrenceId).toBe('recurrence-netflix')
    })

    it('does NOT generate a suggestion when nextOccurrence does not match today', () => {
      const today = new Date(2024, 2, 16) // March 16, 2024
      const recurrence = makeRecurrence({ nextOccurrence: '2024-03-20' })

      const newEntries = generateSuggestedEntries([recurrence], [], today)

      expect(newEntries).toHaveLength(0)
    })

    it('does NOT generate suggestions for non-confirmed recurrences', () => {
      const today = new Date(2024, 2, 15)
      const recurrence = makeRecurrence({
        nextOccurrence: '2024-03-15',
        status: 'suggested',
      })

      const newEntries = generateSuggestedEntries([recurrence], [], today)

      expect(newEntries).toHaveLength(0)
    })

    it('does NOT duplicate suggestions if one already exists for the same date', () => {
      const today = new Date(2024, 2, 15)
      const recurrence = makeRecurrence({ nextOccurrence: '2024-03-15' })
      const existingEntry: SuggestedEntry = {
        id: 'suggested-recurrence-netflix-2024-03-15',
        recurrenceId: 'recurrence-netflix',
        label: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        date: '2024-03-15',
        status: 'pending',
        createdAt: new Date().toISOString(),
      }

      const newEntries = generateSuggestedEntries([recurrence], [existingEntry], today)

      expect(newEntries).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // 2. Confirm flow
  // --------------------------------------------------------------------------
  describe('confirm flow', () => {
    it('changes entry status to confirmed with a resolvedAt timestamp', () => {
      const entries: SuggestedEntry[] = [
        {
          id: 'suggested-recurrence-netflix-2024-03-15',
          recurrenceId: 'recurrence-netflix',
          label: 'Netflix',
          amount: 15.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
      ]

      const updated = confirmSuggestedEntry(entries, 'suggested-recurrence-netflix-2024-03-15')

      expect(updated).toHaveLength(1)
      expect(updated[0].status).toBe('confirmed')
      expect(updated[0].resolvedAt).toBeDefined()
      // The resolvedAt should be a valid ISO timestamp
      expect(new Date(updated[0].resolvedAt!).getTime()).not.toBeNaN()
    })

    it('confirmed entry data can be used to create a real transaction', () => {
      const entries: SuggestedEntry[] = [
        {
          id: 'suggested-recurrence-netflix-2024-03-15',
          recurrenceId: 'recurrence-netflix',
          label: 'Netflix',
          amount: 15.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
      ]

      const updated = confirmSuggestedEntry(entries, 'suggested-recurrence-netflix-2024-03-15')
      const confirmed = updated[0]

      // Confirmed entry retains the data needed for a real transaction
      expect(confirmed.amount).toBe(15.99)
      expect(confirmed.category).toBe('subscriptions')
      expect(confirmed.label).toBe('Netflix')
      expect(confirmed.date).toBe('2024-03-15')
    })
  })

  // --------------------------------------------------------------------------
  // 3. Allowance impact
  // --------------------------------------------------------------------------
  describe('allowance impact', () => {
    it('getPendingSuggestionsTotal returns total of pending suggestions', () => {
      const entries: SuggestedEntry[] = [
        {
          id: 'suggested-1',
          recurrenceId: 'recurrence-netflix',
          label: 'Netflix',
          amount: 15.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
        {
          id: 'suggested-2',
          recurrenceId: 'recurrence-spotify',
          label: 'Spotify',
          amount: 9.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
      ]

      const total = getPendingSuggestionsTotal(entries)

      expect(total).toBeCloseTo(25.98)
    })

    it('pending total decreases after confirming an entry', () => {
      const entries: SuggestedEntry[] = [
        {
          id: 'suggested-1',
          recurrenceId: 'recurrence-netflix',
          label: 'Netflix',
          amount: 15.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
        {
          id: 'suggested-2',
          recurrenceId: 'recurrence-spotify',
          label: 'Spotify',
          amount: 9.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
      ]

      // Before confirmation: total is 25.98
      expect(getPendingSuggestionsTotal(entries)).toBeCloseTo(25.98)

      // After confirming Netflix: only Spotify remains pending
      const afterConfirm = confirmSuggestedEntry(entries, 'suggested-1')
      expect(getPendingSuggestionsTotal(afterConfirm)).toBeCloseTo(9.99)
    })
  })

  // --------------------------------------------------------------------------
  // 4. Dismiss flow
  // --------------------------------------------------------------------------
  describe('dismiss flow', () => {
    it('changes entry status to dismissed with a resolvedAt timestamp', () => {
      const entries: SuggestedEntry[] = [
        {
          id: 'suggested-recurrence-netflix-2024-03-15',
          recurrenceId: 'recurrence-netflix',
          label: 'Netflix',
          amount: 15.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
      ]

      const updated = dismissSuggestedEntry(entries, 'suggested-recurrence-netflix-2024-03-15')

      expect(updated).toHaveLength(1)
      expect(updated[0].status).toBe('dismissed')
      expect(updated[0].resolvedAt).toBeDefined()
      expect(new Date(updated[0].resolvedAt!).getTime()).not.toBeNaN()
    })

    it('dismissed entry is no longer in getPendingSuggestions', () => {
      const entries: SuggestedEntry[] = [
        {
          id: 'suggested-1',
          recurrenceId: 'recurrence-netflix',
          label: 'Netflix',
          amount: 15.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
        {
          id: 'suggested-2',
          recurrenceId: 'recurrence-spotify',
          label: 'Spotify',
          amount: 9.99,
          category: 'subscriptions',
          date: '2024-03-15',
          status: 'pending',
          createdAt: '2024-03-15T08:00:00.000Z',
        },
      ]

      const afterDismiss = dismissSuggestedEntry(entries, 'suggested-1')
      const pending = getPendingSuggestions(afterDismiss)

      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBe('suggested-2')
    })

    it('correction tracker records the dismissal via recordOutcome', () => {
      const entry: SuggestedEntry = {
        id: 'suggested-recurrence-netflix-2024-03-15',
        recurrenceId: 'recurrence-netflix',
        label: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        date: '2024-03-15',
        status: 'dismissed',
        createdAt: '2024-03-15T08:00:00.000Z',
        resolvedAt: new Date().toISOString(),
      }

      const outcome = recordOutcome(entry, 'dismissed')

      expect(outcome.outcome).toBe('dismissed')
      expect(outcome.recurrenceId).toBe('recurrence-netflix')
      expect(outcome.suggestedEntryId).toBe('suggested-recurrence-netflix-2024-03-15')
      expect(outcome.actualAmount).toBeNull()
      expect(outcome.actualDate).toBeNull()
      expect(outcome.amountDelta).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // 5. 2 dismissals → auto-disable + user notification
  // --------------------------------------------------------------------------
  describe('2 dismissals → auto-disable', () => {
    it('shouldAutoDisable returns disable: true after 2 consecutive dismissals', () => {
      // Simulate 2 dismissals for the same recurrence
      const entry1: SuggestedEntry = {
        id: 'suggested-recurrence-netflix-2024-02-15',
        recurrenceId: 'recurrence-netflix',
        label: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        date: '2024-02-15',
        status: 'dismissed',
        createdAt: '2024-02-15T08:00:00.000Z',
        resolvedAt: '2024-02-15T09:00:00.000Z',
      }

      const entry2: SuggestedEntry = {
        id: 'suggested-recurrence-netflix-2024-03-15',
        recurrenceId: 'recurrence-netflix',
        label: 'Netflix',
        amount: 15.99,
        category: 'subscriptions',
        date: '2024-03-15',
        status: 'dismissed',
        createdAt: '2024-03-15T08:00:00.000Z',
        resolvedAt: '2024-03-15T09:00:00.000Z',
      }

      // Record first dismissal
      recordOutcome(entry1, 'dismissed')
      // Record second dismissal
      recordOutcome(entry2, 'dismissed')

      // Check consecutive dismissals
      expect(getConsecutiveDismissals('recurrence-netflix')).toBe(2)

      // shouldAutoDisable returns disable: true
      const result = shouldAutoDisable('recurrence-netflix', 'Netflix')
      expect(result.disable).toBe(true)
      expect(result.notification).toBe(
        'Got it — we won\'t suggest Netflix again. You can re-enable it anytime in recurring bills.'
      )
    })

    it('getAutoDisableNotification returns correct copy', () => {
      const notification = getAutoDisableNotification('Netflix')
      expect(notification).toBe(
        'Got it — we won\'t suggest Netflix again. You can re-enable it anytime in recurring bills.'
      )
    })

    it('shouldAutoDisable returns disable: false with fewer than 2 dismissals', () => {
      const entry: SuggestedEntry = {
        id: 'suggested-recurrence-hulu-2024-03-15',
        recurrenceId: 'recurrence-hulu',
        label: 'Hulu',
        amount: 7.99,
        category: 'subscriptions',
        date: '2024-03-15',
        status: 'dismissed',
        createdAt: '2024-03-15T08:00:00.000Z',
        resolvedAt: '2024-03-15T09:00:00.000Z',
      }

      // Record only 1 dismissal
      recordOutcome(entry, 'dismissed')

      expect(getConsecutiveDismissals('recurrence-hulu')).toBe(1)
      const result = shouldAutoDisable('recurrence-hulu', 'Hulu')
      expect(result.disable).toBe(false)
      expect(result.notification).toBeNull()
    })

    it('a confirmation between dismissals resets the consecutive count', () => {
      const dismiss1: SuggestedEntry = {
        id: 'suggested-recurrence-gym-2024-01-15',
        recurrenceId: 'recurrence-gym',
        label: 'Gym Membership',
        amount: 30,
        category: 'health',
        date: '2024-01-15',
        status: 'dismissed',
        createdAt: '2024-01-15T08:00:00.000Z',
        resolvedAt: '2024-01-15T09:00:00.000Z',
      }

      const confirm1: SuggestedEntry = {
        id: 'suggested-recurrence-gym-2024-02-15',
        recurrenceId: 'recurrence-gym',
        label: 'Gym Membership',
        amount: 30,
        category: 'health',
        date: '2024-02-15',
        status: 'confirmed',
        createdAt: '2024-02-15T08:00:00.000Z',
        resolvedAt: '2024-02-15T09:00:00.000Z',
      }

      const dismiss2: SuggestedEntry = {
        id: 'suggested-recurrence-gym-2024-03-15',
        recurrenceId: 'recurrence-gym',
        label: 'Gym Membership',
        amount: 30,
        category: 'health',
        date: '2024-03-15',
        status: 'dismissed',
        createdAt: '2024-03-15T08:00:00.000Z',
        resolvedAt: '2024-03-15T09:00:00.000Z',
      }

      // Dismiss → Confirm → Dismiss: only 1 consecutive dismissal at the end
      recordOutcome(dismiss1, 'dismissed')
      recordOutcome(confirm1, 'confirmed', 30, '2024-02-15')
      recordOutcome(dismiss2, 'dismissed')

      expect(getConsecutiveDismissals('recurrence-gym')).toBe(1)
      const result = shouldAutoDisable('recurrence-gym', 'Gym Membership')
      expect(result.disable).toBe(false)
    })
  })
})
