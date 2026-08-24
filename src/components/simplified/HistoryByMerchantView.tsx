"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { springs, useReducedMotion } from "@/lib/animations"
import { fills } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { formatMoney, formatDate as formatLocalDate } from '@/lib/localeFormat'

// ============================================================================
// Types
// ============================================================================

interface MerchantGroup {
  merchant: string
  total: number
  count: number
  transactions: Transaction[]
  /** Most common category within this merchant group */
  topCategory: string
  topCategoryEmoji: string
}

export interface HistoryByMerchantViewProps {
  transactions: Transaction[]
  onEditTransaction?: (tx: Transaction) => void
}

// ============================================================================
// Helpers
// ============================================================================

function getMerchantKey(tx: Transaction): string {
  // Use note/merchant text as the grouping key
  // Normalize: trim, lowercase for grouping, but display the original
  return (tx.note || "").trim().toLowerCase() || "(no note)"
}

function getMerchantDisplay(tx: Transaction): string {
  return (tx.note || "").trim() || "(No note)"
}

function formatAmount(amount: number): string {
  return formatMoney(amount)
}

function formatDate(dateStr: string): string {
  return formatLocalDate(dateStr, { month: "short", day: "numeric" })
}

function getCategoryEmoji(category: string): string {
  const found = BUDGET_CATEGORIES.find(c => c.category === category)
  if (found) return found.emoji
  if (category === "income") return "💵"
  return "📦"
}

// ============================================================================
// Component
// ============================================================================

/**
 * HistoryByMerchantView — groups transactions by merchant/note text.
 * Shows which merchants you frequent and total spend per merchant.
 *
 * Requirements: 22.4
 */
export function HistoryByMerchantView({
  transactions,
  onEditTransaction,
}: HistoryByMerchantViewProps) {
  const { prefersReducedMotion, listContainer, listItem } = useReducedMotion()
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null)

  const merchantGroups: MerchantGroup[] = useMemo(() => {
    const map = new Map<string, { display: string; txs: Transaction[] }>()

    transactions.forEach(tx => {
      const key = getMerchantKey(tx)
      const existing = map.get(key)
      if (existing) {
        existing.txs.push(tx)
      } else {
        map.set(key, { display: getMerchantDisplay(tx), txs: [tx] })
      }
    })

    const groups: MerchantGroup[] = []
    map.forEach(({ display, txs }, key) => {
      const total = txs.reduce((sum, tx) => sum + tx.amount, 0)

      // Find most common category in this group
      const catCounts = new Map<string, number>()
      txs.forEach(tx => {
        catCounts.set(tx.category, (catCounts.get(tx.category) || 0) + 1)
      })
      let topCategory = "other"
      let topCount = 0
      catCounts.forEach((count, cat) => {
        if (count > topCount) {
          topCount = count
          topCategory = cat
        }
      })

      groups.push({
        merchant: display,
        total,
        count: txs.length,
        transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
        topCategory,
        topCategoryEmoji: getCategoryEmoji(topCategory),
      })
    })

    // Sort by total descending (highest spend first)
    return groups.sort((a, b) => b.total - a.total)
  }, [transactions])

  if (transactions.length === 0) {
    return (
      <GlassCard elevation="low" style={{ padding: "4px 0", borderRadius: radius.control }}>
        <EmptyState
          illustration="transactions"
          title="No merchants yet"
          subtitle="Log some expenses and they'll be grouped by merchant here."
        />
      </GlassCard>
    )
  }

  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
    >
      {merchantGroups.map(group => {
        const isExpanded = expandedMerchant === group.merchant

        return (
          <motion.div key={group.merchant} variants={listItem}>
            <GlassCard
              elevation="low"
              style={{ borderRadius: radius.control, overflow: "hidden" }}
            >
              {/* Merchant header — tap to expand/collapse */}
              <button
                type="button"
                onClick={() =>
                  setExpandedMerchant(isExpanded ? null : group.merchant)
                }
                aria-expanded={isExpanded}
                aria-label={`${group.merchant}: ${formatAmount(group.total)}, ${group.count} transactions`}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: "16px 20px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "start",
                }}
              >
                {/* Category emoji as a visual cue */}
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.control,
                    background: fills[6],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: typography.subhead.fontSize,
                    flexShrink: 0,
                  }}
                >
                  {group.topCategoryEmoji}
                </span>

                {/* Merchant name + visit count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: fontWeights.semibold,
                      color: "var(--text)",
                      fontFamily: FONT_FAMILY,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.merchant}
                  </p>
                  <p
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      color: "var(--muted)",
                      fontFamily: FONT_FAMILY,
                      margin: 0,
                      marginTop: 2,
                    }}
                  >
                    {group.count} visit{group.count !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Total spend */}
                <span
                  style={{
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.semibold,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {formatAmount(group.total)}
                </span>

                {/* Expand chevron */}
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={springs.snappy}
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    color: "var(--muted)",
                    flexShrink: 0,
                    marginInlineStart: 4,
                  }}
                >
                  ▼
                </motion.span>
              </button>

              {/* Expanded transaction list */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : springs.gentle}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        borderTop: `1px solid ${fills[6]}`,
                        padding: "8px 20px 12px",
                      }}
                    >
                      {group.transactions.map(tx => (
                        <div
                          key={tx.id}
                          role={onEditTransaction ? "button" : undefined}
                          tabIndex={onEditTransaction ? 0 : undefined}
                          onClick={() => onEditTransaction?.(tx)}
                          onKeyDown={(e) => {
                            if (onEditTransaction && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault()
                              onEditTransaction(tx)
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 0",
                            borderBottom: `1px solid ${fills[3]}`,
                            cursor: onEditTransaction ? "pointer" : "default",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p
                              style={{
                                fontSize: typography.body.fontSize,
                                fontWeight: fontWeights.medium,
                                color: "var(--text)",
                                fontFamily: FONT_FAMILY,
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getCategoryEmoji(tx.category)} {BUDGET_CATEGORIES.find(c => c.category === tx.category)?.label || tx.category}
                            </p>
                            <p
                              style={{
                                fontSize: typography['body-sm'].fontSize,
                                color: "var(--muted)",
                                fontFamily: FONT_FAMILY,
                                margin: 0,
                                marginTop: 2,
                              }}
                            >
                              {formatDate(tx.date)}
                            </p>
                          </div>
                          <span
                            style={{
                              fontSize: typography.body.fontSize,
                              fontWeight: fontWeights.medium,
                              color: tx.type === "income" ? "var(--success)" : "var(--text)",
                              fontFamily: FONT_FAMILY,
                              fontVariantNumeric: "tabular-nums",
                              flexShrink: 0,
                              marginInlineStart: spacing.sm,
                            }}
                          >
                            {tx.type === "income" ? "+" : "-"}
                            {formatAmount(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
