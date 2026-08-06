"use client"

import { useReducedMotion as useFramerReducedMotion } from "framer-motion"
import type { Variants, Transition } from "framer-motion"

/**
 * Shared animation configuration for Folio's micro-interaction system.
 *
 * All presets and variants are pure, side-effect free constants that can be
 * imported anywhere. framer-motion animates `transform` and `opacity`, which
 * are GPU-composited, keeping interactions at 60fps.
 *
 * The `useReducedMotion` hook returns simplified, movement-free variants when
 * the user prefers reduced motion so animations degrade gracefully.
 *
 * Validates: Requirements 13.5, 15.4
 */

// ---------------------------------------------------------------------------
// Spring presets
// ---------------------------------------------------------------------------

/**
 * Spring transition presets, tuned for different interaction feels.
 * Use these for `transition` on motion components or within variants.
 */
export const springs = {
  /** Quick, controlled settle — good for taps and toggles. */
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  /** Soft, relaxed settle — good for panels and content reveals. */
  gentle: { type: "spring", stiffness: 200, damping: 24 },
  /** Playful overshoot — good for celebratory or emphasis motion. */
  bouncy: { type: "spring", stiffness: 500, damping: 15 },
} as const satisfies Record<string, Transition>

// ---------------------------------------------------------------------------
// Layout animation presets
// ---------------------------------------------------------------------------

/**
 * Spring transition tuned for Framer Motion `layout` animations.
 * Used on list items with `layout` prop so neighbors glide into place on
 * add/remove/reorder. Quick settle, no overshoot.
 */
export const layoutSpring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 0.8,
}

/**
 * Layout transition config suitable for passing to `motion.div` transition prop
 * when using `layout` or `layoutId`. Covers both layout transform and opacity.
 */
export const layoutTransition = {
  layout: layoutSpring,
  opacity: { type: "tween", duration: 0.2, ease: "easeOut" } as Transition,
}

// ---------------------------------------------------------------------------
// Timing (tween) presets
// ---------------------------------------------------------------------------

/**
 * Duration-based tween presets. Durations are expressed in seconds, matching
 * framer-motion's API (150ms => 0.15s).
 */
export const timings = {
  /** 150ms ease-out — snappy fades and small state changes. */
  fast: { type: "tween", duration: 0.15, ease: "easeOut" },
  /** 250ms ease-in-out — the default for most transitions. */
  normal: { type: "tween", duration: 0.25, ease: "easeInOut" },
  /** 400ms cubic-bezier — deliberate, smooth entrances/exits. */
  slow: { type: "tween", duration: 0.4, ease: [0.22, 1, 0.36, 1] },
} as const satisfies Record<string, Transition>

/** Per-item delay used when staggering list children, in seconds (40ms). */
export const STAGGER_STEP = 0.04

/** Distance (px) content slides up on entrance for lists and page content. */
export const SLIDE_DISTANCE = 12

// ---------------------------------------------------------------------------
// Stagger variants for lists
// ---------------------------------------------------------------------------

/**
 * Container variants that orchestrate a staggered reveal of children.
 * Pair with `listItemVariants` on each child. Each item is delayed by
 * {@link STAGGER_STEP} (40ms) producing a fade + slide-up cascade.
 */
export const listContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_STEP,
      delayChildren: 0,
    },
  },
  exit: {
    transition: {
      staggerChildren: STAGGER_STEP / 2,
      staggerDirection: -1,
    },
  },
}

/** Child variants for staggered lists: fade in while sliding up. */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: SLIDE_DISTANCE },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, y: SLIDE_DISTANCE / 2, transition: timings.fast },
}

// ---------------------------------------------------------------------------
// Button interaction variants
// ---------------------------------------------------------------------------

/**
 * Button press feedback: scale down to 0.96 while pressed, then return with a
 * bouncy overshoot on release. Use with `variants`, `whileTap="pressed"`, and
 * `animate="rest"` (or drive the states directly via `whileTap`/`whileHover`).
 */
export const buttonVariants: Variants = {
  rest: { scale: 1, transition: springs.bouncy },
  pressed: { scale: 0.96, transition: springs.snappy },
}

// ---------------------------------------------------------------------------
// Page / content transition variants
// ---------------------------------------------------------------------------

/**
 * Page-level transition: content fades in and slides up on mount, and
 * reverses (fade out + slide down) on exit. Use with `AnimatePresence`.
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: SLIDE_DISTANCE },
  enter: { opacity: 1, y: 0, transition: timings.slow },
  exit: { opacity: 0, y: SLIDE_DISTANCE, transition: timings.normal },
}

// ---------------------------------------------------------------------------
// Reduced-motion variants
// ---------------------------------------------------------------------------

/**
 * Movement-free counterparts of the standard variants. These keep opacity
 * cross-fades (which read as calm, not motion) but remove translation, scale,
 * and springy overshoot so the experience respects reduced-motion preferences.
 */
const reducedListContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
  exit: { transition: { staggerChildren: 0 } },
}

const reducedListItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.fast },
}

const reducedButtonVariants: Variants = {
  rest: { scale: 1 },
  pressed: { scale: 1 },
}

const reducedPageVariants: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.fast },
}

// ---------------------------------------------------------------------------
// Home-screen entrance choreography (Task 240.1)
// ---------------------------------------------------------------------------

/**
 * Parent container orchestrates a sequential reveal of major sections on the
 * home screen: hero settles first, then quick actions float up, then recent/tip
 * slide in — with a small (~40ms) stagger between children.
 */
export const homeContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_STEP,
      delayChildren: 0.05,
    },
  },
}

/** Child variants for home screen sections: fade in + slide up (gentle). */
export const homeSectionVariants: Variants = {
  hidden: { opacity: 0, y: SLIDE_DISTANCE },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
}

/** Reduced-motion home container: no stagger, instant reveal. */
const reducedHomeContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
}

/** Reduced-motion home section: opacity-only fade, no translation. */
const reducedHomeSectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: timings.fast },
}

// ---------------------------------------------------------------------------
// Directional nav-screen transitions (Task 242.1)
// ---------------------------------------------------------------------------

/** Ordered index for nav screens used to compute transition direction. */
export const NAV_ORDER: Record<string, number> = {
  home: 0,
  history: 1,
  tools: 2,
  settings: 3,
}

/**
 * Slide distance (px) for directional nav transitions. Subtle enough to feel
 * quick but perceptible enough to communicate spatial relationship.
 */
const NAV_SLIDE_DISTANCE = 40

/**
 * Nav screen variants that accept a `custom` direction value (-1 = left, +1 = right).
 * Combine a short horizontal slide with an opacity crossfade for a polished,
 * directional screen switch. GPU-composited (x + opacity only).
 */
export const navScreenVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction * NAV_SLIDE_DISTANCE,
  }),
  enter: {
    opacity: 1,
    x: 0,
    transition: { type: "tween", duration: 0.22, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -NAV_SLIDE_DISTANCE * 0.5,
    transition: { type: "tween", duration: 0.15, ease: "easeIn" },
  }),
}

/** Reduced-motion nav variants: opacity-only crossfade, no translation. */
export const navScreenVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.fast },
}

// ---------------------------------------------------------------------------
// Polished bottom-sheet spring (Task 242.2)
// ---------------------------------------------------------------------------

/**
 * Sheet spring tuned for a native-feeling open/close with slight liveliness.
 * Lower damping than the previous critically-damped value gives a touch of
 * settle without visible overshoot.
 */
export const sheetSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 36,
}

// ---------------------------------------------------------------------------
// Max-stagger cap for list-heavy screens (Task 240.2)
// ---------------------------------------------------------------------------

/**
 * Maximum number of items that receive individual stagger delays.
 * Items beyond this index animate in at the same time as the last staggered
 * item, preventing long lists from feeling sluggish.
 */
export const MAX_STAGGER_ITEMS = 12

/** The full set of reusable variants exposed by {@link useReducedMotion}. */
export interface MotionVariants {
  listContainer: Variants
  listItem: Variants
  button: Variants
  page: Variants
  homeContainer: Variants
  homeSection: Variants
}

/** Return shape of the {@link useReducedMotion} hook. */
export interface ReducedMotionResult extends MotionVariants {
  /** True when the user has requested reduced motion. */
  prefersReducedMotion: boolean
}

const fullVariants: MotionVariants = {
  listContainer: listContainerVariants,
  listItem: listItemVariants,
  button: buttonVariants,
  page: pageVariants,
  homeContainer: homeContainerVariants,
  homeSection: homeSectionVariants,
}

const reducedVariants: MotionVariants = {
  listContainer: reducedListContainerVariants,
  listItem: reducedListItemVariants,
  button: reducedButtonVariants,
  page: reducedPageVariants,
  homeContainer: reducedHomeContainerVariants,
  homeSection: reducedHomeSectionVariants,
}

/**
 * Returns the appropriate variant set based on the user's motion preference.
 *
 * When `prefers-reduced-motion: reduce` is active, this returns simplified
 * variants that avoid translation, scale, and springy motion — keeping only
 * gentle opacity fades. Otherwise it returns the full expressive variants.
 *
 * Wraps framer-motion's own `useReducedMotion`, which reads and subscribes to
 * the `prefers-reduced-motion` media query.
 *
 * Validates: Requirements 13.5, 15.4
 */
export function useReducedMotion(): ReducedMotionResult {
  const prefersReducedMotion = useFramerReducedMotion() ?? false
  const variants = prefersReducedMotion ? reducedVariants : fullVariants
  return { prefersReducedMotion, ...variants }
}
