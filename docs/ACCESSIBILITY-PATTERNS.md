# Component Accessibility Patterns

A developer guide for implementing and maintaining accessible components in Folio. Follow these patterns when building new features or modifying existing ones.

## Table of Contents

- [ARIA Labels](#aria-labels)
- [Focus Management](#focus-management)
- [Live Regions](#live-regions)
- [Keyboard Navigation](#keyboard-navigation)
- [Motion and Animation](#motion-and-animation)
- [Touch Targets and Motor Accessibility](#touch-targets-and-motor-accessibility)
- [Color and Contrast](#color-and-contrast)
- [Testing Checklist](#testing-checklist)

---

## ARIA Labels

### Icon-Only Buttons

Every button that displays only an icon must have an `aria-label`:

```tsx
// Good
<button aria-label="Delete transaction" onClick={handleDelete}>
  <TrashIcon aria-hidden="true" />
</button>

// Bad — screen reader announces "button" with no context
<button onClick={handleDelete}>
  <TrashIcon />
</button>
```

### Decorative vs. Meaningful Icons

- **Decorative** (next to visible text): use `aria-hidden="true"` on the icon
- **Meaningful** (conveys information alone): provide `aria-label` on the parent or `role="img"` + `aria-label` on the icon

```tsx
// Icon next to text — decorative
<button>
  <PlusIcon aria-hidden="true" />
  <span>Add Expense</span>
</button>

// Standalone icon conveying status
<span role="img" aria-label="On track">
  <CheckCircleIcon />
</span>
```

### Dynamic Labels

When a component's meaning changes based on state, update the label:

```tsx
<button aria-label={isExpanded ? "Collapse details" : "Expand details"}>
  <ChevronIcon aria-hidden="true" />
</button>
```

### Form Inputs

All inputs need associated labels. Prefer visible `<label>` elements; use `aria-label` only when a visible label is not feasible:

```tsx
// Preferred — visible label
<label htmlFor="amount-input">Amount</label>
<input id="amount-input" type="number" />

// Acceptable — when layout prohibits a visible label
<input aria-label="Search transactions" type="search" />
```

---

## Focus Management

### Sheet/Overlay Focus Trapping

When a bottom sheet or overlay opens:

1. Move focus to the first focusable element inside (or the close button)
2. Trap Tab/Shift+Tab within the overlay
3. Close on `Esc` and restore focus to the trigger element

This pattern is handled by our overlay system. If building a custom overlay, follow the same contract:

```tsx
function MySheet({ isOpen, onClose, triggerRef }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus()
    }
  }, [isOpen])

  // On close, restore focus
  const handleClose = () => {
    onClose()
    triggerRef.current?.focus()
  }

  // Esc key closes
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="My sheet" onKeyDown={handleKeyDown}>
      <button ref={closeRef} aria-label="Close" onClick={handleClose}>×</button>
      {/* Sheet content */}
    </div>
  )
}
```

### Roving Tabindex

For groups of related items (toolbars, tab bars, grids), use the `useRovingTabindex` hook so the entire group is a single tab stop:

```tsx
import { useRovingTabindex } from '@/hooks/useRovingTabindex'

function Toolbar({ items }) {
  const { getItemProps, activeIndex } = useRovingTabindex({
    itemCount: items.length,
    orientation: 'horizontal',
  })

  return (
    <div role="toolbar" aria-label="Actions">
      {items.map((item, i) => (
        <button key={item.id} {...getItemProps(i)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}
```

**How it works:**
- Only the active item has `tabIndex={0}`; all others have `tabIndex={-1}`
- Arrow keys move focus between items
- Home/End jump to first/last
- Wrap-around at boundaries (configurable)

**When to use:**
- Navigation dock (horizontal)
- Tool lists and grids (vertical or 2D with `columns` option)
- Tab groups (HistoryViewToggle)

### Focus-Visible Styles

All interactive elements show a visible focus indicator when focused via keyboard. The global style is:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Never remove or suppress `:focus-visible`. If you need a custom focus style on a specific component, ensure it meets the 3:1 contrast ratio against adjacent colors.

---

## Live Regions

### Programmatic Announcements

Use the `useScreenReaderAnnouncer` hook for one-off status messages that have no dedicated visual live region:

```tsx
import { useScreenReaderAnnouncer } from '@/components/ui/ScreenReaderAnnouncer'

function TransactionLogger() {
  const { announce } = useScreenReaderAnnouncer()

  const handleLog = async (amount: number) => {
    await saveTransaction(amount)
    announce(`Expense of $${amount} logged successfully`)
  }
}
```

**Guidelines:**
- Keep messages concise (under 100 characters)
- Use sentence case
- Include relevant context (amount, category, result)
- Don't announce redundant info already spoken by the interaction itself

### Inline Live Regions

For content that updates frequently in place (counters, filter results), use an inline `aria-live` region:

```tsx
// Polite — for non-urgent updates (filter counts, status changes)
<p aria-live="polite" aria-atomic="true">
  {filteredCount} transactions shown
</p>

// Assertive — for urgent alerts (errors, undo prompts)
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

**Choosing politeness:**

| Urgency | `aria-live` | Use case |
|---------|-------------|----------|
| Low | `polite` | Filter counts, sync status, allowance updates |
| High | `assertive` | Errors, undo toasts, time-sensitive alerts |

### The Daily Allowance Hero

The hero component announces its full context on update:

```
"Daily allowance: $38. Status: on track. You've spent $12 today."
```

This is wrapped in `aria-live="polite"` so recalculations announce without interrupting.

---

## Keyboard Navigation

### Global Shortcuts

Defined in `src/hooks/useKeyboardShortcuts.ts`. Rules:

1. **Suppress in inputs** — all shortcuts (except Esc and Ctrl+K) are disabled when an input, textarea, or contenteditable element is focused
2. **No modifier conflicts** — single-key shortcuts use unmodified letters; system shortcuts (Ctrl+K) use standard modifiers
3. **Discoverable** — the `?` shortcut toggles a help overlay listing all shortcuts

### Adding New Shortcuts

```typescript
// In useKeyboardShortcuts.ts, add to the switch:
case 'r':
case 'R':
  event.preventDefault()
  actions.newAction()
  break
```

Then update:
- The `KeyboardShortcutActions` interface
- The help overlay content
- This documentation and `docs/ACCESSIBILITY.md`

### Dialog Keyboard Behavior

- `Esc` closes any dialog/sheet
- `Enter` confirms primary action (where applicable)
- `Tab` cycles through focusable elements within the dialog
- Focus does not escape the dialog while open

---

## Motion and Animation

### Respecting User Preferences

Always use the `useReducedMotion` hook before applying motion:

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion'

function AnimatedCard() {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion
        ? { duration: 0.15 }
        : { type: 'spring', stiffness: 300 }
      }
    >
      {/* Content */}
    </motion.div>
  )
}
```

**Rules:**
- When reduced motion is active, replace spring/transform animations with opacity-only fades (≤150ms)
- Scroll-linked transforms hold at resting values
- No animation should be required to understand or use the interface

---

## Touch Targets and Motor Accessibility

### Minimum Sizes

All interactive elements must be at least **44×44px** (CSS pixels). This applies to:
- Buttons
- Links
- Checkboxes / radio buttons
- Swipeable rows
- Category chips

If the visual element is smaller, extend the tap area with padding or a transparent overlay:

```tsx
// Visual is 24px icon, but tap area is 44px
<button className="p-[10px]" aria-label="More options">
  <MoreIcon className="w-6 h-6" aria-hidden="true" />
</button>
```

### Toast Timing

Toast notifications with actions must:
- Display for at least **6 seconds**
- Pause their timer on hover and focus
- Allow action via keyboard (focus + Enter)

---

## Color and Contrast

### Requirements

- **Text** — minimum 4.5:1 against background (WCAG AA)
- **Large text** (18px+ or 14px+ bold) — minimum 3:1
- **UI components** (borders, icons conveying meaning) — minimum 3:1
- **Focus indicators** — minimum 3:1 against adjacent colors

### Verification

Run the contrast check script:

```bash
node scripts/verify-contrast.mjs
```

### High Contrast Mode

When `prefers-contrast: more` is active:
- Increase border visibility on cards and inputs
- Reduce background transparency/blur effects
- Ensure all text meets 7:1 contrast (AAA)

### Color Independence

Never use color as the only indicator of state:
- ✅ Red icon + "Overdue" text label
- ✅ Green check icon + "Complete" badge
- ❌ A dot that's green or red with no other differentiation

---

## Testing Checklist

Before merging any UI change, verify:

### Keyboard

- [ ] All interactive elements are reachable via Tab
- [ ] Focus order follows visual layout (left-to-right, top-to-bottom)
- [ ] Focus-visible indicator is clearly visible on every focusable element
- [ ] Dialogs/sheets trap focus and restore on close
- [ ] Esc closes overlays
- [ ] No keyboard traps (user can always Tab out of components)

### Screen Reader

- [ ] All images and icons have appropriate alt text or aria-label
- [ ] Form inputs have associated labels
- [ ] Dynamic content changes are announced via live regions
- [ ] Custom widgets use correct ARIA roles and states
- [ ] Headings follow a logical hierarchy (h1 → h2 → h3, no skipping)
- [ ] Lists use semantic `<ul>`/`<ol>` markup

### Visual

- [ ] Text contrast meets 4.5:1 (or 3:1 for large text)
- [ ] UI works at 200% browser zoom with no content clipping
- [ ] Layout adapts correctly with `prefers-contrast: more` active
- [ ] No information conveyed by color alone
- [ ] Focus outline contrast is 3:1 against adjacent backgrounds

### Motion

- [ ] Animations respect `prefers-reduced-motion`
- [ ] No flashing content (nothing flashes more than 3 times per second)
- [ ] Auto-playing animations can be paused

### Touch / Motor

- [ ] All tap targets are at least 44×44px
- [ ] No timing-dependent interactions
- [ ] Toast actions are reachable by keyboard and persist on focus

### Cognitive

- [ ] Copy is concise and uses plain language
- [ ] Destructive actions require confirmation
- [ ] Error messages explain what went wrong and how to fix it
- [ ] Consistent patterns are used throughout (same action = same behavior)

---

## Quick Reference: Common Patterns

| Pattern | Implementation | Location |
|---------|---------------|----------|
| Screen reader announcements | `useScreenReaderAnnouncer()` → `announce(msg)` | `src/components/ui/ScreenReaderAnnouncer.tsx` |
| Roving tabindex | `useRovingTabindex({ itemCount, orientation })` | `src/hooks/useRovingTabindex.ts` |
| Reduced motion detection | `useReducedMotion()` → `prefersReducedMotion` | `src/hooks/useReducedMotion.ts` |
| Global keyboard shortcuts | `useKeyboardShortcuts(actions)` | `src/hooks/useKeyboardShortcuts.ts` |
| Focus-visible detection | `useFocusVisible()` | `src/hooks/useFocusVisible.ts` |

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
