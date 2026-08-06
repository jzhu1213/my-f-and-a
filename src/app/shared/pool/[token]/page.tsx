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
 */

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  borderRadius,
  progressTrack,
} from "@/styles/shared"
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

// ============================================================================
// Styles
// ============================================================================

const pageContainer: React.CSSProperties = {
  maxWidth: CONTENT_MAX_WIDTH,
  margin: "0 auto",
  padding: `60px ${HORIZONTAL_PADDING}px 40px`,
  fontFamily: FONT_FAMILY,
  minHeight: "100vh",
  background: "var(--bg)",
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  outline: "none",
}

const actionButton = (enabled: boolean): React.CSSProperties => ({
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: FONT_FAMILY,
  color: enabled ? "#fff" : "var(--muted)",
  background: enabled ? "var(--accent)" : "rgba(255,255,255,0.04)",
  border: "none",
  borderRadius: 8,
  cursor: enabled ? "pointer" : "default",
})

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
      <div style={pageContainer}>
        <p style={{ color: "var(--sub)", fontSize: 14, textAlign: "center", marginTop: 80 }}>
          Loading…
        </p>
      </div>
    )
  }

  // Not found / revoked
  if (notFound || !pool) {
    return (
      <div style={pageContainer}>
        <div style={{ textAlign: "center", marginTop: 80 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">🔗</p>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 8, fontFamily: FONT_FAMILY }}>
            This link is no longer active
          </h1>
          <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.5, maxWidth: 300, margin: "0 auto", fontFamily: FONT_FAMILY }}>
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
    <div style={pageContainer}>
      {/* Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: borderRadius.full,
            background: "rgba(129, 140, 248, 0.1)",
            border: "1px solid rgba(129, 140, 248, 0.2)",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(129, 140, 248, 1)",
            letterSpacing: "0.04em",
            fontFamily: FONT_FAMILY,
          }}
        >
          SHARED POOL
        </span>
        <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: FONT_FAMILY }}>
          · {pool.members.length + 1} {pool.members.length === 0 ? "person" : "people"}
        </span>
      </div>

      {/* Pool header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{pool.emoji}</span>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 8, fontFamily: FONT_FAMILY }}>
          {pool.name}
        </h1>
        <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 4 }}>
          ${pool.monthlyLimit}/month shared budget
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <GlassCard elevation="low" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--sub)" }}>Spent this month</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                ${summary.spentThisMonth.toFixed(2)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--sub)" }}>Remaining</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
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
                background: pct >= 0.9 ? "var(--warning)" : "var(--accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {summary.expenseCount > 0 && (
            <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 8 }}>
              {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""} · ~${summary.perPersonShare.toFixed(2)}/person
            </p>
          )}
        </GlassCard>
      )}

      {/* Join or log */}
      {!myName ? (
        <GlassCard elevation="low" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Join this pool
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 14 }}>
            Add your name so shared expenses show who logged them. This won&apos;t touch your personal budget.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin() }}
              placeholder="Your name"
              style={inputStyle}
              aria-label="Your name"
              maxLength={40}
            />
            <button onClick={handleJoin} disabled={!joinName.trim()} style={actionButton(!!joinName.trim())}>
              Join
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard elevation="low" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Log a shared expense
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            You&apos;re in as {myName}. Add something the group spent together.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--muted)" }}>
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle, paddingLeft: 24, fontVariantNumeric: "tabular-nums" }}
                aria-label="Expense amount"
              />
            </div>
            <button onClick={handleLog} disabled={!(parseFloat(amount) > 0)} style={actionButton(parseFloat(amount) > 0)}>
              {logged ? "Logged ✓" : "Log"}
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. Weekly shop"
            style={{ ...inputStyle, width: "100%" }}
            aria-label="Expense note"
            maxLength={80}
          />
        </GlassCard>
      )}

      {/* Recent shared expenses */}
      {expenses.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 10, letterSpacing: "0.02em", fontFamily: FONT_FAMILY }}>
            Recent shared expenses
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {expenses.slice(0, 15).map((exp) => (
              <GlassCard key={exp.id} elevation="low" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                      ${exp.amount.toFixed(2)}
                      {exp.note && <span style={{ color: "var(--sub)", fontWeight: 400 }}> · {exp.note}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
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
      <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 24, opacity: 0.6, fontFamily: FONT_FAMILY }}>
        Shared via Folio · Only shared pool costs are visible here
      </p>
    </div>
  )
}
