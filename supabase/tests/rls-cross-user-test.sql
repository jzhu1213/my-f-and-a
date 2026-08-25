-- ============================================================================
-- Folio RLS Cross-User Test Queries
-- ============================================================================
-- Purpose: Verify that RLS policies prevent unauthorized cross-user access.
-- Usage: Run these queries in a Supabase SQL editor or pgTAP test suite.
--
-- Setup: These tests assume two test users exist:
--   USER_A: the "attacker" — tries to access USER_B's data
--   USER_B: the "victim" — owns the data being protected
--
-- To run: Set the role to an authenticated user (USER_A) and attempt to
-- access USER_B's resources. All SELECTs should return 0 rows.
-- All INSERT/UPDATE/DELETE should fail or affect 0 rows.
-- ============================================================================

-- ============================================================================
-- TEST SETUP (replace with actual test user UUIDs)
-- ============================================================================

-- In a real test environment, create two test users:
-- DO $$
-- DECLARE
--   v_user_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
--   v_user_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- BEGIN
--   -- Insert test auth users (requires service_role or direct DB access)
--   INSERT INTO auth.users (id, email) VALUES
--     (v_user_a, 'user_a@test.com'),
--     (v_user_b, 'user_b@test.com')
--   ON CONFLICT DO NOTHING;
-- END $$;


-- ============================================================================
-- TEST 1: Core owner-only tables — cross-user SELECT returns 0 rows
-- ============================================================================
-- Run as USER_A, targeting USER_B's data

-- 1.1 Transactions
-- Expected: 0 rows (USER_A cannot see USER_B's transactions)
SELECT * FROM public.transactions
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.2 Budgets
-- Expected: 0 rows
SELECT * FROM public.budgets
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.3 Goals
-- Expected: 0 rows
SELECT * FROM public.goals
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.4 Profiles (another user's profile)
-- Expected: 0 rows
SELECT * FROM public.profiles
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.5 Savings accounts
-- Expected: 0 rows
SELECT * FROM public.savings_accounts
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.6 Debts
-- Expected: 0 rows
SELECT * FROM public.debts
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.7 Sinking funds
-- Expected: 0 rows
SELECT * FROM public.sinking_funds
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.8 Allocations
-- Expected: 0 rows
SELECT * FROM public.allocations
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.9 Pay schedules
-- Expected: 0 rows
SELECT * FROM public.pay_schedules
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.10 Funding sources
-- Expected: 0 rows
SELECT * FROM public.funding_sources
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.11 User sessions
-- Expected: 0 rows
SELECT * FROM public.user_sessions
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.12 Lesson progress
-- Expected: 0 rows
SELECT * FROM public.lesson_progress
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.13 Share links
-- Expected: 0 rows
SELECT * FROM public.share_links
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 1.14 User gamification
-- Expected: 0 rows
SELECT * FROM public.user_gamification
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';


-- ============================================================================
-- TEST 2: Core owner-only tables — cross-user INSERT blocked
-- ============================================================================

-- 2.1 Insert transaction as another user
-- Expected: FAIL (RLS WITH CHECK violation)
INSERT INTO public.transactions (user_id, date, type, amount, category)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2024-05-25', 'expense', 50.00, 'food');

-- 2.2 Insert budget as another user
-- Expected: FAIL
INSERT INTO public.budgets (user_id, category, monthly_limit, month)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'food', 500.00, '2024-05');

-- 2.3 Insert goal as another user
-- Expected: FAIL
INSERT INTO public.goals (user_id, name, target_amount)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Hacked Goal', 1000.00);

-- 2.4 Insert gamification data as another user
-- Expected: FAIL
INSERT INTO public.user_gamification (user_id, streak_data)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"streak": 999}');


-- ============================================================================
-- TEST 3: Core owner-only tables — cross-user UPDATE blocked
-- ============================================================================

-- 3.1 Update another user's transaction
-- Expected: 0 rows affected
UPDATE public.transactions
SET amount = 0
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 3.2 Update another user's budget
-- Expected: 0 rows affected
UPDATE public.budgets
SET monthly_limit = 0
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 3.3 Update another user's profile
-- Expected: 0 rows affected
UPDATE public.profiles
SET name = 'Hacked'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';


-- ============================================================================
-- TEST 4: Core owner-only tables — cross-user DELETE blocked
-- ============================================================================

-- 4.1 Delete another user's transactions
-- Expected: 0 rows affected
DELETE FROM public.transactions
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 4.2 Delete another user's goals
-- Expected: 0 rows affected
DELETE FROM public.goals
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';


-- ============================================================================
-- TEST 5: Reimbursements — counterparty access scope
-- ============================================================================

-- 5.1 Non-counterparty cannot read reimbursements
-- Expected: 0 rows (USER_A is neither owner nor counterparty)
SELECT * FROM public.reimbursements
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND counterparty_user_id != 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 5.2 Non-counterparty cannot update reimbursements
-- Expected: 0 rows affected
UPDATE public.reimbursements
SET settled = true
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND counterparty_user_id != 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 5.3 Counterparty cannot delete reimbursements (only owner can)
-- Expected: 0 rows affected (even if USER_A is counterparty, delete is owner-only)
DELETE FROM public.reimbursements
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND counterparty_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 5.4 Counterparty cannot insert reimbursements for another user
-- Expected: FAIL
INSERT INTO public.reimbursements (user_id, person_name, direction, amount)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Hacker', 'owed_to_me', 999.99);


-- ============================================================================
-- TEST 6: Friendships — cannot spoof friend requests
-- ============================================================================

-- 6.1 Cannot insert friendship as someone else (spoofed requester)
-- Expected: FAIL (WITH CHECK requires auth.uid() = requester_id)
INSERT INTO public.friendships (requester_id, addressee_id, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'accepted');

-- 6.2 Cannot see friendship between two other users
-- Expected: 0 rows
SELECT * FROM public.friendships
WHERE requester_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND addressee_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';


-- ============================================================================
-- TEST 7: Splits — non-participant access blocked
-- ============================================================================

-- 7.1 Cannot read splits owned by another user (where not participant)
-- Expected: 0 rows (unless USER_A is a participant in USER_B's split)
SELECT * FROM public.splits
WHERE owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 7.2 Cannot modify another user's split
-- Expected: 0 rows affected
UPDATE public.splits
SET total_amount = 0
WHERE owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 7.3 Cannot delete another user's split
-- Expected: 0 rows affected
DELETE FROM public.splits
WHERE owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 7.4 Cannot add participants to another user's split
-- Expected: FAIL (is_split_owner check fails)
INSERT INTO public.split_participants (split_id, participant_name, share_amount)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Hacker', 100.00);


-- ============================================================================
-- TEST 8: Pools — non-member access blocked
-- ============================================================================

-- 8.1 Cannot read pools owned by another user (where not member)
-- Expected: 0 rows
SELECT * FROM public.pools
WHERE owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 8.2 Cannot read pool members of a pool you're not part of
-- Expected: 0 rows
SELECT pm.* FROM public.pool_members pm
JOIN public.pools p ON p.id = pm.pool_id
WHERE p.owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 8.3 Cannot add entries to a pool you're not a member of
-- Expected: FAIL
INSERT INTO public.pool_entries (pool_id, added_by, label, amount)
VALUES (
  (SELECT id FROM public.pools WHERE owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' LIMIT 1),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Unauthorized entry',
  50.00
);

-- 8.4 Cannot delete another member's pool entry
-- Expected: 0 rows affected
DELETE FROM public.pool_entries
WHERE added_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';


-- ============================================================================
-- TEST 9: Notifications — cannot read other users' notifications
-- ============================================================================

-- 9.1 Cannot read another user's notifications
-- Expected: 0 rows
SELECT * FROM public.notifications
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 9.2 Cannot insert notification for another user directly
-- Expected: FAIL (must use create_notification function)
INSERT INTO public.notifications (user_id, type, payload)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friend_request', '{}');

-- 9.3 Cannot delete another user's notifications
-- Expected: 0 rows affected
DELETE FROM public.notifications
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';


-- ============================================================================
-- TEST 10: Goal participants — non-participant access blocked
-- ============================================================================

-- 10.1 Cannot read goal participants for a goal you don't own/participate in
-- Expected: 0 rows
SELECT * FROM public.goal_participants gp
JOIN public.goals g ON g.id = gp.goal_id
WHERE g.user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 10.2 Cannot add yourself as participant to another user's goal
-- Expected: FAIL (is_goal_owner check)
INSERT INTO public.goal_participants (goal_id, participant_user_id, name)
VALUES (
  (SELECT id FROM public.goals WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' LIMIT 1),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Hacker'
);


-- ============================================================================
-- TEST 11: Verify public_profiles view only shows discoverable users
-- ============================================================================

-- 11.1 Public profiles only shows opted-in users
-- Expected: Only rows where discoverable = true AND handle IS NOT NULL
SELECT * FROM public.public_profiles;
-- Verify: No rows with NULL handle or non-discoverable users appear

-- 11.2 Cannot access full profiles table for other users
-- Expected: 0 rows (only own profile visible)
SELECT email, has_completed_onboarding, onboarding_path
FROM public.profiles
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';


-- ============================================================================
-- VERIFICATION QUERY: Confirm all tables have RLS enabled
-- ============================================================================

-- This query should return 0 rows (no unprotected tables)
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
      AND c.relrowsecurity = true
  );
