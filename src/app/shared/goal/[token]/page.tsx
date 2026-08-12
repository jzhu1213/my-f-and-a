"use client"

/**
 * Shared Goal View Page
 *
 * A page that allows participants to view a shared goal's progress and
 * per-person contributions. Participants can also record their own contributions.
 *
 * All visual values sourced from the Design_Token_System — zero page-local
 * overrides. Section heading + shared value + supporting labels render
 * immediately in the shell (badge visible before data loads).
 * Invalid/expired link renders explanatory state immediately (no partial content).
 *
 * For MVP, reads from localStorage keyed by token. In production this would
 * fetch from a Supabase endpoint so it works cross-device.
 *
 * Requirements: 15.8, 15.9, 15.10
 */

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/primitives/Card"
import { Icon } from "@/components/ui/Icon"
import {
  getSharedGoalByToken,
  addParticipant,
  recordParticipantContribution,
  getParticipantBreakdown,
} from "@/lib/sharedGoalUtils"
import type { Goal, GoalParticipant } from "@/types"
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
  elevations,
} from "../../sharedPageStyles"

// ============================================================================
// Component
// ============================================================================

export default function SharedGoalViewPage() {
  const params = useParams()
  const token = params?.token as string | undefined

  const [goalId, setGoalId] = useState<string | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
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

    async function loadGoal() {
      if (!token) return
      const goal = await getSharedGoalByToken(token)
      if (!goal) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setGoalId(goal.id)
      setGoal(goal)
      const breakdown = await getParticipantBreakdown(goal.id)
      setParticipants(breakdown)

      const storedId = localStorage.getItem(`folio-shared-goal-me-${goal.id}`)
      if (storedId) setMyParticipantId(storedId)

      setLoading(false)
    }

    loadGoal()
  }, [token])

  const handleJoin = useCallback(async () => {
    if (!goalId || !joinName.trim()) return
    const p = await addParticipant(goalId, joinName.trim())
    if (p) {
      setMyParticipantId(p.id)
      localStorage.setItem(`folio-shared-goal-me-${goalId}`, p.id)
      const breakdown = await getParticipantBreakdown(goalId)
      setParticipants(breakdown)
      setJoinName("")
    }
  }, [goalId, joinName])

  const handleContribute = useCallback(async () => {
    if (!goalId || !myParticipantId) return
    const amount = parseFloat(contributeAmount)
    if (!amount || amount <= 0) return

    await recordParticipantContribution(goalId, myParticipantId, amount)
    const breakdown = await getParticipantBreakdown(goalId)
    setParticipants(breakdown)
    setContributeAmount("")
    setContributed(true)
    setTimeout(() => setContributed(false), 2500)
  }, [goalId, myParticipantId, contributeAmount])

  // Loading state — badge renders immediately
  if (loading) {
    return (
      <div style={sharedPageContainer}>
        <div style={headerBadgeRow}>
          <span style={headerBadge}>SHARED GOAL</span>
        </div>
        <p style={loadingText}>Loading…</p>
      </div>
    )
  }

  // Not found — rendered immediately, no partial content
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
  const targetAmount = goal?.targetAmount ?? 0
  const progressPct = targetAmount > 0
    ? Math.min(1, totalContributed / targetAmount)
    : 0

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
      <Card elevation="raised" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
        {goal && (
          <div style={{ textAlign: "center", marginBottom: spacingScale["16"] }}>
            <span style={{ fontSize: 36 }} aria-hidden="true">{goal.emoji}</span>
            <h1 style={{ ...typography.title, color: textColors.text, marginTop: spacingScale["8"], marginBottom: spacingScale["4"] }}>
              {goal.name}
            </h1>
            {targetAmount > 0 && (
              <p style={{ ...typography.caption, color: textColors.sub }}>
                Goal: ${targetAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: spacingScale["12"], marginBottom: spacingScale["12"] }}>
          <span style={{ color: colorRamp.accent[500] }}>
            <Icon name="shared:group" size={18} />
          </span>
          <p style={{ ...typography.overline, color: textColors.muted, marginBottom: 0 }}>
            Group progress
          </p>
        </div>
        <p
          style={{
            ...typography.title,
            color: textColors.text,
            ...TABULAR_NUMS,
            marginBottom: spacingScale["4"],
          }}
        >
          ${totalContributed.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          {targetAmount > 0 && (
            <span style={{ ...typography.body, color: textColors.sub, fontWeight: 400 }}>
              {" "}/ ${targetAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          )}
        </p>
        <p style={{ ...typography.caption, color: textColors.sub, marginBottom: spacingScale["12"] }}>
          contributed so far
        </p>
        {targetAmount > 0 && (
          <div style={progressTrack}>
            <div
              style={{
                width: `${progressPct * 100}%`,
                height: "100%",
                borderRadius: radius.min,
                background: progressPct >= 1 ? colorRamp.success[500] : colorRamp.accent[500],
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </Card>

      {/* Participant breakdown */}
      {participants.length > 0 && (
        <Card elevation="resting" style={{ padding: `${spacingScale["20"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
          <p style={sectionLabel}>Contributors</p>
          {participants.map((p, idx) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `${spacingScale["8"]} 0`,
                borderBottom:
                  idx < participants.length - 1 ? elevations.resting.border : "none",
              }}
            >
              <span style={{ ...typography.body, color: textColors.text }}>
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
                  color: textColors.sub,
                  ...TABULAR_NUMS,
                }}
              >
                ${p.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Join / Contribute */}
      {!myParticipantId ? (
        <Card elevation="resting" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
          <p style={{ ...typography.body, fontWeight: 500, color: textColors.text, marginBottom: spacingScale["6"] }}>
            Join this goal
          </p>
          <p style={{ ...typography.caption, color: textColors.sub, lineHeight: 1.5, marginBottom: spacingScale["16"] }}>
            Add your name to start tracking your contributions.
          </p>
          <div style={{ display: "flex", gap: spacingScale["8"] }}>
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
        </Card>
      ) : (
        <Card elevation="resting" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
          <p style={{ ...typography.body, fontWeight: 500, color: textColors.text, marginBottom: spacingScale["6"] }}>
            Add your contribution
          </p>
          {myParticipant && (
            <p style={{ ...typography.caption, color: textColors.sub, marginBottom: spacingScale["16"] }}>
              You&apos;ve contributed ${myParticipant.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} so far. Nice work!
            </p>
          )}
          <div style={{ display: "flex", gap: spacingScale["8"] }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...typography.body,
                  color: textColors.muted,
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
        </Card>
      )}

      {/* Footer */}
      <p style={footerAttribution}>
        Shared via Folio · Everyone can see contributions
      </p>
    </div>
  )
}
