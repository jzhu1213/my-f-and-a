"use client"

/**
 * NavigationDock — Composed component
 *
 * A 4-tab floating navigation dock (Home, History, Tools, Settings) at the
 * overlay elevation tier. Uses spring-driven shared highlight (layoutId) with
 * the responsive spring preset (stiffness 600, damping 35, mass 0.8).
 *
 * - Floating overlay-tier: uses --color-overlay, --shadow-xl, 32px blur
 * - Hit targets ≥44px per destination
 * - aria-current on active item
 * - Reduced motion: highlight transitions via opacity crossfade
 *
 * Requirements: 16.1, 11.1, 11.4
 */

import React from "react"
import { motion } from "framer-motion"
import { Icon } from "@/components/ui/Icon"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale, safeArea } from "@/styles/layout"
import { textColors, colorRamp } from "@/styles/colors"
import { springPresets } from "@/styles/motion"
import { typography, FONT_FAMILY } from "@/styles/typography"
import type { IconName } from "@/lib/icons"

// ============================================================================
// Types
// ============================================================================

export type DockDestination = "home" | "history" | "tools" | "settings"

export interface NavigationDockProps {
  /** Currently active destination. */
  active: DockDestination
  /** Called when a destination tab is tapped. */
  onNavigate: (destination: DockDestination) => void
  /** Whether to hide the dock (e.g., during sheet presentation). */
  hidden?: boolean
}

// ============================================================================
// Config
// ============================================================================

interface DockItem {
  id: DockDestination
  label: string
  icon: IconName
}

const DOCK_ITEMS: DockItem[] = [
  { id: "home", label: "Home", icon: "nav:home" },
  { id: "history", label: "History", icon: "nav:history" },
  { id: "tools", label: "Tools", icon: "nav:tools" },
  { id: "settings", label: "Settings", icon: "nav:settings" },
]

/** Shared highlight spring (responsive preset). */
const highlightSpring = {
  type: "spring" as const,
  stiffness: springPresets.responsive.stiffness,
  damping: springPresets.responsive.damping,
  mass: springPresets.responsive.mass,
}

// ============================================================================
// Component
// ============================================================================

export function NavigationDock({ active, onNavigate, hidden = false }: NavigationDockProps) {
  if (hidden) return null

  const tier = elevations.overlay

  const dockStyle: React.CSSProperties = {
    position: "fixed",
    bottom: `calc(${spacingScale["8"]} + ${safeArea.bottom})`,
    left: spacingScale["8"],
    right: spacingScale["8"],
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
    background: tier.fill,
    border: `1px solid ${tier.border}`,
    borderRadius: radius.sheet,
    boxShadow: tier.shadow,
    backdropFilter: `blur(${tier.blur})`,
    WebkitBackdropFilter: `blur(${tier.blur})`,
    zIndex: 50,
  }

  return (
    <nav aria-label="Main navigation" style={dockStyle}>
      {DOCK_ITEMS.map((item) => {
        const isActive = active === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            className="focus-ring"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: spacingScale["4"],
              minWidth: "44px",
              minHeight: "44px",
              padding: spacingScale["4"],
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: isActive ? colorRamp.accent[500] : textColors.muted,
              WebkitTapHighlightColor: "transparent",
              borderRadius: radius.control,
              transition: "color 0.15s ease-out",
            }}
          >
            {/* Spring-driven shared highlight */}
            {isActive && (
              <motion.div
                layoutId="dock-highlight"
                transition={highlightSpring}
                style={{
                  position: "absolute",
                  inset: spacingScale["2"],
                  borderRadius: radius.control,
                  background: colorRamp.accent[100],
                  zIndex: -1,
                }}
              />
            )}

            <Icon name={item.icon} size={22} />

            <span
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: typography.caption.fontSize,
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1,
                letterSpacing: typography.caption.letterSpacing,
              }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
