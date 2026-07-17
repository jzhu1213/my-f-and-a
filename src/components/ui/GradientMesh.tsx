"use client"

/**
 * GradientMesh
 *
 * A full-viewport animated background made of layered radial-gradient orbs
 * (electric blue, teal, dark navy) that drift slowly to create a living,
 * breathing backdrop. A faint grain + scan-line overlay adds depth.
 *
 * Performance: every animated layer moves using GPU-composited
 * `transform: translate3d(...)` + `opacity` only (see `.gradient-mesh__orb`
 * in globals.css), so animation stays on the compositor thread at ~60fps.
 *
 * Accessibility: the whole element is decorative (`aria-hidden`) and the
 * drift animation is disabled via the `prefers-reduced-motion` media query,
 * degrading gracefully to a calm static gradient.
 */

type GradientMeshVariant = 'home' | 'muted'

interface GradientMeshProps {
  /**
   * Visual intensity for the current screen.
   * - `home`: cool-tone orbs (electric blue, teal, navy) for the primary experience.
   * - `muted`: even subtler cool-tone orbs for settings and secondary surfaces.
   * Defaults to `home`.
   */
  variant?: GradientMeshVariant
  /** Optional extra classes applied to the root element. */
  className?: string
}

export function GradientMesh({ variant = 'home', className = '' }: GradientMeshProps) {
  return (
    <div
      aria-hidden="true"
      className={`gradient-mesh gradient-mesh--${variant} ${className}`.trim()}
    >
      <div className="gradient-mesh__orb gradient-mesh__orb--1" />
      <div className="gradient-mesh__orb gradient-mesh__orb--2" />
      <div className="gradient-mesh__orb gradient-mesh__orb--3" />
      <div className="gradient-mesh__grain" />
    </div>
  )
}

export type { GradientMeshVariant, GradientMeshProps }
