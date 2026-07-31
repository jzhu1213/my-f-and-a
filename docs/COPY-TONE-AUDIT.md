# Copy & Tone Audit — Folio vs. Rocket Money

**Date:** June 2025  
**Scope:** All user-facing microcopy across the Folio app  
**Standard:** Warm, shame-free, encouraging — the opposite of utilitarian/transactional

---

## Executive Summary

**Overall grade: A**

Folio's copy is already overwhelmingly differentiated from Rocket Money and its competitors. The warm, human, non-judgmental voice is consistent across nearly every surface — hero messages, tips, insights, affordability checks, celebrations, education, and settings.

One minor fix was identified: the shared/public view uses "Over budget today" (a cold, utilitarian label that reads like a failure state). Everything else passes the tone test.

The copy system is Folio's competitive moat. Where Rocket Money makes you feel like a cost center, Folio makes you feel like a person having a regular Tuesday.

---

## Rocket Money's Style (for contrast)

Rocket Money's copy is:
- **Transactional** — "You spent $X on Y" with no emotional framing
- **Data-forward** — numbers dominate, context is secondary
- **Guilt-adjacent** — "You've wasted $X on subscriptions you don't use"
- **Impersonal** — could be a bank statement talking to you
- **Savings-obsessed** — value prop is "we cancel things for you" (implying you're wasteful)
- **Metric-heavy** — dashboards that feel like a performance review

This approach works for users who want a tool. It fails users who want a companion.

---

## Folio's Tone Principles (as codified)

Sourced from `vocabulary.ts` comments and the steering file:

1. **Warm and short** — one line, conversational, like a friend checking in
2. **Human** — first/second person, contractions, casual punctuation
3. **Non-judgmental** — never "you overspent" or "budget failed"
4. **Encouraging** — frame forward ("tomorrow resets") not backward ("you went over")
5. **Tomorrow-always-resets** — the core emotional safety net
6. **Never shame** — even deep over-budget states use 🫶 and "no stress" framing
7. **Numbers are information, not verdicts** — show the data, let the user feel what they feel

---

## Surface-by-Surface Audit

### 1. Daily Allowance Hero (`vocabulary.ts` → `getStatusMessage`)

| Status | Copy | Rating |
|--------|------|--------|
| healthy (≥$50) | "Nice! You've got $X left today." | ✅ |
| healthy (≥$20) | "You're doing great — $X to go." | ✅ |
| healthy (low) | "Still $X left. You're on track!" | ✅ |
| caution (≥$10) | "Heads up — $X left today." | ✅ |
| caution (low) | "Getting close — $X left. You've got this." | ✅ |
| warning (>$0) | "Almost there — just $X left today." | ✅ |
| warning (=$0) | "Right at your limit. Nice job staying on track." | ✅ |
| over (≤$20) | "A little tight today — tomorrow resets." | ✅ |
| over (≤$50) | "Over today, but no stress. Tomorrow's a fresh start." | ✅ |
| over (>$50) | "Big day for spending — tomorrow gives you a clean start." | ✅ |

**Verdict: ✅ Passes.** Every over-budget state leads with compassion and points forward.

---

### 2. Contextual Tips (`tipUtils.ts`)

| Tip | Copy | Rating |
|-----|------|--------|
| Over-budget | "Today's a little tight — tomorrow resets fresh. Logging income adds to today's pool if you need it." | ✅ |
| Near-budget | "You've used most of today's budget. Maybe save the rest for later?" | ✅ |
| Tracker high-day | "Today's running higher than most — just so you know. Every day is different." | ✅ |
| Burn rate | "At your recent pace, things might get tight before month-end. Spacing out big purchases will keep you comfortable." | ✅ |
| Low balance | "Money's a little tight until payday. Spacing things out will keep you comfortable..." | ✅ |
| Bill reminder | "Reminder — [bill] is due [when]. You've got this!" | ✅ |
| Subscription renewal | "Heads up — [name] renews [when]. All good if you're keeping it!" | ✅ |
| Trial ending | "Your [name] trial converts [when]. Keep it if you love it — or cancel before it charges." | ✅ |
| Subscription audit | "You have X subscriptions totaling $Y/mo — want to check they're all worth keeping?" | ✅ |
| Source breakdown | "X% of this month's spending went on credit ($Y). Not a problem if you clear it monthly!" | ✅ |
| Lump income | "Looks like a big payment came in 🎉 Your daily budget uses a 3-month average..." | ✅ |
| Getting started | "Tap any category to log an expense. Your most common amounts will appear automatically." | ✅ |

**Verdict: ✅ Passes.** Tips are informational, never guilt-based, and always offer a constructive next step.

---

### 3. Month-Over-Month Insights (`spendingInsights.ts`)

| Direction | Copy | Rating |
|-----------|------|--------|
| Up (≥50%) | "Spending is up X% this month. No stress — just good to know." | ✅ |
| Up (≥20%) | "A bit more this month — up X% from last month." | ✅ |
| Up (small) | "Spending crept up a little (X%). Nothing major." | ✅ |
| Down (≥30%) | "You've spent X% less than last month — nice work!" | ✅ |
| Down (≥10%) | "A bit less this month — down X% from last month." | ✅ |
| Down (small) | "Spending is slightly lower this month. Keep it up!" | ✅ |
| Flat | "Spending is about the same as last month — steady as you go." | ✅ |

**Verdict: ✅ Passes.** Even large spending increases are framed as information ("just good to know"), not failure.

---

### 4. End-of-Month Projection (`insightUtils.ts`)

| State | Copy | Rating |
|-------|------|--------|
| On track | "On track to end the month with ~$X left 🎉" | ✅ |
| Tight | "At this pace, things might be tight by month-end" | ✅ |
| Negative | "Spending's running a bit high — spacing things out will keep you on track" | ✅ |

**Verdict: ✅ Passes.** Projections use hedging language ("might be tight") rather than absolutes.

---

### 5. Affordability Helper (`affordabilityUtils.ts`)

| State | Copy | Rating |
|-------|------|--------|
| Can afford (plenty) | "You'd still have $X left today — go for it!" | ✅ |
| Can afford (moderate) | "That works! You'd have $X left for the rest of today." | ✅ |
| Can afford (tight) | "Tight but doable — you'd have $X left today." | ✅ |
| Can't afford (payday close) | "This would stretch today's budget, but payday is close." | ✅ |
| Can't afford | "This would put you over today's budget, but tomorrow resets." | ✅ |

**Verdict: ✅ Passes.** Even when the answer is "no," it's framed as a today-problem that resets tomorrow.

---

### 6. Celebrations (`vocabulary.ts` → `CELEBRATION_COPY`)

| Trigger | Title / Message | Rating |
|---------|-----------------|--------|
| Under budget | "Under budget today!" / "Nice work — you spent well below today's limit." | ✅ |
| 3-day streak | "3-day streak!" / "Three days under budget in a row. You're building momentum!" | ✅ |
| 7-day streak | "One whole week!" / "Seven days under budget — that's seriously impressive." | ✅ |
| First tx | "First one logged!" / "You've started tracking. That's the hardest part." | ✅ |
| No-spend streak | "No-spend streak!" / "You're on a roll — no spending for days straight." | ✅ |
| No-spend weekend | "No-spend weekend!" / "You made it through the whole weekend without spending — nice one!" | ✅ |

**Verdict: ✅ Passes.** Celebrations are genuinely celebratory without being condescending.

---

### 7. Spending Modes & Settings (`spendingModes.ts`)

| Element | Copy | Rating |
|---------|------|--------|
| Tracker label | "Records what you spend — no limits, no nudges, just a clear picture." | ✅ |
| Guided label | "Gentle nudges when you're spending more than usual. Relaxed and flexible." | ✅ |
| Structured label | "Firm per-area caps with clear signals when you're close to or over the limit." | ✅ |
| Over-limit quiet | "Only the ring and amount change color — no extra text." | ✅ |
| Over-limit gentle | "One brief, encouraging line below the hero. Nothing alarming." | ✅ |
| Over-limit headsup | "A short line plus a quick-action chip so you can do something about it." | ✅ |
| Limit visibility (tracker) | "Your limits are paused and saved — switch to Guided or Structured anytime to bring them right back." | ✅ |

**Verdict: ✅ Passes.** Settings descriptions are clear without being clinical.

---

### 8. Welcome Back / Re-engagement (`WelcomeBackBadge.tsx`)

| Message | Rating |
|---------|--------|
| "Welcome back! Ready to pick up where you left off?" | ✅ |
| "Hey — nice to see you again." | ✅ |
| "Welcome back! Your budget is here whenever you need it." | ✅ |
| "Good to see you! Let's check in on your spending." | ✅ |

**Verdict: ✅ Passes.** Never shows days missed, never guilts the user for being away.

---

### 9. Onboarding (`Onboarding.tsx`)

| Element | Copy | Rating |
|---------|------|--------|
| Value prop 1 | "See what you can spend today" | ✅ |
| Value prop 2 | "Log expenses and income in seconds" | ✅ |
| Value prop 3 | "Set weekly limits by category" | ✅ |
| CTA | "Get Started" | ✅ |

**Verdict: ✅ Passes.** Minimal, benefit-oriented, no pressure.

---

### 10. Education / Lessons (`lessonsContent.ts`)

| Element | Copy | Rating |
|---------|------|--------|
| Budgeting 101 opener | "Budgeting isn't about restriction, it's about knowing where your money goes so you can spend on what matters to you." | ✅ |
| Emergency fund | "Start small and be kind to yourself about it." | ✅ |
| Credit cards | "Used gently, a card builds the credit history you'll want later..." | ✅ |
| Investing | "The two habits that matter most are starting early and staying consistent." | ✅ |

**Verdict: ✅ Passes.** Educational content is warm, jargon-light, and uses real student examples. No lecturing tone.

---

### 11. Empty States (`HomeScreen.tsx`)

| Surface | Copy | Rating |
|---------|------|--------|
| No budgets | "You're all set to start — limits are optional" | ✅ |
| No transactions | "Ready when you are / Log your first expense and Folio starts learning your habits" | ✅ |
| Sinking funds | "No sinking funds yet. Pick a preset below to get started." | ✅ |
| Transaction list | "Log your first expense to get started" | ✅ |

**Verdict: ✅ Passes.** Empty states are inviting, not pressuring.

---

### 12. Over-Budget Strip (`HomeScreen.tsx`)

| Element | Copy | Rating |
|---------|------|--------|
| Gentle (one-liner) | "Spent a bit more today — tomorrow resets ✨" | ✅ |
| Headsup (with CTA) | "Tomorrow's budget resets — or log income to top up today." | ✅ |
| Aria label | "Spending suggestion" (not "Over budget suggestion") | ✅ |

**Verdict: ✅ Passes.** The aria-label fix (task 70.5) was a good call — "spending suggestion" is much warmer than "over budget suggestion."

---

### 13. Shared/Public View (`src/app/shared/[token]/page.tsx`)

| Status | Label | Rating |
|--------|-------|--------|
| healthy | "Doing well" | ✅ |
| caution | "A bit tight" | ✅ |
| warning | "Getting tight" | ✅ |
| **over** | **"Over budget today"** | ❌ |

**Verdict: ❌ One fix needed.** "Over budget today" is the only label in the app that reads like a Rocket Money bank statement. It's declarative, judgmental, and uses "over budget" phrasing that the rest of the app carefully avoids.

---

### 14. DailyAllowanceHero Breakdown Explainer

| Element | Copy | Rating |
|---------|------|--------|
| Rollover explanation | "Rollover = what you saved or overspent from previous days (capped at ±2 days)" | ⚠️ |
| Allowance formula | "Today's allowance = daily budget + rollover − spent today" | ✅ |
| Over-budget note | "The number is always $0 or more — if you overspend, tomorrow resets." | ✅ |

**Verdict: ⚠️ Minor polish.** The word "overspent" in the rollover explainer is technically accurate but slightly at odds with the never-shame principle. The rest of the app uses "spent more" or "a little tight" for this concept. However, since this is inside an educational breakdown panel that users opt into by tapping, it's acceptable — the user is actively seeking a technical explanation.

---

## Specific Findings

### Finding 1: Shared view "Over budget today" label (❌ Fix Required)

**Current:** `label: "Over budget today"`  
**File:** `src/app/shared/[token]/page.tsx`, line 52  
**Why it's problematic:** This is the only place in the entire app that uses the phrase "over budget" as a user-facing label. Every other surface says "a little tight today," uses 🫶, or frames it as "spent more today." This label could be seen by anyone the user shares their status with — making it a potential source of external shame.  
**Suggested replacement:** `"A little over today"`

### Finding 2: Rollover explainer uses "overspent" (⚠️ Optional polish)

**Current:** `"Rollover = what you saved or overspent from previous days (capped at ±2 days)"`  
**File:** `src/components/simplified/DailyAllowanceHero.tsx`  
**Why it's borderline:** "Overspent" is a judgment word. The rest of the app uses "spent more" or "a little tight."  
**Suggested replacement:** `"Rollover = what you saved or spent extra from previous days (capped at ±2 days)"`  
**Note:** This is inside an opt-in technical explainer, so it's lower priority. Fixing it is easy and makes the tone 100% consistent.

---

## Code Changes

### Change 1: Shared view status label (required)

**File:** `src/app/shared/[token]/page.tsx`

```typescript
// Before
over: {
  label: "Over budget today",
  ...
}

// After
over: {
  label: "A little over today",
  ...
}
```

### Change 2: Rollover explainer wording (optional polish)

**File:** `src/components/simplified/DailyAllowanceHero.tsx`

```typescript
// Before
"Rollover = what you saved or overspent from previous days (capped at ±2 days)"

// After  
"Rollover = what you saved or spent extra from previous days (capped at ±2 days)"
```

---

## Competitive Positioning Summary

### Folio's Copy IS the Product Differentiator

| App | Tone | Over-budget UX | Emotional outcome |
|-----|------|----------------|-------------------|
| **Rocket Money** | Transactional, guilt-adjacent | "You've wasted $X" | Shame → avoidance |
| **Mint** | Data-heavy, impersonal | Red bars, "over budget" | Anxiety → dashboard fatigue |
| **YNAB** | Jargon-heavy ("age your money") | "Overspent in category" | Confusion → overwhelm |
| **Folio** | Warm, human, shame-free | "A little tight today — tomorrow resets" | Calm → continued engagement |

### Why This Matters

1. **Retention** — Users don't abandon apps that make them feel good. Shame-based copy drives avoidance loops (see every fitness app ever).

2. **Target audience fit** — College students and young adults are building financial habits for the first time. One bad experience with "you failed your budget" can drive a user away permanently.

3. **Defensibility** — Rocket Money can copy features (daily allowance, quick logging) but can't retroactively rebuild their entire copy system around warmth. Their brand is built on "we save you money by being aggressive." Folio's brand is built on "we're here whenever you need us, no judgment."

4. **Word-of-mouth** — People share screenshots of apps that make them smile. "Over today, but no stress. Tomorrow's a fresh start." is screenshot-worthy. "You overspent by $12.47" is not.

### The Core Insight

Folio doesn't compete on features. It competes on *how it makes you feel when you check it*. The copy system — vocabulary.ts, tipUtils.ts, affordability messages, celebrations — is the primary mechanism for that feeling. It is not decoration on top of the product. It IS the product.

---

## Conclusion

Folio's copy passes the tone audit with a 12/14 perfect score and 2 minor items (one fix, one optional polish). The system is remarkably consistent across ~50+ distinct copy strings, all rooted in the same principles: warm, short, human, forward-looking, never-shame.

The copy infrastructure (centralized in vocabulary.ts, with dedicated message generators per surface) makes drift nearly impossible. New features that need copy can import from the same source of truth and follow the established patterns.

**No architectural changes needed. One string fix in the shared view. The copy is the competitive feature.**
