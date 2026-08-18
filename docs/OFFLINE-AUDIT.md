# Offline Functionality Audit

> **Date**: Phase 20, Task 474.1
> **Requirement**: 28.6 — Full offline reliability for the core loop

## Summary

Folio uses a localStorage-backed offline queue (`offlineQueue.ts`) paired with a stale-while-revalidate home cache (`homeCache.ts`). The service worker (`public/sw.js`) caches static assets for shell loading. This audit categorizes every user-facing feature by its offline behavior.

---

## ✅ Works Fully Offline

| Feature | Mechanism |
|---------|-----------|
| **View daily allowance** | Cached in `homeCache` — renders instantly from localStorage |
| **View recent transactions** | Up to 50 cached in `homeCache.recentTransactions` |
| **Log an expense** | Queued in `offlineQueue` with optimistic UI update |
| **Log income** | Queued in `offlineQueue` with optimistic UI update |
| **Edit a transaction** | Queued as `update` operation in `offlineQueue` |
| **Delete a transaction** | Queued as `delete` operation in `offlineQueue` |
| **View budgets** | Cached in `homeCache.budgets` |
| **View goals** | Cached in `homeCache.goals` |
| **Navigate between tabs** | Client-side routing, no network required once shell loaded |
| **Quick-log via suggestion chips** | Smart suggestions computed client-side from cached data |
| **Theme/appearance settings** | Stored in localStorage |
| **Celebration animations** | Triggered client-side based on cached state |
| **Contextual tips** | Selected client-side from tip library |

---

## ⚠️ Degrades Gracefully (Read-Only / Cached State)

| Feature | Offline Behavior |
|---------|-----------------|
| **History screen (full list)** | Shows cached transactions only; no pagination/scroll-load for older data |
| **Budget management (create/edit)** | Reads cached budgets; writes require connectivity (not queued) |
| **Goal management (create/edit)** | Reads cached goals; writes require connectivity (not queued) |
| **Recurring bills screen** | Shows last-known state; changes require connectivity |
| **Sinking funds** | Shows last-known state; changes require connectivity |
| **Subscription audit** | Shows last-known data; refresh requires connectivity |
| **Debt tracking** | Shows cached state; updates require connectivity |
| **Search/filter transactions** | Works over cached transactions only (limited to 50 most recent) |
| **Allowance recalculation** | Uses cached data; may be slightly stale until sync completes |
| **Sync indicator** | Shows "X changes saved — will sync when online" messaging |

---

## ❌ Breaks Offline (Requires Connectivity)

| Feature | Reason |
|---------|--------|
| **Authentication (login/signup)** | Supabase auth requires network roundtrip |
| **Initial app load (no cache)** | First visit requires network to fetch user data |
| **Wallet pass generation** | API call to generate pass file |
| **Widget data refresh** | API endpoint requires auth + fresh data |
| **Export/download data** | Server-side data aggregation |
| **Profile photo upload** | Requires file upload to storage |

---

## Conflict Resolution Strategy (Implemented in 474.2)

- **Creates**: Client-generated `id` used as idempotency key — prevents duplicates if the same create is synced twice
- **Edits**: Last-write-wins using `queuedAt` timestamp vs server `updated_at`
- **Deletes**: If already deleted on server, treated as resolved (no error)

---

## Queue Retry Strategy (Implemented in 474.3)

- Exponential backoff: 1s → 2s → 4s → 8s → ... → max 60s
- Never drops queued mutations — retries indefinitely
- Shows persistent "syncing..." indicator during active retry cycles
- Each queue item tracks `nextRetryAt` for scheduling

---

## Fixes Applied in This Phase

1. **Conflict resolution hardened** (474.2): Added idempotency key deduplication for creates; implemented timestamp-based last-write-wins for edits comparing `queuedAt` vs server `updated_at`.
2. **Exponential backoff** (474.3): Queue no longer gives up after 3 attempts. Retries with exponential backoff (max 60s) indefinitely. Persistent "syncing..." state shown to user.
3. **SyncIndicator enhanced** (474.3): Shows "syncing..." during active backoff retry cycles so users know their data is safe.
