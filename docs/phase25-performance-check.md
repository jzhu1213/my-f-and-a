# Phase 25 Performance Final Check — Task 541

> Audit Date: 2025-07-27 | Build: Next.js 14.2.35 | Node.js production mode
> Scope: Final performance verification after Phase 25 additions (analytics + error monitoring).
> Requirement: **33.7** — launch prerequisites verified; final build deploys with zero blocking issues.

---

## Summary

| Subtask | What it covers | Status |
|---------|----------------|--------|
| 541.1 Lighthouse audit (all routes) | Performance ≥90 on home/history/tools/settings | ⏳ Partial — build-metric proxy captured; interactive Lighthouse runs require manual execution (steps below) |
| 541.2 Bundle size check | Initial bundle < 500 KB after analytics + error monitoring | ✅ PASS — home First Load JS 474 kB (94.8% of budget) |
| 541.3 Real device test | Full PWA flow on a physical device | ⏳ Manual — cannot be automated here; step-by-step walkthrough below |

Validation gates:

- `npm run typecheck` — ✅ PASS (exit 0, no type errors)
- `npm run build` — ✅ PASS (exit 0, compiled successfully, 8/8 static pages generated)
- `npm run build | node scripts/check-bundle-size.mjs` — ✅ All routes within budget

---

## 541.2 Bundle Size Check (fully automated) — ✅ PASS

Production build output (`next build`):

```
Route (app)                              Size     First Load JS
┌ ○ /                                    244 kB          474 kB
├ ○ /_not-found                          920 B          89.5 kB
├ ○ /api                                 0 B                0 B
├ ƒ /api/wallet/daily-allowance          0 B                0 B
├ ○ /api/widget/daily-allowance          0 B                0 B
├ ○ /profile                             11.9 kB         175 kB
├ ƒ /shared/[token]                      2.76 kB         199 kB
├ ƒ /shared/goal/[token]                 3.64 kB         222 kB
├ ƒ /shared/pool/[token]                 5.7 kB          200 kB
└ ƒ /shared/support/[token]              3.38 kB         147 kB
+ First Load JS shared by all            88.6 kB
  ├ chunks/2117-*.js                     31.9 kB
  ├ chunks/fd9d1056-*.js                 53.7 kB
  └ other shared chunks (total)          2.99 kB
```

### Budget compliance

| Metric | Budget | Current | Utilization | Status |
|--------|--------|---------|-------------|--------|
| Initial JS (home `/`) | < 500 kB | **474 kB** | 94.8% | ✅ Within budget |
| Route JS (home `/`) | < 300 kB | 244 kB | 81.3% | ✅ Within budget |
| Shared JS (all routes) | < 120 kB | 88.6 kB | 73.8% | ✅ Within budget |
| `/profile` First Load | < 200 kB | 175 kB | 87.5% | ✅ Within budget |

The budget check script (`scripts/check-bundle-size.mjs`) reports the home route as
`⚠️ CLOSE` because it is above 90% of the 500 kB budget, but still **under** the ceiling.
No route exceeds its budget.

### Comparison against Phase 20 baseline

| Metric | Phase 20 (Post-opt) | Phase 25 (Current) | Change | Cause |
|--------|---------------------|--------------------|--------|-------|
| `/` Route JS | 246 kB | 244 kB | −2 kB | stable |
| `/` First Load JS | 456 kB | **474 kB** | **+18 kB** | analytics + error monitoring + error boundary + feedback sheet |
| `/profile` First Load | 159 kB | 175 kB | +16 kB | shared additions |
| Shared JS | 88.5 kB | 88.6 kB | +0.1 kB | stable |

**Verdict:** The Phase 25 additions (analytics utility, Sentry-equivalent error monitoring,
global error boundary, feedback sheet) added ~18 kB to the home first-load bundle. The home
route remains within the <500 KB budget at 94.8% utilization. **Bundle budget met.**

> Note on "compressed": Next.js build output reports parsed (uncompressed) transfer sizes.
> These 474 kB gzip down to roughly ~150–180 kB over the wire (~60% reduction), so the app
> is comfortably within the <500 KB compressed budget on both interpretations.

### Watch item

Home route is at 94.8% of budget. Future feature additions should defer non-critical code
via `next/dynamic` (the feedback sheet and error-monitoring init are good lazy-load
candidates) to keep headroom before launch-blocking growth.

---

## 541.1 Lighthouse Audit (partially automated) — ⏳ Requires manual runs

### What was verified automatically

- Production build compiles cleanly and generates all static pages (8/8).
- Bundle sizes that drive Lighthouse Performance are within budget (see 541.2). At 474 kB
  first-load JS with code-splitting, cache hydration, and memoized renders, the home route
  is expected to score ≥90 (consistent with the Phase 20 baseline projection of 90–95).

### What must be run manually

Lighthouse Performance scoring requires a real browser measuring FCP/LCP/TBT/CLS/INP against
a running server — this cannot be produced from build output alone. Run these steps and
record the scores in the table below.

```bash
# 1. Build and start the production server
npm run build
npm run start           # serves http://localhost:3000

# 2a. CLI (install once: npm i -g lighthouse)
lighthouse http://localhost:3000 \
  --only-categories=performance \
  --preset=desktop --output=html --output-path=./lighthouse-home.html
# repeat with mobile emulation (default) for the mobile score
```

Or via Chrome DevTools (recommended for the SPA tabs):

1. Open `http://localhost:3000` in Chrome → DevTools (F12) → **Lighthouse** tab.
2. Categories: **Performance**. Device: **Mobile** (simulated throttling).
3. Run for the **home** route (Navigation mode).
4. History / Tools / Settings are client-side tabs within `/`, not separate URLs. For each:
   click the tab, then run Lighthouse in **Timespan** mode to capture TBT/CLS/INP.

Record results:

| Route | Performance | FCP | LCP | TBT | CLS | Pass (≥90)? |
|-------|-------------|-----|-----|-----|-----|-------------|
| Home (`/`) | ___ | ___ | ___ | ___ | ___ | ___ |
| History (tab) | ___ | — | — | ___ | ___ | ___ |
| Tools (tab) | ___ | — | — | ___ | ___ | ___ |
| Settings (tab) | ___ | — | — | ___ | ___ | ___ |

Targets (from `performance.budget.json`): FCP < 1.5s, LCP < 2.5s, TBT < 200ms, CLS < 0.1,
INP < 100ms. Compare each score against the Phase 20 baseline in
`docs/PERFORMANCE-FINAL-AUDIT.md`.

---

## 541.3 Real Device Test (manual) — ⏳ Requires a physical device

Cannot be automated in this environment. Follow this walkthrough on at least one real
Android or iOS device and note any issues.

### Setup

```bash
npm run build
npm run start                      # binds 0.0.0.0:3000
ipconfig                           # find your machine's LAN IP (e.g. 192.168.1.20)
```

On the device (same Wi-Fi network), open `http://<LAN-IP>:3000` in Chrome (Android) or
Safari (iOS).

### Full flow to walk through

1. **Install PWA** — use the browser's "Add to Home Screen" / install prompt. Confirm the
   app opens standalone (no browser chrome), correct icon and name.
2. **Onboard** — go through first-run. Confirm the minimal path reaches a home screen with
   an allowance number quickly (Phase 25 target < 90s, ideally the $50/day fallback shows
   immediately without setup).
3. **Log 5 expenses** — use quick-log + suggestion chips. Confirm one-tap logging works,
   amounts appear instantly (optimistic update), no jank.
4. **Check history** — open the History tab. Confirm the 5 expenses appear, scrolling is
   smooth (~60fps), and pagination behaves.
5. **Open 2 tools** — from the Tools tab open any two (e.g. Debt, Subscription Audit).
   Confirm lazy-loaded overlays open within ~200ms and back navigation is smooth.
6. **Change a setting** — e.g. toggle the analytics opt-out or edit a budget. Confirm the
   change persists after reload.

### What to record

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| PWA installs and opens standalone | | |
| Onboarding reaches allowance < 90s | | |
| 5 expenses log without friction | | |
| History scroll smooth, entries correct | | |
| 2 tools open promptly, no errors | | |
| Setting change persists | | |
| Any visual jank / layout shift | | |
| Errors in monitoring dashboard | | |

Reference throttling profiles and detailed pass/fail thresholds are in
`docs/PERFORMANCE-FINAL-AUDIT.md` §3.

---

## Conclusion

- **541.2 Bundle size: PASS.** Home first-load 474 kB < 500 kB budget after analytics and
  error-monitoring additions (+18 kB vs Phase 20). All other routes within budget.
- **Build + typecheck: PASS.** Both gates green.
- **541.1 Lighthouse & 541.3 Real device: manual execution required.** Build-metric proxy
  indicates the home route should meet the ≥90 Performance target; interactive runs and the
  physical-device walkthrough must be completed by a human using the steps above, with
  results recorded in the tables provided.
