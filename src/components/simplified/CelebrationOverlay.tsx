"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { GlassCard } from "@/components/ui"
import {
  springs,
  timings,
  useReducedMotion,
  celebrationMilestoneSpring,
  celebrationEverydaySpring,
  CELEBRATION_STAGGER_MS,
} from "@/lib/animations"
import { triggerHaptic } from "@/lib/haptics"
import type { CelebrationEvent, CelebrationType } from "@/types/folio"
import { resolvedColors } from "@/styles/colors"

/**
 * CelebrationOverlay — the immersive, full-screen celebration experience.
 *
 * Elevated in Task 257.1 with:
 * - Refined confetti timing with multi-burst layering for milestones
 * - Animated SVG star-burst for milestone celebrations (framer-motion powered)
 * - Progress timer ring on dismiss button showing auto-dismiss countdown
 * - Staggered card element entrance (icon → title → message → button)
 * - Context-aware dismiss copy ("Nice!" / "Amazing!" / "Let's go!")
 * - Full reduced-motion parity (calm static card, opacity-only fade)
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
 * Expanded milestone set that earns premium treatment: screen shake, dramatic
 * spring, SVG star-burst animation, multi-burst confetti, and "Amazing!" copy.
 */
const MILESTONE_TYPES: ReadonlySet<CelebrationType> = new Set<CelebrationType>([
  "streak_7_days",
  "streak_14_days",
  "streak_30_days",
  "goal_complete",
  "weekly_win",
  "first_month",
  "first_goal_met",
  "first_no_spend_week",
])

/** Streak-specific types that get "Let's go!" dismiss copy. */
const STREAK_TYPES: ReadonlySet<CelebrationType> = new Set<CelebrationType>([
  "streak_7_days",
  "streak_14_days",
  "streak_30_days",
  "logging_streak",
  "no_spend_streak",
])

/** Warm, friendly confetti palette drawn from the theme's semantic colors. */
const CONFETTI_COLORS = [
  resolvedColors.caution500,   // warm gold
  resolvedColors.warning600,   // orange/amber
  resolvedColors.success500,   // success green
  resolvedColors.accent500,    // accent indigo
  resolvedColors.pink500,      // playful pink
  resolvedColors.text,         // sparkle white
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

/**
 * Returns context-aware dismiss button copy:
 * - "Let's go!" for streaks (momentum)
 * - "Amazing!" for milestones (celebration)
 * - "Nice!" for everyday wins (warm)
 */
function getDismissCopy(type: CelebrationType): string {
  if (STREAK_TYPES.has(type)) return "Let's go!"
  if (MILESTONE_TYPES.has(type)) return "Amazing!"
  return "Nice!"
}

// ---------------------------------------------------------------------------
// SVG Star-burst animation (replaces Lottie — pure framer-motion)
// ---------------------------------------------------------------------------

/** A brief animated sparkle/star-burst rendered via motion.svg for milestones. */
function MilestoneStarburst() {
  const rays = 8
  const size = 64
  const center = size / 2

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: "block" }}
      initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={springs.dramatic}
    >
      {Array.from({ length: rays }, (_, i) => {
        const angle = (i / rays) * 360
        const isLong = i % 2 === 0
        const length = isLong ? 18 : 12
        const rad = (angle * Math.PI) / 180
        const x1 = center + Math.cos(rad) * 6
        const y1 = center + Math.sin(rad) * 6
        const x2 = center + Math.cos(rad) * length
        const y2 = center + Math.sin(rad) * length
        return (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isLong ? resolvedColors.caution500 : resolvedColors.warning600}
            strokeWidth={isLong ? 2.5 : 2}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              delay: i * 0.04,
              duration: 0.35,
              ease: "easeOut",
            }}
          />
        )
      })}
      {/* Central sparkle dot */}
      <motion.circle
        cx={center}
        cy={center}
        r={4}
        fill={resolvedColors.caution500}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0.85] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      {/* Outer ring pulse */}
      <motion.circle
        cx={center}
        cy={center}
        r={24}
        fill="none"
        stroke={resolvedColors.accent500}
        strokeWidth={1.5}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.1, 1], opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
      />
    </motion.svg>
  )
}

// ---------------------------------------------------------------------------
// Progress Timer Ring (SVG circle that depletes over auto-dismiss duration)
// ---------------------------------------------------------------------------

interface TimerRingProps {
  durationMs: number
}

/** A thin circular progress indicator that depletes over the dismiss countdown. */
function TimerRing({ durationMs }: TimerRingProps) {
  const radius = 20
  const strokeWidth = 2.5
  const circumference = 2 * Math.PI * radius
  const size = (radius + strokeWidth) * 2

  return (
    <svg
      className="celebration-timer-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth={strokeWidth}
      />
      {/* Depleting progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(252, 211, 77, 0.7)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={0}
        style={{
          transformOrigin: "center",
          transform: "rotate(-90deg)",
          animation: `celebration-timer-deplete ${durationMs}ms linear forwards`,
        }}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CelebrationOverlay({ event, onDismiss }: CelebrationOverlayProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dismissButtonRef = useRef<HTMLButtonElement | null>(null)

  // Track whether the Lottie-replacement starburst has rendered, for fallback
  const [starburstReady, setStarburstReady] = useState(false)

  const isMilestone = event ? MILESTONE_TYPES.has(event.type) : false
  const animation = event?.animation ?? "confetti"
  const showParticles =
    !prefersReducedMotion &&
    event != null &&
    animation !== "none" &&
    animation !== "pulse"
  const showShake = !prefersReducedMotion && isMilestone
  const showFlash = !prefersReducedMotion && event != null
  // Milestone starburst replaces emoji for premium celebrations
  const showStarburst = !prefersReducedMotion && isMilestone

  const trailParticles = useMemo(
    () => (showParticles ? buildTrailParticles() : []),
    [showParticles],
  )

  const duration = event
    ? event.duration > 0
      ? event.duration
      : DEFAULT_DURATION_MS
    : DEFAULT_DURATION_MS

  const handleDismiss = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  // Reset starburst state when event changes
  useEffect(() => {
    setStarburstReady(false)
    if (showStarburst) {
      // Small delay so the card entrance animation leads, then starburst pops
      const t = setTimeout(() => setStarburstReady(true), 120)
      return () => clearTimeout(t)
    }
  }, [showStarburst, event?.id])

  // Fire the layered confetti — refined timing for milestones with multi-burst
  useEffect(() => {
    if (!showParticles) return

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
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

        const fireBurst = (originX: number, scale = 1) => {
          background({
            particleCount: Math.round(38 * scale),
            spread: 110,
            startVelocity: 28,
            scalar: 0.55,
            gravity: 0.85,
            ticks: 250,
            origin: { x: originX, y: 0.6 },
            colors: [...CONFETTI_COLORS],
            disableForReducedMotion: true,
          })
          foreground({
            particleCount: Math.round(60 * scale),
            spread: 78,
            startVelocity: 48,
            scalar: 1.2,
            gravity: 1.05,
            ticks: 250,
            origin: { x: originX, y: 0.64 },
            colors: [...CONFETTI_COLORS],
            disableForReducedMotion: true,
          })
        }

        // Center pop immediately.
        fireBurst(0.5)

        if (isMilestone) {
          // Milestones: layered multi-burst sequence for dramatic rhythm
          timers.push(setTimeout(() => !cancelled && fireBurst(0.22, 0.7), 140))
          timers.push(setTimeout(() => !cancelled && fireBurst(0.78, 0.7), 240))
          // Second center burst (smaller, slower) for depth
          timers.push(
            setTimeout(() => {
              if (cancelled) return
              foreground({
                particleCount: 25,
                spread: 120,
                startVelocity: 20,
                scalar: 0.8,
                gravity: 0.7,
                ticks: 300,
                origin: { x: 0.5, y: 0.55 },
                colors: [...CONFETTI_COLORS],
                disableForReducedMotion: true,
              })
            }, 420),
          )
        }
      } catch {
        // Progressive enhancement — card still celebrates if confetti fails.
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

    triggerHaptic("success")
    dismissButtonRef.current?.focus()

    const timer = setTimeout(handleDismiss, duration)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss()
    }
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [event, handleDismiss, duration])

  // Card entrance: dramatic spring for milestones, gentle for everyday
  const cardTransition = prefersReducedMotion
    ? timings.fast
    : isMilestone
      ? celebrationMilestoneSpring
      : celebrationEverydaySpring

  const cardInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.75, y: 16 }
  const cardAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, y: 0 }
  const cardExit = prefersReducedMotion
    ? { opacity: 0, transition: timings.fast }
    : { opacity: 0, scale: 0.92, y: 8, transition: timings.normal }

  // Stagger delay calculator for card elements
  const stagger = (index: number) =>
    prefersReducedMotion ? 0 : index * (CELEBRATION_STAGGER_MS / 1000)

  const dismissCopy = event ? getDismissCopy(event.type) : "Nice!"

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

          {/* Centered glass celebration card with spring entrance. */}
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
              transition={cardTransition}
            >
              <GlassCard
                elevation="high"
                glow="celebration"
                className="celebration-card"
              >
                {/* Icon area: starburst for milestones, emoji for everyday */}
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.6 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
                  transition={{
                    delay: stagger(0),
                    ...(prefersReducedMotion ? timings.fast : springs.bouncy),
                  }}
                >
                  {showStarburst && starburstReady ? (
                    <div className="celebration-starburst-wrap">
                      <MilestoneStarburst />
                      {/* Emoji below starburst at smaller size */}
                      <span
                        className="celebration-emoji celebration-emoji--milestone"
                        role="img"
                        aria-hidden="true"
                      >
                        {event.emoji}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`celebration-emoji${
                        prefersReducedMotion ? "" : " celebration-emoji--animated"
                      }`}
                      role="img"
                      aria-hidden="true"
                    >
                      {event.emoji}
                    </span>
                  )}
                </motion.div>

                {/* Title */}
                <motion.h2
                  id="celebration-title"
                  className="celebration-card__title"
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{
                    delay: stagger(1),
                    ...(prefersReducedMotion ? timings.fast : timings.normal),
                  }}
                >
                  {event.title}
                </motion.h2>

                {/* Message */}
                <motion.p
                  id="celebration-message"
                  className="celebration-card__message"
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{
                    delay: stagger(2),
                    ...(prefersReducedMotion ? timings.fast : timings.normal),
                  }}
                >
                  {event.message}
                </motion.p>

                {/* Dismiss button with timer ring and spring animation */}
                <motion.div
                  className="celebration-dismiss-wrap"
                  initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.85 }}
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: 1, scale: 1 }
                  }
                  transition={{
                    delay: stagger(3),
                    ...(prefersReducedMotion ? timings.fast : springs.bouncy),
                  }}
                >
                  {!prefersReducedMotion && (
                    <TimerRing durationMs={duration} />
                  )}
                  <motion.button
                    ref={dismissButtonRef}
                    type="button"
                    onClick={handleDismiss}
                    className="celebration-card__dismiss"
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                    transition={springs.snappy}
                  >
                    {dismissCopy}
                  </motion.button>
                </motion.div>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
