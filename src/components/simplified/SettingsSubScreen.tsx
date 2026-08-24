"use client"

/**
 * SettingsSubScreen — shared wrapper for all settings sub-screens.
 *
 * Provides a consistent layout: fixed header with back button + title,
 * scrollable content area below, and a slide-in-from-right entrance animation.
 * All settings sub-screens use this to ensure uniform navigation and layout.
 *
 * Requirements: 20.3
 */

import type { ReactNode } from "react"
import { useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion, timings } from "@/lib/animations"
import { contentColumn, spacingScale, safeAreaTop, safeAreaBottom } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, semanticColors } from "@/styles/colors"
import { elevations } from "@/styles/surfaces"

// ============================================================================
// Types
// ============================================================================

export interface SettingsSubScreenProps {
  /** Title displayed in the sticky header. */
  title: string
  /** Optional short description shown below the title in the content area. */
  description?: string
  /** Callback when the back button is pressed. */
  onBack: () => void
  /** Sub-screen content rendered in the scrollable area. */
  children: ReactNode
}

// ============================================================================
// Animation variants
// ============================================================================

const SLIDE_DISTANCE = 60

const slideVariants = {
  initial: { x: SLIDE_DISTANCE, opacity: 0 },
  enter: { x: 0, opacity: 1 },
  exit: { x: SLIDE_DISTANCE, opacity: 0 },
}

const reducedVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
}

// ============================================================================
// Component
// ============================================================================

export function SettingsSubScreen({ title, description, onBack, children }: SettingsSubScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const backButtonRef = useRef<HTMLButtonElement>(null)

  // Auto-focus the back button when the sub-screen opens (385.2)
  // This announces the screen context change to screen readers.
  useEffect(() => {
    const timer = setTimeout(() => {
      backButtonRef.current?.focus()
    }, 100) // Brief delay for animation to start
    return () => clearTimeout(timer)
  }, [])

  const variants = prefersReducedMotion ? reducedVariants : slideVariants
  const transition = prefersReducedMotion ? timings.fast : springs.gentle

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      transition={transition}
      role="region"
      aria-label={`${title} settings`}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: elevations.canvas.fill,
        zIndex: 1,
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          paddingTop: safeAreaTop(12),
          paddingBottom: spacingScale["12"],
          paddingInlineStart: spacingScale["20"],
          paddingInlineEnd: spacingScale["20"],
          background: elevations.canvas.fill,
          borderBottom: `1px solid ${semanticColors.borderSubtle}`,
          display: "flex",
          alignItems: "center",
          gap: spacingScale["12"],
        }}
      >
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          className="focus-ring"
          aria-label={`Back to settings`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: textColors.text,
            cursor: "pointer",
            flexShrink: 0,
            ...typography.subhead,
          }}
        >
          ←
        </button>
        <h1
          style={{
            ...typography.subhead,
            color: textColors.text,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: safeAreaBottom(24),
        }}
      >
        <div style={{ ...contentColumn, paddingTop: spacingScale["24"] }}>
          {description && (
            <p
              style={{
                ...typography["body-sm"],
                color: textColors.sub,
                margin: 0,
                marginBottom: spacingScale["20"],
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </motion.div>
  )
}
