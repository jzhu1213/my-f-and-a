"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { GlassCard } from "@/components/ui"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { triggerHaptic } from "@/lib/haptics"
import type { CelebrationEvent, CelebrationType } from "@/types/folio"

/**
 * CelebrationOverlay — the immersive, full-screen celebration experience.
 *
 * When a {@link CelebrationEvent} is supplied it presents a layered moment of
 * positive reinforcement:
 *
 * - A brief full-screen warm gradient flash that glows then fades.
 * - Layered confetti rendered on two canvases: sharp, larger foreground pieces
 *   and smaller, depth-of-field-blurred background pieces (canvas-confetti is
 *   dynamically imported so it stays out of the initial bundle).
 * - CSS-animated trail particles that drift down behind the confetti.
 * - A centered, glass-treated celebration card that springs in with a playful
 *   bounce, showing an animated emoji, a title and an encouraging message.
 * - A subtle 2px / 150ms screen shake for the bigger milestone celebrations.
 *
 * This component owns only the *presentation* of a celebration. The Celebration
 * Engine (task 10) decides *when* to celebrate and simply passes the resolved
 * `event` in (and `null` to hide it), so this overlay can be driven declaratively.
 *
 * Accessibility & motion:
 * - Respects `prefers-reduced-motion`: it drops the flash, confetti, trails and
 *   screen shake entirely and shows a simple centered card with a gentle fade.
 * - All motion uses GPU-composited transform/opacity to stay at 60fps.
 * - The card is an `alertdialog`; it can be dismissed with the button, a click
 *   on the backdrop, or the Escape key, and auto-dismisses after the event's
 *   `duration`.
 *
 * Validates: Requirements 6.7, 13.5, 15.4
 */
export interface CelebrationOverlayProps {
  /** The celebration to present, or `null` to hide the overlay. */
  event: CelebrationEvent | null
  /** Called when the celebration is dismissed (button, backdrop, Escape, timeout). */
  onDismiss: () => void
}

/**
 * The larger, milestone-grade celebrations that earn a subtle screen shake.
 * Everyday wins (a single under-budget day, goal progress, first log) stay calm.
 */
const MILESTONE_TYPES: ReadonlySet<CelebrationType> = new Set<CelebrationType>([
  "streak_7_days",
  "goal_complete",
  "weekly_win",
])

/** Warm, friendly confetti palette drawn from the theme's semantic colors. */
const CONFETTI_COLORS = [
  "#fcd34d", // warm gold
  "#fb923c", // orange
  "#4ade80", // success green
  "#818cf8", // accent indigo
  "#f472b6", // playful pink
  "#ffffff", // sparkle white
] as const

/** Default on-screen lifetime if the event doesn't specify a duration. */
const DEFAULT_DURATION_MS = 4000

/** Number of CSS trail particles rendered behind the confetti. */
const TRAIL_PARTICLE_COUNT = 14

interface TrailParticle {
  left: number
  delay: number
  duration: number
  drift: number
  size: number
  color: string
}

/** Deterministically-seeded-ish spread of trail particles across the top. */
function buildTrailParticles(): TrailParticle[] {
  return Array.from({ length: TRAIL_PARTICLE_COUNT }, (_, i) => {
    const t = i / TRAIL_PARTICLE_COUNT
    return {
      left: 6 + t * 88 + (i % 2 === 0 ? 3 : -3),
      delay: (i % 5) * 0.12,
      duration: 1.6 + (i % 4) * 0.35,
      drift: (i % 2 === 0 ? 1 : -1) * (8 + (i % 3) * 10),
      size: 6 + (i % 3) * 3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }
  })
}

export function CelebrationOverlay({ event, onDismiss }: CelebrationOverlayProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dismissButtonRef = useRef<HTMLButtonElement | null>(null)

  const isMilestone = event ? MILESTONE_TYPES.has(event.type) : false
  const animation = event?.animation ?? "confetti"
  // Confetti/trails only for expressive animation types, and never under
  // reduced motion.
  const showParticles =
    !prefersReducedMotion &&
    event != null &&
    animation !== "none" &&
    animation !== "pulse"
  const showShake = !prefersReducedMotion && isMilestone
  const showFlash = !prefersReducedMotion && event != null

  const trailParticles = useMemo(
    () => (showParticles ? buildTrailParticles() : []),
    [showParticles],
  )

  const handleDismiss = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  // Fire the layered confetti on the two canvases once the event appears.
  // canvas-confetti is imported dynamically so it is code-split out of the
  // initial bundle (Requirement 13.6 / performance guidance).
  useEffect(() => {
    if (!showParticles) return

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    // Instances we create so we can reset them on cleanup.
    let cleanupInstances: Array<{ reset: () => void }> = []

    void (async () => {
      try {
        const mod = await import("canvas-confetti")
        if (cancelled) return
        const confetti = mod.default
        const fgCanvas = fgCanvasRef.current
        const bgCanvas = bgCanvasRef.current
        if (!fgCanvas || !bgCanvas) return

        const foreground = confetti.create(fgCanvas, { resize: true })
        const background = confetti.create(bgCanvas, { resize: true })
        cleanupInstances = [foreground, background]

        const fireBurst = (originX: number) => {
          // Smaller, softer pieces on the blurred background canvas.
          background({
            particleCount: 34,
            spread: 100,
            startVelocity: 30,
            scalar: 0.6,
            gravity: 0.9,
            ticks: 220,
            origin: { x: originX, y: 0.62 },
            colors: [...CONFETTI_COLORS],
            disableForReducedMotion: true,
          })
          // Larger, sharper pieces on the crisp foreground canvas.
          foreground({
            particleCount: 55,
            spread: 72,
            startVelocity: 46,
            scalar: 1.3,
            gravity: 1,
            ticks: 220,
            origin: { x: originX, y: 0.66 },
            colors: [...CONFETTI_COLORS],
            disableForReducedMotion: true,
          })
        }

        // Center pop immediately.
        fireBurst(0.5)

        // Milestones get celebratory side cannons for extra depth.
        if (isMilestone) {
          timers.push(setTimeout(() => !cancelled && fireBurst(0.18), 160))
          timers.push(setTimeout(() => !cancelled && fireBurst(0.82), 300))
        }
      } catch {
        // Confetti is a progressive enhancement — the card still celebrates
        // if the dynamic import fails for any reason.
      }
    })()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      cleanupInstances.forEach((instance) => {
        try {
          instance.reset()
        } catch {
          /* no-op */
        }
      })
    }
  }, [showParticles, isMilestone, event?.id])

  // Auto-dismiss after the event's duration, and wire up Escape + focus.
  useEffect(() => {
    if (!event) return

    // Trigger celebratory haptic feedback when the celebration appears
    triggerHaptic("success")

    dismissButtonRef.current?.focus()

    const duration = event.duration > 0 ? event.duration : DEFAULT_DURATION_MS
    const timer = setTimeout(handleDismiss, duration)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss()
    }
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [event, handleDismiss])

  // Card entrance: playful spring-bounce, reduced to a gentle fade.
  const cardInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.8, y: 12 }
  const cardAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, y: 0 }
  const cardExit = prefersReducedMotion
    ? { opacity: 0, transition: timings.fast }
    : { opacity: 0, scale: 0.92, y: 8, transition: timings.normal }

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          className="celebration-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={timings.fast}
        >
          {/* Backdrop — dim + click to dismiss. */}
          <div
            className="celebration-overlay__backdrop"
            aria-hidden="true"
            onClick={handleDismiss}
          />

          {/* Brief full-screen warm gradient flash. */}
          {showFlash && (
            <div className="celebration-flash" aria-hidden="true" />
          )}

          {/* Layered confetti canvases: blurred background + crisp foreground. */}
          {showParticles && (
            <>
              <canvas
                ref={bgCanvasRef}
                className="celebration-confetti celebration-confetti--bg"
                aria-hidden="true"
              />
              <canvas
                ref={fgCanvasRef}
                className="celebration-confetti celebration-confetti--fg"
                aria-hidden="true"
              />
              {/* CSS trail particles drifting behind the confetti. */}
              <div className="celebration-trails" aria-hidden="true">
                {trailParticles.map((p, i) => (
                  <span
                    key={i}
                    className="celebration-trail"
                    style={
                      {
                        left: `${p.left}%`,
                        width: p.size,
                        height: p.size,
                        color: p.color,
                        ["--trail-delay" as string]: `${p.delay}s`,
                        ["--trail-duration" as string]: `${p.duration}s`,
                        ["--trail-drift" as string]: `${p.drift}px`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </>
          )}

          {/* Centered glass celebration card with spring-bounce entrance. */}
          <div
            className={`celebration-card-wrap${
              showShake ? " celebration-shake" : ""
            }`}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="celebration-title"
              aria-describedby="celebration-message"
              initial={cardInitial}
              animate={cardAnimate}
              exit={cardExit}
              transition={prefersReducedMotion ? timings.fast : springs.bouncy}
            >
              <GlassCard
                elevation="high"
                glow="celebration"
                className="celebration-card"
              >
                <span
                  className={`celebration-emoji${
                    prefersReducedMotion ? "" : " celebration-emoji--animated"
                  }`}
                  role="img"
                  aria-hidden="true"
                >
                  {event.emoji}
                </span>

                <h2 id="celebration-title" className="celebration-card__title">
                  {event.title}
                </h2>

                <p id="celebration-message" className="celebration-card__message">
                  {event.message}
                </p>

                <button
                  ref={dismissButtonRef}
                  type="button"
                  onClick={handleDismiss}
                  className="celebration-card__dismiss"
                >
                  Nice!
                </button>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
