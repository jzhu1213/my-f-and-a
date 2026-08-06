"use client"

/**
 * Shared Goal View Page
 *
 * A page that allows participants to view a shared goal's progress and
 * per-person contributions. Participants can also record their own contributions.
 *
 * For MVP, reads from localStorage keyed by token. In production, this would
 * fetch from a Supabase endpoint so it works cross-device.
 *
 * Task 169.1 — Shared goals
 * Phase 6, Task 269.1 — Premium design system styling
 */

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { Icon } from "@/components/ui/Icon"
import {
  getSharedGoalByToken,
  addParticipant,
  recordParticipantContribution,
  getParticipantBreakdown,
} from "@/lib/sharedGoalUtils"
import type { GoalParticipant } from "@/types"
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
  typography,
  TABULAR_NUMS,
  FONT_FAMILY,
  spacing,
  borderRadius,
} from "../../sharedPageStyles"

// ============================================================================
// Component
// ============================================================================

export default function SharedGoalViewPage() {
  const params = useParams()
  const token = params?.token as string | undefined

  const [goalId, setGoalId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<GoalParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Join form
  const [joinName, setJoinName] = useState("")
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null)

  // Contribute form
  const [contributeAmount, setContributeAmount] = useState("")
  const [contributed, setContributed] = useState(false)

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const meta = getSharedGoalByToken(token)
    if (!meta) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setGoalId(meta.goalId)
    setParticipants(getParticipantBreakdown(meta.goalId))

    const storedId = localStorage.getItem(`folio-shared-goal-me-${meta.goalId}`)
    if (storedId) setMyParticipantId(storedId)

    setLoading(false)
  }, [token])

  const handleJoin = useCallback(() => {
    if (!goalId || !joinName.trim()) return
    const p = addParticipant(goalId, joinName.trim())
    if (p) {
      setMyParticipantId(p.id)
      localStorage.setItem(`folio-shared-goal-me-${goalId}`, p.id)
      setParticipants(getParticipantBreakdown(goalId))
      setJoinName("")
    }
  }, [goalId, joinName])

  const handleContribute = useCallback(() => {
    if (!goalId || !myParticipantId) return
    const amount = parseFloat(contributeAmount)
    if (!amount || amount <= 0) return

    recordParticipantContribution(goalId, myParticipantId, amount)
    setParticipants(getParticipantBreakdown(goalId))
    setContributeAmount("")
    setContributed(true)
    setTimeout(() => setContributed(false), 2500)
  }, [goalId, myParticipantId, contributeAmount])

  // Loading state
  if (loading) {
    return (
      <div style={sharedPageContainer}>
        <p style={loadingText}>Loading…</p>
      </div>
    )
  }

  // Not found
  if (notFound) {
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
            The person who shared this goal may have revoked access, or the link may have expired.
          </p>
        </div>
      </div>
    )
  }

  const totalContributed = participants.reduce((sum, p) => sum + p.contributedAmount, 0)
  const myParticipant = participants.find(p => p.id === myParticipantId)

  return (
    <div style={sharedPageContainer}>
      {/* Header badge */}
      <div style={headerBadgeRow}>
        <span style={headerBadge}>SHARED GOAL</span>
        <span style={headerSubtitle}>
          · {participants.length} contributor{participants.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Goal info — hero card */}
      <GlassCard elevation="medium" style={{ padding: "20px", marginBottom: spacing.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
          <span style={{ color: colorRamp.accent[500] }}>
            <Icon name="shared:group" size={18} />
          </span>
          <p style={{ ...typography.overline, color: "var(--muted)", marginBottom: 0 }}>
            Group progress
          </p>
        </div>
        <p
          style={{
            ...typography.title,
            color: "var(--text)",
            ...TABULAR_NUMS,
            marginBottom: 4,
          }}
        >
          ${totalContributed.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </p>
        <p style={{ ...typography.caption, color: "var(--sub)" }}>
          contributed so far
        </p>
      </GlassCard>

      {/* Participant breakdown */}
      {participants.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
          <p style={sectionLabel}>Contributors</p>
          {participants.map((p, idx) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom:
                  idx < participants.length - 1 ? `1px solid ${fills[8]}` : "none",
              }}
            >
              <span style={{ ...typography.body, color: "var(--text)" }}>
                {p.name}
                {p.id === myParticipantId && (
                  <span style={{ ...typography.caption, color: colorRamp.accent[500], marginLeft: 6 }}>
                    (you)
                  </span>
                )}
              </span>
              <span
                style={{
                  ...typography.body,
                  fontWeight: 500,
                  color: "var(--sub)",
                  ...TABULAR_NUMS,
                }}
              >
                ${p.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </GlassCard>
      )}

      {/* Join / Contribute */}
      {!myParticipantId ? (
        <GlassCard elevation="low" style={{ padding: "20px", marginBottom: spacing.md }}>
          <p style={{ ...typography.body, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Join this goal
          </p>
          <p style={{ ...typography.caption, color: "var(--sub)", lineHeight: 1.5, marginBottom: 14 }}>
            Add your name to start tracking your contributions.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleJoin()
              }}
              placeholder="Your name"
              style={sharedInput}
              aria-label="Your name"
            />
            <button
              onClick={handleJoin}
              disabled={!joinName.trim()}
              style={sharedActionButton(!!joinName.trim())}
            >
              Join
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard elevation="low" style={{ padding: "20px", marginBottom: spacing.md }}>
          <p style={{ ...typography.body, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Add your contribution
          </p>
          {myParticipant && (
            <p style={{ ...typography.caption, color: "var(--sub)", marginBottom: 14 }}>
              You&apos;ve contributed ${myParticipant.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} so far. Nice work!
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...typography.body,
                  color: "var(--muted)",
                }}
              >
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={contributeAmount}
                onChange={e => setContributeAmount(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleContribute()
                }}
                placeholder="0"
                style={{
                  ...sharedInput,
                  width: "100%",
                  paddingLeft: 24,
                  ...TABULAR_NUMS,
                }}
                aria-label="Contribution amount"
              />
            </div>
            <button
              onClick={handleContribute}
              disabled={!contributeAmount || parseFloat(contributeAmount) <= 0}
              style={sharedActionButton(!!contributeAmount && parseFloat(contributeAmount) > 0)}
            >
              {contributed ? "Added ✓" : "Add"}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Footer */}
      <p style={footerAttribution}>
        Shared via Folio · Everyone can see contributions
      </p>
    </div>
  )
}
