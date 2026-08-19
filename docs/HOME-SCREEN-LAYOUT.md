# Home Screen Layout — Final Structure (Phase 21)

The home screen contains exactly **seven sections**. Nothing else.

```
── ABOVE THE FOLD ──────────────────────────────────────────────

1. DailyAllowanceHero
   The big number. Shows daily allowance remaining (or chosen
   hero meaning). Tap for breakdown. Long-press for affordability
   check. Warm purple glow on new day, color shift when over.

2. HeroContextRow
   One collapsed summary line (~13px, muted) showing top 3
   active indicators joined by " · ". Tappable to expand a card
   with all active context:
   - Streak count (with grace day annotation)
   - $0 day note (if applicable)
   - Period context ("Day 8 of 14")
   - Savings rate
   - Spend pace
   - Time horizon stats (weekend / payday / term)
   - Spend-down plan
   - Suggestion allowance impact
   - Coming-up awareness
   - Over-budget message
   - Outstanding splits summary (if any)

3. Quick Actions
   Two buttons only:
   - [Log expense] — primary, gradient fill, flex 1.6
   - [Log income]  — secondary, green ghost border, flex 1

── BELOW THE FOLD ──────────────────────────────────────────────

4. Log Again Repeats (max 3 chips)
   Horizontal chip row of recent transactions the user can
   one-tap log again. Only renders if transaction history exists.

5. Coming Up (max 3 items)
   Merged predictions + suggested entries. Shows upcoming
   predicted expenses with confirm/dismiss actions for
   auto-suggested items.

6. Category Budget Cards (2×2 grid, top 4)
   Visual progress cards for the top 4 budget categories
   (sorted: over-budget first, then least remaining, then
   most spent). "See all →" link if more than 4 exist.

7. Recent Transactions (5 max with "See all →")
   Grouped by date with timeline accent. Swipeable rows
   (left = delete, right = edit). Day subtotals shown.

────────────────────────────────────────────────────────────────
```

## What's NOT on the home screen

Everything below has been relocated as part of Phase 21 cleanup:

| Element                      | New Location                          |
|------------------------------|---------------------------------------|
| Standalone streak badge      | HeroContextRow                        |
| PeriodContextIndicator       | HeroContextRow                        |
| Period transition message     | Hero subtitle                         |
| Suggestion allowance impact  | HeroContextRow                        |
| Coming-up awareness message  | HeroContextRow                        |
| Savings-rate badge           | HeroContextRow                        |
| SpendPaceIndicator           | HeroContextRow                        |
| "New day" text               | Hero glow animation                   |
| Estimation button            | Hero label                            |
| OverBudgetStrip              | Hero color + HeroContextRow line      |
| TimeHorizonPills             | HeroContextRow                        |
| Spend-down indicator         | HeroContextRow                        |
| PinnedHomeCards              | Removed (Tools screen for widgets)    |
| Split/Afford/Wish buttons    | ExpenseSheet / hero long-press / Tools|
| $0 Day marker                | StreakDetailView                       |
| Grace day notification       | StreakDetailView + HeroContextRow      |
| Outstanding Splits card      | HeroContextRow expanded section        |
| WhatsNewCard                 | Settings                              |
| WelcomeBackBadge             | Auto sheet + Settings                 |
| Setup Checklist              | Bottom sheet (2nd/3rd open) + Settings|
| Contextual Tip Card          | Toast after user action (not inline)  |

## Design Principles

- **Calm and focused**: 7 sections max, no clutter
- **Progressive disclosure**: details live in expanded views, sheets, or other screens
- **Above-the-fold priority**: hero + context + quick actions own the first screenful
- **No infinite scroll**: finite list with clear boundaries
