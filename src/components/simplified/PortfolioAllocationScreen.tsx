"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { ChartFrame } from "@/components/ui/primitives/ChartFrame"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  borderRadius,
} from "@/styles/shared"
import { chartMotion } from "@/styles/chartTokens"
import {
  computeAllocationByType,
  computeGrowthVsContribution,
} from "@/lib/portfolioAllocationUtils"
import { getAccountTypeMetadata } from "@/lib/savingsAccountUtils"
import type { SavingsAccount } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface PortfolioAllocationScreenProps {
  savingsAccounts: SavingsAccount[]
  onBack: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function formatDollars(amount: number): string {
  return "$" + Math.round(Math.abs(amount)).toLocaleString("en-US")
}

/** Soft, distinct colors for each allocation bar segment. */
const TYPE_COLORS: Record<string, string> = {
  hysa: "rgba(6, 214, 160, 0.7)",       // teal
  roth_ira: "rgba(129, 140, 248, 0.7)", // purple
  "401k": "rgba(245, 158, 11, 0.7)",    // amber
  brokerage: "rgba(99, 179, 237, 0.7)", // blue
  savings: "rgba(74, 222, 128, 0.7)",   // green
  other: "rgba(156, 163, 175, 0.6)",    // gray
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.other
}

// ============================================================================
// PortfolioAllocationScreen Component (Task 172.1)
// ============================================================================

/**
 * PortfolioAllocationScreen — full-screen overlay showing portfolio allocation
 * broken down by account type, plus a growth vs. contribution split.
 *
 * Lives behind Tools tab via progressive disclosure. Uses the same visual
 * language as CombinedGrowthOutlook and SavingsProjectionsScreen.
 */
export function PortfolioAllocationScreen({
  savingsAccounts,
  onBack,
}: PortfolioAllocationScreenProps) {
  const allocations = useMemo(
    () => computeAllocationByType(savingsAccounts),
    [savingsAccounts]
  )

  const growthSummary = useMemo(
    () => computeGrowthVsContribution(savingsAccounts),
    [savingsAccounts]
  )

  const totalBalance = savingsAccounts.reduce((sum, a) => sum + a.balance, 0)
  const hasAccounts = savingsAccounts.length > 0

  // ── Empty State ──────────────────────────────────────────────────
  if (!hasAccounts) {
    return (
      <div
        style={{
          maxWidth: CONTENT_MAX_WIDTH,
          margin: "0 auto",
          padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--sub)",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            cursor: "pointer",
            padding: "4px 0",
            marginBottom: 20,
          }}
        >
          ← Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 80,
            gap: 12,
          }}
        >
          <span style={{ fontSize: 40 }}>🥧</span>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              textAlign: "center",
            }}
          >
            No accounts yet
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--sub)",
              textAlign: "center",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            Add a savings or investment account to see your allocation
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Main Content ─────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: 14,
          fontWeight: 500,
          fontFamily: FONT_FAMILY,
          cursor: "pointer",
          padding: "4px 0",
          marginBottom: 20,
        }}
      >
        ← Back
      </button>

      {/* ── Hero: Total Portfolio Balance ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{ marginBottom: 24, textAlign: "center" }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--sub)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          Total Savings
        </p>
        <p
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}
        >
          {formatDollars(totalBalance)}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--sub)",
            marginTop: 6,
          }}
        >
          across {savingsAccounts.length} account{savingsAccounts.length !== 1 ? "s" : ""}
        </p>
      </motion.div>

      {/* ── Allocation Breakdown by Type ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.05 }}
        style={{ marginBottom: 24 }}
      >
        <p style={{ ...sectionHeader, marginBottom: 14 }}>
          Breakdown by Type
        </p>

        <ChartFrame
          type="bar"
          state="loaded"
          height={allocations.length * 44 + 60}
          aria-label="Savings breakdown by account type"
        >
          <div style={{ padding: "16px 18px" }}>
            {/* Stacked allocation bar */}
            <div
              style={{
                display: "flex",
                height: 12,
                borderRadius: 6,
                overflow: "hidden",
                marginBottom: 16,
                background: "rgba(255, 255, 255, 0.04)",
              }}
              role="img"
              aria-label="Savings breakdown bar"
            >
              {allocations.map((alloc) => (
                <div
                  key={alloc.type}
                  style={{
                    width: `${Math.max(alloc.percentage, 1)}%`,
                    background: getTypeColor(alloc.type),
                    transition: chartMotion.barGrow,
                  }}
                  title={`${alloc.label}: ${alloc.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Per-type rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allocations.map((alloc) => (
                <div
                  key={alloc.type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Color dot */}
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: getTypeColor(alloc.type),
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 15 }} aria-hidden="true">
                      {alloc.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text)",
                      }}
                    >
                      {alloc.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDollars(alloc.totalBalance)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--muted)",
                        minWidth: 40,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {alloc.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartFrame>
      </motion.div>

      {/* ── Growth vs. Contribution Summary ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.1 }}
        style={{ marginBottom: 24 }}
      >
        <p style={{ ...sectionHeader, marginBottom: 14 }}>
          Growth vs. Contributions
        </p>

        <ChartFrame
          type="bar"
          state="loaded"
          height={160}
          aria-label="Growth vs. contributions breakdown chart"
        >
          <div style={{ padding: "16px 18px" }}>
            {/* Summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: borderRadius.sm,
                  background: "rgba(255, 255, 255, 0.04)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--muted)",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Contributed
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDollars(growthSummary.totalContributions)}
                </p>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: borderRadius.sm,
                  background: "rgba(255, 255, 255, 0.04)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--muted)",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Est. Growth
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: growthSummary.totalEstimatedGrowth >= 0
                      ? "var(--success)"
                      : "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {growthSummary.totalEstimatedGrowth >= 0 ? "+" : "-"}
                  {formatDollars(growthSummary.totalEstimatedGrowth)}
                </p>
              </div>
            </div>

            {/* Split bar visualization */}
            {growthSummary.totalContributions > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    height: 8,
                    borderRadius: 4,
                    overflow: "hidden",
                    background: "rgba(255, 255, 255, 0.04)",
                  }}
                  role="img"
                  aria-label={`Contributions: ${formatDollars(growthSummary.totalContributions)}, Growth: ${formatDollars(growthSummary.totalEstimatedGrowth)}`}
                >
                  <div
                    style={{
                      width: `${Math.max(
                        (growthSummary.totalContributions / growthSummary.totalBalance) * 100,
                        2
                      )}%`,
                      background: "rgba(129, 140, 248, 0.6)",
                      transition: chartMotion.barGrow,
                    }}
                  />
                  {growthSummary.totalEstimatedGrowth > 0 && (
                    <div
                      style={{
                        width: `${Math.max(
                          (growthSummary.totalEstimatedGrowth / growthSummary.totalBalance) * 100,
                          2
                        )}%`,
                        background: "rgba(6, 214, 160, 0.6)",
                        transition: chartMotion.barGrow,
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 6,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    💰 Contributed
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    📈 Growth
                  </span>
                </div>
              </div>
            )}

            {growthSummary.totalContributions === 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--sub)",
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                Log contributions to your accounts to see how much is growth vs. what you put in.
              </p>
            )}
          </div>
        </ChartFrame>
      </motion.div>

      {/* ── Per-Account Detail Cards ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.15 }}
      >
        <p style={{ ...sectionHeader, marginBottom: 14 }}>
          Per-Account Breakdown
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {growthSummary.perAccount.map((acct) => {
            const meta = getAccountTypeMetadata(acct.accountType)
            return (
              <GlassCard
                key={acct.accountId}
                elevation="low"
                style={{ padding: "14px 16px" }}
              >
                {/* Account header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }} aria-hidden="true">
                      {meta.emoji}
                    </span>
                    <div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text)",
                        }}
                      >
                        {acct.accountName}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                        }}
                      >
                        {meta.label}
                      </p>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDollars(acct.currentBalance)}
                  </p>
                </div>

                {/* Growth vs contribution for this account */}
                {acct.hasHistory ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "8px 10px",
                      borderRadius: borderRadius.sm,
                      background: "rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginBottom: 2,
                        }}
                      >
                        Contributed
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatDollars(acct.totalContributions)}
                      </p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginBottom: 2,
                        }}
                      >
                        Est. Growth
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: acct.estimatedGrowth >= 0
                            ? "var(--success)"
                            : "var(--sub)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {acct.estimatedGrowth >= 0 ? "+" : "-"}
                        {formatDollars(acct.estimatedGrowth)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--sub)",
                      fontStyle: "italic",
                    }}
                  >
                    No contribution history yet
                  </p>
                )}
              </GlassCard>
            )
          })}
        </div>
      </motion.div>

      {/* ── Encouraging footer ─────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        style={{
          fontSize: 12,
          color: "var(--sub)",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 1.5,
        }}
      >
        Every dollar you set aside is a step toward the future you&apos;re building.
      </motion.p>
    </div>
  )
}
