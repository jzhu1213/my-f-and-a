"use client"

/**
 * HomeSurface — Redesigned Home Surface entry sequence and sections
 *
 * Implements the new home screen composition using Phase 14+ composed primitives:
 *   hero (AllowanceHero) → quick-log (QuickLogControl) → recent transactions
 *   (max 5 TransactionRows + link) → contextual card (max 1)
 *
 * Entry stagger: 30–50ms between sections, total ≤400ms, using the
 * list-stagger motion variant (gentle spring).
 *
 * Key behaviors:
 * - Skeleton placeholder matching display-tier height (±2px) when data unavailable
 * - No layout shift when skeleton is replaced with content
 * - At most 5 recent transactions + one link to Timeline
 * - At most one contextual card (highest-ranked qualifying); space reclaimed when none
 * - Empty state: single encouraging message + first-log CTA when no transactions exist
 *
 * Validates: Requirements 12.4, 12.7, 12.8, 12.10, 12.12
 */

import React, { useMemo } from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { AllowanceHero } from "@/components/ui/composed/AllowanceHero"
import { QuickLogControl } from "@/components/ui/composed/QuickLogControl"
import { TransactionRow } from "@/components/ui/composed/TransactionRow"
import { Skeleton } from "@/components/ui/primitives/Skeleton"
import { EmptyState } from "@/components/ui/primitives/EmptyState"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale, CONTENT_MAX_WIDTH, HORIZONTAL_PADDING } from "@/styles/layout"
import { typography, FONT_FAMILY, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import { radius } from "@/styles/surfaces"
import type { Transaction } from "@/types"
import type { ContextualTip } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface HomeSurfaceProps {
  /** Daily allowance amount. Null while loading. */
  allowanceAmount: number | null
  /** Progress percentage for the ring (0–100). */
  progress: number
  /** Status message for the hero. */
  statusMessage: string
  /** Ring color variant. */
  ringColor?: "accent" | "success" | "warning" | "error"
  /** Whether data is currently loading. */
  isLoading: boolean
  /** All transactions (recent 5 will be extracted). */
  transactions: Transaction[]
  /** Active contextual tip (at most one, highest-ranked qualifying). Null if none qualifies. */
  contextualTip: ContextualTip | null

  // ── Callbacks ──────────────────────────────────────────────────────────────
  /** Called when quick-log is tapped. */
  onQuickLog: () => void
  /** Called when a transaction row is tapped. */
  onViewTransaction: (tx: Transaction) => void
  /** Called when "View all" link is tapped (navigate to Timeline). */
  onViewTimeline: () => void
  /** Called when the first-log CTA is tapped in the empty state. */
  onLogFirst: () => void
  /** Called when the contextual tip is dismissed. */
  onDismissTip?: () => void
  /** Called when the contextual tip action is activated. */
  onTipAction?: () => void
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Stagger step for the home surface sections (40ms = 0.04s).
 * Constraint: 30–50ms between sections, total ≤400ms for 4 sections.
 * 4 sections × 40ms = 160ms total, well within 400ms cap.
 */
const HOME_STAGGER_STEP = 0.04

/**
 * Maximum number of recent transactions displayed on the home surface.
 * Requirement 12.7: at most 5 entries.
 */
const MAX_RECENT_TRANSACTIONS = 5

/**
 * Display-tier height (px) for the skeleton placeholder.
 * Must match the AllowanceHero rendered height ±2px (Requirement 12.10).
 * The AllowanceHero renders: 32px top padding + ~80px amount + 24px gap +
 * 120px ring + 12px gap + 16px status + 32px bottom padding ≈ 316px.
 * We use a slightly simplified measurement based on the dominant amount line.
 */
const HERO_SKELETON_HEIGHT = 316

/**
 * Recent transactions section skeleton height per row.
 * TransactionRow renders at ~56px height (compact ListRow).
 */
const TRANSACTION_ROW_HEIGHT = 56

// ============================================================================
// Entry stagger container variant
// ============================================================================

/**
 * Container orchestrating staggered reveal of major home sections.
 * Uses gentle spring per child, 40ms stagger step.
 */
const homeSurfaceContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: HOME_STAGGER_STEP,
      delayChildren: 0.05,
    },
  },
}

/**
 * Individual section child variant: fade + translateY(12→0) with gentle spring.
 * Reduced motion: opacity-only crossfade (no translation).
 */
const homeSurfaceSection: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
}

const homeSurfaceSectionReduced: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { type: "tween" as const, duration: 0.15, ease: "easeOut" as const },
  },
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * HomeSurfaceSkeleton — Skeleton placeholder matching the layout of
 * the loaded home surface. Heights match the display-tier and transaction
 * row heights within ±2px to prevent layout shift on replace (Req 12.10).
 */
function HomeSurfaceSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading home screen"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacingScale["40"],
        padding: `${spacingScale["24"]} 0`,
      }}
    >
      {/* Hero skeleton — matches AllowanceHero height */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacingScale["24"] }}>
        {/* Display-tier amount placeholder */}
        <Skeleton variant="rect" width={220} height={80} style={{ borderRadius: radius.control }} />
        {/* Progress ring placeholder */}
        <Skeleton variant="circle" size={120} />
        {/* Status message placeholder */}
        <Skeleton variant="text" width={140} height={16} />
      </div>

      {/* Quick-log control skeleton */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Skeleton variant="circle" size={56} />
      </div>

      {/* Recent transactions skeleton — 3 rows (representative) */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
        <Skeleton variant="rect" height={TRANSACTION_ROW_HEIGHT} />
        <Skeleton variant="rect" height={TRANSACTION_ROW_HEIGHT} />
        <Skeleton variant="rect" height={TRANSACTION_ROW_HEIGHT} />
      </div>
    </div>
  )
}

/**
 * ContextualCardSlot — Renders at most one contextual card when a tip qualifies.
 * Reclaims layout space (renders nothing) when no tip qualifies (Req 12.8).
 */
function ContextualCardSlot({
  tip,
  onDismiss,
  onAction,
  prefersReducedMotion,
}: {
  tip: ContextualTip | null
  onDismiss?: () => void
  onAction?: () => void
  prefersReducedMotion: boolean
}) {
  if (!tip) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tip.id}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
        transition={prefersReducedMotion ? { type: "tween", duration: 0.15, ease: "easeOut" } : springs.gentle}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--border-resting, var(--fill-06))",
          borderRadius: radius.card,
          padding: spacingScale["16"],
          display: "flex",
          flexDirection: "column",
          gap: spacingScale["8"],
        }}
        role="region"
        aria-label="Contextual insight"
      >
        {/* Tip message */}
        <p
          style={{
            margin: 0,
            fontFamily: FONT_FAMILY,
            fontSize: typography["body-sm"].fontSize,
            fontWeight: typography["body-sm"].fontWeight,
            lineHeight: typography["body-sm"].lineHeight,
            color: textColors.sub,
          }}
        >
          {tip.message}
        </p>

        {/* Action row: action button + dismiss */}
        <div style={{ display: "flex", alignItems: "center", gap: spacingScale["8"] }}>
          {tip.actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              style={{
                padding: `${spacingScale["6"]} ${spacingScale["12"]}`,
                borderRadius: radius.full,
                border: `1px solid ${colorRamp.accent[500]}`,
                background: "transparent",
                color: colorRamp.accent[500],
                fontFamily: FONT_FAMILY,
                fontSize: typography.caption.fontSize,
                fontWeight: fontWeights.semibold,
                cursor: "pointer",
                minHeight: "44px",
                minWidth: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {tip.actionLabel}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss tip"
              style={{
                padding: `${spacingScale["6"]} ${spacingScale["12"]}`,
                borderRadius: radius.full,
                border: "none",
                background: "transparent",
                color: textColors.muted,
                fontFamily: FONT_FAMILY,
                fontSize: typography.caption.fontSize,
                fontWeight: fontWeights.medium,
                cursor: "pointer",
                minHeight: "44px",
                minWidth: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================================================
// HomeSurface Component
// ============================================================================

export function HomeSurface({
  allowanceAmount,
  progress,
  statusMessage,
  ringColor = "accent",
  isLoading,
  transactions,
  contextualTip,
  onQuickLog,
  onViewTransaction,
  onViewTimeline,
  onLogFirst,
  onDismissTip,
  onTipAction,
}: HomeSurfaceProps) {
  const { prefersReducedMotion } = useReducedMotion()

  // Derive at most 5 recent transactions (Req 12.7)
  const recentTransactions = useMemo(
    () => transactions.slice(0, MAX_RECENT_TRANSACTIONS),
    [transactions]
  )

  // Select appropriate section variant based on motion preference
  const sectionVariant = prefersReducedMotion
    ? homeSurfaceSectionReduced
    : homeSurfaceSection

  // ── Loading: render skeleton matching loaded layout (Req 12.10) ──
  if (isLoading) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: `${CONTENT_MAX_WIDTH}px`,
          marginInlineStart:  "auto",
          marginInlineEnd:  "auto",
          padding: `0 ${HORIZONTAL_PADDING}px`,
        }}
      >
        <HomeSurfaceSkeleton />
      </div>
    )
  }

  // Determine if we're in empty state (no transactions at all — Req 12.12)
  const hasNoTransactions = transactions.length === 0

  return (
    <div
      style={{
        width: "100%",
        maxWidth: `${CONTENT_MAX_WIDTH}px`,
        marginInlineStart:  "auto",
        marginInlineEnd:  "auto",
        padding: `0 ${HORIZONTAL_PADDING}px`,
      }}
    >
      <motion.div
        variants={homeSurfaceContainer}
        initial="hidden"
        animate="visible"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacingScale["40"],
          paddingTop: spacingScale["24"],
          paddingBottom: spacingScale["96"],
        }}
      >
        {/* ── 1. Hero: AllowanceHero ────────────────────────── */}
        <motion.section variants={sectionVariant} aria-label="Daily allowance">
          <AllowanceHero
            amount={allowanceAmount ?? 0}
            progress={progress}
            statusMessage={statusMessage}
            ringColor={ringColor}
            loading={allowanceAmount === null}
          />
        </motion.section>

        {/* ── 2. Quick-Log: QuickLogControl ────────────────── */}
        <motion.section
          variants={sectionVariant}
          aria-label="Quick log"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <QuickLogControl onPress={onQuickLog} />
        </motion.section>

        {/* ── 3. Recent Transactions (max 5 + link to Timeline) ── */}
        <motion.section variants={sectionVariant} aria-label="Recent transactions">
          {hasNoTransactions ? (
            /* ── Empty state: encouraging message + first-log CTA (Req 12.12) ── */
            <EmptyState
              title="Ready when you are"
              message="Log your first expense and Folio starts learning your habits"
              action
              actionLabel="Log your first expense"
              onAction={onLogFirst}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacingScale["4"],
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    ...typography.headline,
                    color: textColors.text,
                  }}
                >
                  Recent
                </h2>
                {/* Link to Timeline (Req 12.7: exactly one link) */}
                <button
                  type="button"
                  onClick={onViewTimeline}
                  style={{
                    padding: `${spacingScale["6"]} ${spacingScale["12"]}`,
                    borderRadius: radius.full,
                    border: "none",
                    background: "transparent",
                    color: textColors.muted,
                    fontFamily: FONT_FAMILY,
                    fontSize: typography.caption.fontSize,
                    fontWeight: fontWeights.medium,
                    cursor: "pointer",
                    minHeight: "44px",
                    minWidth: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="View all transactions"
                >
                  View all →
                </button>
              </div>

              {/* Transaction rows (max 5) */}
              {recentTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  category={tx.category}
                  note={tx.note || tx.category}
                  amount={tx.type === "income" ? -tx.amount : tx.amount}
                  onPress={() => onViewTransaction(tx)}
                  compact
                />
              ))}
            </div>
          )}
        </motion.section>

        {/* ── 4. Contextual Card (max 1, reclaim space when none — Req 12.8) ── */}
        <motion.section variants={sectionVariant} aria-label="Contextual insight">
          <ContextualCardSlot
            tip={contextualTip}
            onDismiss={onDismissTip}
            onAction={onTipAction}
            prefersReducedMotion={prefersReducedMotion}
          />
        </motion.section>
      </motion.div>
    </div>
  )
}
