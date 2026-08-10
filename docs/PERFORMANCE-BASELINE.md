# Performance Baseline

> Recorded before the first Redesign Phase (Phase 9+) as required by Requirement 19.9.
> This file is the single reference value for the Performance Gate (Requirements 19.5 and 19.8).

## Home Surface Route (`/`) — First Load JavaScript Payload

| Metric | Value | Date Recorded | Build Tool |
|--------|-------|---------------|------------|
| First Load JS (/) | **383 kB** | 2025-07-18 | Next.js 14.2.35 |
| Route-specific size | 184 kB | 2025-07-18 | Next.js 14.2.35 |
| Shared JS (all routes) | 88.2 kB | 2025-07-18 | Next.js 14.2.35 |

## Performance Gate Threshold

Per Requirement 19.5, the post-redesign first-load JavaScript payload for the Home Surface
route must not exceed **110% of the baseline**:

- **Baseline:** 383 kB
- **Maximum allowed:** 421.3 kB (383 × 1.10)

## How This Was Measured

1. Ran `npm run build` (which executes `next build`)
2. Read the "First Load JS" column for the `/` route from the build output
3. Build environment: Next.js 14.2.35, Node.js, production mode

## Notes

- "First Load JS" includes route-specific code (184 kB) plus shared chunks (88.2 kB)
  and represents the total JavaScript a browser must download and parse on first navigation
  to the Home Surface route.
- This baseline was recorded against the current codebase state before any design overhaul
  phases were applied.
- Per Requirement 19.8, any new visual asset, icon set, or animation runtime introduced
  must have its payload impact recorded in kilobytes relative to this baseline.
