"use client"

/**
 * ParallaxMesh
 *
 * Wraps {@link GradientMesh} in a fixed, over-extended motion layer that
 * translates *slower* than the scrolling content, giving the animated
 * background a subtle sense of depth (the mesh appears to sit behind the
 * content, drifting gently as you scroll).
 *
 * It does not touch GradientMesh's internals — the mesh renders exactly as it
 * does everywhere else; this component only shifts the layer that contains it.
 *
 * Performance: the only scroll-driven change is a `transform: translateY(...)`
 * on a single layer, which the compositor handles off the main thread. The
 * layer is over-extended (`inset: -24vmax 0`) so the drift never exposes an
 * edge of the mesh.
 *
 * Accessibility / reduced motion: the mesh is decorative (GradientMesh is
 * `aria-hidden`). When the user prefers reduced motion, the parallax translate
 * is disabled and the mesh stays put — identical to using GradientMesh alone.
 *
 * Validates: Requirements 13.1, 13.5, 8.4
 */

import { motion, useTransform } from "framer-motion"
import { GradientMesh, type GradientMeshVariant } from "../GradientMesh"
import { useScrollProgress } from "@/hooks/useScrollProgress"

export interface ParallaxMeshProps {
  /** Mesh intensity for the current screen, passed through to GradientMesh. */
  variant?: GradientMeshVariant
  /**
   * How strongly the mesh trails the content. 0 = no movement (fixed),
   * 1 = moves with the content. Kept low for a gentle depth effect.
   * Defaults to 0.15.
   */
  strength?: number
  /** Maximum drift in px so long pages never over-translate. Defaults to 220. */
  maxShift?: number
  /** Extra classes applied to the parallax layer. */
  className?: string
}

export function ParallaxMesh({
  variant = "home",
  strength = 0.15,
  maxShift = 220,
  className = "",
}: ParallaxMeshProps) {
  const { scrollY, prefersReducedMotion } = useScrollProgress()

  // Drift the mesh up as the page scrolls, but slower than content and capped.
  const meshY = useTransform(scrollY, (v) =>
    -Math.min(v * strength, maxShift),
  )

  return (
    <motion.div
      aria-hidden="true"
      className={`parallax-mesh ${className}`.trim()}
      style={prefersReducedMotion ? undefined : { y: meshY }}
    >
      <GradientMesh variant={variant} />
    </motion.div>
  )
}
