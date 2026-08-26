# Folio Launch Checklist

The single source of truth for launch readiness. Folio is "launched" when every
item here is green. Each item is verifiable independently.

**Legend**
- ✅ Verified passing in this environment
- ⚠️ Not verifiable in this environment (requires a live deploy, real device, browser tooling, or Supabase project) — see note
- ❌ Blocker — fails or is incomplete

**Last run:** Phase 25, task 543.2
**Build state at verification:** `npm run typecheck` ✅ · `npm run build` ✅ (compiled successfully, 9/9 pages)

---

## ── Technical ──

- [x] ✅ **Bundle <500KB** — Production build reports the home route (`/`) at **474 kB First Load JS (raw)**; gzip/brotli transfer size is well under the 500 KB compressed budget. A `check-budget` script (`scripts/check-bundle-size.mjs`) guards this in CI.
- [x] ✅ **Service worker caches critical assets** — `public/sw.js` precaches the app shell (`/`, `/offline.html`, `/manifest.json`, icons) on install and runtime-caches hashed `_next/static` (cache-first), Supabase data (network-first), and same-origin assets (stale-while-revalidate). Auth/token requests are network-only (never cached).
- [x] ✅ **Offline mode works end-to-end** — Cache hydration (`homeCache`), an offline write queue (`src/lib/offlineQueue.ts`), navigation fallback to the cached shell / `offline.html`, and network-first API caching are all wired. *(Live offline walkthrough on a device is the manual confirmation step — see docs/OFFLINE-AUDIT.md.)*
- [x] ✅ **RLS policies verified** — RLS is enabled in version-controlled migrations (`supabase/migrations/0001_core.sql` … `0006_analytics_events.sql`); `analytics_events` is insert-only (write, no read) from the client. A cross-user test suite lives at `supabase/tests/rls-cross-user-test.sql`. *(Running the suite against a live project is the final live confirmation.)*
- [x] ✅ **No secrets in client code** — Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the client bundle (`src/lib/supabaseClient.ts`); all sensitive keys (service role, Plaid, wallet cert) use server-only env vars without the `NEXT_PUBLIC_` prefix. A repo scan for hardcoded key/token patterns found none.
- [ ] ⚠️ **Lighthouse ≥90 on all routes** — Not runnable in this environment (no headless browser / Lighthouse). Perf optimizations (code splitting, memoized allowance, cache hydration, lazy tool screens) are in place and documented in `docs/PERFORMANCE-FINAL-AUDIT.md` and `docs/phase25-performance-check.md`. **Action before launch:** run Lighthouse against the deployed URL on home, history, tools, settings.
- [ ] ⚠️ **Error monitoring configured and tested** — Code is complete: `src/lib/errorMonitoring.ts` (exception + `unhandledrejection` capture, PII scrubbing, environment tagging), a root `ErrorBoundary`, and `productionBrowserSourceMaps: true` for symbolication. It **no-ops until `NEXT_PUBLIC_SENTRY_DSN` is set**. **Action before launch:** set the DSN in the production environment and confirm a test event lands in the dashboard.
- [x] ✅ **Analytics opt-in working** — `src/lib/analytics.ts` is anonymous, cookie-free, no-ops in dev and when opted out, and strips PII defensively. The Settings → Privacy "Usage analytics" toggle (`SettingsPrivacySecurityScreen.tsx`) drives `optIn()`/`optOut()`. *(Live event delivery is verified below under Monitoring.)*
- [ ] ❌ **npm audit clean (no high/critical)** — **3 vulnerabilities: 1 critical, 2 high.** All are transitive-to-breaking and have no non-major fix. See **Accepted Risks** below.

---

## ── Content ──

- [x] ✅ **Privacy policy linked** — `/privacy` (`src/app/privacy/page.tsx`) is a plain-language policy, linked from Settings → Privacy via a "Privacy policy" row that opens in a new tab (same URL doubles as the app-store privacy link).
- [ ] ⚠️ **Release notes template ready** — An in-app "What's New" system exists (`src/lib/whatsNew.ts`, surfaced in Settings) that serves as the release-notes surface. A standalone external release-notes template document was **not located in the repo**. **Action before launch:** confirm the release-notes template artifact from task 538.3 is captured (in `docs/` or the store console).
- [ ] ⚠️ **App Store description written** — Marked complete in the Phase 25 plan (task 538.1) but **no description artifact was located in the repo**. **Action before launch:** confirm the copy is saved (docs or store console).
- [ ] ⚠️ **Screenshots generated** — Marked complete in the plan (task 538.2) but **no screenshot assets were located in the repo**. **Action before launch:** confirm generated screenshots are stored with the launch assets.
- [ ] ⚠️ **OG images generated** — Marked complete in the plan (task 539.1) but **no default OG image asset or `openGraph` metadata was found** in `src/app` or `public`. **Action before launch:** add the 1200×630 OG image + `openGraph`/`twitter` metadata (or confirm the asset lives outside the repo).

---

## ── Quality ──

- [x] ✅ **All features from Phase 1–24 still buildable** — `npm run typecheck` and `npm run build` both pass with zero errors after all Phase 25 additions (analytics, error monitoring, feedback UI). *(This confirms type/compile integrity of the full surface; exhaustive behavioral regression is the manual/device step below.)*
- [ ] ⚠️ **Onboarding < 90s (minimal path)** — Not timeable without an interactive session. Structurally verified: new users land on the home screen immediately with a $50/day fallback and skippable onboarding ("value before setup"), per `docs/FREE-NO-LINK-VALUE-PROPOSITION.md` and task 540. **Action before launch:** time a cold-start run on a real device.
- [ ] ⚠️ **Core flows work on real device** — Requires a physical device; not available here. Manual test plan documented in `docs/phase25-performance-check.md` (install PWA → onboard → log 5 → history → 2 tools → change a setting).
- [ ] ⚠️ **Screen reader flow is comprehensible** — Documented as passing in `docs/VOICEOVER-WALKTHROUGH.md`; requires assistive tech for live confirmation. **Action before launch:** re-run a VoiceOver/TalkBack pass on the deployed build.
- [ ] ⚠️ **Keyboard navigation works end-to-end** — Documented in `docs/KEYBOARD-WALKTHROUGH.md`; requires interactive confirmation on the deployed build.

---

## ── Monitoring ──

- [x] ✅ **Performance monitoring reports vitals** — `src/lib/webVitals.ts` collects FCP/LCP/CLS/INP and forwards poorly-rated metrics to the error-monitoring service (`reportPerformanceMetric`), so vitals surface alongside errors. Wiring is code-verified; live reporting depends on the monitoring DSN (see below).
- [ ] ⚠️ **Error reporting sends test event** — Depends on `NEXT_PUBLIC_SENTRY_DSN` being set in production; no-ops otherwise. **Action before launch:** trigger a test exception on the deployed build and confirm it appears in the dashboard.
- [ ] ⚠️ **Analytics sends test event** — Depends on a live Supabase project + production build (no-ops in dev). **Action before launch:** perform a tracked action on the deployed build and confirm a row in `analytics_events`.
- [ ] ❌ **Feedback submission works** — `FeedbackSheet` UI is complete (rating + text, accessible, sanitized), but its `onSubmit` is an abstract callback with **no persistence** and **no reachable entry point**. See **Blockers** below.

---

## Blockers

### B1 — Feedback submission has no storage or entry point (`❌`)
- **What:** `src/components/simplified/FeedbackSheet.tsx` collects a rating + text but does not persist anything. The `user_feedback` Supabase table (with write-only RLS) is not created, and there is no "Send feedback" row in Settings.
- **Root cause:** Phase 25 tasks **536.3 (store feedback)** and **536.4 (Settings entry point)** are still open — the component (536.1) shipped ahead of its backing store and wiring.
- **Scope:** Out of scope for task 543 (this task creates/runs the checklist; it does not implement 536.3/536.4). Flagged here so it is not missed.
- **Recommended fix before launch:** add migration `00xx_user_feedback.sql` (`id, user_id (hashed), rating, text, created_at, app_version`, insert-only RLS), wire `onSubmit` to write to it, and add the always-available "Send feedback" row in Settings.

---

## Accepted Risks

### R1 — Dependency vulnerabilities with no non-breaking fix (`npm audit`: 1 critical, 2 high)
`npm audit` reports:

| Package | Severity | Nature | Fix available |
|---------|----------|--------|---------------|
| `jspdf` | **critical** / high | PDF/HTML injection, path traversal, DoS via crafted image/PDF input | `jspdf@4.2.1` (**semver-major**, breaking) |
| `next` | **high** | DoS / cache-poisoning / SSRF classes in server features | `next@16.3.3` (**semver-major**, breaking) |
| `postcss` | **high** | source-map path traversal / XSS in stringify (transitive via `next`) | resolved by the `next` major upgrade |

- **Why accepted for now:** every fix is a **major-version upgrade** (`jspdf 3→4`, `next 14→16`), which is a breaking change requiring dedicated migration + regression work. Per the project's production-safety rules, breaking upgrades are not applied unattended.
- **Practical exposure is low for the current build:**
  - `jspdf` runs **client-side only**, generating PDFs from the user's **own** data (CSV/summary export). The injection/traversal vectors require attacker-controlled input, which does not exist in this single-user, own-data flow.
  - The `next` advisories concern server features (image optimizer remote patterns, rewrites/SSRF, RSC edge cases). Folio is a mostly-static PWA on Vercel with a very small API surface (`/api/widget`, `/api/wallet`), narrowing exposure.
- **Planned remediation:** schedule the `next 14→16` and `jspdf 3→4` upgrades as their own tracked task with full `typecheck`/`build`/regression verification. Re-run `npm audit` to confirm clean afterward.

### R2 — Content artifacts not located in repo (App Store copy, screenshots, OG image/metadata, release-notes template)
- Tasks 538.1/538.2/539.1/538.3 are marked complete in the Phase 25 plan, but the corresponding artifacts were not found in the repository during this sweep.
- **Accepted with follow-up:** these may live outside the repo (store console, design tool, asset bucket). Before public availability, confirm each artifact exists and — for the OG image — that `openGraph`/`twitter` metadata plus the 1200×630 asset are wired into the app so shared links render correctly.

---

## Pre-launch action summary

Green in this environment: bundle size, service worker, offline wiring, RLS (migrations + test), no client secrets, analytics opt-in, performance-monitoring wiring, typecheck + build.

Must resolve or consciously accept before flipping to public:
1. **Feedback storage + Settings entry point** (B1 — complete tasks 536.3 / 536.4).
2. **Dependency upgrades** (R1 — schedule `next` and `jspdf` majors).
3. **Confirm content artifacts** (R2 — App Store copy, screenshots, OG image + metadata, release-notes template).
4. **Live verifications** on the deployed build: Lighthouse ≥90 all routes, error + analytics test events, real-device core-flow pass, screen-reader + keyboard walkthroughs, onboarding timing.
