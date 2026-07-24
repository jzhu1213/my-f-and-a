---
inclusion: manual
---

# Folio Architecture Reference

## Key Source Files
| File | Role |
|------|------|
| `src/app/page.tsx` | Root routing, all overlay/sheet state, nav switching |
| `src/hooks/useHomeData.ts` | All data fetching + mutations; calls `computeDailyAllowance` |
| `src/lib/dailyAllowanceUtils.ts` | Core allowance calc, status thresholds, encouraging messages |
| `src/lib/suggestionUtils.ts` | Smart amount suggestions by category |
| `src/lib/tipUtils.ts` | Contextual tip selection |
| `src/lib/celebrationEngine.ts` | Celebration trigger logic |
| `src/lib/supabaseData.ts` | All Supabase CRUD operations |
| `src/lib/animations.ts` | Spring/timing presets for framer-motion |
| `src/styles/shared.ts` | Layout constants (max-width, padding, dock height) |
| `src/styles/typography.ts` | Type scale constants |
| `src/types/folio.ts` | Core domain types (DailyAllowance, SmartSuggestion, etc.) |
| `src/types/index.ts` | Transaction, Budget, Goal, TransactionCategory |

## Component Map
```
AppShell (top bar + dock)
├── HomeScreen
│   ├── DailyAllowanceHero → AllowanceRing
│   ├── QuickLogArea → SuggestionChip
│   ├── ContextualTipCard
│   ├── CelebrationOverlay
│   └── SwipeableTransactionRow → InlineTransactionEditor
├── HistoryScreen
├── ToolsScreen  ← advanced features, opt-in
└── SettingsScreen
    ├── BudgetSettings (overlay)
    ├── GoalsScreen (overlay)
    ├── RecurringBillsScreen (overlay)
    ├── SinkingFundsScreen (overlay)
    ├── SubscriptionAuditScreen (overlay)
    └── LessonsScreen (overlay, via ToolsScreen)
```

## Allowance Calculation Logic
```
incomeSource priority: budget limits → actual income txns → estimate (fallback $50/day)
dailyBudget = (monthlyPool - fixedExpenses) / effectiveDays
rollover = expectedSpend(day1→yesterday) - actualSpend, capped ±2×dailyBudget
amount = max(0, dailyBudget + rollover - spentToday)
isEstimated = true when using estimate source (shown in HomeScreen banner)
```

## Task Progress (Group 9 Practicality)
- [x] 65 — Core money events (one-tap log, income, split, recurring bills)
- [x] 66 — Budget setup optional; no onboarding gate; $50/day fallback
- [x] 67 — Advanced tools moved to Tools tab (progressive disclosure)
- [~] 68 — Handle irregular/variable income (foundation in task 48)
- [~] 69 — Realistic student categories + inline custom category
- [~] 70 — Over-budget state: warm, practical, shame-free

## Task Progress (Group 10 Realisticness)
- [ ] 71 — Optimize for 10-second session
- [ ] 72 — Trustworthy daily reference + "How is this calculated?" explainer
- [ ] 73 — Frictionless capture at point of spending
- [ ] 74 — Daily/weekly rhythm framing (today, this weekend, until payday)
- [ ] 75 — Quiet by default; tips/celebrations only when genuinely relevant
- [ ] 76 — Clean home canvas (hero + log actions + 3-5 recent + 1 contextual)
- [ ] 77 — Gentle re-engagement without nagging (opt-in daily reminder)

## Navigation State Machine (page.tsx)
```
activeNav: 'home' | 'history' | 'tools' | 'settings'

Full-screen overlays (each has its own boolean state):
  showBudgetSettings, showGoals, showSinkingFunds,
  showSubscriptionAudit, showRecurringBills, showLearn

Sheets (each has its own boolean isOpen):
  expenseSheetOpen, incomeSheetOpen, paycheckSheetOpen,
  editSheetOpen, refundSheetOpen, profileSheetOpen
```
