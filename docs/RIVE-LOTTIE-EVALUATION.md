# Rive / Lottie Feasibility Evaluation (Task 270)

**Decision: NO-GO** — The current Framer Motion + canvas-confetti approach already delivers premium celebration and hero moments at a fraction of the cost. Neither Rive nor Lottie clears the bar for Folio today.

---

## Context

Task 270 asked us to evaluate `@rive-app/react-canvas` (or Lottie) for three use cases:

1. **Animated success/celebration moment** — e.g., a richer confetti burst or character animation
2. **Optional expressive hero state** — e.g., a living illustration around the allowance ring
3. **Branded loading/mascot beat** — e.g., a small animated mark during skeleton states

---

## Bundle Impact Assessment

| Runtime | Compressed (brotli) | Uncompressed | Notes |
|---------|--------------------:|-------------:|-------|
| `@rive-app/react-canvas` (canvas) | ~567 KB | ~1.7 MB | Includes WASM blob. Lite variant: ~222 KB compressed |
| `lottie-react` (lottie-web) | ~60 KB | ~150 KB | No WASM; pure JS player |
| `micro-lottie-react` | ~6 KB | ~15 KB | Minimal, limited feature support |
| **Current: framer-motion** | 0 KB marginal | Already in bundle | Already paying this cost |
| **Current: canvas-confetti** | ~5 KB | ~14 KB | Already in bundle |

Folio's home screen budget is tight (PWA, mobile-first). Adding 222–567 KB of WASM for Rive, or 60 KB for lottie-web, for a single celebration moment is disproportionate. Even with code-splitting, the WASM fetch blocks the animation until loaded — meaning the first celebration a user sees would have a cold-start delay.

---

## What We Already Have (and Why It's Good Enough)

The current `CelebrationOverlay` (Task 257.1) already delivers:

- **Multi-burst layered confetti** via canvas-confetti (foreground + blurred background layers)
- **Animated SVG star-burst** for milestones (pure Framer Motion, zero additional weight)
- **Timer ring** with depleting progress arc
- **Staggered card entrance** (icon → title → message → button)
- **Spring physics** with milestone-specific dramatic springs
- **CSS trail particles** for depth
- **Full reduced-motion parity** (calm static card)
- **Haptic feedback** on trigger

The `DailyAllowanceHero` already has:
- **Animated progress ring** with gradient fills
- **Spring-driven number counter** with overshoot
- **Shimmer particles** (ambient glow)
- **Time-of-day atmosphere** shifting warmth
- **Status-reactive color gradients**

These are all GPU-composited, ship at zero marginal bundle cost (framer-motion is already loaded), and have no cold-start latency.

---

## Use-Case-by-Use-Case Verdict

### 1. Celebration Moment

**Verdict: Not needed.** The current layered confetti + starburst SVG + springs already feel premium. A Rive/Lottie character animation would require:
- Designing a custom animation file (hours of design work or paid asset)
- 200+ KB cold-load penalty on first celebration
- Maintaining an additional runtime dependency
- Reduced-motion fallback path (duplicated effort)

The marginal quality gain is small for the cost.

### 2. Expressive Hero State

**Verdict: Not appropriate.** The hero's identity is the *number* — it must remain readable, fast, and accessible above all. Adding a living illustration around the ring would compete for attention and add visual complexity counter to Folio's minimalism principle. The existing shimmer particles and time-of-day atmosphere already provide life without distraction.

### 3. Branded Loading/Mascot

**Verdict: Not yet.** Folio doesn't have a mascot or brand mark that would benefit from animation. The existing skeleton shimmer + progressive reveal is on-brand and instant. A mascot would need brand design work first — that's a product decision, not a technical one.

---

## If We Revisited in the Future

If Folio later develops a mascot or brand character, the lightest path would be:

1. **`micro-lottie-react`** (~6 KB) for a single contained animation
2. Lazy-loaded via `React.lazy` + `Suspense` with static SVG fallback
3. Lottie JSON asset hosted on CDN, not bundled
4. Triggered only after core UI paints (no blocking)

Rive would only make sense if we needed *interactive* state machines (e.g., a character that reacts to spending in real time) — which is compelling but premature for Folio's current scope.

---

## Summary

| Criterion | Rive | Lottie | Current Stack |
|-----------|------|--------|---------------|
| Bundle cost | ❌ High (222–567 KB) | ⚠️ Moderate (60 KB) | ✅ Zero marginal |
| Cold-start latency | ❌ WASM fetch | ⚠️ JSON fetch | ✅ Instant |
| Design asset needed | ❌ Yes (custom .riv) | ❌ Yes (custom .json) | ✅ Already built |
| Reduced-motion parity | ⚠️ Must implement | ⚠️ Must implement | ✅ Already done |
| Interactivity | ✅ State machines | ❌ Playback only | ⚠️ Limited to springs |
| Quality ceiling | ✅ Highest | ✅ High | ✅ Already premium |
| Maintenance burden | ❌ New runtime + assets | ⚠️ Player + assets | ✅ Existing patterns |

**Recommendation:** Skip for Phase 6. Revisit when/if Folio develops brand illustration or a mascot character that needs animated expressiveness beyond what Framer Motion provides. The current implementation is already at the quality bar of polished startup products.

---

*Produced for Task 270.1 — Phase 6, Group 55 (Interactive illustration, optional/scoped)*
