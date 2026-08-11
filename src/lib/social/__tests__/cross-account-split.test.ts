/**
 * Cross-account split smoke test (task 295.2).
 *
 * Validates the end-to-end data flow for linked (cross-account) splits:
 * 1. Two users establish a friendship (friend request → accept)
 * 2. A linked split creates paired IOUs on both sides
 * 3. Settling one participant reflects on both ledgers
 * 4. A name-only split creates only a single-sided IOU (payer's ledger only)
 *
 * Since this runs in CI without a Supabase connection, we mock the Supabase
 * client responses to validate that the logic layer issues the correct calls
 * and transforms the data properly.
 *
 * Requirements: 14.2, 14.3, 12.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Test Constants
// ============================================================================

const USER_A_ID = 'aaaa-1111-aaaa-1111'
const USER_B_ID = 'bbbb-2222-bbbb-2222'
const FRIENDSHIP_ID = 'friendship-0001'
const SPLIT_ID = 'split-0001'
const PARTICIPANT_A_ID = 'part-a-001'
const PARTICIPANT_B_ID = 'part-b-001'
const REIMBURSEMENT_A_ID = 'reimb-a-001'
const REIMBURSEMENT_B_ID = 'reimb-b-001'

// ============================================================================
// Mock Setup
// ============================================================================

// Track all supabase calls for assertions
let supabaseCalls: { table: string; method: string; args: unknown[] }[] = []
let mockSession: { session: { user: { id: string } } | null } = {
  session: { user: { id: USER_A_ID } },
}

// Mock response factories
function makeSelectResponse(data: unknown) {
  return {
    data,
    error: null,
  }
}

function makeSingleResponse(data: unknown) {
  return {
    data,
    error: null,
    single: () => ({ data, error: null }),
  }
}

// Build a chainable mock for supabase queries
function createChainMock(table: string) {
  const chain: Record<string, unknown> = {}

  const addMethod = (name: string) => {
    chain[name] = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table, method: name, args })
      return chain
    })
  }

  // Query builder methods
  ;['select', 'insert', 'update', 'delete', 'upsert'].forEach(addMethod)
  ;['eq', 'neq', 'in', 'or', 'gte', 'lt', 'gt', 'lte', 'order', 'limit'].forEach(addMethod)

  // Terminal methods that return data
  chain.single = vi.fn(() => {
    const lastInsertOrUpdate = supabaseCalls
      .filter((c) => c.table === table && ['insert', 'update'].includes(c.method))
      .pop()

    if (table === 'friendships') {
      return makeSingleResponse({
        id: FRIENDSHIP_ID,
        requester_id: USER_A_ID,
        addressee_id: USER_B_ID,
        status: 'pending',
        created_at: new Date().toISOString(),
        responded_at: null,
      })
    }
    if (table === 'splits') {
      return makeSingleResponse({
        id: SPLIT_ID,
        owner_id: USER_A_ID,
        linked_transaction_id: null,
        total_amount: 50,
        type: 'expense',
        split_method: 'even',
        note: 'Lunch',
        settled: false,
        created_at: new Date().toISOString(),
      })
    }
    if (table === 'split_participants') {
      // Return the updated participant (settled)
      return makeSingleResponse({
        id: PARTICIPANT_B_ID,
        split_id: SPLIT_ID,
        participant_user_id: USER_B_ID,
        participant_name: 'Bob',
        share_amount: 25,
        is_payer: false,
        settled: true,
        created_at: new Date().toISOString(),
      })
    }
    if (table === 'reimbursements') {
      return makeSingleResponse({
        id: REIMBURSEMENT_A_ID,
        user_id: USER_A_ID,
        person_name: 'Bob',
        direction: 'owed_to_me',
        amount: 25,
        note: 'Split: Lunch',
        settled: false,
        settled_at: null,
        linked_transaction_id: SPLIT_ID,
        counterparty_user_id: USER_B_ID,
        split_id: SPLIT_ID,
        created_at: new Date().toISOString(),
      })
    }
    return makeSingleResponse(null)
  })

  // Make select() return data (for list queries)
  const originalSelect = chain.select as ReturnType<typeof vi.fn>
  chain.select = vi.fn((...args: unknown[]) => {
    supabaseCalls.push({ table, method: 'select', args })
    return chain
  })

  return chain
}

// Table-specific mock chains
let friendshipsChain: ReturnType<typeof createChainMock>
let splitsChain: ReturnType<typeof createChainMock>
let splitParticipantsChain: ReturnType<typeof createChainMock>
let reimbursementsChain: ReturnType<typeof createChainMock>

// Mock the supabase module
vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: mockSession }),
    },
    from: (table: string) => {
      switch (table) {
        case 'friendships':
          return friendshipsChain
        case 'splits':
          return splitsChain
        case 'split_participants':
          return splitParticipantsChain
        case 'reimbursements':
          return reimbursementsChain
        default:
          return createChainMock(table)
      }
    },
  },
}))

// ============================================================================
// Tests
// ============================================================================

describe('Cross-account split smoke test', () => {
  beforeEach(() => {
    supabaseCalls = []
    mockSession = { session: { user: { id: USER_A_ID } } }
    friendshipsChain = createChainMock('friendships')
    splitsChain = createChainMock('splits')
    splitParticipantsChain = createChainMock('split_participants')
    reimbursementsChain = createChainMock('reimbursements')

    vi.clearAllMocks()
  })

  it('1. Two users can establish a friendship (request + accept)', async () => {
    // Arrange: User A sends a friend request to User B
    const { sendFriendRequest, respondToRequest } = await import('../friends')

    // Act: Send the request
    const friendship = await sendFriendRequest(USER_B_ID)

    // Assert: insert was called on friendships table with correct requester/addressee
    const insertCalls = supabaseCalls.filter(
      (c) => c.table === 'friendships' && c.method === 'insert'
    )
    expect(insertCalls.length).toBeGreaterThanOrEqual(1)
    expect(friendship).not.toBeNull()
    expect(friendship?.requesterId).toBe(USER_A_ID)
    expect(friendship?.addresseeId).toBe(USER_B_ID)
    expect(friendship?.status).toBe('pending')

    // Now User B accepts the request
    supabaseCalls = []
    // Mock the update to return accepted status
    friendshipsChain.single = vi.fn(() =>
      makeSingleResponse({
        id: FRIENDSHIP_ID,
        requester_id: USER_A_ID,
        addressee_id: USER_B_ID,
        status: 'accepted',
        created_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
      })
    )

    const accepted = await respondToRequest(FRIENDSHIP_ID, 'accepted')

    // Assert: update was called and status is 'accepted'
    const updateCalls = supabaseCalls.filter(
      (c) => c.table === 'friendships' && c.method === 'update'
    )
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
    expect(accepted).not.toBeNull()
    expect(accepted?.status).toBe('accepted')
    expect(accepted?.respondedAt).not.toBeNull()
  })

  it('2. A linked split creates paired IOUs on both sides', async () => {
    // Arrange: User A creates a split with User B as a linked participant
    const { createSplit } = await import('../splits')

    // Mock split_participants insert to return both participants
    splitParticipantsChain.single = vi.fn(() =>
      makeSingleResponse({
        id: PARTICIPANT_A_ID,
        split_id: SPLIT_ID,
        participant_user_id: USER_A_ID,
        participant_name: 'Alice',
        share_amount: 25,
        is_payer: true,
        settled: true,
        created_at: new Date().toISOString(),
      })
    )

    // Override select on split_participants to return participant list
    const participantRows = [
      {
        id: PARTICIPANT_A_ID,
        split_id: SPLIT_ID,
        participant_user_id: USER_A_ID,
        participant_name: 'Alice',
        share_amount: 25,
        is_payer: true,
        settled: true,
        created_at: new Date().toISOString(),
      },
      {
        id: PARTICIPANT_B_ID,
        split_id: SPLIT_ID,
        participant_user_id: USER_B_ID,
        participant_name: 'Bob',
        share_amount: 25,
        is_payer: false,
        settled: false,
        created_at: new Date().toISOString(),
      },
    ]

    // The insert().select() chain on split_participants returns the rows
    splitParticipantsChain.select = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table: 'split_participants', method: 'select', args })
      // After insert, return all participant rows
      return {
        ...splitParticipantsChain,
        data: participantRows,
        error: null,
        // Override terminal: no single() needed, the insert().select() returns data directly
        then: undefined,
      }
    })

    // Make the insert chain resolve with the participant data
    const originalInsert = splitParticipantsChain.insert as ReturnType<typeof vi.fn>
    splitParticipantsChain.insert = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table: 'split_participants', method: 'insert', args })
      return {
        select: vi.fn(() => ({
          data: participantRows,
          error: null,
        })),
        data: participantRows,
        error: null,
      }
    })

    // Mock splits insert -> select -> single chain
    splitsChain.insert = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table: 'splits', method: 'insert', args })
      return {
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: SPLIT_ID,
              owner_id: USER_A_ID,
              linked_transaction_id: null,
              total_amount: 50,
              type: 'expense',
              split_method: 'even',
              note: 'Lunch',
              settled: false,
              created_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      }
    })

    // Track reimbursement inserts
    const reimbursementInserts: unknown[] = []
    reimbursementsChain.insert = vi.fn((...args: unknown[]) => {
      reimbursementInserts.push(args[0])
      supabaseCalls.push({ table: 'reimbursements', method: 'insert', args })
      return {
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: `reimb-${reimbursementInserts.length}`,
              user_id: (args[0] as Record<string, unknown>).user_id,
              person_name: (args[0] as Record<string, unknown>).person_name,
              direction: (args[0] as Record<string, unknown>).direction,
              amount: (args[0] as Record<string, unknown>).amount,
              note: (args[0] as Record<string, unknown>).note,
              settled: false,
              settled_at: null,
              created_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      }
    })

    // Act: Create the linked split (User B has a participantUserId)
    const result = await createSplit({
      totalAmount: 50,
      type: 'expense',
      splitMethod: 'even',
      note: 'Lunch',
      participants: [
        {
          participantUserId: USER_A_ID,
          participantName: 'Alice',
          shareAmount: 25,
          isPayer: true,
        },
        {
          participantUserId: USER_B_ID,
          participantName: 'Bob',
          shareAmount: 25,
          isPayer: false,
        },
      ],
    })

    // Assert: split was created
    expect(result).not.toBeNull()
    expect(result?.split.id).toBe(SPLIT_ID)
    expect(result?.split.totalAmount).toBe(50)

    // Assert: paired IOUs were created (2 reimbursement inserts)
    // - One for the payer (owed_to_me: Bob owes Alice)
    // - One for the ower (owed_by_me: Bob owes Alice, from Bob's side)
    expect(reimbursementInserts.length).toBe(2)

    const payerIOU = reimbursementInserts[0] as Record<string, unknown>
    expect(payerIOU.user_id).toBe(USER_A_ID)
    expect(payerIOU.direction).toBe('owed_to_me')
    expect(payerIOU.person_name).toBe('Bob')
    expect(payerIOU.amount).toBe(25)

    const owerIOU = reimbursementInserts[1] as Record<string, unknown>
    expect(owerIOU.user_id).toBe(USER_B_ID)
    expect(owerIOU.direction).toBe('owed_by_me')
    expect(owerIOU.person_name).toBe('Alice')
    expect(owerIOU.amount).toBe(25)
  })

  it('3. Settling one participant reflects via the settle API', async () => {
    // Arrange: settle User B's participant record
    const { settleParticipant } = await import('../splits')

    // Mock the update chain for split_participants
    splitParticipantsChain.update = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table: 'split_participants', method: 'update', args })
      return {
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: PARTICIPANT_B_ID,
                split_id: SPLIT_ID,
                participant_user_id: USER_B_ID,
                participant_name: 'Bob',
                share_amount: 25,
                is_payer: false,
                settled: true,
                created_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      }
    })

    // Act
    const settled = await settleParticipant(PARTICIPANT_B_ID)

    // Assert: participant was updated to settled
    expect(settled).not.toBeNull()
    expect(settled?.settled).toBe(true)
    expect(settled?.participantUserId).toBe(USER_B_ID)
    expect(settled?.shareAmount).toBe(25)

    // Assert: update was called with { settled: true }
    const updateCalls = supabaseCalls.filter(
      (c) => c.table === 'split_participants' && c.method === 'update'
    )
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
    expect(updateCalls[0].args[0]).toEqual({ settled: true })
  })

  it('4. A name-only split creates only a single-sided IOU (payer ledger only)', async () => {
    // Arrange: User A creates a split where participant "Charlie" has no userId (name-only)
    const { createSplit } = await import('../splits')

    // Reset call tracking
    supabaseCalls = []

    const participantRows = [
      {
        id: PARTICIPANT_A_ID,
        split_id: SPLIT_ID,
        participant_user_id: USER_A_ID,
        participant_name: 'Alice',
        share_amount: 30,
        is_payer: true,
        settled: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'part-charlie-001',
        split_id: SPLIT_ID,
        participant_user_id: null, // name-only — no linked user
        participant_name: 'Charlie',
        share_amount: 30,
        is_payer: false,
        settled: false,
        created_at: new Date().toISOString(),
      },
    ]

    // Mock splits insert chain
    splitsChain.insert = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table: 'splits', method: 'insert', args })
      return {
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: SPLIT_ID,
              owner_id: USER_A_ID,
              linked_transaction_id: null,
              total_amount: 60,
              type: 'expense',
              split_method: 'even',
              note: 'Dinner',
              settled: false,
              created_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      }
    })

    // Mock split_participants insert chain
    splitParticipantsChain.insert = vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table: 'split_participants', method: 'insert', args })
      return {
        select: vi.fn(() => ({
          data: participantRows,
          error: null,
        })),
      }
    })

    // Track reimbursement inserts
    const reimbursementInserts: unknown[] = []
    reimbursementsChain.insert = vi.fn((...args: unknown[]) => {
      reimbursementInserts.push(args[0])
      supabaseCalls.push({ table: 'reimbursements', method: 'insert', args })
      return {
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: `reimb-${reimbursementInserts.length}`,
              user_id: (args[0] as Record<string, unknown>).user_id,
              person_name: (args[0] as Record<string, unknown>).person_name,
              direction: (args[0] as Record<string, unknown>).direction,
              amount: (args[0] as Record<string, unknown>).amount,
              note: (args[0] as Record<string, unknown>).note,
              settled: false,
              settled_at: null,
              created_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      }
    })

    // Act: Create a name-only split (Charlie has no participantUserId)
    const result = await createSplit({
      totalAmount: 60,
      type: 'expense',
      splitMethod: 'even',
      note: 'Dinner',
      participants: [
        {
          participantUserId: USER_A_ID,
          participantName: 'Alice',
          shareAmount: 30,
          isPayer: true,
        },
        {
          participantUserId: null, // name-only — not a linked friend
          participantName: 'Charlie',
          shareAmount: 30,
          isPayer: false,
        },
      ],
    })

    // Assert: split was created
    expect(result).not.toBeNull()

    // Assert: only ONE reimbursement was created (payer side only)
    // The name-only participant should NOT get a mirror entry
    expect(reimbursementInserts.length).toBe(1)

    const payerIOU = reimbursementInserts[0] as Record<string, unknown>
    expect(payerIOU.user_id).toBe(USER_A_ID)
    expect(payerIOU.direction).toBe('owed_to_me')
    expect(payerIOU.person_name).toBe('Charlie')
    expect(payerIOU.amount).toBe(30)
  })
})
