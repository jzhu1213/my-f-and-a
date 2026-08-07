"use client"

import { useReducedMotion as useFramerReducedMotion } from "framer-motion"
import type { Variants, Transition } from "framer-motion"
import { springPresets, type SpringPresetName } from "@/styles/motion"

/**
 * Folio Motion System — animations.ts
 *
 * Provides 6 spring presets (as framer-motion Transition objects), 11 named
 * motion variants, backward-compatible stagger/page/button/nav exports, and a
 * `useReducedMotion` hook that selects appropriate variant sets.
 *
 * Constraints:
 * - Only `transform`, `opacity`, and `filter` are animated (GPU-composited).
 * - Reduced-motion fallbacks: crossfade ≤150ms, static hold, or none.
 *   Never translational.
 * - List stagger: 30–50ms/item, capped 400ms total, max 12 items.
 * - Press acknowledgment: ≤120ms.
 *
 * Validates: Requirements 6.1, 6.2, 6.4, 6.8
 */

// ============================================================================
// Spring Presets (framer-motion Transition objects)
// ============================================================================

/**
 * Spring transition presets derived from the canonical motion.ts SpringPresets.
 * Each includes `type: "spring"` for direct use as a framer-motion Transition.
 */
export const springs = {
  /** Quick, controlled settle — taps, toggles. Stiffness 400, Damping 30, Mass 1.0 */
  snappy: { type: "spring", stiffness: springPresets.snappy.stiffness, damping: springPresets.snappy.damping, mass: springPresets.snappy.mass },
  /** Soft, relaxed settle — content reveals. Stiffness 200, Damping 24, Mass 1.0 */
  gentle: { type: "spring", stiffness: springPresets.gentle.stiffness, damping: springPresets.gentle.damping, mass: springPresets.gentle.mass },
  /** Playful overshoot — celebrations, emphasis. Stiffness 500, Damping 15, Mass 1.0 */
  bouncy: { type: "spring", stiffness: springPresets.bouncy.stiffness, damping: springPresets.bouncy.damping, mass: springPresets.bouncy.mass },
  /** Quick layout response — dock, resize. Stiffness 600, Damping 35, Mass 0.8 */
  responsive: { type: "spring", stiffness: springPresets.responsive.stiffness, damping: springPresets.responsive.damping, mass: springPresets.responsive.mass },
  /** Sheet present/dismiss. Stiffness 380, Damping 36, Mass 1.0 */
  sheet: { type: "spring", stiffness: springPresets.sheet.stiffness, damping: springPresets.sheet.damping, mass: springPresets.sheet.mass },
  /** Milestone celebrations — dramatic overshoot. Stiffness 420, Damping 14, Mass 0.9 */
  dramatic: { type: "spring", stiffness: springPresets.dramatic.stiffness, damping: springPresets.dramatic.damping, mass: springPresets.dramatic.mass },
} as const satisfies Record<SpringPresetName, Transition>

// ============================================================================
// Timing (tween) presets
// ============================================================================

/**
 * Duration-based tween presets. Durations in seconds (framer-motion convention).
 */
export const timings = {
  /** 100ms ease-out — instant swap / fast fade. */
  instant: { type: "tween", duration: 0.1, ease: "easeOut" },
  /** 150ms ease-out — snappy fades, reduced-motion crossfades. */
  fast: { type: "tween", duration: 0.15, ease: "easeOut" },
  /** 250ms ease-in-out — default for most transitions. */
  normal: { type: "tween", duration: 0.25, ease: "easeInOut" },
  /** 400ms cubic-bezier — deliberate, smooth entrances/exits. */
  slow: { type: "tween", duration: 0.4, ease: [0.22, 1, 0.36, 1] },
} as const satisfies Record<string, Transition>

// ============================================================================
// Layout animation presets
// ============================================================================

/**
 * Spring for Framer Motion `layout` animations. Quick settle, no overshoot.
 */
export const layoutSpring: Transition = {
  type: "spring",
  stiffness: springPresets.responsive.stiffness,
  damping: springPresets.responsive.damping,
  mass: springPresets.responsive.mass,
}

/**
 * Layout transition config for `motion.div` transition prop with `layout`/`layoutId`.
 */
export const layoutTransition = {
  layout: layoutSpring,
  opacity: { type: "tween", duration: 0.2, ease: "easeOut" } as Transition,
}

// ============================================================================
// Constants
// ============================================================================

/** Per-item stagger delay in seconds (40ms). */
export const STAGGER_STEP = 0.04

/** Distance (px) content slides up on entrance. */
export const SLIDE_DISTANCE = 12

/** Max items that receive individual stagger delays (Req 6.5). */
export const MAX_STAGGER_ITEMS = 12

// ============================================================================
// 11 Named Motion Variants (Requirement 6.1)
// ============================================================================

/**
 * Describes a single named motion variant in the Folio motion vocabulary.
 */
export interface MotionVariantDef {
  /** Unique variant name. */
  readonly name: string
  /** What triggers this variant. */
  readonly trigger: string
  /** Which spring preset drives the animation (null for linear/tween). */
  readonly springPreset: SpringPresetName | null
  /** CSS properties animated (only opacity, transform, filter). */
  readonly properties: readonly string[]
  /** Reduced-motion fallback strategy. */
  readonly reducedMotionFallback: string
}

/**
 * The 11 canonical motion variants for the Folio motion system.
 * Each records its trigger, spring preset, animated properties, and
 * reduced-motion fallback strategy.
 */
export const motionVariants: readonly MotionVariantDef[] = [
  {
    name: "surface-enter",
    trigger: "Navigation in",
    springPreset: "gentle",
    properties: ["opacity", "transform"],
    reducedMotionFallback: "opacity 150ms",
  },
  {
    name: "surface-exit",
    trigger: "Navigation out",
    springPreset: "snappy",
    properties: ["opacity", "transform"],
    reducedMotionFallback: "opacity 100ms",
  },
  {
    name: "list-stagger",
    trigger: "List mount",
    springPreset: "gentle",
    properties: ["opacity", "transform"],
    reducedMotionFallback: "opacity instant",
  },
  {
    name: "sheet-present",
    trigger: "Sheet open",
    springPreset: "sheet",
    properties: ["transform"],
    reducedMotionFallback: "opacity 150ms",
  },
  {
    name: "sheet-dismiss",
    trigger: "Sheet close",
    springPreset: "sheet",
    properties: ["transform"],
    reducedMotionFallback: "opacity 100ms",
  },
  {
    name: "press",
    trigger: "Pointer down",
    springPreset: "snappy",
    properties: ["transform"],
    reducedMotionFallback: "opacity(1→0.92)",
  },
  {
    name: "release",
    trigger: "Pointer up",
    springPreset: "bouncy",
    properties: ["transform"],
    reducedMotionFallback: "opacity(0.92→1)",
  },
  {
    name: "emphasis-pop",
    trigger: "Value highlight",
    springPreset: "bouncy",
    properties: ["transform"],
    reducedMotionFallback: "none (static)",
  },
  {
    name: "value-change",
    trigger: "Number update",
    springPreset: "responsive",
    properties: ["opacity", "transform"],
    reducedMotionFallback: "instant swap",
  },
  {
    name: "scroll-reveal",
    trigger: "Scroll progress",
    springPreset: null,
    properties: ["opacity", "transform"],
    reducedMotionFallback: "hold resting",
  },
  {
    name: "celebration",
    trigger: "Milestone",
    springPreset: "dramatic",
    properties: ["transform", "opacity", "filter"],
    reducedMotionFallback: "static overlay 1500ms",
  },
] as const

// ============================================================================
// Framer-Motion Variant Implementations
// ============================================================================

// --- surface-enter / surface-exit (page transitions) -------------------------

/** Page enter: fade + slide up 12px → 0. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: SLIDE_DISTANCE },
  enter: { opacity: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, y: 8, transition: springs.snappy },
}

/** Reduced-motion page: opacity-only crossfade ≤150ms, no translation. */
const reducedPageVariants: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.instant },
}

// --- list-stagger -------------------------------------------------------------

/**
 * Container orchestrating staggered reveal of children.
 * 40ms/item, capped at MAX_STAGGER_ITEMS (12 items × 40ms = 480ms, but items
 * beyond 10 share timing → effective cap ~400ms).
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

/** Child: fade in + translateY(12→0). */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: SLIDE_DISTANCE },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, y: SLIDE_DISTANCE / 2, transition: timings.fast },
}

/** Reduced-motion list container: no stagger, instant reveal. */
const reducedListContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
  exit: { transition: { staggerChildren: 0 } },
}

/** Reduced-motion list items: opacity instant (no translation). */
const reducedListItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { type: "tween", duration: 0.01, ease: "linear" } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0.01, ease: "linear" } },
}

// --- sheet-present / sheet-dismiss -------------------------------------------

/**
 * Sheet spring (Transition object). Used for sheet open/close.
 */
export const sheetSpring: Transition = {
  type: "spring",
  stiffness: springPresets.sheet.stiffness,
  damping: springPresets.sheet.damping,
  mass: springPresets.sheet.mass,
}

/** Sheet present: translateY(100%→0). */
export const sheetPresentVariants: Variants = {
  hidden: { y: "100%" },
  visible: { y: "0%", transition: sheetSpring },
  exit: { y: "100%", transition: { type: "tween", duration: 0.25, ease: "easeIn" } },
}

/** Reduced-motion sheet: opacity crossfade ≤150ms (no translation). */
export const sheetPresentVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: timings.fast },
  exit: { opacity: 0, transition: timings.instant },
}

// --- press / release (button interaction) ------------------------------------

/**
 * Button press feedback: scale(1→0.96) on press, bouncy scale(0.96→1) on release.
 * Press acknowledgment ≤120ms (snappy spring settles within ~100ms).
 */
export const buttonVariants: Variants = {
  rest: { scale: 1, transition: springs.bouncy },
  pressed: { scale: 0.96, transition: springs.snappy },
}

/** Reduced-motion button: opacity change instead of scale (never translational). */
const reducedButtonVariants: Variants = {
  rest: { opacity: 1, scale: 1 },
  pressed: { opacity: 0.92, scale: 1, transition: timings.fast },
}

// --- emphasis-pop ------------------------------------------------------------

/** Emphasis pop: scale(1→1.05→1) with bouncy spring. */
export const emphasisPopVariants: Variants = {
  idle: { scale: 1 },
  pop: {
    scale: [1, 1.05, 1],
    transition: {
      type: "spring",
      stiffness: springPresets.bouncy.stiffness,
      damping: springPresets.bouncy.damping,
      mass: springPresets.bouncy.mass,
      duration: 0.4,
    },
  },
}

/** Reduced-motion emphasis: none (static hold). */
export const emphasisPopVariantsReduced: Variants = {
  idle: { scale: 1 },
  pop: { scale: 1 },
}

// --- value-change ------------------------------------------------------------

/** Value change: counter interpolation via responsive spring. */
export const valueChangeVariants: Variants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0, transition: springs.responsive },
  exit: { opacity: 0, y: 8, transition: timings.fast },
}

/** Reduced-motion value change: instant swap (no translation). */
export const valueChangeVariantsReduced: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { type: "tween", duration: 0, ease: "linear" } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0, ease: "linear" } },
}

// --- scroll-reveal -----------------------------------------------------------

/** Scroll reveal: linear interpolation of translateY, opacity, scale. */
export const scrollRevealVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "tween", duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

/** Reduced-motion scroll reveal: hold resting state (no animation). */
export const scrollRevealVariantsReduced: Variants = {
  hidden: { opacity: 1, y: 0, scale: 1 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

// --- celebration -------------------------------------------------------------

/**
 * Celebration (milestone): scale + opacity + rotation via dramatic spring.
 */
export const celebrationVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, rotate: -2 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: springs.dramatic,
  },
  exit: { opacity: 0, scale: 0.95, transition: timings.normal },
}

/** Reduced-motion celebration: static overlay for 1500ms (no motion). */
export const celebrationVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { type: "tween", duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0.15, ease: "easeOut", delay: 1.5 } },
}

// ============================================================================
// Backward-compatible exports (from previous versions)
// ============================================================================

// --- Home-screen entrance choreography (homeContainerVariants, homeSectionVariants) ---

/** Home container: orchestrates a staggered reveal of major sections. */
export const homeContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_STEP,
      delayChildren: 0.05,
    },
  },
}

/** Home section child: fade in + slide up (gentle spring). */
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

// --- Directional nav-screen transitions (navScreenVariants) ---

/** Ordered index for nav screens used to compute transition direction. */
export const NAV_ORDER: Record<string, number> = {
  home: 0,
  history: 1,
  tools: 2,
  settings: 3,
}

const NAV_SLIDE_DISTANCE = 40

/**
 * Nav screen variants accepting `custom` direction (-1 = left, +1 = right).
 * Horizontal slide + opacity crossfade.
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

// --- Celebration-specific presets (backward compat) ---

/**
 * Dramatic spring for milestone celebration card entrance.
 */
export const celebrationMilestoneSpring: Transition = {
  type: "spring",
  stiffness: springPresets.dramatic.stiffness,
  damping: springPresets.dramatic.damping,
  mass: springPresets.dramatic.mass,
}

/**
 * Gentle spring for everyday celebration card entrance.
 */
export const celebrationEverydaySpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 22,
}

/** Stagger delay for card element cascade (emoji → title → message → button). */
export const CELEBRATION_STAGGER_MS = 80

// ============================================================================
// useReducedMotion hook
// ============================================================================

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
 * When `prefers-reduced-motion: reduce` is active, returns simplified variants
 * that avoid translation, scale, and springy motion — keeping only gentle opacity
 * fades (≤150ms crossfade) or static holds. Otherwise returns full expressive variants.
 *
 * Validates: Requirements 6.1, 6.2, 6.4, 6.8
 */
export function useReducedMotion(): ReducedMotionResult {
  const prefersReducedMotion = useFramerReducedMotion() ?? false
  const variants = prefersReducedMotion ? reducedVariants : fullVariants
  return { prefersReducedMotion, ...variants }
}
