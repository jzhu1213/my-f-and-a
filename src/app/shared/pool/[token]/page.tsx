"use client"

/**
 * Shared Pool View Page
 *
 * The page a roommate lands on when they accept a pool invite (task 201.1).
 * It reuses the household pool share token (task 170.1): the roommate can
 * join the pool by name, view the shared spend, and log a shared expense.
 *
 * Pool data is completely separate from anyone's personal budget or daily
 * number — this view never shows a personal allowance.
 *
 * For MVP, reads from localStorage keyed by token (same pattern as the
 * shared goal page). In production this would fetch from Supabase with RLS.
 *
 * Task 201.1 — Invite-a-roommate loop (pairs with task 170.1)
 * Phase 6, Task 269.1 — Premium design system styling
 */

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { Icon } from "@/components/ui/Icon"
import { progressTrack } from "@/styles/shared"
import {
  getPoolByShareToken,
  addMember,
  logPoolExpense,
  getPoolSummary,
  getPoolExpenses,
  type HouseholdPool,
  type HouseholdPoolSummary,
  type HouseholdPoolExpense,
} from "@/lib/householdPool"
import {
  sharedPageContainer,
  headerBadge,
  headerBadgeRow,
  headerSubtitle,
  notFoundContainer,
  notFoundIconWrapper,
  notFoundTitle,
  notFoundDescription,
  loadingText,
  sectionLabel,
  footerAttribution,
  sharedInput,
  sharedActionButton,
  colorRamp,
  fills,
  shadows,
  typography,
  TABULAR_NUMS,
  FONT_FAMILY,
  spacing,
  borderRadius,
} from "../../sharedPageStyles"

// ============================================================================
// Component
// ============================================================================

export default function SharedPoolViewPage() {
  const params = useParams()
  const token = params?.token as string | undefined

  const [pool, setPool] = useState<HouseholdPool | null>(null)
  const [summary, setSummary] = useState<HouseholdPoolSummary | null>(null)
  const [expenses, setExpenses] = useState<HouseholdPoolExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Join form
  const [joinName, setJoinName] = useState("")
  const [myName, setMyName] = useState<string | null>(null)

  // Log expense form
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [logged, setLogged] = useState(false)

  const refresh = useCallback((poolId: string) => {
    setSummary(getPoolSummary(poolId))
    setExpenses(getPoolExpenses(poolId))
  }, [])

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const found = getPoolByShareToken(token)
    if (!found) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setPool(found)
    refresh(found.id)
    const storedName = localStorage.getItem(`folio-shared-pool-me-${found.id}`)
    if (storedName) setMyName(storedName)
    setLoading(false)
  }, [token, refresh])

  const handleJoin = useCallback(() => {
    if (!pool || !joinName.trim()) return
    addMember(pool.id, joinName.trim())
    localStorage.setItem(`folio-shared-pool-me-${pool.id}`, joinName.trim())
    setMyName(joinName.trim())
    setPool(getPoolByShareToken(token!))
    setJoinName("")
  }, [pool, joinName, token])

  const handleLog = useCallback(() => {
    if (!pool || !myName) return
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    logPoolExpense(pool.id, val, "general", myName, note || undefined)
    refresh(pool.id)
    setAmount("")
    setNote("")
    setLogged(true)
    setTimeout(() => setLogged(false), 2500)
  }, [pool, myName, amount, note, refresh])

  // Loading
  if (loading) {
    return (
      <div style={sharedPageContainer}>
        <p style={loadingText}>Loading…</p>
      </div>
    )
  }

  // Not found / revoked
  if (notFound || !pool) {
    return (
      <div style={sharedPageContainer}>
        <div style={notFoundContainer}>
          <div style={notFoundIconWrapper}>
            <Icon name="shared:link-expired" size={28} />
          </div>
          <h1 style={notFoundTitle}>
            This link is no longer active
          </h1>
          <p style={notFoundDescription}>
            The person who shared this pool may have removed it, or the link may have changed.
          </p>
        </div>
      </div>
    )
  }

  const pct = pool.monthlyLimit > 0
    ? Math.min(1, (summary?.spentThisMonth ?? 0) / pool.monthlyLimit)
    : 0

  return (
    <div style={sharedPageContainer}>
      {/* Badge */}
      <div style={headerBadgeRow}>
        <span style={headerBadge}>SHARED POOL</span>
        <span style={headerSubtitle}>
          · {pool.members.length + 1} {pool.members.length === 0 ? "person" : "people"}
        </span>
      </div>

      {/* Pool header */}
      <div style={{ textAlign: "center", marginBottom: spacing.md }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{pool.emoji}</span>
        <h1 style={{ ...typography.title, color: "var(--text)", marginTop: 8 }}>
          {pool.name}
        </h1>
        <p style={{ ...typography.caption, color: "var(--sub)", marginTop: 4, ...TABULAR_NUMS }}>
          ${pool.monthlyLimit}/month shared budget
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <GlassCard elevation="medium" style={{ padding: spacing.md, marginBottom: spacing.md }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <div>
              <p style={{ ...typography.caption, color: "var(--sub)" }}>Spent this month</p>
              <p style={{ ...typography.title, fontSize: typography.headline.fontSize, color: "var(--text)", ...TABULAR_NUMS }}>
                ${summary.spentThisMonth.toFixed(2)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...typography.caption, color: "var(--sub)" }}>Remaining</p>
              <p style={{ ...typography.title, fontSize: typography.headline.fontSize, color: colorRamp.success[500], ...TABULAR_NUMS }}>
                ${summary.remainingThisMonth.toFixed(2)}
              </p>
            </div>
          </div>
          <div style={progressTrack}>
            <div
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                borderRadius: 2,
                background: pct >= 0.9 ? colorRamp.warning[500] : colorRamp.accent[500],
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {summary.expenseCount > 0 && (
            <p style={{ ...typography.caption, color: "var(--sub)", marginTop: 8, ...TABULAR_NUMS }}>
              {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""} · ~${summary.perPersonShare.toFixed(2)}/person
            </p>
          )}
        </GlassCard>
      )}

      {/* Join or log */}
      {!myName ? (
        <GlassCard elevation="low" style={{ padding: 20, marginBottom: spacing.md }}>
          <p style={{ ...typography.body, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Join this pool
          </p>
          <p style={{ ...typography.caption, color: "var(--sub)", lineHeight: 1.5, marginBottom: 14 }}>
            Add your name so shared expenses show who logged them. This won&apos;t touch your personal budget.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin() }}
              placeholder="Your name"
              style={sharedInput}
              aria-label="Your name"
              maxLength={40}
            />
            <button onClick={handleJoin} disabled={!joinName.trim()} style={sharedActionButton(!!joinName.trim())}>
              Join
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard elevation="low" style={{ padding: 20, marginBottom: spacing.md }}>
          <p style={{ ...typography.body, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Log a shared expense
          </p>
          <p style={{ ...typography.caption, color: "var(--sub)", marginBottom: 14 }}>
            You&apos;re in as {myName}. Add something the group spent together.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", ...typography.body, color: "var(--muted)" }}>
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{ ...sharedInput, paddingLeft: 24, ...TABULAR_NUMS }}
                aria-label="Expense amount"
              />
            </div>
            <button onClick={handleLog} disabled={!(parseFloat(amount) > 0)} style={sharedActionButton(parseFloat(amount) > 0)}>
              {logged ? "Logged ✓" : "Log"}
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. Weekly shop"
            style={{ ...sharedInput, width: "100%" }}
            aria-label="Expense note"
            maxLength={80}
          />
        </GlassCard>
      )}

      {/* Recent shared expenses */}
      {expenses.length > 0 && (
        <div>
          <p style={sectionLabel}>Recent shared expenses</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {expenses.slice(0, 15).map((exp) => (
              <GlassCard key={exp.id} elevation="low" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ ...typography.body, color: "var(--text)", fontWeight: 500, ...TABULAR_NUMS }}>
                      ${exp.amount.toFixed(2)}
                      {exp.note && <span style={{ color: "var(--sub)", fontWeight: 400 }}> · {exp.note}</span>}
                    </p>
                    <p style={{ ...typography.caption, color: "var(--muted)", marginTop: 2 }}>
                      {exp.loggedBy} · {exp.date}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p style={footerAttribution}>
        Shared via Folio · Only shared pool costs are visible here
      </p>
    </div>
  )
}
