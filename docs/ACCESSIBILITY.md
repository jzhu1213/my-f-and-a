# Accessibility Statement

Folio is committed to making personal budgeting accessible to everyone. We follow [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/) guidelines (with select AAA enhancements) to ensure all users — regardless of ability — can manage their money with confidence.

## Standards

| Standard | Level | Status |
|----------|-------|--------|
| WCAG 2.1 | AA | Conformant |
| WCAG 2.1 | AAA (select criteria) | Partial — reduced motion, enhanced contrast |
| ARIA Authoring Practices 1.2 | — | Followed for all widget patterns |

## Supported Assistive Technologies

Folio is tested and supported with:

| Technology | Platform | Status |
|------------|----------|--------|
| VoiceOver | iOS / macOS Safari | Supported |
| TalkBack | Android Chrome | Supported |
| NVDA | Windows Chrome/Edge | Supported |
| Keyboard-only navigation | All platforms | Supported |
| Voice Control | iOS / macOS | Supported |
| Switch Control | iOS | Supported |
| Browser zoom (up to 200%) | All platforms | Supported |
| High contrast mode (`prefers-contrast: more`) | All platforms | Supported |
| Reduced motion (`prefers-reduced-motion`) | All platforms | Supported |

## Keyboard Shortcuts

Folio provides keyboard shortcuts for power users. Shortcuts are suppressed when a text input is focused.

| Shortcut | Action |
|----------|--------|
| `E` or `N` | Open new expense sheet |
| `I` | Open income sheet |
| `1` / `2` / `3` / `4` | Switch tabs: Home / History / Tools / Settings |
| `Esc` | Close any open sheet or overlay |
| `/` or `Ctrl+K` | Focus search |
| `?` | Toggle keyboard shortcuts help overlay |

**Navigation within components:**

| Shortcut | Context | Action |
|----------|---------|--------|
| `Arrow Left/Right` | Navigation dock, toolbars | Move focus between items |
| `Arrow Up/Down` | Vertical lists, grids | Move focus between rows |
| `Home` / `End` | Any roving tabindex group | Jump to first / last item |
| `Tab` | Anywhere | Move to next focusable group |

## Accessibility Features

### Screen Reader Support

- A centralized **live region** (`aria-live="polite"`) announces status updates without interrupting reading flow
- Assertive announcements (`aria-live="assertive"`) for time-sensitive alerts (undo toasts, errors)
- All icon-only buttons have descriptive `aria-label` attributes
- The Daily Allowance hero announces full context: allowance amount, status, and today's spending
- Filter and search results announce count changes dynamically

### Focus Management

- Sheets and overlays trap focus while open and restore focus on close
- Roving tabindex pattern makes component groups (dock, toolbars, grids) a single tab stop with arrow key navigation
- Clear focus-visible styles on all interactive elements (2px accent outline with offset)

### Visual Accessibility

- All text uses `rem` units — respects user font-size preferences
- High contrast mode enhances borders and reduces background complexity
- Color-blind-safe palette with pattern/shape differentiation in charts
- State indicators use icons, text, and shape — never color alone
- 200% browser zoom fully supported

### Motor Accessibility

- 44×44px minimum touch targets on all interactive elements
- Toast notifications with actions pause on hover/focus (minimum 6 second visibility)
- No timing-dependent interactions anywhere in the app
- Large, forgiving tap areas for one-handed use

### Cognitive Accessibility

- Plain language throughout (~8th grade reading level)
- Consistent visual patterns (destructive = red, primary = accent color)
- Confirmation dialogs before destructive actions
- Undo available for recent mutations
- Progressive disclosure — advanced features hidden behind Tools/Settings tabs

### Motion

- All animations respect the operating system's `prefers-reduced-motion` setting
- When reduced motion is active, spring-based animations resolve to opacity-only transitions (≤150ms)
- Scroll-linked transforms hold at resting values

### Internationalization

- RTL layout support triggered by locale
- Locale-aware date, number, and currency formatting
- Text direction set at the `<html>` element level

## Known Limitations

1. **Chart details** — Complex chart data (spending breakdowns) may not be fully conveyed through screen reader announcements. We provide text summaries alongside charts where possible.
2. **Gesture alternatives** — Swipe-to-delete and swipe navigation have keyboard/button alternatives, but the discovery of these alternatives could be improved.
3. **PDF export** — Exported PDF reports do not currently include accessibility tags for screen readers.
4. **Third-party content** — Confetti animations (canvas-confetti) are decorative and hidden from assistive technology, but the underlying celebration event is announced.

## Reporting Accessibility Issues

If you encounter an accessibility barrier in Folio, please let us know:

1. **GitHub Issues** — Open an issue with the `accessibility` label describing:
   - What you were trying to do
   - The assistive technology and browser/platform you were using
   - What happened vs. what you expected
2. **Email** — Reach out to the maintainers listed in the repository README

We aim to acknowledge accessibility reports within 48 hours and resolve critical barriers within one release cycle.

## Testing Approach

Folio validates accessibility through:

- **Automated** — Contrast verification scripts (`scripts/verify-contrast.mjs`), TypeScript lint rules for missing labels
- **Manual keyboard testing** — All core flows verified keyboard-only
- **Screen reader walkthroughs** — VoiceOver and NVDA used across Home, History, Tools, and Settings flows
- **User testing** — Periodic walkthroughs with assistive technology users

## Related Documentation

- [Component Accessibility Patterns](./ACCESSIBILITY-PATTERNS.md) — developer guide for implementing accessible components
