/**
 * Linked Accounts: OPTIONAL bank/card linking (e.g. Plaid).
 *
 * Folio's positioning is "free core + no-linking-required" — the app is fully
 * usable with zero linked accounts. This module provides:
 *
 *   1. Pure, immutable CRUD-shaped helpers for a list of `LinkedAccount`s
 *      (mirroring the pure-helper style of `fundingSources.ts`).
 *   2. A clearly-marked, STUBBED `startAccountLink()` that gates on a feature
 *      flag AND server env presence and returns a graceful result. It performs
 *      NO network calls and touches NO secrets.
 *
 * SECURITY / SCOPE NOTES:
 * - A real Plaid integration exchanges tokens SERVER-SIDE (public_token →
 *   access_token) and stores the access_token behind a server boundary. The
 *   client only ever holds an opaque `accessTokenRef` — never a raw token.
 * - Plaid credentials (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`) are
 *   SERVER-ONLY (no `NEXT_PUBLIC_` prefix), so they are unreadable in the
 *   browser. That's intentional: client-side, linking always reports
 *   "not configured" and the UI shows a warm "coming soon" state instead of
 *   attempting a broken live connection.
 * - See `.kiro/specs/folio-simplification/TASK-107-ACCOUNT-LINKING.md`.
 */

import type {
  LinkedAccount,
  LinkedAccountKind,
  LinkedAccountStatus,
} from '@/types/folio'
import { isFeatureEnabled } from './featureFlags'

// ============================================================================
// Pure CRUD-shaped helpers (immutable — return new arrays, never mutate input)
// ============================================================================

/** Input for creating a linked account (ids/timestamps are generated). */
export type NewLinkedAccountInput = Omit<
  LinkedAccount,
  'id' | 'createdAt' | 'status'
> & {
  /** Optional initial status — defaults to 'connected'. */
  status?: LinkedAccountStatus
}

/**
 * Generate a stable unique id. Uses `crypto.randomUUID` when available
 * (matching `useRecurringBills`), with a safe fallback for older runtimes.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `linked-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Add a linked account to the list.
 * Returns a NEW array; the input array is not mutated.
 *
 * @param accounts - Current linked accounts
 * @param input - New account fields (id/createdAt/status defaulted)
 * @returns New array including the created account
 */
export function addLinkedAccount(
  accounts: LinkedAccount[],
  input: NewLinkedAccountInput
): LinkedAccount[] {
  const account: LinkedAccount = {
    ...input,
    id: generateId(),
    status: input.status ?? 'connected',
    createdAt: new Date().toISOString(),
  }
  return [...accounts, account]
}

/**
 * Update a linked account by id.
 * The `id`, `userId`, and `createdAt` fields are protected from edits.
 * Returns a NEW array; the input array is not mutated.
 *
 * @param accounts - Current linked accounts
 * @param id - Id of the account to update
 * @param updates - Partial fields to merge
 * @returns New array with the matching account updated
 */
export function updateLinkedAccount(
  accounts: LinkedAccount[],
  id: string,
  updates: Partial<Omit<LinkedAccount, 'id' | 'userId' | 'createdAt'>>
): LinkedAccount[] {
  return accounts.map(account =>
    account.id === id ? { ...account, ...updates } : account
  )
}

/**
 * Remove a linked account by id.
 * Returns a NEW array; the input array is not mutated.
 *
 * @param accounts - Current linked accounts
 * @param id - Id of the account to remove
 * @returns New array without the matching account
 */
export function removeLinkedAccount(
  accounts: LinkedAccount[],
  id: string
): LinkedAccount[] {
  return accounts.filter(account => account.id !== id)
}

/**
 * Look up a single linked account by id.
 *
 * @param accounts - Current linked accounts
 * @param id - Id to find
 * @returns The matching account, or undefined
 */
export function getLinkedAccount(
  accounts: LinkedAccount[],
  id: string
): LinkedAccount | undefined {
  return accounts.find(account => account.id === id)
}

/**
 * Convenience check: is this account currently connected?
 *
 * @param account - The account to check
 * @returns true when status === 'connected'
 */
export function isLinkedAccountConnected(account: LinkedAccount): boolean {
  return account.status === 'connected'
}

/** Human-friendly label for an account kind. */
export function linkedAccountKindLabel(kind: LinkedAccountKind): string {
  return kind === 'bank' ? 'Bank' : 'Card'
}

// ============================================================================
// Configuration + stubbed link entry point (NO network, NO secrets)
// ============================================================================

/**
 * Whether the server is configured with Plaid credentials.
 *
 * Reads SERVER-ONLY env vars (no `NEXT_PUBLIC_` prefix). This means:
 * - Server-side: reflects real configuration.
 * - Client-side: `process.env.PLAID_*` is `undefined`, so this returns `false`.
 *
 * We only ever check for PRESENCE — secret values are never read into any
 * client-visible value, logged, or returned.
 */
export function isAccountLinkingConfigured(): boolean {
  return Boolean(
    process.env.PLAID_CLIENT_ID &&
      process.env.PLAID_SECRET &&
      process.env.PLAID_ENV
  )
}

/**
 * Reason a link attempt could not proceed (used to pick warm UI copy).
 * - `disabled`: the `accountLinking` feature flag is off (opt-in only).
 * - `not_configured`: Plaid server credentials are absent.
 * - `coming_soon`: flag on + configured, but the live integration isn't wired
 *   up yet (this is a scaffold).
 */
export type AccountLinkBlockedReason = 'disabled' | 'not_configured' | 'coming_soon'

/**
 * Result of attempting to start account linking. `ok` is always `false` in this
 * scaffold — there is no live Plaid integration yet. A future task will add an
 * `ok: true` branch carrying a real `link_token` obtained from Folio's backend.
 */
export type StartAccountLinkResult =
  | { ok: false; reason: AccountLinkBlockedReason; message: string }

/** Warm, shame-free copy for each blocked reason. */
const BLOCKED_MESSAGES: Record<AccountLinkBlockedReason, string> = {
  disabled:
    "Linking is off right now — and that's totally fine. Folio works great without it.",
  not_configured:
    "Account linking isn't set up yet. No worries — everything in Folio works without linking a thing.",
  coming_soon:
    "Linking accounts is coming soon. It'll always be optional — Folio never requires it.",
}

/**
 * STUB — begin the optional account-linking flow.
 *
 * This intentionally makes NO network calls and touches NO secrets. It only
 * gates on the feature flag and server env presence, then returns a graceful
 * "not available yet" result the UI can turn into friendly copy.
 *
 * When the real integration lands, the happy path here will ask Folio's own
 * backend for a short-lived Plaid `link_token` and return it (the token
 * exchange still happens SERVER-SIDE; the client never sees the access_token).
 *
 * @returns A graceful, non-throwing result. Never rejects.
 */
export async function startAccountLink(): Promise<StartAccountLinkResult> {
  // 1. Opt-in gate: the feature flag is OFF by default.
  if (!isFeatureEnabled('accountLinking')) {
    return { ok: false, reason: 'disabled', message: BLOCKED_MESSAGES.disabled }
  }

  // 2. Configuration gate: server Plaid credentials must be present.
  //    (Always false in the browser, since these are server-only env vars.)
  if (!isAccountLinkingConfigured()) {
    return {
      ok: false,
      reason: 'not_configured',
      message: BLOCKED_MESSAGES.not_configured,
    }
  }

  // 3. Configured + enabled, but the live integration isn't built yet.
  return { ok: false, reason: 'coming_soon', message: BLOCKED_MESSAGES.coming_soon }
}
