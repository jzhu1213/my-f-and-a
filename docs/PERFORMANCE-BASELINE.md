# Performance Baseline

> Phase 20 comprehensive performance baseline.
> Recorded: 2025-07-27 | Build: Next.js 14.2.35 | Node.js production mode

---

## 1. Build Output Metrics (Route Sizes)

| Route | Route JS | First Load JS | Notes |
|-------|----------|---------------|-------|
| `/` (home) | 272 kB | **481 kB** | Main app shell + all home screen code |
| `/_not-found` | 880 B | 89.2 kB | Error page |
| `/profile` | 11.8 kB | 157 kB | Profile page |
| `/shared/[token]` | 2.71 kB | 199 kB | Shared budget view |
| `/shared/goal/[token]` | 3.59 kB | 204 kB | Shared goal view |
| `/shared/pool/[token]` | 5.61 kB | 199 kB | Shared pool view |
| `/shared/support/[token]` | 3.33 kB | 147 kB | Shared support view |

**Shared JS (all routes):** 88.3 kB
- `chunks/2117-*.js` — 31.9 kB (React runtime + framework)
- `chunks/fd9d1056-*.js` — 53.6 kB (Next.js core)
- Other shared chunks — 2.8 kB

---

## 2. Bundle Analysis — Top Largest Chunks

The home route (`/`) dominates at 272 kB route-specific code. Based on dependency analysis:

| # | Dependency | Est. Size | Feature/Route | Ships on Initial Load? | Lazy-loadable? |
|---|-----------|-----------|---------------|----------------------|----------------|
| 1 | **framer-motion** | ~80-120 kB | All animations (home, sheets, overlays) | ✅ Yes | Partially — core needed, advanced features deferrable |
| 2 | **jspdf** | ~60-80 kB | PDF export (tools → reports) | ⚠️ Likely bundled | ✅ Yes — only needed on export action |
| 3 | **@supabase/supabase-js** | ~40-50 kB | Data layer (all routes) | ✅ Yes | ❌ No — core dependency |
| 4 | **date-fns** | ~20-30 kB | Date formatting/calculations | ✅ Yes | Partially — tree-shake unused locales |
| 5 | **react-hook-form** | ~15-20 kB | All forms (sheets, settings) | ✅ Yes | ✅ Yes — lazy-load with sheets |
| 6 | **zod** | ~12-15 kB | Form validation | ✅ Yes | ✅ Yes — co-locate with forms |
| 7 | **@hookform/resolvers** | ~5-8 kB | Form validation bridge | ✅ Yes | ✅ Yes — co-locate with forms |
| 8 | **canvas-confetti** | ~5-8 kB | Celebrations | ✅ Yes | ✅ Yes — only needed on celebration trigger |
| 9 | **lucide-react** | ~5-10 kB | Icons (tree-shaken) | ✅ Yes | ❌ No — used everywhere |
| 10 | **zustand** | ~3-5 kB | State management | ✅ Yes | ❌ No — core state layer |

### Key Findings

**Dependencies shipping on initial load that aren't needed immediately:**

1. **jspdf** (60-80 kB) — Only used when user exports a PDF report. Should be dynamically imported on export action.
2. **canvas-confetti** (5-8 kB) — Only triggers on celebration events. Can be lazy-loaded on first celebration.
3. **react-hook-form + zod + @hookform/resolvers** (~32-43 kB combined) — Only needed when a sheet/form opens. Can be code-split with sheet components.
4. **framer-motion** — The full bundle includes layout animations, gesture handlers, and SVG animation features that may not all be needed on first paint. Consider importing only `motion` and `AnimatePresence` initially.

**Optimization opportunities (estimated savings: 100-130 kB):**
- Lazy-load jspdf → ~70 kB saved on initial load
- Lazy-load canvas-confetti → ~6 kB saved
- Code-split form libraries with sheets → ~35 kB saved
- Tree-shake date-fns more aggressively → ~5-10 kB saved

---

## 3. Lighthouse Audit Procedure

Since Folio is a local development app, Lighthouse audits must be run manually against
the dev server or a production build preview. Use the following procedure:

### Prerequisites
```bash
npm install -g lighthouse    # or use Chrome DevTools
npm run build
npm run start                # Start production server on localhost:3000
```

### Running Lighthouse CLI
```bash
# Home screen
lighthouse http://localhost:3000 --only-categories=performance,accessibility,best-practices --output=json --output-path=./lighthouse-home.json

# Profile
lighthouse http://localhost:3000/profile --only-categories=performance,accessibility,best-practices --output=json --output-path=./lighthouse-profile.json
```

### Running via Chrome DevTools
1. Open Chrome → Navigate to `http://localhost:3000`
2. DevTools (F12) → Lighthouse tab
3. Select: Performance, Accessibility, Best Practices
4. Device: Mobile (simulated throttling)
5. Run audit on each primary screen:
   - Home (`/`) — the app shell with daily allowance
   - History (tab within `/`) — transaction list
   - Tools (tab within `/`) — tool grid
   - Settings (tab within `/`) — settings list
   - Tool sub-screens: Debt, Subscriptions, Cash Flow (overlay within `/`)

### Metrics to Record
| Metric | Abbreviation | Target |
|--------|-------------|--------|
| First Contentful Paint | FCP | < 1.5s |
| Largest Contentful Paint | LCP | < 2.5s |
| Total Blocking Time | TBT | < 200ms |
| Cumulative Layout Shift | CLS | < 0.1 |
| Time to Interactive | TTI | < 2.0s (3G) |

### Simulated 3G Settings
- Download: 1.6 Mbps
- Upload: 768 Kbps
- Latency: 150ms RTT
- CPU slowdown: 4x

### Note on SPA Routing
Folio uses client-side tab navigation within the root `/` route. History, Tools, and
Settings are tabs — not separate URL routes. To audit these:
1. Navigate to `/` in the browser
2. Click the target tab
3. Run a "Timespan" Lighthouse audit (DevTools → Lighthouse → Mode: Timespan)
4. Record the interaction metrics (TBT, CLS, INP)

---

## 4. Performance Budget

Defined in `performance.budget.json` at project root.

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| Initial JS (home `/`) | < 500 kB | 481 kB | ✅ Within budget (96%) |
| Time to Interactive (3G) | < 2.0s | TBD (manual) | ⏳ Requires Lighthouse |
| First Contentful Paint | < 1.5s | TBD (manual) | ⏳ Requires Lighthouse |
| Cumulative Layout Shift | < 0.1 | TBD (manual) | ⏳ Requires Lighthouse |
| Interaction to Next Paint | < 100ms | TBD (manual) | ⏳ Requires Lighthouse |
| Scroll/Animation | 60fps | TBD (manual) | ⏳ Requires DevTools |

### Budget Enforcement

A build-time check script exists at `scripts/check-bundle-size.mjs`. Run it:

```bash
# After build, pipe output to the checker:
npm run build 2>&1 | node scripts/check-bundle-size.mjs

# Or add to CI:
# - name: Check bundle budget
#   run: npm run build 2>&1 | node scripts/check-bundle-size.mjs
```

The script:
- Parses Next.js build output for route sizes
- Compares against budgets in `performance.budget.json`
- Exits with code 1 if any route exceeds its budget
- Warns (exit 0) if any route is within 10% of its budget

---

## 5. Previous Baseline (Phase 9)

For reference, the Phase 9 baseline recorded:
- First Load JS (`/`): 383 kB (2025-07-18)
- Route-specific: 184 kB
- Shared: 88.2 kB

Current state shows growth of ~98 kB on the home route since Phase 9, likely due to
features added in Phases 10-19 (settings, tools, shared views, celebrations, forms).

---

## 6. Recommendations for Phase 20 Optimization

1. **Immediate wins (high impact, low effort):**
   - Dynamic import `jspdf` — saves ~70 kB from initial bundle
   - Dynamic import `canvas-confetti` — saves ~6 kB
   - Code-split form sheets (react-hook-form + zod load on sheet open)

2. **Medium effort:**
   - Audit framer-motion imports — use `m` instead of `motion` where possible
   - Ensure tool sub-screens use `next/dynamic` or React.lazy
   - Verify date-fns tree-shaking (no full library import)

3. **Measurement gaps to fill:**
   - Run Lighthouse manually and record FCP, LCP, TBT, CLS, TTI
   - Test on a real mid-range device (not just dev laptop)
   - Profile scroll performance in History tab with 500+ transactions
