# Phase 13 — New User Journey Verification (Task 397)

Verification performed against the codebase to confirm all onboarding flows, skip paths, and copy meet requirements.

---

## 397.1 Full Onboarding Path ✅

### Flow Verified

1. **New account detection** — `page.tsx` checks `getOnboardingProgress().isComplete`; new users are routed to `onboardingStep = 'conversational'` (line ~661).

2. **3-step conversational intro** — `ConversationalOnboarding.tsx` implements:
   - **Step 1:** "How much money do you have to work with each month?" — presets ($500, $1000, $1500, $2000, $3000) + custom input.
   - **Step 2:** "What's your biggest monthly bill?" — amount input + "I don't have a big recurring bill" option + live `AllowancePreview` showing `$X/day`.
   - **Step 3:** "How do you want Folio to work?" — spending mode picker (Just watching / Guided budgeting / Strict limits).
   - **Validates: Req 21.1** (meaningful allowance in ≤3 steps, <60s).

3. **Instant allowance preview** — `AllowancePreview` component shows computed `$X/day` after step 1+2 with animated green number and subtle glow (`textShadow`). Also shown on step 3. **Validates: Req 21.2**.

4. **Transition animation** — `OnboardingTransition.tsx` morphs the daily allowance number from its onboarding position toward the hero position (scale + y animation). Respects `prefers-reduced-motion`. **Validates: Req 21.1, Task 391.1**.

5. **Home landing** — After transition, `onboardingStep` → `'done'`, user sees:
   - Real allowance number (seeded income transaction from onboarding inputs).
   - `isFirstRun` flag triggers first-run home state: prominent CTA, warm empty-state copy ("Your spending will show up here").
   - Progressive setup checklist card visible (via `activateChecklist()`).
   - **Validates: Task 391.2**.

6. **First expense logging** — When first expense is logged:
   - `folio-just-onboarded` localStorage flag is cleared.
   - `checkNewUserFirstExpense()` fires celebration: "You're tracking! That's the hardest part." (sparkle animation).
   - `markChecklistStepComplete('first-expense')` updates the checklist.
   - **Validates: Req 21.4, 21.5**.

7. **Checklist progression** — `setupChecklist.ts` defines 7 steps:
   1. ✅ Set up your allowance (auto-completed)
   2. Log your first expense
   3. Add your income source
   4. Set a budget for one category
   5. Create your first savings goal
   6. Enable notifications
   7. Invite a friend
   - Each step has emoji, label, description, and action routing.
   - `ProgressiveChecklistCard` shows progress ring + max 2 visible tasks + "see all" expansion.
   - **Validates: Req 21.4, Task 392**.

8. **Celebrations** — `celebrationEngine.ts` includes new-user-specific milestones (Phase 13 task 393.1):
   - `checkNewUserFirstExpense` → "You're tracking!"
   - `checkNewUserFirstDay` → "Day 1 complete — you stayed at $X."
   - `checkNewUser3DayStreak` → "3 days running — you're building a habit."
   - `checkNewUserFirstWeek` → "One week down. You know more about your money than most."
   - All gated to first 7 days via `isNewUser()`.
   - **Validates: Req 21.5, Task 393.1**.

---

## 397.2 Skip Path ✅

### Flow Verified

1. **Skip at any point** — `ConversationalOnboarding` renders "Skip for now" button on every step. `handleConversationalSkip` in `page.tsx`:
   - Sets `progress.isComplete = true`
   - Adds `'conversational-intro'` to `skippedSteps`
   - Routes to `onboardingStep = 'done'`
   - Sets default goal preferences.
   - **Validates: Req 21.3**.

2. **App usable with defaults** — When skipped:
   - No income seeded, so the app uses the existing $50/day fallback from `personaDefaults.ts`.
   - Home screen renders normally with all features accessible.
   - No crashes or broken states.

3. **Checklist persists** — The checklist is not activated on skip (only on complete), but the legacy `SetupChecklistCard` still shows any `skippedSteps` for resumption. Users can also trigger "Resume setup" from Settings.
   - **Validates: Req 21.3**.

4. **Resume later** — Settings exposes "Resume setup" which calls `resumeChecklist()`. Individual steps can be re-entered via their action routing.

---

## 397.3 Copy and Tone ✅

### Audit Results

All onboarding copy verified as warm, encouraging, short, and jargon-free:

| Location | Copy | Assessment |
|----------|------|------------|
| Step 1 title | "How much money do you have to work with each month?" | ✅ Conversational, no jargon |
| Step 1 subtitle | "No need to be exact — a rough number works great." | ✅ Reassuring, zero pressure |
| Step 2 title | "What's your biggest monthly bill?" | ✅ Natural question |
| Step 2 subtitle | "Usually rent or housing — helps us figure out your daily spending room." | ✅ Explains why, friendly |
| Step 2 "no bill" | "I don't have a big recurring bill" | ✅ Non-judgmental option |
| Step 3 title | "How do you want Folio to work?" | ✅ Empowering language |
| Step 3 subtitle | "You can always change this later in settings." | ✅ Reduces commitment anxiety |
| Allowance preview | "Based on that, you can spend about $X/day" | ✅ Casual, personal |
| Preview subtitle | "This gets more accurate as you use Folio" | ✅ Manages expectations gently |
| Skip button | "Skip for now" | ✅ No guilt, implies return |
| Completion toast | "You're all set — here's your daily number ✨" | ✅ Warm, celebratory |
| Checklist header | "No rush — explore at your own pace" | ✅ Respectful of time |
| Checklist dismiss | "Got it, I'll explore on my own" | ✅ No guilt |
| New user tip (ring) | "The ring on the home screen shows today's spending at a glance. Green means you're on track, yellow is getting close." | ✅ Helpful, plain language |
| New user celebration | "You're tracking! That's the hardest part." | ✅ Encouraging |
| Welcome back | "Welcome back! Your allowance today is $X." | ✅ Warm, informative |
| Tool not ready | "Keep logging for a few days and this will come alive" | ✅ Honest, not punishing |

**No instances found of:**
- ❌ "Configure your parameters"
- ❌ "Budget failed" / "You overspent" energy
- ❌ Technical jargon
- ❌ Guilt-based messaging
- ❌ Institutional/banking tone

---

## Build Verification

- `npm run typecheck` → ✅ Pass (exit code 0)
- `npm run build` → ✅ Pass (exit code 0)

---

## Summary

All three subtasks of Task 397 pass verification:
- **397.1** Full onboarding path: 3-step conversational flow → allowance preview → transition animation → home with checklist → celebrations fire on milestones.
- **397.2** Skip path: Fully skippable at any point → app works with defaults → checklist resumable.
- **397.3** Copy and tone: Warm, encouraging, short, jargon-free throughout.
