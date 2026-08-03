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
 */

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  borderRadius,
} from "@/styles/shared"
import {
  getSharedGoalByToken,
  addParticipant,
  recordParticipantContribution,
  getParticipantBreakdown,
} from "@/lib/sharedGoalUtils"
import type { GoalParticipant } from "@/types"

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

    // Check if we have a stored participant ID for this goal
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
      <div style={pageContainer}>
        <p style={{ color: "var(--sub)", fontSize: 14, textAlign: "center", marginTop: 80 }}>
          Loading…
        </p>
      </div>
    )
  }

  // Not found
  if (notFound) {
    return (
      <div style={pageContainer}>
        <div style={{ textAlign: "center", marginTop: 80 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">🔗</p>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            This link is no longer active
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--sub)",
              lineHeight: 1.5,
              maxWidth: 300,
              margin: "0 auto",
              fontFamily: FONT_FAMILY,
            }}
          >
            The person who shared this goal may have revoked access, or the link may have expired.
          </p>
        </div>
      </div>
    )
  }

  const totalContributed = participants.reduce((sum, p) => sum + p.contributedAmount, 0)
  const myParticipant = participants.find(p => p.id === myParticipantId)

  return (
    <div style={pageContainer}>
      {/* Header badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 24,
        }}
      >
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
          SHARED GOAL
        </span>
        <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: FONT_FAMILY }}>
          · {participants.length} contributor{participants.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Goal info */}
      <GlassCard elevation="low" style={{ padding: "20px", marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
          👥 Group progress
        </p>
        <p
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            marginBottom: 4,
          }}
        >
          ${totalContributed.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </p>
        <p style={{ fontSize: 13, color: "var(--sub)" }}>
          contributed so far
        </p>
      </GlassCard>

      {/* Participant breakdown */}
      {participants.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Contributors</p>
          {participants.map((p, idx) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom:
                  idx < participants.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--text)", fontFamily: FONT_FAMILY }}>
                {p.name}
                {p.id === myParticipantId && (
                  <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 6 }}>
                    (you)
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--sub)",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: FONT_FAMILY,
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
        <GlassCard elevation="low" style={{ padding: "20px", marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Join this goal
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 14 }}>
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
              style={{
                flex: 1,
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                outline: "none",
              }}
              aria-label="Your name"
            />
            <button
              onClick={handleJoin}
              disabled={!joinName.trim()}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                color: joinName.trim() ? "#fff" : "var(--muted)",
                background: joinName.trim() ? "var(--accent)" : "rgba(255,255,255,0.04)",
                border: "none",
                borderRadius: 8,
                cursor: joinName.trim() ? "pointer" : "default",
              }}
            >
              Join
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard elevation="low" style={{ padding: "20px", marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            Add your contribution
          </p>
          {myParticipant && (
            <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
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
                  fontSize: 14,
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
                  width: "100%",
                  padding: "10px 12px 10px 24px",
                  fontSize: 14,
                  fontFamily: FONT_FAMILY,
                  color: "var(--text)",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  outline: "none",
                  fontVariantNumeric: "tabular-nums",
                }}
                aria-label="Contribution amount"
              />
            </div>
            <button
              onClick={handleContribute}
              disabled={!contributeAmount || parseFloat(contributeAmount) <= 0}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                color:
                  contributeAmount && parseFloat(contributeAmount) > 0
                    ? "#fff"
                    : "var(--muted)",
                background:
                  contributeAmount && parseFloat(contributeAmount) > 0
                    ? "var(--accent)"
                    : "rgba(255,255,255,0.04)",
                border: "none",
                borderRadius: 8,
                cursor:
                  contributeAmount && parseFloat(contributeAmount) > 0
                    ? "pointer"
                    : "default",
              }}
            >
              {contributed ? "Added ✓" : "Add"}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Footer */}
      <p
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 20,
          opacity: 0.6,
          fontFamily: FONT_FAMILY,
        }}
      >
        Shared via Folio · Everyone can see contributions
      </p>
    </div>
  )
}

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

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
  letterSpacing: "0.02em",
  fontFamily: FONT_FAMILY,
}
