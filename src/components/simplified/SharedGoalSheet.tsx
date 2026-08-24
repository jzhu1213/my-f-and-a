"use client"

/**
 * SharedGoalSheet
 *
 * A bottom sheet for managing shared goal settings — viewing participants,
 * adding new ones, recording contributions, and sharing the invite link.
 *
 * Task 169.1 — Shared goals
 * Task 288.1 — Persist shared goals & participants server-side
 */

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { Goal, GoalParticipant } from "@/types"
import {
  createSharedGoalToken,
  addParticipant,
  recordParticipantContribution,
  removeParticipant,
  getSharedGoalUrl,
  revokeSharedGoalToken,
  getParticipantBreakdown,
  isGoalShared,
} from "@/lib/sharedGoalUtils"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

export interface SharedGoalSheetProps {
  isOpen: boolean
  goal: Goal | null
  onClose: () => void
  /** Called after sharing state changes so the parent can refresh goal data */
  onGoalUpdated?: () => void
  /** Authenticated user ID — enables Supabase persistence. Falls back to localStorage if absent. */
  userId?: string | null
}

// ============================================================================
// Component
// ============================================================================

export function SharedGoalSheet({ isOpen, goal, onClose, onGoalUpdated, userId }: SharedGoalSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [participants, setParticipants] = useState<GoalParticipant[]>([])
  const [newName, setNewName] = useState("")
  const [contributeId, setContributeId] = useState<string | null>(null)
  const [contributeAmount, setContributeAmount] = useState("")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [loading, setLoading] = useState(false)

  // Refresh state when sheet opens
  useEffect(() => {
    if (!isOpen || !goal) return
    let cancelled = false

    async function refresh() {
      if (!goal) return
      setLoading(true)
      try {
        const shared = await isGoalShared(goal.id, userId)
        if (cancelled) return
        setIsShared(shared)
        if (shared) {
          const breakdown = await getParticipantBreakdown(goal.id, userId)
          if (cancelled) return
          setParticipants(breakdown)
          const token = goal.shareToken
          if (token) setShareUrl(getSharedGoalUrl(token))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    refresh()
    return () => { cancelled = true }
  }, [isOpen, goal, userId])

  const handleEnableSharing = useCallback(async () => {
    if (!goal) return
    setLoading(true)
    try {
      const token = await createSharedGoalToken(goal.id, userId)
      setIsShared(true)
      setShareUrl(getSharedGoalUrl(token))
      onGoalUpdated?.()
    } finally {
      setLoading(false)
    }
  }, [goal, userId, onGoalUpdated])

  const handleDisableSharing = useCallback(async () => {
    if (!goal) return
    setLoading(true)
    try {
      await revokeSharedGoalToken(goal.id, userId)
      setIsShared(false)
      setShareUrl(null)
      setParticipants([])
      onGoalUpdated?.()
    } finally {
      setLoading(false)
    }
  }, [goal, userId, onGoalUpdated])

  const handleAddParticipant = useCallback(async () => {
    if (!goal || !newName.trim()) return
    const p = await addParticipant(goal.id, newName.trim(), userId)
    if (p) {
      setParticipants(prev => [...prev, p])
      setNewName("")
      onGoalUpdated?.()
    }
  }, [goal, newName, userId, onGoalUpdated])

  const handleContribute = useCallback(async () => {
    if (!goal || !contributeId) return
    const amount = parseFloat(contributeAmount)
    if (!amount || amount <= 0) return
    const updated = await recordParticipantContribution(goal.id, contributeId, amount, userId)
    if (updated) {
      setParticipants(prev =>
        prev.map(p => (p.id === contributeId ? updated : p))
      )
    }
    setContributeId(null)
    setContributeAmount("")
    onGoalUpdated?.()
  }, [goal, contributeId, contributeAmount, userId, onGoalUpdated])

  const handleRemoveParticipant = useCallback(
    async (participantId: string) => {
      if (!goal) return
      const success = await removeParticipant(goal.id, participantId, userId)
      if (success) {
        setParticipants(prev => prev.filter(p => p.id !== participantId))
        onGoalUpdated?.()
      }
    },
    [goal, userId, onGoalUpdated]
  )

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
    }
  }, [shareUrl])

  const handleClose = useCallback(() => {
    setNewName("")
    setContributeId(null)
    setContributeAmount("")
    setCopied(false)
    setParticipants([])
    setIsShared(false)
    setShareUrl(null)
    onClose()
  }, [onClose])

  if (!isOpen || !goal) return null

  const totalFromParticipants = participants.reduce((sum, p) => sum + p.contributedAmount, 0)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
            onClick={handleClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--color-canvas)",
              zIndex: 1000,
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: prefersReducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.gentle}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "var(--surface)",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: "24px 20px 40px",
              zIndex: 1001,
              fontFamily: FONT_FAMILY,
            }}
          >
            {/* Handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "var(--fill-15)",
                margin: "0 auto 20px",
              }}
            />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: HORIZONTAL_PADDING }}>
              <span style={{ fontSize: typography.headline.fontSize }}>{goal.emoji}</span>
              <div>
                <h3 style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)" }}>
                  {goal.name}
                </h3>
                <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)" }}>
                  Shared goal settings
                </p>
              </div>
            </div>

            {/* Enable/Disable sharing */}
            {!isShared ? (
              <GlassCard elevation="low" style={{ padding: "20px", marginBottom: spacing.md, textAlign: "center" }}>
                <p style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">👥</p>
                <p style={{ fontSize: typography.body.fontSize, color: "var(--text)", marginBottom: 6, fontWeight: fontWeights.medium }}>
                  Save together
                </p>
                <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.5, marginBottom: spacing.md }}>
                  Invite friends or family to contribute toward this goal. Everyone can see progress and chip in.
                </p>
                <motion.button
                  onClick={handleEnableSharing}
                  whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                  transition={springs.snappy}
                  disabled={loading}
                  style={{
                    padding: "12px 24px",
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: radius.control,
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Setting up…" : "Make this a shared goal"}
                </motion.button>
              </GlassCard>
            ) : (
              <>
                {/* Share link */}
                {shareUrl && (
                  <GlassCard elevation="low" style={{ padding: "14px 16px", marginBottom: spacing.md }}>
                    <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginBottom: spacing.xs, fontWeight: fontWeights.semibold }}>
                      Invite link
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
                      <input
                        readOnly
                        value={shareUrl}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          color: "var(--sub)",
                          background: "var(--fill-04)",
                          border: "1px solid var(--border)",
                          borderRadius: radius.min,
                          outline: "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        aria-label="Share link URL"
                      />
                      <motion.button
                        onClick={handleCopyLink}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          padding: "8px 14px",
                          fontSize: typography['body-sm'].fontSize,
                          fontWeight: fontWeights.semibold,
                          fontFamily: FONT_FAMILY,
                          color: copied ? "var(--success)" : "var(--accent)",
                          background: copied ? "var(--success-100)" : "var(--accent-muted)",
                          border: "none",
                          borderRadius: radius.min,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </motion.button>
                    </div>
                  </GlassCard>
                )}

                {/* Participant list */}
                <div style={{ marginBottom: spacing.md }}>
                  <p style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.semibold, color: "var(--muted)", marginBottom: 10 }}>
                    Contributors ({participants.length})
                  </p>

                  {participants.length === 0 && (
                    <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: spacing.sm }}>
                      No one has joined yet. Share the link above to invite people.
                    </p>
                  )}

                  {participants.map(p => (
                    <GlassCard
                      key={p.id}
                      elevation="low"
                      style={{ padding: "12px 14px", marginBottom: spacing.xs }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: "var(--text)" }}>
                            {p.name}
                          </p>
                          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
                            ${p.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} contributed
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {contributeId === p.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)" }}>$</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={contributeAmount}
                                onChange={e => setContributeAmount(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleContribute()
                                  if (e.key === "Escape") setContributeId(null)
                                }}
                                placeholder="0"
                                style={{
                                  width: 54,
                                  padding: "4px 6px",
                                  fontSize: typography['body-sm'].fontSize,
                                  fontFamily: FONT_FAMILY,
                                  color: "var(--text)",
                                  background: "var(--fill-06)",
                                  border: "1px solid var(--border)",
                                  borderRadius: radius.min,
                                  outline: "none",
                                }}
                                autoFocus
                                aria-label={`Contribution amount for ${p.name}`}
                              />
                              <button
                                onClick={handleContribute}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: typography.caption.fontSize,
                                  fontWeight: fontWeights.semibold,
                                  fontFamily: FONT_FAMILY,
                                  color: "var(--text)",
                                  background: "var(--accent)",
                                  border: "none",
                                  borderRadius: radius.min,
                                  cursor: "pointer",
                                }}
                              >
                                Add
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setContributeId(p.id)
                                  setContributeAmount("")
                                }}
                                aria-label={`Record contribution for ${p.name}`}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: typography.caption.fontSize,
                                  fontFamily: FONT_FAMILY,
                                  color: "var(--accent)",
                                  background: "var(--accent-muted)",
                                  border: "none",
                                  borderRadius: radius.min,
                                  cursor: "pointer",
                                }}
                              >
                                + $
                              </button>
                              <button
                                onClick={() => handleRemoveParticipant(p.id)}
                                aria-label={`Remove ${p.name}`}
                                style={{
                                  padding: "4px 6px",
                                  fontSize: typography.caption.fontSize,
                                  fontFamily: FONT_FAMILY,
                                  color: "var(--error)",
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  ))}

                  {/* Add participant form */}
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, marginTop: 10 }}>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleAddParticipant()
                      }}
                      placeholder="Add a person…"
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        fontSize: typography['body-sm'].fontSize,
                        fontFamily: FONT_FAMILY,
                        color: "var(--text)",
                        background: "var(--fill-04)",
                        border: "1px solid var(--border)",
                        borderRadius: radius.control,
                        outline: "none",
                      }}
                      aria-label="New participant name"
                    />
                    <motion.button
                      onClick={handleAddParticipant}
                      whileTap={{ scale: 0.95 }}
                      disabled={!newName.trim()}
                      style={{
                        padding: "10px 14px",
                        fontSize: typography['body-sm'].fontSize,
                        fontWeight: fontWeights.semibold,
                        fontFamily: FONT_FAMILY,
                        color: newName.trim() ? "var(--accent)" : "var(--muted)",
                        background: "var(--accent-muted)",
                        border: "none",
                        borderRadius: radius.control,
                        cursor: newName.trim() ? "pointer" : "default",
                        opacity: newName.trim() ? 1 : 0.5,
                      }}
                    >
                      Add
                    </motion.button>
                  </div>
                </div>

                {/* Contribution summary */}
                {participants.length > 0 && (
                  <GlassCard elevation="low" style={{ padding: "14px 16px", marginBottom: spacing.md }}>
                    <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginBottom: spacing.xs, fontWeight: fontWeights.semibold }}>
                      Contribution breakdown
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {participants.map(p => {
                        const pct = goal.targetAmount > 0
                          ? Math.min((p.contributedAmount / goal.targetAmount) * 100, 100)
                          : 0
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                            <span style={{ fontSize: typography['body-sm'].fontSize, color: "var(--text)", minWidth: 70 }}>
                              {p.name}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: radius.full,
                                background: "var(--fill-06)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  borderRadius: radius.full,
                                  background: "var(--accent)",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: typography.caption.fontSize,
                                color: "var(--sub)",
                                fontVariantNumeric: "tabular-nums",
                                minWidth: 40,
                                textAlign: "right",
                              }}
                            >
                              ${p.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <p
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        color: "var(--muted)",
                        marginTop: 10,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Total from participants: ${totalFromParticipants.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      {" "}/ ${goal.targetAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                  </GlassCard>
                )}

                {/* Stop sharing */}
                <motion.button
                  onClick={handleDisableSharing}
                  whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                  transition={springs.snappy}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    fontFamily: FONT_FAMILY,
                    color: "var(--error)",
                    background: "var(--error-100)",
                    border: "1px solid var(--error-200)",
                    borderRadius: radius.control,
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  Stop sharing this goal
                </motion.button>
              </>
            )}

            {/* Close button */}
            <motion.button
              onClick={handleClose}
              whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
              transition={springs.snappy}
              style={{
                width: "100%",
                padding: "14px",
                marginTop: spacing.md,
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.medium,
                fontFamily: FONT_FAMILY,
                color: "var(--sub)",
                background: "var(--fill-04)",
                border: "1px solid var(--border)",
                borderRadius: radius.control,
                cursor: "pointer",
              }}
            >
              Done
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
