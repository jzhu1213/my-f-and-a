# Folio Data Protection Audit

This document audits how Folio stores and protects user data: what sensitive
fields live where, the encryption-at-rest and in-transit posture, how Row-Level
Security (RLS) enforces per-user isolation, the security of read-only sharing
tokens, and a feasibility review of optional two-factor authentication (2FA).

It is a point-in-time review of the repository (task 194.1). Items that depend
on the live Supabase project configuration — which is outside the repo — are
called out explicitly as **unverified** so nothing here overstates the actual
runtime posture.

Column names in the database use `snake_case`; the app converts them to
`camelCase` via mapper functions in `src/lib/supabaseData.ts`. Cross-reference:
`docs/DATA-MODEL.md` for the full schema.

---

## 1. Sensitive Field Inventory

The following is the actual set of user-owned data Folio persists, drawn from
the DB type interfaces and CRUD functions in `src/lib/supabaseData.ts` and the
domain types in `src/types/index.ts` and `src/types/folio.ts`.

### Stored in Supabase (Postgres)

| Table | Sensitive fields | Sensitivity | Notes |
|-------|------------------|-------------|-------|
| `profiles` | `email`, `name`, `display_name`, `avatar_url`, `user_type`, `priority`, onboarding flags | Medium (PII: email, name) | `email` is also held by Supabase Auth; the profile row mirrors it. |
| `transactions` | `amount`, `category`, `note`, `type`, `date`, `account_type` | High | `note` is free text and may contain descriptions of purchases; financial behavior is inherently sensitive. |
| `budgets` | `monthly_limit`, `spent`, `category`, `period` | Medium | Reveals spending capacity and habits. |
| `goals` | `name`, `target_amount`, `current_amount`, `target_date`, `linked_account_id` | Medium | Goal names are free text. |
| `savings_accounts` | `name`, `balance`, `monthly_contribution`, `expected_annual_return`, `type` | High | Balances are sensitive financial data. |
| `debts` | `name`, `balance`, `apr`, `minimum_payment`, `type` | High | Liability data (student loans, credit cards). |
| `sinking_funds` | `label`, `target_amount`, `saved_amount`, `monthly_reserve`, `due_date` | Medium | |
| `allocations` | `spend`, `save`, `invest`, `set_aside`, `date` | Medium | Income-split records. |
| `pay_schedules` | `cadence`, `anchor_date`, `amount` | Medium | Reveals income timing/amount. |
| `funding_sources` | payment-method metadata, `snapshot_balance` | Medium | Payment method *types* (debit/cash/credit/wallet/borrowed), not card numbers. |
| `reimbursements` | IOU amounts and counterparties | Medium | |
| `lesson_progress` | `lesson_id`, `completed`, `quiz_score` | Low | Educational progress. |
| `user_sessions` (additive) | `device_id`, `label`, `user_agent`, `last_seen_at` | Low–Medium | `device_id` is a random, non-PII id; `user_agent` is coarse device metadata, not fingerprinting. See `src/lib/sessionManagement.ts`. |

### Stored by Supabase Auth (managed service)

- Email, hashed password, session/refresh tokens, and any auth metadata are
  managed by Supabase Auth (the `auth.users` schema), not by application tables.
  Passwords are never stored or handled in app code — sign-in/sign-up go through
  `supabase.auth.signInWithPassword` / `signUp` in `src/lib/supabaseData.ts`.

### Stored client-side (localStorage / sessionStorage — device-local)

These never leave the device and are **not** encrypted at rest by the app
beyond what the OS/browser provides:

| Store | Key(s) | Sensitivity | Notes |
|-------|--------|-------------|-------|
| Share links | `folio-share-links`, `folio-shared-data-*` | Medium | Sharing tokens + cached read-only summaries (`src/lib/sharingUtils.ts`). MVP is localStorage-only. |
| Shared goals | `folio-shared-goals` | Low–Medium | Share tokens + participant names (`src/lib/sharedGoalUtils.ts`). |
| App lock | `folio_app_lock_prefs` | Low (by design) | Stores only a **salted PBKDF2 hash** of the PIN (150k iterations, SHA-256) + a WebAuthn credential id — never the raw PIN or any secret material (`src/lib/appLock.ts`). |
| Device id | `folio_device_id` | Low | Random id, no PII. |
| Home cache / offline queue | various | Medium | Cached transactions/budgets for instant load and offline writes (`src/lib/homeCache.ts`, `src/lib/offlineQueue.ts`). Mirrors Supabase data locally. |
| Receipt references | receipt URLs | Medium | Receipt photos stored in a Supabase Storage `receipts` bucket with localStorage fallback (`src/lib/receiptStorage.ts`). |
| Transaction tags | per-transaction labels | Low | localStorage until a DB column is added. |

**Observation:** Folio does **not** store card numbers, bank credentials, SSNs,
or any linked-institution secrets. It is a self-reported pocket-money tracker,
which materially lowers the blast radius of any single compromise. The most
sensitive persisted data is free-text transaction notes, account/debt balances,
and email/name PII.

---

## 2. Encryption-at-Rest & In-Transit Posture

### What Supabase/Postgres provides by default

- **At rest:** Supabase-managed Postgres runs on cloud infrastructure where the
  underlying disks/volumes are encrypted at rest by the platform. This is a
  property of the managed database tier, **not** something implemented in this
  repo. Supabase Storage (the `receipts` bucket) is likewise encrypted at rest
  by the platform.
- **In transit:** The Supabase client (`src/lib/supabaseClient.ts`) connects
  over HTTPS/TLS to the `NEXT_PUBLIC_SUPABASE_URL` endpoint. All CRUD, auth, and
  storage traffic is TLS-encrypted in transit. The app is deployed on Vercel,
  which serves the frontend over HTTPS.

### What could NOT be verified from the repo

- The exact at-rest encryption configuration of the specific Supabase project
  (region, key management, whether any custom encryption is enabled) lives in
  the Supabase dashboard/project settings, **not** in this codebase. Treat the
  "encrypted at rest by the platform" statement as the documented default of the
  managed service, to be confirmed against the actual project settings.
- Backup encryption and retention policy are project-level settings — unverified
  here.

### Field-level encryption — is it warranted?

Folio stores no payment credentials or government identifiers, so
application-layer field-level encryption is **not required** for a product at
this stage. The default managed at-rest encryption plus RLS is a reasonable
posture for self-reported budgeting data.

If field-level encryption were later pursued for defense-in-depth on the most
sensitive columns (`transactions.note`, `savings_accounts.balance`,
`debts.balance`), the honest tradeoffs are:

- Encrypted columns can no longer be filtered, ordered, or aggregated in SQL
  (e.g. the monthly `.gte('date', …)` range queries and budget rollups rely on
  plaintext numeric/date columns).
- Key management becomes the new hard problem: a client-held key means lost-key =
  lost-data; a server-held key via `pgsodium`/Vault re-centralizes trust.
- **Recommendation:** Do not add field-level encryption now. Revisit only if the
  product begins storing linked-institution data or other high-severity secrets.

---

## 3. Row-Level Security (RLS) Review

### How isolation is enforced today

Every server-side table read/write in `src/lib/supabaseData.ts` is scoped by the
authenticated user's id. Two patterns are used consistently:

- Reads filter with `.eq('user_id', userId)` (e.g. `getTransactions`,
  `getBudgets`, `getGoals`, `getSavingsAccounts`, `getDebts`, `getMonthAllocations`).
- Writes/deletes double-scope with both the row id **and** `.eq('user_id', userId)`
  (e.g. `updateTransaction`, `deleteTransaction`, `updateGoal`, `deleteGoal`,
  `revokeSession`). The `profiles` table is keyed by `id` = the auth user id.

The account-deletion primitive `deleteAllUserData` (task 191.1) iterates every
user-owned table and deletes `.eq('user_id', userId)`, relying on RLS to keep
the delete confined to the caller's own rows.

**Important:** These `user_id` filters are a correctness/clarity measure in the
client. They are **not** the security boundary on their own — the client uses the
public anon key, so the real enforcement must be RLS policies in Postgres. If RLS
were disabled or misconfigured, the anon key could in principle read other users'
rows regardless of the client-side filters.

### Where the policies live

No SQL migration or policy files exist in the repo (searched for `CREATE TABLE`,
`policy`, `auth.uid`, `RLS`). The only RLS policy definitions present are inline
documentation comments — notably the suggested `user_sessions` table + policy in
`src/lib/sessionManagement.ts`:

```sql
alter table public.user_sessions enable row level security;
create policy "own sessions" on public.user_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`docs/DATA-MODEL.md` states all tables use RLS keyed on `user_id`. This means the
policies are defined and maintained in the **Supabase dashboard**, not in
version control — which is a gap (see checklist). There is no automated,
reviewable proof in the repo that RLS is enabled on every table.

### Recommended RLS policy template (per user-owned table)

Apply to `transactions`, `budgets`, `goals`, `savings_accounts`, `debts`,
`sinking_funds`, `allocations`, `pay_schedules`, `funding_sources`,
`reimbursements`, `lesson_progress`, `user_sessions`:

```sql
-- 1. Turn RLS on (denies all access until a policy allows it).
alter table public.<table> enable row level security;

-- 2. Owner-only access for every operation.
create policy "<table>_owner_all" on public.<table>
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

For `profiles` (keyed by `id`, not `user_id`):

```sql
alter table public.profiles enable row level security;
create policy "profiles_owner_all" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

Recommendation: capture these policies as a checked-in SQL migration file (e.g.
`supabase/migrations/…`) so RLS is reviewable and reproducible, and so the
"is RLS on?" question has a version-controlled answer.

---

## 4. Sharing Token Security (cross-reference: task 193.1 hardening)

Read-only sharing is implemented in `src/lib/sharingUtils.ts` (spending
summaries) and `src/lib/sharedGoalUtils.ts` (shared goals). Both are currently
**localStorage-only** for the MVP.

Hardening already in place (task 193.1):

- **Tokens:** Generated with `crypto.randomUUID()` — 122 bits of entropy,
  unguessable.
- **Expiry:** Links support `expiresAt` with presets (7/30/90 days or none).
  `isShareLinkExpired` / `isShareLinkValid` gate every read; expired links return
  no data and their cached summary is purged.
- **Revoke:** `revokeShareLink` deactivates immediately and removes the cached
  summary so revoked data can't be read afterward.
- **Scope:** `ShareScope` limits which sections a recipient sees
  (`status` / `weekSpending` / `categories`). Out-of-scope sections are blanked
  **at generation time** and re-applied on read (defense-in-depth), so narrowing
  scope takes effect even against a previously cached summary.
- **Data minimization:** Shared summaries expose only high-level percentages and
  totals — never individual transactions or dollar-level line items.

Honest limitations (documented in the source):

- Because persistence is localStorage, a share link only resolves on the device
  that created it — it is not truly cross-device yet. The in-code comments note
  the production path is a Supabase table with RLS.
- Expiry/revoke are enforced by client code reading local state. When this moves
  server-side, enforcement should happen in Postgres (RLS + a scheduled cleanup
  or `expires_at` check in the query) so a recipient can never bypass it.

**Recommendation:** When sharing graduates from MVP, store links in a
`share_links` table with RLS (owner can CRUD their own links) plus a public,
token-scoped read path (e.g. a `security definer` RPC that validates
`is_active` + `expires_at` server-side and returns only the sanitized summary).

---

## 5. Optional 2FA on the Auth Layer (feasibility + recommendation)

**Status: documented recommendation, not implemented.** Folio's auth UI is a
simple email/password flow; a full MFA enrollment + challenge experience would
touch sign-in, settings, and session handling. Per the task's guidance, adding
it now would be disruptive, so the recommended approach is documented here for a
clean future implementation.

### Feasibility with Supabase Auth

Supabase Auth supports app-based TOTP MFA natively via the JS client, with no
backend code required. The flow uses four client methods:

1. **Enroll** — `supabase.auth.mfa.enroll({ factorType: 'totp' })` returns a
   `factorId` plus a QR code / secret the user scans into an authenticator app.
2. **Challenge** — `supabase.auth.mfa.challenge({ factorId })` starts a
   verification challenge.
3. **Verify** — `supabase.auth.mfa.verify({ factorId, challengeId, code })`
   confirms the 6-digit code and activates the factor (also used at sign-in).
4. **Assurance level** — `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
   reports `aal1` vs `aal2`, letting the app require step-up before showing
   sensitive screens.

Unenroll uses `supabase.auth.mfa.unenroll({ factorId })`. To make MFA meaningful,
RLS policies can additionally require `aal2` for sensitive tables.

### Recommended implementation (when prioritized)

- Add an opt-in "Two-factor authentication" section under Settings → Privacy &
  security (consistent with the existing progressive-disclosure App Lock).
- Enrollment UI: render the TOTP QR/secret, verify a first code before marking
  the factor active.
- Sign-in: after password success, if `getAuthenticatorAssuranceLevel()` shows a
  pending `aal2` requirement, present a challenge/verify step.
- Provide clear recovery messaging and a way to unenroll from a trusted session.
- Keep it strictly optional and off by default, matching Folio's "no forced
  setup" principle.

**Distinction from the existing App Lock:** `src/lib/appLock.ts` is a
*device-local* cold-open gate (PIN/biometric), not account security. It does not
protect the Supabase account if credentials leak. True account-level 2FA is the
Supabase MFA flow above. Both are complementary.

---

## 6. Prioritized Findings Checklist

Ordered by risk. None represent an active data breach; several are hardening and
verifiability gaps typical of an MVP.

### High priority

- [ ] **Verify RLS is enabled on every user-owned table** in the Supabase
  dashboard. Client-side `user_id` filters are not the security boundary — RLS
  is. This is the single most important item because the app ships the public
  anon key. (§3)
- [ ] **Check the anon vs service-role key usage.** Confirm the service-role key
  is never bundled into client code or `NEXT_PUBLIC_*` env vars (only the anon
  key should be public). `supabaseClient.ts` correctly uses the anon key.

### Medium priority

- [ ] **Commit RLS policies as a version-controlled SQL migration** so policy
  coverage is reviewable and reproducible instead of living only in the
  dashboard. Use the template in §3. (§3)
- [ ] **Confirm Supabase project at-rest encryption + backup settings** in the
  dashboard and record them, since they cannot be verified from the repo. (§2)
- [ ] **Plan the server-side migration for sharing tokens** (`share_links` table
  with RLS + token-scoped read RPC) so expiry/revoke/scope are enforced in the
  database rather than only in client code. (§4)
- [ ] **Confirm the `receipts` Storage bucket is private** with RLS/signed URLs,
  not public, since receipt photos can contain sensitive detail. (§1)

### Low priority / optional

- [ ] **Add optional account-level 2FA (TOTP)** via Supabase MFA, opt-in under
  Settings. (§5)
- [ ] **Review free-text fields** (`transactions.note`, goal/debt/account names)
  for any accidental logging — confirm they never appear in analytics or error
  logs. The design doc already states no analytics on transaction content.
- [ ] **Reassess field-level encryption only if scope expands** to store
  linked-institution data or other high-severity secrets. Not warranted today. (§2)

---

## Summary

Folio stores self-reported budgeting data (amounts, categories, free-text notes,
balances) plus basic PII (email, name) in Supabase, and some device-local state
in localStorage. It stores **no** payment credentials or government identifiers.
Transport is TLS; at-rest encryption is provided by the managed Supabase/Postgres
platform (to be confirmed against project settings). Per-user isolation depends
on RLS keyed on `user_id` — consistently reinforced by client-side filters but
ultimately enforced (and to be verified/version-controlled) in Postgres. Sharing
tokens are already hardened with unguessable tokens, expiry, revoke, and scope,
with a documented path to server-side enforcement. Account-level 2FA is feasible
with Supabase MFA and recommended as an opt-in future addition. The top action is
to **verify and version-control RLS coverage**.
