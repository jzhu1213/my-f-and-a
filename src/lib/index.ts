/**
 * Folio Lib — Top-Level Module Map
 *
 * This file serves as a registry of all domain clusters. Because several modules
 * export symbols with the same name (e.g. `ValidationResult`, `createSinkingFund`),
 * we expose domains as namespace imports rather than flat re-exports.
 *
 * Usage:
 *   import * as allowance from '@/lib/allowance'
 *   import * as savings from '@/lib/savings'
 *   import { computeDailyAllowance } from '@/lib/allowance'
 *
 * Or import directly from a specific file (unchanged from before):
 *   import { computeDailyAllowance } from '@/lib/dailyAllowanceUtils'
 *
 * Domain clusters:
 *
 *   allowance/      — Daily allowance, term/weekend modes, spend-down, affordability
 *   income/         — Allocation logic, pay schedules, disbursements, auto-contribute
 *   obligations/    — Debts, fixed expenses, sinking funds, subscriptions
 *   sources/        — Funding sources, linked accounts, balances, account utilities
 *   savings/        — Savings accounts, goals, compound growth, round-ups, set-aside
 *   insights/       — Tips, celebrations, habits, trajectory, spending insights
 *   dates/          — Date helpers, term schedule
 *   transactions/   — Transaction utils, validation, refunds, tags, receipts, splits
 *   categories/     — Auto-categorize, rules, custom categories, budget utils
 *   notifications/  — Notification scheduling, preferences, smart notifications
 *   education/      — Lessons, micro-lessons, vocabulary
 *   challenges/     — No-spend challenges, min-balance buffer
 *   infra/          — Supabase, offline queue, cache, storage, feature flags, haptics
 *
 * Remaining top-level files (not yet clustered — single-purpose or cross-cutting):
 *   suggestionUtils.ts       — Smart amount suggestions (cross-cutting)
 *   defaultsEngine.ts        — Time-of-day defaults prediction (cross-cutting)
 *   reimbursements.ts        — IOU ledger (standalone)
 */

export * as allowance from './allowance'
export * as income from './income'
export * as obligations from './obligations'
export * as sources from './sources'
export * as savings from './savings'
export * as insights from './insights'
export * as dates from './dates'
export * as transactions from './transactions'
export * as categories from './categories'
export * as notifications from './notifications'
export * as education from './education'
export * as challenges from './challenges'
export * as infra from './infra'
export * as i18n from './i18n'
