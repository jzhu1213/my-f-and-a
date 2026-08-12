"use client"

/**
 * DayGroupTimeline — Composed component for the Timeline Surface.
 *
 * Renders transactions grouped by day (most-recent-first) with:
 * - Sticky pinned header per day: relative date label + day subtotal (tabular-nums)
 * - Entry layout via TransactionRow: category icon + note on leading, amount on trailing
 * - Shared numeric axis alignment (within 1px) via consistent padding
 * - Note truncation: single line, trailing ellipsis
 * - Row height: 56–72px, ≤8px vertical padding beyond content
 * - Virtualized scrolling: only viewport-intersecting entries + 5 above/below rendered
 * - Swipe-to-reveal: edit/delete actions with ≤1 frame drag lag
 * - 40% threshold: spring back (<40%) or commit delete (≥40%)
 * - Undo affordance: 5+ seconds, restore with original values
 * - Inline edit expansion via shared-element continuity (within 400ms)
 * - Removal animation: close gap within 400ms, no blank row
 * - Persistence failure: restore entry, show error, retain unsaved input
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.10, 14.11, 14.12
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TransactionRow } from "@/components/ui/composed/TransactionRow"
import { SwipeRevealActions } from "@/components/ui/composed/SwipeRevealActions"
import { UndoToast } from "@/components/ui/composed/UndoToast"
import { typography, FONT_FAMILY, TABULAR_NUMS } from "@/styles/typography"
import { textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"
import { elevations } from "@/styles/surfaces"
import { springs } from "@/lib/animations"
import type { Transaction } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface DayGroupTimelineProps {
  /** Transactions to display (will be grouped by date internally). */
  transactions: Transaction[]
  /** Called when a transaction row is tapped. */
  onPressTransaction?: (tx: Transaction) => void
  /** Whether rows should be swipeable (for edit/delete reveal). */
  swipeable?: boolean
  /** Content builder for swipe-revealed actions. */
  renderRevealContent?: (tx: Transaction) => React.ReactNode
  /** Called when a row's swipe actions are revealed. */
  onReveal?: (tx: Transaction) => void
  /** Called when user swipes past 40% threshold to delete. */
  onDelete?: (tx: Transaction) => void
  /** Called when user activates edit on a row. */
  onEdit?: (tx: Transaction) => void
  /** Called when undo is activated for a deletion. */
  onUndo?: (tx: Transaction) => void
  /** Set of transaction IDs currently being removed (for exit animation). */
  removingIds?: Set<string>
  /** Set of transaction IDs to hide (pending deletion). */
  hiddenIds?: Set<string>
  /** ID of the row currently in inline-edit mode. */
  editingRowId?: string | null
  /** Content builder for inline edit expansion. */
  renderEditContent?: (tx: Transaction) => React.ReactNode
  /** Whether to show the undo toast. */
  showUndo?: boolean
  /** Message for the undo toast. */
  undoMessage?: string
  /** Called when the undo toast dismisses (auto or manual). */
  onUndoDismiss?: () => void
  /** Called when undo button is pressed. */
  onUndoActivate?: () => void
  /** Whether reduced motion is active. */
  reducedMotion?: boolean
}

export interface DayGroup {
  /** Date string in YYYY-MM-DD format. */
  date: string
  /** Human-readable label: Today, Yesterday, or weekday + date. */
  label: string
  /** Sum of expense amounts for the day. */
  subtotal: number
  /** Transactions for this day. */
  transactions: Transaction[]
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a date string (YYYY-MM-DD) into a relative label:
 * - "Today" for the current date
 * - "Yesterday" for the preceding date
 * - "Wednesday, Jan 15" format for all other dates
 */
function formatRelativeDate(dateStr: string): string {
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]

  if (dateStr === today) return "Today"
  if (dateStr === yesterdayStr) return "Yesterday"

  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

/**
 * Computes the sum of expense amounts for a list of transactions.
 * Only counts expenses (positive amounts / type === 'expense').
 */
function computeDaySubtotal(transactions: Transaction[]): number {
  return transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0)
}

/**
 * Groups transactions by date, ordered most-recent-first.
 */
function groupByDay(transactions: Transaction[]): DayGroup[] {
  const grouped: Record<string, Transaction[]> = {}

  for (const tx of transactions) {
    if (!grouped[tx.date]) {
      grouped[tx.date] = []
    }
    grouped[tx.date].push(tx)
  }

  // Sort dates most-recent-first
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return sortedDates.map((date) => ({
    date,
    label: formatRelativeDate(date),
    subtotal: computeDaySubtotal(grouped[date]),
    transactions: grouped[date],
  }))
}

/**
 * Formats a subtotal amount for the day header.
 */
function formatSubtotal(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacingScale["8"],
}

const dayGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
}

const stickyHeaderStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
  background: elevations.canvas.fill,
  // Subtle border below sticky header for visual separation
  borderBottom: `1px solid var(--border-subtle)`,
}

const dateLabelStyle: React.CSSProperties = {
  ...typography.overline,
  color: textColors.sub,
  margin: 0,
}

const subtotalStyle: React.CSSProperties = {
  ...TABULAR_NUMS,
  fontFamily: FONT_FAMILY,
  fontSize: typography["body-sm"].fontSize,
  fontWeight: 600,
  lineHeight: typography["body-sm"].lineHeight,
  color: textColors.muted,
}

const entriesContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacingScale["4"],
  padding: `0 ${spacingScale["8"]}`,
}

const placeholderStyle: React.CSSProperties = {
  height: "64px",
  minHeight: "64px",
  flexShrink: 0,
}

// ============================================================================
// Virtualization Constants
// ============================================================================

/**
 * Estimated row height in pixels for placeholder sizing.
 * Based on the 56–72px row height constraint (Req 14.3), using 64px as midpoint.
 */
const ESTIMATED_ROW_HEIGHT = 64

/**
 * Number of entries to render above and below the visible viewport.
 * Provides buffer to prevent blank rows during fast scrolling (Req 14.4).
 */
const OVERSCAN_COUNT = 5

/**
 * Threshold for enabling virtualization. Below this, all entries render normally.
 */
const VIRTUALIZATION_THRESHOLD = 50

// ============================================================================
// Virtualization Hook
// ============================================================================

interface FlatEntry {
  /** Unique key for this entry. */
  key: string
  /** Type discriminator. */
  type: "header" | "transaction"
  /** Original transaction (only for type=transaction). */
  transaction?: Transaction
  /** Day group data (only for type=header). */
  group?: DayGroup
  /** Flat index in the full list. */
  index: number
}

/**
 * Flattens day groups into a single ordered list of headers + transactions
 * for virtualization indexing.
 */
function flattenGroups(dayGroups: DayGroup[]): FlatEntry[] {
  const entries: FlatEntry[] = []
  let index = 0

  for (const group of dayGroups) {
    entries.push({
      key: `header-${group.date}`,
      type: "header",
      group,
      index,
    })
    index++

    for (const tx of group.transactions) {
      entries.push({
        key: `tx-${tx.id}`,
        type: "transaction",
        transaction: tx,
        index,
      })
      index++
    }
  }

  return entries
}

/**
 * Custom hook that manages virtualized rendering of a flat entry list.
 * Uses IntersectionObserver to track which sentinel elements are visible,
 * then computes the visible range + overscan buffer.
 */
function useVirtualizedRange(
  totalCount: number,
  enabled: boolean
): {
  visibleRange: { start: number; end: number }
  containerRef: React.RefObject<HTMLDivElement>
  sentinelRef: (index: number) => (el: HTMLDivElement | null) => void
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelMapRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set())

  // Compute the range to render based on visible sentinel indices
  const visibleRange = useMemo(() => {
    if (!enabled || visibleIndices.size === 0) {
      return { start: 0, end: totalCount }
    }

    let minVisible = totalCount
    let maxVisible = 0

    visibleIndices.forEach((idx) => {
      if (idx < minVisible) minVisible = idx
      if (idx > maxVisible) maxVisible = idx
    })

    const start = Math.max(0, minVisible - OVERSCAN_COUNT)
    const end = Math.min(totalCount, maxVisible + OVERSCAN_COUNT + 1)

    return { start, end }
  }, [visibleIndices, totalCount, enabled])

  // Set up IntersectionObserver
  useEffect(() => {
    if (!enabled) return

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIndices((prev) => {
          const next = new Set(prev)
          let changed = false

          for (const entry of entries) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.virtualIndex
            )
            if (isNaN(idx)) continue

            if (entry.isIntersecting) {
              if (!next.has(idx)) {
                next.add(idx)
                changed = true
              }
            } else {
              if (next.has(idx)) {
                next.delete(idx)
                changed = true
              }
            }
          }

          return changed ? next : prev
        })
      },
      {
        // Use a generous root margin to detect items before they enter viewport
        rootMargin: "200px 0px",
        threshold: 0,
      }
    )

    observerRef.current = observer

    // Observe all currently registered sentinels
    sentinelMapRef.current.forEach((el) => {
      observer.observe(el)
    })

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [enabled])

  // Factory for sentinel ref callbacks
  const sentinelRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      const map = sentinelMapRef.current
      const observer = observerRef.current

      if (el) {
        map.set(index, el)
        if (observer) observer.observe(el)
      } else {
        const existing = map.get(index)
        if (existing && observer) {
          observer.unobserve(existing)
        }
        map.delete(index)
      }
    },
    []
  )

  return { visibleRange, containerRef, sentinelRef }
}

// ============================================================================
// Component
// ============================================================================

export function DayGroupTimeline({
  transactions,
  onPressTransaction,
  swipeable = false,
  renderRevealContent,
  onReveal,
  onDelete,
  onEdit,
  onUndo,
  removingIds,
  hiddenIds,
  editingRowId,
  renderEditContent,
  showUndo = false,
  undoMessage,
  onUndoDismiss,
  onUndoActivate,
  reducedMotion = false,
}: DayGroupTimelineProps) {
  // Filter out hidden (pending-deletion) transactions
  const visibleTransactions = useMemo(() => {
    if (!hiddenIds || hiddenIds.size === 0) return transactions
    return transactions.filter((tx) => !hiddenIds.has(tx.id))
  }, [transactions, hiddenIds])

  const dayGroups = useMemo(() => groupByDay(visibleTransactions), [visibleTransactions])
  const flatEntries = useMemo(() => flattenGroups(dayGroups), [dayGroups])

  const shouldVirtualize = flatEntries.length >= VIRTUALIZATION_THRESHOLD

  const { visibleRange, containerRef, sentinelRef } = useVirtualizedRange(
    flatEntries.length,
    shouldVirtualize
  )

  // Build default reveal content if swipeable and no custom renderer
  const getRevealContent = useCallback(
    (tx: Transaction) => {
      if (renderRevealContent) return renderRevealContent(tx)
      if (!swipeable) return undefined
      return (
        <SwipeRevealActions
          onEdit={onEdit ? () => onEdit(tx) : undefined}
          onDelete={onDelete ? () => onDelete(tx) : undefined}
        />
      )
    },
    [renderRevealContent, swipeable, onEdit, onDelete]
  )

  if (dayGroups.length === 0) {
    return null
  }

  // Non-virtualized render for small lists (below threshold)
  if (!shouldVirtualize) {
    return (
      <>
        <div style={containerStyle} role="list" aria-label="Transaction timeline">
          {dayGroups.map((group) => (
            <div key={group.date} style={dayGroupStyle} role="group" aria-label={group.label}>
              <div style={stickyHeaderStyle} aria-label={`${group.label}, ${formatSubtotal(group.subtotal)} spent`}>
                <span style={dateLabelStyle}>{group.label}</span>
                {group.subtotal > 0 && (
                  <span style={subtotalStyle}>{formatSubtotal(group.subtotal)}</span>
                )}
              </div>
              <div style={entriesContainerStyle}>
                <AnimatePresence initial={false}>
                  {group.transactions.map((tx) => {
                    const isRemoving = removingIds?.has(tx.id) ?? false

                    return (
                      <motion.div
                        key={tx.id}
                        layout={!reducedMotion}
                        initial={false}
                        animate={{
                          opacity: isRemoving ? 0 : 1,
                          height: isRemoving ? 0 : "auto",
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          transition: reducedMotion
                            ? { duration: 0 }
                            : {
                                opacity: { type: "tween", duration: 0.15 },
                                height: springs.responsive,
                              },
                        }}
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : springs.responsive
                        }
                        style={{ overflow: "hidden" }}
                      >
                        <TransactionRow
                          category={tx.category}
                          note={tx.note || tx.category}
                          amount={tx.type === "income" ? -tx.amount : tx.amount}
                          onPress={onPressTransaction ? () => onPressTransaction(tx) : undefined}
                          swipeable={swipeable}
                          revealContent={getRevealContent(tx)}
                          onReveal={onReveal ? () => onReveal(tx) : undefined}
                          onDelete={onDelete ? () => onDelete(tx) : undefined}
                          onEdit={onEdit ? () => onEdit(tx) : undefined}
                          editing={editingRowId === tx.id}
                          editContent={renderEditContent ? renderEditContent(tx) : undefined}
                          compact
                        />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

        {/* Undo toast (Req 14.11) */}
        <UndoToast
          visible={showUndo}
          message={undoMessage}
          onUndo={onUndoActivate ?? (() => {})}
          onDismiss={onUndoDismiss ?? (() => {})}
        />
      </>
    )
  }

  // Virtualized render: only render items in the visible range + overscan
  return (
    <>
      <div
        ref={containerRef}
        style={containerStyle}
        role="list"
        aria-label="Transaction timeline"
      >
        {flatEntries.map((entry, idx) => {
          const isInRange = idx >= visibleRange.start && idx < visibleRange.end

          if (entry.type === "header") {
            const group = entry.group!
            // Always render headers (they're sticky and needed for context)
            return (
              <div
                key={entry.key}
                style={dayGroupStyle}
                role="group"
                aria-label={group.label}
              >
                <div
                  ref={sentinelRef(idx)}
                  data-virtual-index={idx}
                  style={stickyHeaderStyle}
                  aria-label={`${group.label}, ${formatSubtotal(group.subtotal)} spent`}
                >
                  <span style={dateLabelStyle}>{group.label}</span>
                  {group.subtotal > 0 && (
                    <span style={subtotalStyle}>{formatSubtotal(group.subtotal)}</span>
                  )}
                </div>
              </div>
            )
          }

          // Transaction entry
          const tx = entry.transaction!
          const isRemoving = removingIds?.has(tx.id) ?? false

          if (!isInRange && !isRemoving) {
            // Render a lightweight placeholder to maintain scroll height
            return (
              <div
                key={entry.key}
                ref={sentinelRef(idx)}
                data-virtual-index={idx}
                style={placeholderStyle}
                role="listitem"
                aria-hidden="true"
              />
            )
          }

          return (
            <motion.div
              key={entry.key}
              ref={sentinelRef(idx)}
              data-virtual-index={idx}
              layout={!reducedMotion}
              animate={{
                opacity: isRemoving ? 0 : 1,
                height: isRemoving ? 0 : "auto",
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : springs.responsive
              }
              style={{ overflow: "hidden" }}
            >
              <TransactionRow
                category={tx.category}
                note={tx.note || tx.category}
                amount={tx.type === "income" ? -tx.amount : tx.amount}
                onPress={onPressTransaction ? () => onPressTransaction(tx) : undefined}
                swipeable={swipeable}
                revealContent={getRevealContent(tx)}
                onReveal={onReveal ? () => onReveal(tx) : undefined}
                onDelete={onDelete ? () => onDelete(tx) : undefined}
                onEdit={onEdit ? () => onEdit(tx) : undefined}
                editing={editingRowId === tx.id}
                editContent={renderEditContent ? renderEditContent(tx) : undefined}
                compact
              />
            </motion.div>
          )
        })}
      </div>

      {/* Undo toast (Req 14.11) */}
      <UndoToast
        visible={showUndo}
        message={undoMessage}
        onUndo={onUndoActivate ?? (() => {})}
        onDismiss={onUndoDismiss ?? (() => {})}
      />
    </>
  )
}
