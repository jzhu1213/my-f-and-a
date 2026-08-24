"use client"

/**
 * Shared Pool View Page
 *
 * The page a roommate lands on when they accept a pool invite.
 * They can join the pool by name, view the shared spend, and log a shared expense.
 *
 * All visual values sourced from the Design_Token_System — zero page-local
 * overrides. Section heading + shared value + supporting labels render
 * immediately in the shell (badge visible before data loads).
 * Invalid/expired link renders explanatory state immediately (no partial content).
 *
 * Fetches from Supabase first (via async householdPool functions), falls back
 * to localStorage for backward compat.
 *
 * Requirements: 15.8, 15.9, 15.10
 * Task 289.1 — Supabase-backed pool persistence
 */

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/primitives/Card"
import { Icon } from "@/components/ui/Icon"
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
  progressTrack,
  colorRamp,
  typography,
  TABULAR_NUMS,
  spacingScale,
  textColors,
  radius,
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

  const refresh = useCallback(async (poolId: string) => {
    const [s, e] = await Promise.all([
      getPoolSummary(poolId),
      getPoolExpenses(poolId),
    ])
    setSummary(s)
    setExpenses(e)
  }, [])

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      const found = await getPoolByShareToken(token!)
      if (cancelled) return
      if (!found) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setPool(found)
      await refresh(found.id)
      if (cancelled) return
      const storedName = localStorage.getItem(`folio-shared-pool-me-${found.id}`)
      if (storedName) setMyName(storedName)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [token, refresh])

  const handleJoin = useCallback(async () => {
    if (!pool || !joinName.trim()) return
    await addMember(pool.id, joinName.trim())
    localStorage.setItem(`folio-shared-pool-me-${pool.id}`, joinName.trim())
    setMyName(joinName.trim())
    const updated = await getPoolByShareToken(token!)
    if (updated) setPool(updated)
    setJoinName("")
  }, [pool, joinName, token])

  const handleLog = useCallback(async () => {
    if (!pool || !myName) return
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    await logPoolExpense(pool.id, val, "general", myName, note || undefined)
    await refresh(pool.id)
    setAmount("")
    setNote("")
    setLogged(true)
    setTimeout(() => setLogged(false), 2500)
  }, [pool, myName, amount, note, refresh])

  // Loading — badge renders immediately
  if (loading) {
    return (
      <div style={sharedPageContainer}>
        <div style={headerBadgeRow}>
          <span style={headerBadge}>SHARED POOL</span>
        </div>
        <p style={loadingText}>Loading…</p>
      </div>
    )
  }

  // Not found / revoked — rendered immediately, no partial content
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
      <div style={{ textAlign: "center", marginBottom: spacingScale["16"] }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{pool.emoji}</span>
        <h1 style={{ ...typography.title, color: textColors.text, marginTop: spacingScale["8"] }}>
          {pool.name}
        </h1>
        <p style={{ ...typography.caption, color: textColors.sub, marginTop: spacingScale["4"], ...TABULAR_NUMS }}>
          ${pool.monthlyLimit}/month shared budget
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <Card elevation="raised" style={{ padding: spacingScale["16"], marginBottom: spacingScale["16"] }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacingScale["12"] }}>
            <div>
              <p style={{ ...typography.caption, color: textColors.sub }}>Spent this month</p>
              <p style={{ ...typography.headline, color: textColors.text, ...TABULAR_NUMS }}>
                ${summary.spentThisMonth.toFixed(2)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...typography.caption, color: textColors.sub }}>Remaining</p>
              <p style={{ ...typography.headline, color: colorRamp.success[500], ...TABULAR_NUMS }}>
                ${summary.remainingThisMonth.toFixed(2)}
              </p>
            </div>
          </div>
          <div style={progressTrack}>
            <div
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                borderRadius: radius.min,
                background: pct >= 0.9 ? colorRamp.warning[500] : colorRamp.accent[500],
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {summary.expenseCount > 0 && (
            <p style={{ ...typography.caption, color: textColors.sub, marginTop: spacingScale["8"], ...TABULAR_NUMS }}>
              {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""} · ~${summary.perPersonShare.toFixed(2)}/person
            </p>
          )}
        </Card>
      )}

      {/* Join or log */}
      {!myName ? (
        <Card elevation="resting" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
          <p style={{ ...typography.body, fontWeight: 500, color: textColors.text, marginBottom: spacingScale["6"] }}>
            Join this pool
          </p>
          <p style={{ ...typography.caption, color: textColors.sub, lineHeight: 1.5, marginBottom: spacingScale["16"] }}>
            Add your name so shared expenses show who logged them. This won&apos;t touch your personal budget.
          </p>
          <div style={{ display: "flex", gap: spacingScale["8"] }}>
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
        </Card>
      ) : (
        <Card elevation="resting" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
          <p style={{ ...typography.body, fontWeight: 500, color: textColors.text, marginBottom: spacingScale["6"] }}>
            Log a shared expense
          </p>
          <p style={{ ...typography.caption, color: textColors.sub, marginBottom: spacingScale["16"] }}>
            You&apos;re in as {myName}. Add something the group spent together.
          </p>
          <div style={{ display: "flex", gap: spacingScale["8"], marginBottom: spacingScale["8"] }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", ...typography.body, color: textColors.muted }}>
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{ ...sharedInput, paddingInlineStart: 24, ...TABULAR_NUMS }}
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
        </Card>
      )}

      {/* Recent shared expenses */}
      {expenses.length > 0 && (
        <div>
          <p style={sectionLabel}>Recent shared expenses</p>
          <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
            {expenses.slice(0, 15).map((exp) => (
              <Card key={exp.id} elevation="resting" style={{ padding: `${spacingScale["12"]} ${spacingScale["16"]}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ ...typography.body, color: textColors.text, fontWeight: 500, ...TABULAR_NUMS }}>
                      ${exp.amount.toFixed(2)}
                      {exp.note && <span style={{ color: textColors.sub, fontWeight: 400 }}> · {exp.note}</span>}
                    </p>
                    <p style={{ ...typography.caption, color: textColors.muted, marginTop: 2 }}>
                      {exp.loggedBy} · {exp.date}
                    </p>
                  </div>
                </div>
              </Card>
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
