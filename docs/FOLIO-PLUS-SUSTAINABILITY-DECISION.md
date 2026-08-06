# Folio+ Sustainability Decision Doc

**Task:** 202.1 (Group 29 — Sustainable Model Exploration)
**Type:** Product-strategy scoping / decision doc (no code, no paywall, no feature flags)
**Extends:** Phase 2 task 127.1 (Free Core + No-Linking-Required value proposition audit)
**Status:** Recommendation for discussion — no commitment required

---

## Decision Summary (read this first)

Folio can explore an optional **"Folio+"** tier *without* betraying its positioning — but only
if it follows one hard rule: **Folio+ may only add brand-new, advanced, optional capabilities.
It may never gate, degrade, or slow down anything that already ships or anything in the daily
"can I afford this today?" loop.**

**Recommendation — a defensible Folio+ built from 2–4 net-new surfaces:**

1. **Advanced investing projections & scenario modeling** (net-new depth on Group 22 — 173, 172)
2. **Multi-currency travel/study-abroad convenience** (net-new depth on Group 28 — 195/196/198)
3. **Advanced reports & formatted exports** (net-new depth on Group 25 — 185; basic CSV stays free)
4. **Automation / rules depth beyond a generous free allotment** (net-new depth on Group 26)

**Explicitly rejected (must stay free forever):** the daily allowance number, one-tap logging,
history, budgets, goals basics, shared goals / household pools / parent-support tracking
(Group 21 core), basic CSV export, and every feature already shipped in Phases 1–4.

**Preferred packaging:** student-friendly price, fully optional, cancel-anytime, no dark patterns.
Strongly consider **non-subscription alternatives first** (one-time unlock, donations/"tip the
devs," .edu discounts) before defaulting to a recurring subscription.

Nothing here should be built without a follow-up spec. This doc is a compass, not a commit.

---

## 1. Context & the Non-Negotiable Promise

Folio's entire competitive moat is that it is **free, requires no bank linking, needs no setup,
carries no shame, and is student-native.** This is not marketing — it is enforced in the
architecture (see `docs/FREE-NO-LINK-VALUE-PROPOSITION.md`): there is currently zero payment
code, zero subscription types, and zero paywall gates anywhere in the codebase.

The tension this doc resolves: **a product still has real costs** (hosting, a paid FX-rate API,
future email/push infrastructure, and the maintainers' time). "Keep the lights on" is a legitimate
goal for Group 29. The question is whether there is *any* way to fund the project without eroding
the moat that makes Folio worth using.

The promise, stated as hard constraints:

- **The daily loop is free forever.** The core "can I afford this today?" number, one-tap logging,
  recent history, and the home screen are free for every user, always.
- **No bank linking is ever required.** Linking stays opt-in (`accountLinking: false` by default).
  Folio+ must never make linking feel necessary.
- **No paywall on any existing or shipped feature.** Everything live at the moment Folio+ launches
  stays free for everyone. Folio+ can only add *new* things.
- **No degradation of the free tier to make paid look better.** We never slow, cap, ad-clutter, or
  nag the free experience to drive upgrades. That is the definition of a dark pattern here.

If a proposed premium idea fails any of these, it is rejected — full stop.

---

## 2. Guiding Principles for What May Become Premium

A capability is *eligible* to be Folio+ only if it clears **all** of these gates:

1. **Net-new.** It did not exist for free before. We never take something away and re-sell it.
2. **Advanced / optional / power-user.** It deepens an existing pillar for the minority who want
   more. A student who never touches it loses nothing and never feels like a second-class user.
3. **Off the daily loop.** It lives behind Tools/Settings via progressive disclosure. The home
   screen (hero + quick log + recent + one tip) is untouched.
4. **Has a real cost or real depth justification.** Either it carries genuine operating cost
   (e.g., a paid FX API) or it represents substantial ongoing build/maintenance depth — not just
   an arbitrary lock on something cheap.
5. **The free path is still complete.** For anything premium, there must be a free way to
   accomplish the underlying student need, even if less automated or less polished.

The inverse — the **"never gate" list** — is equally important. These are free forever regardless
of tier: the daily number, one-tap logging, transaction history, budgets, goals basics, streaks,
warm tips, celebrations, basic CSV export, cash/Venmo/campus-card sources, sharing basics, and
anything already shipped.

---

## 3. Candidate Premium Surfaces (evaluated against the promise)

Each candidate is scored on: *what stays free*, *what could plausibly be Folio+*, and *the rationale*.

### 3a. Advanced Investing Projections — Group 22 (173 what-if, 172 portfolio/allocation)

- **Free (never gated):** manually logging savings/retirement balances, seeing the honest
  trajectory curve (175), the basic allocation breakdown (172 core), and a single simple
  "what if I invest $X/month" projection (173 core). Students should always be able to see where
  they stand and run one basic projection for free.
- **Could be Folio+:** *advanced* scenario modeling — side-by-side multi-scenario comparison,
  variable contribution schedules, adjustable return/inflation assumptions, retirement-readiness
  ranges, tax-advantaged-account modeling, and richer visualizations layered on the trajectory.
- **Rationale:** the everyday student need ("am I saving enough, roughly?") is met free. The
  premium layer is genuine power-user depth that a small subset wants and that costs real build
  and maintenance effort. It never touches the daily loop and never requires linking. **Strong fit.**

### 3b. Multi-currency & Study-Abroad — Group 28 (195 multi-currency, 196 locale formatting, 198 region defaults)

- **Free (never gated):** locale-aware formatting (196), region-aware defaults (198), i18n/language
  support (197), and single-currency logging for everyone. A domestic student and an international
  student using one currency both get the full free experience.
- **Could be Folio+:** the **convenience** of live multi-currency conversion — logging in a local
  currency abroad and auto-converting to a home currency using fetched, refreshed exchange rates.
  This is the one candidate with a clear recurring third-party cost (a paid/rate-limited FX API).
- **Rationale:** the *cost* justification is real and honest — refreshed FX rates cost money at
  scale. Crucially, a free manual fallback must remain: users can enter their own conversion rate
  and still log in any currency. So the free path is complete; Folio+ only buys the auto-refresh
  convenience. **Good fit, with a mandatory free manual-rate fallback.**

### 3c. Family / Household & Shared Money — Group 21 (169 shared goals, 170 household pool, 171 parent support)

- **Free (never gated):** shared goals, the roommate/household pool, parent/guardian support
  tracking, settle-up ledger, and the sharing-token flow. These are **core to the student
  demographic** — roommates splitting rent and parents sending support are central use cases, not
  luxury add-ons.
- **Could be Folio+ (only carefully, and only net-new):** possibly a *future* premium layer like
  large multi-member households beyond a generous free member count, or advanced shared analytics —
  **but only if introduced as brand-new capability with a genuinely generous free baseline.**
- **Rationale:** **Mostly rejected as a premium surface.** Shared money is too close to Folio's
  student-native identity to gate. Charging students to split rent with roommates or to let a
  parent see they're okay would directly betray the positioning. If anything premium ever appears
  here, it must be an obviously optional power feature layered on a fully-free core, and it should
  be the *last* candidate considered, not the first. **Weak fit — default to free.**

### 3d. Advanced Reports & Exports — Group 25 (185 PDF/filtered reports)

- **Free (never gated):** basic CSV export (already free and explicitly documented as
  "Free — no paywall required"), Year in Review (183), and monthly/term reviews (184).
- **Could be Folio+:** *formatted* PDF reports, advanced filtering by tag/merchant/category,
  scheduled/recurring report generation, and polished shareable report layouts.
- **Rationale:** raw data portability is a right, not a product — CSV export stays free forever so
  users are never locked in. The premium layer is presentation and convenience (formatted PDFs,
  saved filters), which is genuine added depth without withholding the underlying data.
  **Moderate fit.**

### 3e. Automation / Rules Depth — Group 26 (187 rules, 188 transfers v2, 189 IFTTT, 190 recurring detection)

- **Free (never gated):** a **generous** allotment of user-defined categorization rules, basic
  round-ups/auto-contribute, one-tap recurring-bill confirmation, and payday/overspend nudges.
  The daily loop must stay fast for free users, so the everyday automation that makes logging quick
  is free.
- **Could be Folio+:** *depth beyond the free allotment* — unlimited/complex multi-condition rules,
  advanced scheduled/triggered virtual transfers, and richer IFTTT-style automation chains.
- **Rationale:** automation that speeds the daily loop should be free (it serves the core promise).
  Only advanced, high-volume automation depth — which a small power-user segment wants — is
  eligible. The free allotment must be generous enough that a typical student never hits it.
  **Moderate fit, contingent on a genuinely generous free tier.**

---

## 4. Recommendation & Rejected Options

### Recommended Folio+ (2–4 defensible surfaces)

A coherent, non-betraying Folio+ is built from **advanced/optional depth** on pillars where the
everyday need is already met free:

1. **Advanced investing projections & scenario modeling** (3a) — clearest "power-user depth" story.
2. **Multi-currency auto-conversion for travel/study-abroad** (3b) — the one candidate with an
   honest recurring cost; must keep a free manual-rate fallback.
3. **Advanced reports & formatted exports** (3d) — presentation/convenience layer over free CSV.
4. **Automation/rules depth beyond a generous free allotment** (3e) — only if the free tier stays
   generous.

Two to three of these is enough for a defensible tier. There is no need to gate all four; fewer,
clearer premium surfaces are easier to communicate honestly.

### Explicitly Rejected (must stay free)

- The daily allowance number, one-tap logging, history, home screen — the core loop.
- Budgets, goals basics, streaks, tips, celebrations, warm copy.
- **Shared goals, household pools, and parent-support tracking (Group 21 core)** — too central to
  the student identity to gate.
- Basic CSV export and all data portability — no lock-in, ever.
- Everything already shipped in Phases 1–4 at the time any Folio+ launches.
- Bank linking is not a premium feature; it stays opt-in and free, and is never a Folio+ hook.

---

## 5. Pricing / Packaging & Alternative Models (high level, no commitment)

**Principles for any future pricing:**

- **Student-friendly.** If subscription, price it like a coffee, not like a rent line item. The
  competitor pain point is that YNAB's ~$14.99/mo is *itself* a budget problem for students.
- **Fully optional & cancel-anytime.** No trials that auto-convert, no friction to cancel, no
  "are you sure" guilt screens. Cancelling returns the user to a complete free experience.
- **No dark patterns.** No nagging, no artificial free-tier degradation, no fake urgency, no
  buried unsubscribe. The free experience is never made worse to sell the paid one.

**Alternative / complementary sustainability models — evaluate these *before* defaulting to a
subscription:**

- **One-time unlock.** Pay once, own Folio+ forever. Very student-friendly; avoids subscription
  fatigue. Best fit for features without ongoing per-user cost (e.g., advanced projections, reports).
- **Donations / "tip the devs."** A warm, no-pressure support option ("Folio is free — if it's
  helped you, you can chip in"). Complements any model and reinforces goodwill.
- **.edu discounts / free-for-students.** Verified student status could unlock Folio+ free or deeply
  discounted, funded by non-student or alumni users. Reinforces the student-first identity.
- **Cost-recovery framing for multi-currency.** Where a feature has a real per-use API cost (FX
  rates), pricing can be framed transparently as covering that cost, not as profit extraction.
- **Hybrid.** One-time unlock for static depth (projections, reports) + a small optional
  subscription only for features with genuine recurring cost (live FX). Avoid a single blanket
  subscription that bundles zero-cost features with cost-bearing ones.

No model is committed here. The recommendation is to **prefer one-time unlock and voluntary support
over recurring subscription**, and to reserve subscriptions strictly for features that carry real
ongoing cost.

---

## 6. Risks, Guardrails & Definition of Done

### Risks

- **Perception risk (biggest).** Even a well-scoped Folio+ can *feel* like a betrayal if
  communicated poorly. The narrative must be "we added optional power tools," never "we now charge."
- **Slippery slope.** Once payment infrastructure exists, there's pressure to gate more over time.
  The "never gate" list must be treated as a constitution, not a guideline.
- **Free-tier neglect.** Paid features can quietly starve free-tier investment. Guard against this
  explicitly in planning.
- **Complexity creep.** Tiering adds product surface (upgrade screens, entitlement checks) that
  could clutter the warm, simple UX. Keep it behind Settings, minimal, and calm.

### Guardrails

- Any Folio+ work requires its **own spec** and an explicit re-affirmation of the "never gate" list.
- A written **"free-first" review** for every proposed premium feature: prove the free path is still
  complete and the daily loop is untouched before building the paid layer.
- Upgrade prompts (if any) are calm, honest, single, and dismissible — consistent with the
  "quiet by default" nudge principle. No repeated nagging.
- Copy stays warm and shame-free: never imply free users are missing out or doing it wrong.

### Definition of Done (for any future paywall/Folio+ work)

A Folio+ feature is only "done" if **all** of the following hold:

1. The daily "can I afford this today?" loop is identical and fully functional for free users.
2. No previously-free or shipped feature was moved behind the paywall.
3. Bank linking is still optional and still free; it is not a Folio+ hook.
4. There is a complete free path for the underlying student need (even if less automated).
5. The free tier was not degraded, throttled, ad-cluttered, or nagged to promote the upgrade.
6. Upgrade UX is optional, calm, cancel-anytime, and free of dark patterns.
7. Copy remains warm and shame-free for both free and paid users.
8. The change is documented against this doc's "never gate" list and passed a free-first review.

If any item fails, the feature is not shipped as-is.

---

## 7. Next Steps (non-binding)

1. Socialize this doc; confirm the "never gate" list is treated as non-negotiable.
2. If pursuing sustainability, **start with voluntary support** (donations / one-time unlock)
   before any subscription — it tests willingness-to-pay without touching the moat.
3. Only if needed, spec **one** premium surface (advanced investing projections is the cleanest
   first candidate) as a proof point, with a full free-first review.
4. Revisit multi-currency pricing only when the FX-rate cost becomes a real operating expense.

Folio's advantage is trust. Any move toward sustainability must *spend zero* of that trust. The
safest path is the smallest one: keep the core free forever, add optional depth only where students
genuinely want more, and let people support the project because they want to — not because they're
cornered into it.
