"use client"

import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface ToolsScreenProps {
  onOpenCompoundGrowth?: () => void
  onOpenCreditPayoff?: () => void
  onOpenSubscriptions?: () => void
  onOpenSinkingFunds?: () => void
  onOpenLearn?: () => void
  onOpenSavingsProjections?: () => void
}

// ============================================================================
// Tool definitions
// ============================================================================

interface ToolItem {
  id: string
  emoji: string
  title: string
  description: string
  onOpen?: () => void
}

// ============================================================================
// ToolsScreen Component
// ============================================================================

/**
 * ToolsScreen — opt-in "Tools" area for advanced features that don't pass
 * the "would a typical sophomore use this in a normal week?" test.
 *
 * Accessible from the dock navigation. Presents advanced tools as a simple
 * list of glass cards with emoji, title, and description.
 */
export function ToolsScreen({
  onOpenCompoundGrowth,
  onOpenCreditPayoff,
  onOpenSubscriptions,
  onOpenSinkingFunds,
  onOpenLearn,
  onOpenSavingsProjections,
}: ToolsScreenProps) {
  const tools: ToolItem[] = [
    {
      id: "compound-growth",
      emoji: "📈",
      title: "Compound Growth Calculator",
      description: "See how your savings could grow over time with compound interest.",
      onOpen: onOpenCompoundGrowth,
    },
    {
      id: "credit-payoff",
      emoji: "💳",
      title: "Credit Payoff Calculator",
      description: "Plan how to pay off credit card debt faster.",
      onOpen: onOpenCreditPayoff,
    },
    {
      id: "subscriptions",
      emoji: "🔄",
      title: "Subscription Audit",
      description: "Review detected recurring charges and decide what's worth keeping.",
      onOpen: onOpenSubscriptions,
    },
    {
      id: "sinking-funds",
      emoji: "🎯",
      title: "Sinking Funds",
      description: "Save gradually for predictable large expenses like insurance or travel.",
      onOpen: onOpenSinkingFunds,
    },
    {
      id: "savings-projections",
      emoji: "🏦",
      title: "Savings Projections",
      description: "Project how your savings accounts and investments might grow.",
      onOpen: onOpenSavingsProjections,
    },
    {
      id: "learn",
      emoji: "📚",
      title: "Learn",
      description: "Short lessons on budgeting, saving, and growing your money.",
      onOpen: onOpenLearn,
    },
  ]

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Title ──────────────────────────────────────────────────────── */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        Tools & Calculators
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--sub)",
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        Advanced tools for when you want to dig deeper into your finances.
      </p>

      {/* ── Tool Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tools.map((tool) => (
          <motion.div
            key={tool.id}
            whileTap={{ scale: 0.98 }}
            transition={springs.snappy}
          >
            <GlassCard
              elevation="low"
              style={{
                padding: "16px 18px",
                cursor: tool.onOpen ? "pointer" : "default",
                opacity: tool.onOpen ? 1 : 0.5,
              }}
              onClick={tool.onOpen}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span
                  style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2 }}
                  aria-hidden="true"
                >
                  {tool.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--text)",
                      marginBottom: 4,
                    }}
                  >
                    {tool.title}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--sub)",
                      lineHeight: 1.4,
                    }}
                  >
                    {tool.description}
                  </p>
                </div>
                {tool.onOpen && (
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--muted)",
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
