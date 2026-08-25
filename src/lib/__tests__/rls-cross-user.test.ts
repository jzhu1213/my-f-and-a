/**
 * RLS Cross-User Access Verification (Static Analysis)
 *
 * Since RLS tests require a live Supabase instance, this test suite performs
 * static analysis on schema.sql and the RLS test file to confirm:
 * 1. Every public table has RLS enabled
 * 2. Every table with a user_id column has an owner-only policy
 * 3. The SQL test file covers all tables
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const schemaSQL = readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf-8');
const rlsTestSQL = readFileSync(
  join(ROOT, 'supabase', 'tests', 'rls-cross-user-test.sql'),
  'utf-8'
);

/** Extract all "create table if not exists public.<name>" from schema */
function extractPublicTables(sql: string): string[] {
  const regex = /create table if not exists public\.(\w+)/gi;
  const tables: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  return [...new Set(tables)];
}

/** Extract all "alter table public.<name> enable row level security" */
function extractRLSEnabled(sql: string): string[] {
  const regex = /alter table public\.(\w+)\s+enable row level security/gi;
  const tables: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  return [...new Set(tables)];
}

/** Extract tables that have a user_id column (from create table blocks) */
function extractTablesWithUserId(sql: string): string[] {
  const tableBlocks =
    sql.match(/create table if not exists public\.(\w+)\s*\([^;]+?\);/gis) ||
    [];
  const tables: string[] = [];
  for (const block of tableBlocks) {
    const nameMatch = block.match(
      /create table if not exists public\.(\w+)/i
    );
    if (nameMatch && /\buser_id\b/i.test(block)) {
      tables.push(nameMatch[1]);
    }
  }
  return [...new Set(tables)];
}

/** Extract all owner policies (e.g., "create policy xxx_owner_all on public.<table>") */
function extractOwnerPolicies(sql: string): string[] {
  const regex =
    /create policy \w+_owner_(?:all|rw|select|update|delete)\s+on\s+public\.(\w+)/gi;
  const tables: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  return [...new Set(tables)];
}

/** Extract table names mentioned in the RLS test file */
function extractTestedTables(sql: string): string[] {
  const regex = /(?:FROM|INTO|UPDATE|DELETE FROM)\s+public\.(\w+)/gi;
  const tables: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  return [...new Set(tables)];
}

describe('RLS Coverage Verification', () => {
  const allTables = extractPublicTables(schemaSQL);
  const rlsEnabledTables = extractRLSEnabled(schemaSQL);
  const tablesWithUserId = extractTablesWithUserId(schemaSQL);
  const tablesWithOwnerPolicy = extractOwnerPolicies(schemaSQL);
  const testedTables = extractTestedTables(rlsTestSQL);

  it('schema.sql defines public tables', () => {
    expect(allTables.length).toBeGreaterThan(0);
  });

  it('every public table has RLS enabled', () => {
    const unprotected = allTables.filter(
      (t) => !rlsEnabledTables.includes(t)
    );
    expect(unprotected).toEqual([]);
  });

  it('every table with user_id has an owner-only policy', () => {
    const missing = tablesWithUserId.filter(
      (t) => !tablesWithOwnerPolicy.includes(t)
    );
    expect(missing).toEqual([]);
  });

  it('RLS test file covers all core owner-only tables', () => {
    // Core tables that must be tested for cross-user access
    const coreTables = [
      'transactions',
      'budgets',
      'goals',
      'profiles',
      'savings_accounts',
      'debts',
      'sinking_funds',
      'allocations',
      'pay_schedules',
      'funding_sources',
      'user_sessions',
      'lesson_progress',
      'share_links',
    ];
    const untested = coreTables.filter((t) => !testedTables.includes(t));
    expect(untested).toEqual([]);
  });

  it('RLS test file covers social/shared tables', () => {
    const socialTables = [
      'reimbursements',
      'friendships',
      'splits',
      'split_participants',
      'pools',
      'pool_members',
      'pool_entries',
      'notifications',
      'goal_participants',
    ];
    const untested = socialTables.filter((t) => !testedTables.includes(t));
    expect(untested).toEqual([]);
  });

  it('RLS test file includes verification query for unprotected tables', () => {
    expect(rlsTestSQL).toContain('relrowsecurity');
  });

  it('no table uses permissive policies without auth check', () => {
    // Verify all policies reference auth.uid()
    const policyBlocks =
      schemaSQL.match(/create policy[\s\S]*?;/gi) || [];
    const unsafePolicies = policyBlocks.filter(
      (p) =>
        !p.includes('auth.uid()') &&
        !p.includes('is_split_owner') &&
        !p.includes('is_split_participant') &&
        !p.includes('is_goal_owner') &&
        !p.includes('is_pool_owner') &&
        !p.includes('is_pool_member')
    );
    expect(unsafePolicies).toEqual([]);
  });
});
