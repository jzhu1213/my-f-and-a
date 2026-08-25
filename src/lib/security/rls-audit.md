# Folio — Row Level Security (RLS) Audit

**Date:** 2024-05-25  
**Scope:** All tables in `public` schema (schema.sql + migrations)  
**Status:** PASS — all tables protected, no cross-user data leakage found

---

## 1. RLS Status Overview

| # | Table | RLS Enabled | Policy Type | Key Column | Notes |
|---|-------|-------------|-------------|------------|-------|
| 1 | `profiles` | Yes | owner-only | `id` | Keyed by `auth.uid() = id` (not user_id) |
| 2 | `transactions` | Yes | owner-only | `user_id` | Standard owner pattern |
| 3 | `budgets` | Yes | owner-only | `user_id` | Standard owner pattern |
| 4 | `goals` | Yes | owner-only | `user_id` | Standard owner pattern |
| 5 | `lesson_progress` | Yes | owner-only | `user_id` | Standard owner pattern |
| 6 | `savings_accounts` | Yes | owner-only | `user_id` | Standard owner pattern |
| 7 | `debts` | Yes | owner-only | `user_id` | Standard owner pattern |
| 8 | `sinking_funds` | Yes | owner-only | `user_id` | Standard owner pattern |
| 9 | `allocations` | Yes | owner-only | `user_id` | Standard owner pattern |
| 10 | `pay_schedules` | Yes | owner-only | `user_id` | Standard owner pattern |
| 11 | `reimbursements` | Yes | owner + counterparty | `user_id` | Counterparty can read + settle |
| 12 | `funding_sources` | Yes | owner-only | `user_id` | Standard owner pattern |
| 13 | `user_sessions` | Yes | owner-only | `user_id` | Standard owner pattern |
| 14 | `friendships` | Yes | both-parties | `requester_id`, `addressee_id` | Both parties can see/update/delete |
| 15 | `splits` | Yes | owner + participant-read | `owner_id` | Participant read via helper fn |
| 16 | `split_participants` | Yes | owner/participant | `split_id` → owner | Scoped via `is_split_owner` |
| 17 | `notifications` | Yes | recipient-only | `user_id` | Read/update/delete by recipient; insert by self |
| 18 | `goal_participants` | Yes | owner + participant | `goal_id` → owner | Participant self-read/update |
| 19 | `pools` | Yes | owner + member-read | `owner_id` | Member read via helper fn |
| 20 | `pool_members` | Yes | owner + member-read | `pool_id` → owner | Scoped via helpers |
| 21 | `pool_entries` | Yes | owner/member + author | `pool_id` → owner | Members can insert; author can edit/delete |
| 22 | `share_links` | Yes | owner-only | `user_id` | Standard owner pattern |
| 23 | `user_gamification` | Yes | owner-only | `user_id` | Per-operation policies (SELECT/INSERT/UPDATE/DELETE) |

**Views:**
| View | Access | Exposure |
|------|--------|----------|
| `public_profiles` | `anon`, `authenticated` | Only `id`, `handle`, `display_name`, `avatar_url` for discoverable users |

---

## 2. Policy-by-Policy Correctness Analysis

### 2.1 Core Owner-Only Tables

All core tables use the canonical pattern:
```sql
CREATE POLICY {table}_owner_all ON public.{table}
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Analysis:** This is correct. The `FOR ALL` shorthand covers SELECT, INSERT, UPDATE, and DELETE. Both `USING` (for existing rows) and `WITH CHECK` (for new/modified rows) enforce ownership. A user cannot read, create, modify, or delete rows belonging to another user.

**Exception — `profiles`:** Uses `auth.uid() = id` instead of `user_id`. This is correct because profiles use the auth user ID as the primary key directly.

**Verdict:** PASS

### 2.2 Reimbursements (Owner + Counterparty)

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `reimbursements_owner_all` | ALL | `auth.uid() = user_id` |
| `reimbursements_counterparty_read` | SELECT | `auth.uid() = counterparty_user_id` |
| `reimbursements_counterparty_settle` | UPDATE | `auth.uid() = counterparty_user_id` |

**Analysis:**
- Owner has full CRUD — correct.
- Counterparty can read reimbursements they're involved in — correct (they need to see what's owed).
- Counterparty can update (settle) — correct, allows marking as settled.
- Counterparty cannot DELETE or INSERT for another user's reimbursements — correct.
- The counterparty UPDATE policy does NOT restrict which columns can be changed. A counterparty could theoretically update `amount`, `note`, etc.

**Recommendation:** Consider adding a column-level restriction or a trigger to ensure counterparty updates only modify `settled` and `settled_at`. Low severity — the counterparty is an explicitly linked user, not an arbitrary attacker.

**Verdict:** PASS with minor recommendation

### 2.3 Friendships

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `friendships_party_select` | SELECT | `auth.uid() IN (requester_id, addressee_id)` |
| `friendships_insert_as_requester` | INSERT | `auth.uid() = requester_id` |
| `friendships_party_update` | UPDATE | both parties |
| `friendships_party_delete` | DELETE | both parties |

**Analysis:**
- Only involved parties can see the friendship — correct.
- Only the requester can create (prevents spoofing friend requests) — correct.
- Both parties can update status (accept/decline/block) — correct.
- Both parties can delete (unfriend) — correct.
- Unique index on `(least, greatest)` prevents duplicate requests — correct.
- `CHECK (requester_id <> addressee_id)` prevents self-friending — correct.

**Verdict:** PASS

### 2.4 Splits

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `splits_owner_all` | ALL | `auth.uid() = owner_id` |
| `splits_participant_read` | SELECT | `is_split_participant(id)` |

**Analysis:**
- Owner has full control — correct.
- Participants can only read the split, not modify — correct.
- Helper function `is_split_participant` checks `split_participants` table — correct isolation.

**Verdict:** PASS

### 2.5 Split Participants

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `split_participants_read` | SELECT | owner OR self |
| `split_participants_owner_insert` | INSERT | owner of parent split |
| `split_participants_update` | UPDATE | owner OR self |
| `split_participants_owner_delete` | DELETE | owner of parent split |

**Analysis:**
- Only split owner can add/remove participants — correct.
- Participants can see other participants in same split (via owner check) AND themselves — correct.
- Participants can update their own record (e.g., mark settled) — correct.
- A participant cannot delete other participants — correct.

**Verdict:** PASS

### 2.6 Notifications

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `notifications_owner_rw` | SELECT | `auth.uid() = user_id` |
| `notifications_owner_update` | UPDATE | `auth.uid() = user_id` |
| `notifications_owner_delete` | DELETE | `auth.uid() = user_id` |
| `notifications_self_insert` | INSERT | `auth.uid() = user_id` |

**Analysis:**
- Only recipient can read/update/delete their notifications — correct.
- INSERT policy requires `auth.uid() = user_id` — this means users can only insert notifications for themselves. Cross-user notification creation is handled by the `create_notification` SECURITY DEFINER function, which bypasses RLS — correct pattern.
- The `create_notification` function validates that the caller is authenticated and has a relationship with the recipient (friend, pending friendship, or split) — correct access control.

**Verdict:** PASS

### 2.7 Goal Participants

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `goal_participants_owner_all` | ALL | `is_goal_owner(goal_id)` |
| `goal_participants_self_read` | SELECT | `auth.uid() = participant_user_id` |
| `goal_participants_self_update` | UPDATE | `auth.uid() = participant_user_id` |

**Analysis:**
- Goal owner can manage all participants — correct.
- Participants can see and update their own contribution — correct.
- Participants cannot see other participants unless they're the goal owner — this means shared goal participants can't see each other's contributions unless the goal owner queries for them. This is a design choice, not a bug.

**Verdict:** PASS

### 2.8 Pools (Household)

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `pools_owner_all` | ALL | `auth.uid() = owner_id` |
| `pools_member_read` | SELECT | `is_pool_member(id)` |
| `pool_members_owner_all` | ALL | `is_pool_owner(pool_id)` |
| `pool_members_read` | SELECT | member OR owner |
| `pool_entries_read` | SELECT | member OR owner |
| `pool_entries_member_insert` | INSERT | (member OR owner) AND `auth.uid() = added_by` |
| `pool_entries_author_update` | UPDATE | author OR owner |
| `pool_entries_author_delete` | DELETE | author OR owner |

**Analysis:**
- Owner has full control over pool and members — correct.
- Members can read the pool, members list, and entries — correct for a shared household pool.
- Members can add entries but must be the `added_by` — prevents impersonation.
- Only the author (or owner) can edit/delete entries — correct.
- Non-members cannot see or interact with pools — correct.

**Verdict:** PASS

### 2.9 Share Links

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `share_links_owner_all` | ALL | `auth.uid() = user_id` |

**Analysis:**
- Only owner can manage their share links — correct.
- Reading shared summaries is handled by `get_shared_summary` SECURITY DEFINER function which validates the token is active/non-expired/non-revoked — correct.
- Anonymous users can call `get_shared_summary` (granted to `anon`) — correct for the share link use case.

**Verdict:** PASS

### 2.10 User Gamification

| Policy | Operation | Condition |
|--------|-----------|-----------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` |
| DELETE | `auth.uid() = user_id` |

**Analysis:** Per-operation policies all enforce owner-only — correct. Has auto-updating `updated_at` trigger.

**Verdict:** PASS

### 2.11 Public Profiles View

```sql
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, handle, display_name, avatar_url
  FROM public.profiles
  WHERE discoverable = true AND handle IS NOT NULL;
```

**Analysis:**
- Only exposes minimal identity fields — correct.
- Filtered to opt-in users only (`discoverable = true`) — correct.
- Granted to `anon` and `authenticated` — correct for friend discovery.
- Does NOT expose email, user_type, setup data, or financial info — correct.

**Verdict:** PASS

---

## 3. Shared Data Access Patterns (Subtask 527.3)

### 3.1 Reimbursements

**Access pattern:** Owner creates → links counterparty via `counterparty_user_id`  
**Consent mechanism:** Explicit — owner sets counterparty; counterparty can only read/settle  
**Risk:** Counterparty UPDATE is not column-restricted (see recommendation in 2.2)  
**Verdict:** Acceptable — counterparty is explicitly invited

### 3.2 Splits

**Access pattern:** Owner creates split → adds participants via `split_participants`  
**Consent mechanism:** Explicit — owner adds participant_user_id  
**Isolation:** Participants can only READ the split, not modify it. They can update their own participant record (mark settled).  
**Cross-split isolation:** `is_split_participant` checks the specific split_id, so being in split A doesn't grant access to split B.  
**Verdict:** PASS — properly scoped

### 3.3 Pools (Roommate/Household)

**Access pattern:** Owner creates pool → adds members → members can add entries  
**Consent mechanism:** Owner invites via `share_token` (UUID); membership recorded in `pool_members`  
**Isolation:** `is_pool_member` checks specific pool_id. Member of pool A cannot access pool B.  
**Entry attribution:** Entries have `added_by` enforced on insert. Only author or pool owner can modify.  
**Verdict:** PASS — well-isolated with proper attribution

### 3.4 Shared Goals

**Access pattern:** Owner creates goal with `is_shared = true` → adds participants  
**Consent mechanism:** Goal owner manages participant list. Participants join via share_token lookup.  
**Isolation:** `is_goal_owner` checks the specific goal_id. Participants can see/update only their own record.  
**Limitation:** Participants cannot see each other's contributions directly (only via goal owner). Acceptable for privacy.  
**Verdict:** PASS

### 3.5 Friendships

**Access pattern:** User A sends request → User B accepts/declines  
**Consent mechanism:** Addressee must explicitly accept. Insert policy requires `auth.uid() = requester_id`.  
**Isolation:** Only the two parties can see the friendship row.  
**Verdict:** PASS — mutual consent required

---

## 4. Unprotected Tables Check (Subtask 527.4)

### Tables with RLS ENABLED (23/23):

All 23 tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`:

1. profiles ✓
2. transactions ✓
3. budgets ✓
4. goals ✓
5. lesson_progress ✓
6. savings_accounts ✓
7. debts ✓
8. sinking_funds ✓
9. allocations ✓
10. pay_schedules ✓
11. reimbursements ✓
12. funding_sources ✓
13. user_sessions ✓
14. friendships ✓
15. splits ✓
16. split_participants ✓
17. notifications ✓
18. goal_participants ✓
19. pools ✓
20. pool_members ✓
21. pool_entries ✓
22. share_links ✓
23. user_gamification ✓

**Verdict:** PASS — no unprotected tables found

### Views:

- `public_profiles` — intentionally public (read-only, filtered to opt-in users, minimal fields). Granted to `anon, authenticated`. This is safe.

### Security Definer Functions:

All helper functions use `SECURITY DEFINER` with `SET search_path = public` — this prevents search_path hijacking attacks. All are `STABLE` (read-only) except `create_notification` and `get_shared_summary` which perform writes but validate access internally.

**Verdict:** PASS

---

## 5. Findings & Recommendations

### Issues Found: 0 Critical, 0 High, 1 Low

| Severity | Table | Finding | Recommendation |
|----------|-------|---------|----------------|
| Low | `reimbursements` | Counterparty UPDATE policy doesn't restrict columns | Add trigger or application-level check to limit counterparty updates to `settled`/`settled_at` only |

### Positive Findings:

1. **Complete coverage** — all 23 tables have RLS enabled with appropriate policies
2. **Consistent patterns** — owner-only tables all use the same `FOR ALL` pattern
3. **Proper consent model** — shared features require explicit linking (counterparty_user_id, participant records, pool membership)
4. **Scoped helper functions** — `is_split_owner`, `is_pool_member`, etc. check specific resource IDs, preventing lateral access
5. **Security definer safety** — all use `SET search_path = public` to prevent hijacking
6. **Public view is minimal** — only exposes opt-in, non-sensitive identity fields
7. **Notification isolation** — cross-user notifications use a validated SECURITY DEFINER function rather than open INSERT policies
8. **No world-readable tables** — every table requires authentication and ownership verification

### Architecture Notes:

- The `FOR ALL` policy pattern is convenient but means a single policy handles all operations. If fine-grained operation control is needed later (e.g., separate read vs write permissions), individual operation policies can be added alongside.
- PostgreSQL RLS is "deny by default" — if no policy matches, access is denied. This means even if a policy is accidentally dropped, the table becomes inaccessible rather than exposed.
