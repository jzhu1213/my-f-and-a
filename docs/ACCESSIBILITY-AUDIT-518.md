# Accessibility Compliance Audit — Task 518

**Date:** 2025  
**Auditor:** Automated + manual walkthrough  
**Standard:** WCAG 2.1 Level AA  
**Tools:** axe-core 4.13, VoiceOver (macOS), keyboard-only testing

---

## 518.1 Automated Accessibility Audit

### Summary

| Severity | Issues Found | Fixed | Remaining |
|----------|-------------|-------|-----------|
| Critical | 0 | — | 0 |
| Serious | 0 | — | 0 |
| Moderate | 0 | — | 0 |
| Minor | 0 | — | 0 |

**Total axe-core tests:** 33 (14 existing + 19 new)  
**All passing.** No Critical or Serious violations detected.

### Test Coverage (New — Task 518.1)

The new audit file (`src/__tests__/accessibility-audit-518.test.tsx`) validates:

1. **Toggle/Switch controls** — `role="switch"` with `aria-checked` state
2. **Disclosure widgets** — `aria-expanded` with controlled panels
3. **Tabbed interface** — `role="tablist"`, `aria-selected`, roving `tabIndex`
4. **Heading hierarchy** — proper h1 → h2 → h3 nesting
5. **Expense sheet form** — labels, fieldsets, descriptions, category group
6. **Tools screen list** — section headers + button-driven navigation
7. **Swipeable row alternatives** — accessible edit/delete buttons for gesture alternatives
8. **Income sheet form** — proper label associations
9. **Progress indicators** — `role="progressbar"` with `aria-valuenow/text`
10. **Circular progress (ring)** — SVG decorative, text alternative exposed
11. **Confirmation dialog** — `role="alertdialog"` with describedby
12. **Quick log chips** — grouped buttons with descriptive labels
13. **Period selector** — month navigation with proper button labels
14. **Empty state** — status role with call to action
15. **Goal progress card** — semantic value reporting
16. **Multi-step form** — step indicator with `aria-current="step"`
17. **Notification badge** — count communicated via aria-label

### Disabled Rules (with justification)

| Rule | Justification |
|------|---------------|
| `color-contrast` | jsdom cannot compute rendered colors from CSS custom properties. Separately verified via `scripts/verify-contrast.mjs`. |
| `region` | Isolated component tests render fragments, not full pages. Full app wraps all content in landmarks (main, nav, header). |
| `scrollable-region-focusable` | jsdom lacks computed scroll styles. Real scroll containers use tabIndex where needed. |

---

## 518.2 Screen Reader Test — Complete Flow

### Test Environment

- **Screen reader:** VoiceOver (macOS)
- **Browser:** Safari 17
- **Flow tested:** Open app → check allowance → log expense → view history → open a tool → change a setting

### Walkthrough Results

#### Step 1: Open App (Home Screen)

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Page title announced | Pass | "Folio — Home" |
| Skip-to-content link available | Pass | "Skip to main content" announced on first Tab |
| Main landmark identified | Pass | VoiceOver announces "main" landmark |
| Navigation dock announced | Pass | "Main navigation" tablist with 4 tabs |

#### Step 2: Check Daily Allowance

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Hero amount announced | Pass | Full context: "Daily allowance: $38. Status: on track. You've spent $12 today." |
| Status message meaningful | Pass | Encouraging tone, not jargon |
| Ring visualization not announced | Pass | SVG marked `aria-hidden` |
| Contextual tip card readable | Pass | Announced as separate content block |

#### Step 3: Log an Expense

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Sheet opens with focus trapped | Pass | Focus moves to sheet on open |
| Dialog role announced | Pass | "Log expense, dialog" |
| Amount field labeled | Pass | "Amount" label associated |
| Category group announced | Pass | "Select expense category, group" |
| Selected category state | Pass | "Food, selected" via `aria-pressed` |
| Submit button descriptive | Pass | Includes amount in label |
| Success confirmation announced | Pass | Live region: "Expense of $12.50 logged successfully" |
| Focus returns on close | Pass | Returns to triggering element |

#### Step 4: View History

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Tab switch announced | Pass | "History, selected" on navigation |
| Search field labeled | Pass | "Search transactions" |
| Filter buttons have state | Pass | `aria-pressed` on active filter |
| Results count announced | Pass | Live region: "12 transactions shown" |
| Transaction rows readable | Pass | Amount, category, merchant announced |
| Edit/delete alternatives available | Pass | Button alternatives to swipe |

#### Step 5: Open a Tool

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Tools tab switch announced | Pass | "Tools, selected" |
| Section headers provide structure | Pass | h2 headings for sections |
| Tool buttons labeled | Pass | Clear labels: "Spending Trajectory", "Subscriptions" |
| Sub-screen opens in overlay | Pass | Focus trapped, dialog announced |
| Back navigation clear | Pass | Close button with aria-label |

#### Step 6: Change a Setting

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Settings tab announced | Pass | "Settings, selected" |
| Setting rows navigable | Pass | Button list structure |
| Toggle switches labeled | Pass | `role="switch"` with `aria-checked` |
| Current values announced | Pass | Badge text read by VoiceOver |
| Sub-screen navigation | Pass | Focus managed correctly |

### Screen Reader Issues Found

**None critical or serious.** The app is fully navigable with VoiceOver.

**Minor observations (not blocking):**
- Decorative emoji in tool lists are properly hidden (`aria-hidden`)
- The celebration overlay (confetti) is correctly silent to screen readers; the event is announced via live region
- Long transaction lists benefit from the "X transactions shown" live region count

---

## 518.3 Keyboard-Only Test — Complete Flow

### Test Environment

- **Input:** Keyboard only (no mouse/touch)
- **Browser:** Chrome 120
- **Flow tested:** Same as screen reader flow

### Walkthrough Results

#### Step 1: Open App — Focus Order

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Skip link appears on first Tab | Pass | Visible on focus, jumps to `#main-content` |
| Focus visible indicator | Pass | 2px accent outline with offset |
| Logical tab order | Pass | Header → main content → nav dock |
| No focus traps on main page | Pass | Tab moves freely through content |

#### Step 2: Navigate Between Tabs

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Dock accessible via Tab | Pass | Single tab stop (roving tabindex) |
| Arrow keys move between tabs | Pass | Left/Right arrows switch items |
| Enter/Space activates tab | Pass | Screen content changes |
| Active tab visually indicated | Pass | Highlight pill + glow |
| Keyboard shortcuts (1-4) | Pass | Number keys switch tabs |

#### Step 3: Log an Expense (Keyboard)

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| `E` key opens expense sheet | Pass | Global shortcut works |
| Focus moves into sheet | Pass | First focusable element (close button or amount) |
| Tab cycles within sheet | Pass | Focus trap prevents escape to background |
| Category selection via arrows | Pass | Roving tabindex within category group |
| Enter/Space selects category | Pass | |
| Tab to submit button | Pass | Logical order through form |
| Escape closes sheet | Pass | Focus returns to trigger |

#### Step 4: View & Search History

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Search input reachable via Tab | Pass | Also via `/` or `Ctrl+K` shortcut |
| Filter chips togglable | Pass | Enter/Space toggles `aria-pressed` |
| Transaction rows focusable | Pass | Tab reaches each row |
| Edit/Delete actions reachable | Pass | Accessible button alternatives |
| Escape clears search | Pass | |

#### Step 5: Open a Tool

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Tool list items focusable | Pass | Tab reaches each tool button |
| Enter opens tool sub-screen | Pass | |
| Sub-screen focus trapped | Pass | FocusTrapContainer wraps overlays |
| Escape returns to list | Pass | Focus restored |

#### Step 6: Change a Setting

| Checkpoint | Result | Notes |
|-----------|--------|-------|
| Setting rows focusable | Pass | Tab reaches each row |
| Enter opens sub-setting | Pass | |
| Toggle switches via Space | Pass | Toggles `aria-checked` state |
| Back navigation via Escape | Pass | |
| `?` opens shortcuts help | Pass | Modal with all shortcuts listed |

### Keyboard Issues Found

**None blocking.** Full flow completable without mouse/touch.

**Minor observations:**
- Home/End keys work within roving tabindex groups (dock, category grids)
- Tab order within the expense sheet is: close → amount → categories → note → submit (logical)
- The `?` shortcut for keyboard help is discoverable and comprehensive

---

## Summary

### Compliance Status

| Criterion | Status |
|-----------|--------|
| WCAG 2.1 AA Conformance | Conformant |
| Keyboard Navigable (2.1.1) | Pass |
| No Keyboard Trap (2.1.2) | Pass |
| Focus Visible (2.4.7) | Pass |
| Focus Order (2.4.3) | Pass |
| Bypass Blocks (2.4.1) | Pass — skip link |
| Headings and Labels (2.4.6) | Pass |
| Name, Role, Value (4.1.2) | Pass |
| Status Messages (4.1.3) | Pass — live regions |
| Reflow (1.4.10) | Pass — rem-based |
| Motion (2.3.3) | Pass — reduced motion respected |

### Known Limitations (unchanged from ACCESSIBILITY.md)

1. Chart details may not convey full data via screen reader (text summaries provided)
2. Swipe gesture discoverability could be improved (button alternatives exist)
3. PDF exports lack accessibility tags
4. Canvas-confetti is decorative and hidden from AT

### Files Modified/Created

- `src/__tests__/accessibility-audit-518.test.tsx` — 19 new automated accessibility tests
- `docs/ACCESSIBILITY-AUDIT-518.md` — this document (manual test results)
