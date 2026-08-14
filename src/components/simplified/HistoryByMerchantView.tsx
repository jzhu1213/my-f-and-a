"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import { GlassCard } from "@/components/ui/GlassCard"
import { springs, useReducedMotion } from "@/lib/animations"
import { borderRadius, fills } from "@/styles/shared"
import { FONT_FAMILY } from "@/styles/typography"

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
  return `$${amount.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
      <GlassCard elevation="low" style={{ padding: "32px 20px", borderRadius: borderRadius.lg }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--sub)", fontFamily: FONT_FAMILY }}>
            No transactions to group
          </p>
        </div>
      </GlassCard>
    )
  }

  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {merchantGroups.map(group => {
        const isExpanded = expandedMerchant === group.merchant

        return (
          <motion.div key={group.merchant} variants={listItem}>
            <GlassCard
              elevation="low"
              style={{ borderRadius: borderRadius.lg, overflow: "hidden" }}
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
                  gap: 12,
                  padding: "16px 20px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {/* Category emoji as a visual cue */}
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.sm,
                    background: fills[6],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {group.topCategoryEmoji}
                </span>

                {/* Merchant name + visit count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
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
                      fontSize: 12,
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
                    fontSize: 15,
                    fontWeight: 600,
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
                    fontSize: 12,
                    color: "var(--muted)",
                    flexShrink: 0,
                    marginLeft: 4,
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
                                fontSize: 14,
                                fontWeight: 500,
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
                                fontSize: 12,
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
                              fontSize: 14,
                              fontWeight: 500,
                              color: tx.type === "income" ? "var(--success)" : "var(--text)",
                              fontFamily: FONT_FAMILY,
                              fontVariantNumeric: "tabular-nums",
                              flexShrink: 0,
                              marginLeft: 12,
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
