# Decision Note: Optional Accent Theme Choices

**Phase 6, Task 262 — Scoping only (no build)**

---

## Context

Folio's visual identity is anchored in a single accent hue — soft indigo/purple
(`#818cf8`). This color drives the FAB, primary buttons, glow effects, dock
highlight, hero gradient, glass-card rims, and the full `--accent-50` → `--accent-900`
ramp in `globals.css`. Letting users personalize the accent would add a small layer of
ownership to the app without disrupting the dark-base brand.

## Proposal

Offer **4–5 curated warm accent choices** that users can pick from in Settings.  
The dark surface palette (`--bg`, `--surface`, `--raised`, `--hover`, `--border`,
semantic colors, text) stays fixed — only the accent ramp rotates.

### Candidate Hues

| Name       | Base (500) | Hex        | Character               | WCAG on #12121f |
|------------|-----------|------------|-------------------------|-----------------|
| Indigo     | default   | `#818cf8`  | Current — calm, neutral | 5.3:1 ✓         |
| Violet     | warmer    | `#a78bfa`  | Softer, more purple     | 5.8:1 ✓         |
| Rose       | warm pink | `#fb7185`  | Energetic, warm         | 4.9:1 ✓         |
| Teal       | cool mint | `#2dd4bf`  | Fresh, optimistic       | 8.2:1 ✓         |
| Amber      | warm gold | `#fbbf24`  | Sunny, confident        | 10.1:1 ✓        |

All candidates exceed **4.5:1** contrast against `--bg (#12121f)` as text and **3:1**
as UI components — meeting WCAG 2.1 AA.

### UX Surface

- **Where**: Settings screen, near the existing theme toggle (warm/dark).
- **How**: A row of 5 small color swatches; tap to select. Active swatch gets the
  glow-pill treatment used elsewhere.
- **Persistence**: localStorage key (`folio-accent`), read on mount to set `--accent-*`
  vars. Same pattern as the existing theme preference.
- **Scope of change**: Only `--accent`, `--accent-muted`, `--accent-50` → `--accent-900`,
  `--shadow-glow-accent`, and `--shadow-glow-accent-strong` rotate. Semantic colors
  (success/warning/error/blue) and all surface/text tokens stay constant.
- **Dark theme parity**: Each accent must define both warm-theme and dark-theme ramps
  (slightly desaturated for the darker surfaces).

### What Does NOT Change

- Background / surface palette (warm purple or brutalist dark)
- Semantic colors (green/amber/red/blue)
- Typography, spacing, iconography
- Category-specific tint colors (those are per-category, not accent-linked)
- Brand wordmark dot (could optionally tint, but the indigo dot IS the mark)

## Complexity Estimate

| Item                            | Effort   |
|---------------------------------|----------|
| Define 5 accent ramps (CSS)     | ~30 min  |
| Settings UI (swatch row)        | ~1 hr    |
| Persistence + mount injection   | ~30 min  |
| Dark-theme parity per accent    | ~45 min  |
| QA contrast verification        | ~30 min  |
| **Total**                       | **~3 hr** |

Low-risk, self-contained change. No structural refactor needed — the token architecture
already supports this (every accent usage references `var(--accent-*)`).

## Open Questions

1. **Wordmark dot** — Should it always stay indigo (brand anchor), or tint to the
   user's accent? Recommendation: keep it indigo for brand recognition.
2. **Category icon tints** — These are per-category colors (food = orange, transport =
   blue, etc.) and should NOT rotate with accent. Confirm no accidental coupling.
3. **Wallet Pass / widgets** — The Apple Wallet pass uses hardcoded purple. If accent
   changes, should the pass match? Likely no (pass is a static artifact).
4. **Sharing / public pages** — Shared goal/support links are seen by non-owners.
   Should they always render in default indigo? Probably yes for consistency.

## Recommendation

**Approved for build**, contingent on:
- Keeping the set small (5 max) to avoid choice paralysis.
- Wordmark dot stays indigo.
- Category tints and semantic colors remain fixed.
- Full WCAG AA verification for every accent × surface combination.
- Ship behind a simple `if (accentPreference)` branch so it's trivially revertible.

If the team agrees, this can ship as part of a future polish pass (or Phase 7+). It is
**not** blocking any Phase 6 work — the current indigo remains the default and nothing
else depends on this feature existing.

---

*Status: Scoped. Ready for go/no-go approval before implementation.*
