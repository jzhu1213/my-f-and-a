# Folio Development Guidelines

## Project Context

Folio is a personal finance app for college students and young adults. The product direction is to simplify the app into a warm, friendly experience centered around one core question:

> “Can I afford this today?”

Folio should not try to win by having the most features or the most advanced financial dashboard. Its advantage should come from being simpler, more flexible, and more personally relevant than traditional budgeting tools.

The app should prioritize:
- Simplicity: a clear, low-friction interface that is easy to understand immediately
- Flexibility: features that adapt to common everyday needs and individual user patterns
- Tailoring: an experience designed around the financial lives, habits, and expectations of college students and young adults
- Warmth: friendly, non-judgmental guidance that lowers the barrier to consistent use

The simplified experience should center on:
- A single Daily Allowance number
- Fast expense logging
- Warm visual design
- Flexible defaults that can adapt over time
- Progressive disclosure for advanced finance tools
- Reliable Supabase-backed persistence
- Smooth Vercel deployment

## Product Differentiators

### 1. Simplicity as the Main Advantage

Many finance apps already provide budgeting, expense tracking, and insights. Folio should differentiate by making those capabilities feel easier, faster, and less intimidating.

When choosing between a powerful but complex interaction and a simpler interaction that solves the core need, prefer the simpler interaction.

The ideal user experience should feel like:
- Open the app
- Understand today’s spending room
- Log something quickly if needed
- Leave without feeling overwhelmed

### 2. Flexible Functionality

Folio should support structure without feeling rigid.

Users should be able to rely on helpful defaults, but the app should also adapt to different spending patterns, income rhythms, habits, and personal preferences.

Prefer flexible systems over hardcoded assumptions.

Examples of flexible design patterns:
- Smart defaults that can be changed
- Suggestions based on user behavior
- Categories and budgets that can evolve
- Optional detail views instead of mandatory setup
- Interfaces that work for both consistent and irregular usage

Avoid building features that only work well for one narrow financial pattern unless the task explicitly requires it.

### 3. Tailoring for Students and Young Adults

Folio should feel like it understands the financial stage of college students and young adults without requiring them to become finance experts.

The product should assume users may have:
- Variable income
- Limited time
- Small frequent purchases
- Occasional larger obligations
- Changing priorities
- A preference for simple guidance over detailed financial analysis

This audience should feel that Folio is approachable, relevant, and easy to start using.

Do not over-professionalize the product. Avoid making the app feel like a corporate accounting tool, investment dashboard, or advanced budgeting spreadsheet.

### 4. Lowering the Barrier to Entry

Every major feature should reduce friction rather than add setup burden.

Prefer:
- Quick starts
- Sensible defaults
- Optional configuration
- Inline guidance
- Gradual personalization
- One-tap or low-tap flows

Avoid:
- Long required setup flows
- Dense forms
- Financial jargon
- Overly precise configuration before the user sees value
- Features that require users to already understand budgeting concepts

## Product Principles

### 1. Radical Simplicity

Prefer fewer screens, fewer visible controls, and fewer visible calculations.

Users should be able to understand their financial status in under one second. If a feature adds cognitive load, hide it behind progressive disclosure or move it to settings, history, or a secondary surface.

Simplicity should be treated as a product feature, not a lack of functionality.

### 2. Flexible by Default

Folio should provide structure without forcing every user into the same pattern.

Features should work well for common use cases while still adapting to personal habits and changing circumstances.

Prefer:
- Configurable defaults
- Behavior-based suggestions
- Optional customization
- Graceful fallbacks
- Interfaces that still work with incomplete data

Avoid rigid assumptions that make the app useful only for one type of budget, income pattern, or spending behavior.

### 3. Tailored, Not Generic

Folio should feel intentionally designed for students and young adults.

The app should use language, flows, and defaults that feel relevant to users who are building financial habits, not users who already manage complex finances.

Tailoring should show up through:
- Friendly onboarding
- Simple daily guidance
- Relevant spending categories
- Encouraging copy
- Low-pressure education
- Fast everyday interactions

### 4. Warmth Over Brutalism

The app should feel welcoming, encouraging, and calm.

Avoid harsh, intimidating UI unless preserving it as an intentional alternate dark mode. Prefer soft contrast, rounded surfaces, friendly copy, and positive reinforcement.

### 5. Daily Allowance First

The Daily Allowance is the core product concept.

All budgeting, transaction, onboarding, and UI decisions should support the user’s ability to quickly answer whether they can afford something today.

### 6. One-Tap Logging

Expense logging should feel effortless.

Prioritize smart defaults, common amounts, category shortcuts, optimistic UI updates, and minimal required input.

### 7. Progressive Disclosure

Advanced tools such as detailed budgets, goals, insights, and full transaction history should remain accessible but should not dominate the primary experience.

## Product Decision Filter

When adding or changing a feature, evaluate it against these questions:

1. Does this make the app simpler to use?
2. Does this preserve or improve flexibility for different user needs?
3. Does this feel tailored to students and young adults?
4. Does this support the Daily Allowance-centered experience?
5. Does this reduce friction or add friction?
6. Can the user get value without completing a long setup process?
7. Is advanced detail hidden until the user asks for it?

If a change makes the app more powerful but less simple, prefer the simpler version unless the task explicitly requires the extra complexity.

## Technical Stack

This project uses:
- Next.js App Router
- React
- TypeScript
- Supabase
- Vercel
- Tailwind CSS
- framer-motion for motion
- canvas-confetti for celebrations
- Radix primitives where accessible overlays/dialogs are needed
- Vitest / fast-check only where tests already exist or when explicitly requested

## Implementation Standards

### TypeScript

Use strict, explicit types for shared data models and utility function inputs/outputs.

Prefer reusable interfaces and exported types from the shared types module. Avoid `any` unless there is no reasonable alternative.

### React Components

Components should be:
- Small and focused
- Typed with explicit props interfaces
- Accessible by default
- Mobile-first
- Easy to reuse inside the simplified app flow

Prefer clear prop names over clever abstractions.

### Utility Functions

Business logic should live in pure utility functions where possible.

Examples:
- Daily allowance calculation
- Smart suggestions
- Tip selection
- Celebration eligibility
- Transaction validation
- Amount and note sanitization

Pure functions should avoid side effects and should be easy to validate independently.

### State Management

Keep state local unless it is shared across multiple parts of the app.

Use React context only for app-wide concerns such as auth, theme, toast notifications, or global user/session state.

Avoid introducing new global state libraries or architectural patterns unless the task clearly requires them.

## Styling Guidelines

Use the warm design system as the default visual direction.

Prefer:
- Soft dark purple backgrounds
- Rounded cards and buttons
- Inter font
- Friendly semantic colors
- Clear visual hierarchy
- Large readable financial numbers
- Spacious mobile-first layouts

Avoid:
- Pure black as the default primary background
- Monospace body text
- Tiny labels for important values
- Dense dashboards
- Excessive visual noise
- Shame-based warning states

## Supabase Guidelines

Supabase is the source of truth for persisted user data.

When working with Supabase:
- Never hardcode project URLs, anon keys, service-role keys, or secrets
- Use environment variables for configuration
- Only expose `NEXT_PUBLIC_` variables when they are safe for the browser
- Do not use service-role credentials in frontend code
- Keep optimistic UI updates reversible when persistence fails
- Handle offline/network failures gracefully
- Do not modify production data unless explicitly instructed

Required public environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never commit:
- Supabase service-role keys
- Local `.env` files
- Real user data
- Production secrets
- Personal access tokens

## Vercel Deployment Guidelines

Before pushing or deploying, verify:
- Environment variables are configured in Vercel
- The app builds successfully
- TypeScript checks pass
- No local-only files or secrets are committed
- `.env.local` is ignored
- Generated build folders are ignored

Do not commit:
- `.env`
- `.env.local`
- `.next`
- `node_modules`
- local secrets
- personal machine-specific config
- temporary debug files

## Git Guidelines

Before pushing:
- Check `git status`
- Review changed files
- Avoid committing secrets or local-only files
- Use clear commit messages

Preferred commit message style:
- `Add daily allowance calculation`
- `Simplify theme system`
- `Build quick log component`
- `Update Supabase transaction persistence`
- `Wire simplified home screen`

Do not force push unless explicitly approved by the user.

When reconnecting or merging with GitHub, prefer preserving remote history unless the user explicitly asks to overwrite it.

## Testing and Validation Policy

Do not create new tests unless explicitly requested.

This includes:
- Unit tests
- Integration tests
- Property-based tests
- Accessibility tests
- Performance tests
- Snapshot tests

Existing tests may still be run when useful for validation.

Even when new test creation is not requested, validation is still required after meaningful code changes.

Preferred validation order:
1. Type check
2. Build check
3. Existing targeted tests, if relevant
4. Manual smoke check

Use:
```bash
npm run typecheck
npm run build
npm run test:run
```

If a full validation is too expensive or blocked, run the most targeted check available and explain what was not verified.

## UX Copy Guidelines

Copy should be:
- Encouraging
- Short
- Human
- Non-judgmental
- Actionable when needed

Avoid shame-based language like:
- “You failed”
- “Bad spending”
- “You overspent again”
- “You made a mistake”

Prefer:
- “A little tight today — tomorrow resets.”
- “You’re still on track.”
- “Nice, you’ve got room left today.”
- “Heads up, you’re close to today’s limit.”
- “No stress — let’s keep it simple.”

## Accessibility Guidelines

All interactive elements should support:
- Clear labels
- Keyboard access where applicable
- Sufficient color contrast
- Reduced motion preferences
- Scalable text
- Screen-reader friendly labels for financial values and actions

Celebrations and animations must respect reduced motion settings.

## Performance Guidelines

The home screen should feel instant.

Prioritize:
- Memoized daily allowance calculations
- Smart suggestion calculation only after category selection
- Lazy loading for heavy animation components
- Avoiding unnecessary re-renders
- Keeping initial bundle size reasonable
- Avoiding expensive calculations during initial render

## Current Implementation Priorities

Focus implementation in this order:
1. Finish the Daily Allowance calculation utilities
2. Build the simplified home experience
3. Add quick logging and smart suggestions
4. Add reliable transaction persistence
5. Add tips and celebrations
6. Add onboarding
7. Integrate everything into the main app route
8. Polish accessibility, performance, and deployment readiness

## Agent Behavior Preferences

When working on this project:

- Follow the active implementation task list
- Keep changes focused to the current task
- Do not introduce unrelated refactors
- Prefer minimal, production-safe implementations
- Preserve existing working functionality unless the task explicitly replaces it
- Protect simplicity as a core product requirement
- Prefer flexible defaults over rigid hardcoded behavior
- Tailor UX decisions toward students and young adults
- Avoid making the app feel like an advanced finance dashboard
- Do not create new test files unless explicitly asked
- Validate changes before reporting completion
- Ask before making destructive Git, deployment, backend, or production data changes
- Do not modify Supabase production data unless explicitly instructed
- Do not expose secrets in code, logs, commits, examples, or documentation
- Prefer clear, maintainable code over clever abstractions
- Keep the user experience simple, warm, flexible, and fast
