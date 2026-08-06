"use client"

import { useState } from "react"
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion"
import { GlassCard, type GlassGlow } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import { getTipIconName } from "@/lib/icons"
import { borderRadius } from "@/styles/shared"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import type { ContextualTip, TipType } from "@/types/folio"

interface ContextualTipCardProps {
  tip: ContextualTip
  onDismiss: () => void
  onLearnMore: () => void
  onActionComplete: () => void
}

/**
 * Visual treatment per tip type. `glow` feeds the GlassCard halo, while
 * `accent` colors the gradient bar on the left edge:
 *   celebration     → warm gold
 *   gentle_nudge    → amber
 *   did_you_know    → blue (educational)
 *   smart_suggestion→ blue (educational)
 */
const TIP_STYLES: Record<
  TipType,
  { glow: GlassGlow; accentFrom: string; accentTo: string }
> = {
  celebration: {
    glow: "celebration",
    accentFrom: "#fcd34d",
    accentTo: "#f59e0b",
  },
  gentle_nudge: {
    glow: "caution",
    accentFrom: "#fbbf24",
    accentTo: "#f59e0b",
  },
  did_you_know: {
    glow: "rgba(99, 179, 237, 0.35)",
    accentFrom: "#63b3ed",
    accentTo: "#3b82f6",
  },
  smart_suggestion: {
    glow: "rgba(99, 179, 237, 0.35)",
    accentFrom: "#63b3ed",
    accentTo: "#3b82f6",
  },
}

/** Past this horizontal drag distance (px), a swipe dismisses the tip. */
const SWIPE_DISMISS_THRESHOLD = 96
/** A fast flick also dismisses, even below the distance threshold. */
const SWIPE_DISMISS_VELOCITY = 500

/**
 * ContextualTipCard — displays a single contextual tip on the home screen.
 *
 * Renders an elevated glass card with a type-specific glow, a gradient accent
 * bar, a gently floating emoji, and a ghost glass action pill. Tips slide in
 * from the right on mount and can be swiped away (rubber-band drag) or
 * dismissed permanently via the close button.
 *
 * All expressive motion (float, slide, rotation) is skipped when the user
 * prefers reduced motion; a gentle fade is preserved.
 *
 * Validates: Requirements 5.1, 5.7, 5.8, 8.4
 */
export function ContextualTipCard({
  tip,
  onDismiss,
  onLearnMore,
  onActionComplete,
}: ContextualTipCardProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const hasAction = tip.actionLabel && tip.actionType
  const style = TIP_STYLES[tip.type] ?? TIP_STYLES.did_you_know
  // Structural icon for the tip: a tip may specify a precise semantic icon
  // (bill, subscription, credit, …); otherwise fall back to the per-type icon.
  const iconName = tip.iconName ?? getTipIconName(tip.type)

  function handleAction() {
    if (tip.actionType === "learn_more") {
      onLearnMore()
    } else {
      onActionComplete()
    }
  }

  function handleDragEnd(_event: unknown, info: PanInfo) {
    const swipedFarEnough = Math.abs(info.offset.x) > SWIPE_DISMISS_THRESHOLD
    const flickedFastEnough = Math.abs(info.velocity.x) > SWIPE_DISMISS_VELOCITY
    if (swipedFarEnough || flickedFastEnough) {
      // Record swipe direction for directional exit animation
      setSwipeDirection(info.offset.x > 0 ? 1 : -1)
      onDismiss()
    }
  }

  // Track drag X for rubber-band tilt and opacity fade
  const dragX = useMotionValue(0)
  // Slight rotation in swipe direction: max ±4deg at ±150px
  const dragRotate = useTransform(dragX, [-150, 0, 150], [-4, 0, 4])
  // Fade opacity as user drags further: 1 → 0.4 at ±200px
  const dragOpacity = useTransform(dragX, [-200, 0, 200], [0.4, 1, 0.4])
  // Track which direction the card was swiped for directional exit
  const [swipeDirection, setSwipeDirection] = useState<number>(1)

  // Entrance: slide in from the right with a spring + slight rotation.
  // Reduced motion collapses this to a gentle fade.
  const initial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, x: 48, rotate: -2.5 }
  const animate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, x: 0, rotate: 0 }
  // Directional exit: slide out in the direction the user swiped
  const exit = prefersReducedMotion
    ? { opacity: 0, transition: timings.fast }
    : { opacity: 0, x: swipeDirection * 200, scale: 0.94, rotate: swipeDirection * 6, transition: timings.normal }

  return (
    <motion.div
      role="region"
      aria-label={`Tip: ${tip.title}`}
      className="w-full"
      initial={initial}
      animate={animate}
      exit={exit}
      transition={springs.gentle}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
      style={{ touchAction: "pan-y", x: dragX, rotate: prefersReducedMotion ? 0 : dragRotate, opacity: prefersReducedMotion ? undefined : dragOpacity }}
    >
      <GlassCard elevation="low" glow={style.glow} className="relative overflow-hidden">
        {/* Frosted-noise texture overlay for subtle depth */}
        <span aria-hidden="true" className="tip-noise-overlay" />

        {/* Gradient accent bar on the left edge, colored by tip type */}
        <span
          aria-hidden="true"
          className="tip-accent-bar"
          style={
            {
              ["--tip-accent-from" as string]: style.accentFrom,
              ["--tip-accent-to" as string]: style.accentTo,
            } as React.CSSProperties
          }
        />

        <div style={{ padding: "16px 16px 16px 20px" }}>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3 right-3 flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 28,
              height: 28,
              background: "var(--raised)",
              color: "var(--muted)",
            }}
            aria-label={`Dismiss tip: ${tip.title}. Won't show again.`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3L11 11M11 3L3 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Tip content */}
          <div className="flex items-start gap-3 pr-8">
            {/* Themeable icon in a tinted chip, colored by the tip type accent.
                Retains the gentle floating animation (skipped under reduced
                motion). Decorative — the tip title/message carry the meaning. */}
            <span
              className={`flex-shrink-0${
                prefersReducedMotion ? "" : " tip-emoji-float"
              }`}
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: borderRadius.md,
                background: `color-mix(in srgb, ${style.accentFrom} 16%, transparent)`,
                color: style.accentFrom,
              }}
            >
              <Icon name={iconName} size={22} />
            </span>

            <div className="flex flex-col gap-1 min-w-0">
              {/* Title */}
              <h3
                className="text-sm font-medium"
                style={{
                  color: "var(--text)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {tip.title}
              </h3>

              {/* Message */}
              <p
                className="text-sm"
                style={{
                  color: "var(--sub)",
                  lineHeight: 1.4,
                }}
              >
                {tip.message}
              </p>
            </div>
          </div>

          {/* Action button — ghost glass pill with arrow icon */}
          {hasAction && (
            <div className="mt-3 pl-9">
              <motion.button
                type="button"
                onClick={handleAction}
                className="tip-action-pill inline-flex items-center gap-1.5 text-sm font-medium"
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                aria-label={tip.actionLabel}
              >
                <span>{tip.actionLabel}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}
