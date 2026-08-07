/**
 * Transition System — Shared-element choreography for Folio.
 *
 * Provides transition configurations for navigating between surfaces,
 * presenting sheets, and coordinating shared-element continuity. All
 * transitions drive only `transform`, `opacity`, and `filter` — never
 * layout or paint properties.
 *
 * Components consume these configs via framer-motion's `AnimatePresence`,
 * `motion` components, and `variants` props. The actual animation execution
 * is handled by framer-motion; this module provides the choreography.
 *
 * Validates: Requirements 8.1, 8.2, 8.4, 8.5, 8.7
 */

import type { Transition, Variants } from "framer-motion"

import { springPresets } from "@/styles/motion"
import { NAV_ORDER } from "@/lib/animations"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for a shared-element transition that carries container
 * bounds from origin to destination.
 */
export interface SharedElementTransitionConfig {
  /** Spring transition for the container transform. */
  readonly spring: Transition
  /** Duration range (ms) for the continuous transform. */
  readonly durationRange: readonly [min: number, max: number]
  /** Maximum allowed jump between consecutive frames (px). */
  readonly maxFrameJump: number
}

/**
 * Configuration for child stagger on surface entry.
 * Container settles first, then children stagger in.
 */
export interface ChildStaggerConfig {
  /** Delay between successive children (seconds). */
  readonly staggerStep: number
  /** Maximum total stagger duration (seconds). */
  readonly maxTotalDuration: number
  /** Delay before first child starts (seconds), allows container to settle. */
  readonly delayChildren: number
  /** Transition applied to each child element. */
  readonly childTransition: Transition
}

/**
 * Configuration for directional navigation transitions.
 * Direction is derived from dock order (NAV_ORDER).
 */
export interface DirectionalTransitionConfig {
  /** Travel distance as fraction of viewport width [min, max]. */
  readonly travelRange: readonly [min: number, max: number]
  /** Resolved travel distance as fraction of viewport width. */
  readonly travel: number
  /** Duration for the directional crossfade (seconds). */
  readonly duration: number
  /** Easing curve for the directional slide. */
  readonly ease: readonly [number, number, number, number]
}

/**
 * Configuration for sheet presentation choreography.
 * Backdrop, sheet, and underlying surface animate together.
 */
export interface SheetPresentationConfig {
  /** Spring for the sheet's upward movement. */
  readonly sheetSpring: Transition
  /** Duration range for the full presentation (ms). */
  readonly durationRange: readonly [min: number, max: number]
  /** Backdrop blur value at full presentation. */
  readonly backdropBlur: string
  /** Backdrop dim opacity at full presentation. */
  readonly backdropDimOpacity: number
  /** Scale factor range for the underlying surface [min, max]. */
  readonly underlyingScaleRange: readonly [min: number, max: number]
  /** Resolved underlying surface scale (0.96–0.98 = 2–4% scale-down). */
  readonly underlyingScale: number
  /** Transition for backdrop blur and dim. */
  readonly backdropTransition: Transition
  /** Transition for underlying surface scale. */
  readonly underlyingTransition: Transition
}

/**
 * How the transition system handles interruptions.
 */
export interface InterruptionPolicy {
  /** Continue from current in-flight values (no reset). */
  readonly continueFromCurrent: true
  /** Maximum time to complete redirected transition (ms). */
  readonly maxRedirectDuration: number
}

/**
 * A destination identifier matching NAV_ORDER keys.
 */
export type NavDestination = keyof typeof NAV_ORDER

// ---------------------------------------------------------------------------
// Transition Configs
// ---------------------------------------------------------------------------

/**
 * Shared-element transition: carries container bounds from origin to
 * destination via a single continuous transform over 200–400ms.
 *
 * Validates: Requirement 8.1
 */
export const sharedElementConfig: SharedElementTransitionConfig = {
  spring: {
    type: "spring",
    stiffness: springPresets.responsive.stiffness,
    damping: springPresets.responsive.damping,
    mass: springPresets.responsive.mass,
  },
  durationRange: [200, 400],
  maxFrameJump: 4,
}

/**
 * Child stagger configuration: container settles first, then children
 * stagger at 20–40ms each, capped at 200ms total.
 *
 * Validates: Requirement 8.2
 */
export const childStaggerConfig: ChildStaggerConfig = {
  staggerStep: 0.03, // 30ms — middle of 20–40ms range
  maxTotalDuration: 0.2, // 200ms cap
  delayChildren: 0.08, // 80ms — middle of 60–120ms range, lets container settle
  childTransition: {
    type: "spring",
    stiffness: springPresets.gentle.stiffness,
    damping: springPresets.gentle.damping,
    mass: springPresets.gentle.mass,
  },
}

/**
 * Directional navigation transition: forward arrives from trailing edge,
 * backward from leading edge. Travel 4–10% viewport width.
 *
 * Validates: Requirement 8.4
 */
export const directionalConfig: DirectionalTransitionConfig = {
  travelRange: [0.04, 0.1],
  travel: 0.06, // 6% viewport width — balanced feel
  duration: 0.25, // 250ms within 220–320ms surface transition budget
  ease: [0.25, 0.1, 0.25, 1.0], // cubic-bezier for smooth directional slide
}

/**
 * Sheet presentation choreography: backdrop blur + dim + sheet rise
 * within 250–400ms. Underlying surface scales down 2–4%.
 *
 * Validates: Requirement 8.5
 */
export const sheetPresentationConfig: SheetPresentationConfig = {
  sheetSpring: {
    type: "spring",
    stiffness: springPresets.sheet.stiffness,
    damping: springPresets.sheet.damping,
    mass: springPresets.sheet.mass,
  },
  durationRange: [250, 400],
  backdropBlur: "12px",
  backdropDimOpacity: 0.5,
  underlyingScaleRange: [0.96, 0.98],
  underlyingScale: 0.97, // 3% scale-down — middle of 2–4% range
  backdropTransition: {
    type: "tween",
    duration: 0.3, // 300ms — within 250–400ms window
    ease: [0.22, 1, 0.36, 1],
  },
  underlyingTransition: {
    type: "spring",
    stiffness: springPresets.sheet.stiffness,
    damping: springPresets.sheet.damping,
    mass: springPresets.sheet.mass,
  },
}

/**
 * Interruption policy: continue from current values/velocity, no reset.
 *
 * Validates: Requirement 8.7
 */
export const interruptionPolicy: InterruptionPolicy = {
  continueFromCurrent: true,
  maxRedirectDuration: 400,
}

// ---------------------------------------------------------------------------
// Direction Computation
// ---------------------------------------------------------------------------

/**
 * Compute transition direction from dock order.
 * Returns +1 for forward (trailing edge), −1 for backward (leading edge).
 *
 * @param from - Current destination
 * @param to - Target destination
 * @returns +1 for forward navigation, −1 for backward
 */
export function getTransitionDirection(from: string, to: string): 1 | -1 {
  const fromIndex = NAV_ORDER[from] ?? 0
  const toIndex = NAV_ORDER[to] ?? 0
  return toIndex > fromIndex ? 1 : -1
}

/**
 * Compute the pixel travel distance for a directional transition.
 *
 * @param viewportWidth - Current viewport width in px
 * @returns Travel distance in px (clamped to 4–10% of viewport)
 */
export function getDirectionalTravel(viewportWidth: number): number {
  const travel = viewportWidth * directionalConfig.travel
  const min = viewportWidth * directionalConfig.travelRange[0]
  const max = viewportWidth * directionalConfig.travelRange[1]
  return Math.max(min, Math.min(max, travel))
}

// ---------------------------------------------------------------------------
// Framer-Motion Variants
// ---------------------------------------------------------------------------

/**
 * Shared-element container variants.
 * Use with `layoutId` on the shared element for automatic interpolation.
 * The `custom` prop receives `{ direction: 1 | -1 }`.
 */
export const sharedElementVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.92,
  },
  enter: {
    opacity: 1,
    scale: 1,
    transition: sharedElementConfig.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      type: "tween",
      duration: 0.2,
      ease: "easeIn",
    },
  },
}

/**
 * Container variants with child stagger orchestration.
 * Apply to a parent motion element whose children use `childEntryVariants`.
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  enter: {
    transition: {
      staggerChildren: childStaggerConfig.staggerStep,
      delayChildren: childStaggerConfig.delayChildren,
    },
  },
  exit: {
    transition: {
      staggerChildren: childStaggerConfig.staggerStep / 2,
      staggerDirection: -1,
    },
  },
}

/**
 * Child entry variants for staggered reveal.
 * Pair with `staggerContainerVariants` on the parent.
 */
export const childEntryVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: childStaggerConfig.childTransition,
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: {
      type: "tween",
      duration: 0.12,
      ease: "easeIn",
    },
  },
}

/**
 * Directional navigation variants.
 * The `custom` prop receives a direction: +1 (forward) or −1 (backward).
 * Travel distance is computed as a percentage of viewport width.
 */
export const directionalNavVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: `${direction * directionalConfig.travel * 100}%`,
  }),
  enter: {
    opacity: 1,
    x: "0%",
    transition: {
      type: "tween",
      duration: directionalConfig.duration,
      ease: directionalConfig.ease,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: `${direction * -directionalConfig.travel * 50}%`,
    transition: {
      type: "tween",
      duration: directionalConfig.duration * 0.7,
      ease: "easeIn",
    },
  }),
}

/**
 * Sheet presentation variants (the sheet itself).
 */
export const sheetVariants: Variants = {
  initial: {
    opacity: 0,
    y: "100%",
  },
  enter: {
    opacity: 1,
    y: "0%",
    transition: sheetPresentationConfig.sheetSpring,
  },
  exit: {
    opacity: 0,
    y: "100%",
    transition: sheetPresentationConfig.sheetSpring,
  },
}

/**
 * Backdrop variants for sheet presentation (blur + dim).
 */
export const sheetBackdropVariants: Variants = {
  initial: {
    opacity: 0,
    backdropFilter: "blur(0px)",
  },
  enter: {
    opacity: sheetPresentationConfig.backdropDimOpacity,
    backdropFilter: `blur(${sheetPresentationConfig.backdropBlur})`,
    transition: sheetPresentationConfig.backdropTransition,
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: {
      type: "tween",
      duration: 0.2,
      ease: "easeIn",
    },
  },
}

/**
 * Underlying surface variants during sheet presentation.
 * Scales the surface down 2–4% to communicate layering.
 */
export const sheetUnderlyingVariants: Variants = {
  initial: {
    scale: 1,
  },
  pushed: {
    scale: sheetPresentationConfig.underlyingScale,
    transition: sheetPresentationConfig.underlyingTransition,
  },
  restored: {
    scale: 1,
    transition: sheetPresentationConfig.underlyingTransition,
  },
}

// ---------------------------------------------------------------------------
// Reduced Motion Variants
// ---------------------------------------------------------------------------

/**
 * Reduced-motion shared-element: opacity-only crossfade, no positional
 * or scale animation.
 */
export const sharedElementVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { type: "tween", duration: 0.15 } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0.1 } },
}

/**
 * Reduced-motion stagger container: no stagger, instant reveal.
 */
export const staggerContainerVariantsReduced: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0, delayChildren: 0 } },
  exit: { transition: { staggerChildren: 0 } },
}

/**
 * Reduced-motion child entry: opacity-only, no translation.
 */
export const childEntryVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { type: "tween", duration: 0.15 } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0.1 } },
}

/**
 * Reduced-motion directional nav: crossfade only, no slide.
 */
export const directionalNavVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { type: "tween", duration: 0.15 } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0.1 } },
}

/**
 * Reduced-motion sheet: opacity-only presentation.
 */
export const sheetVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { type: "tween", duration: 0.15 } },
  exit: { opacity: 0, transition: { type: "tween", duration: 0.1 } },
}

// ---------------------------------------------------------------------------
// Transition Presets (named exports for component consumption)
// ---------------------------------------------------------------------------

/**
 * Complete transition preset for shared-element navigation.
 * Components spread this into their AnimatePresence + motion config.
 */
export const transitionPresets = {
  sharedElement: {
    variants: sharedElementVariants,
    reducedVariants: sharedElementVariantsReduced,
    config: sharedElementConfig,
  },
  childStagger: {
    containerVariants: staggerContainerVariants,
    childVariants: childEntryVariants,
    reducedContainerVariants: staggerContainerVariantsReduced,
    reducedChildVariants: childEntryVariantsReduced,
    config: childStaggerConfig,
  },
  directionalNav: {
    variants: directionalNavVariants,
    reducedVariants: directionalNavVariantsReduced,
    config: directionalConfig,
    getDirection: getTransitionDirection,
    getTravel: getDirectionalTravel,
  },
  sheetPresentation: {
    sheetVariants,
    backdropVariants: sheetBackdropVariants,
    underlyingVariants: sheetUnderlyingVariants,
    reducedSheetVariants: sheetVariantsReduced,
    config: sheetPresentationConfig,
  },
  interruption: interruptionPolicy,
} as const
