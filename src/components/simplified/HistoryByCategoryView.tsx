"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import { GlassCard } from "@/components/ui/GlassCard"
import { springs, useReducedMotion } from "@/lib/animations"
import { getCategoryAccent, borderRadius, fills } from "@/styles/shared"
import { FONT_FAMILY, spacing } from "@/styles/typography"

// ============================================================================
// Types
// ============================================================================

interface CategoryGroup {
  category: TransactionCategory
  emoji: string
  label: string
  total: number
  count: number
  transactions: Transaction[]
}

export interface HistoryByCategoryViewProps {
  transactions: Transaction[]
  onEditTransaction?: (tx: Transaction) => void
}

// ============================================================================
// Helpers
// ============================================================================

function getCategoryMeta(category: TransactionCategory): { emoji: string; label: string } {
  const found = BUDGET_CATEGORIES.find(c => c.category === category)
  if (found) return { emoji: found.emoji, label: found.label }
  // Fallback for income and unmapped categories
  if (category === "income") return { emoji: "💵", label: "Income" }
  return { emoji: "📦", label: category }
}

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ============================================================================
// Component
// ============================================================================

/**
 * HistoryByCategoryView — groups transactions by category.
 * Each category section shows: icon, category name, total for the period,
 * and the individual transactions within.
 *
 * Requirements: 22.4
 */
export function HistoryByCategoryView({
  transactions,
  onEditTransaction,
}: HistoryByCategoryViewProps) {
  const { prefersReducedMotion, listContainer, listItem } = useReducedMotion()
  const [expandedCategory, setExpandedCategory] = useState<TransactionCategory | null>(null)

  const categoryGroups: CategoryGroup[] = useMemo(() => {
    const map = new Map<TransactionCategory, Transaction[]>()

    transactions.forEach(tx => {
      const existing = map.get(tx.category) || []
      existing.push(tx)
      map.set(tx.category, existing)
    })

    const groups: CategoryGroup[] = []
    map.forEach((txs, category) => {
      const { emoji, label } = getCategoryMeta(category)
      const total = txs.reduce((sum, tx) => sum + tx.amount, 0)
      groups.push({
        category,
        emoji,
        label,
        total,
        count: txs.length,
        transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
      })
    })

    // Sort by total descending
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
      {categoryGroups.map(group => {
        const isExpanded = expandedCategory === group.category
        const accent = getCategoryAccent(group.category)

        return (
          <motion.div key={group.category} variants={listItem}>
            <GlassCard
              elevation="low"
              style={{ borderRadius: borderRadius.lg, overflow: "hidden" }}
            >
              {/* Category header — tap to expand/collapse */}
              <button
                type="button"
                onClick={() =>
                  setExpandedCategory(isExpanded ? null : group.category)
                }
                aria-expanded={isExpanded}
                aria-label={`${group.label}: ${formatAmount(group.total)}, ${group.count} transactions`}
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
                {/* Category icon chip */}
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.sm,
                    background: `${accent}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {group.emoji}
                </span>

                {/* Name + count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--text)",
                      fontFamily: FONT_FAMILY,
                      margin: 0,
                    }}
                  >
                    {group.label}
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
                    {group.count} transaction{group.count !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Total amount */}
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: accent,
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
                              {tx.note || group.label}
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
