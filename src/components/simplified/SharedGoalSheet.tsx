"use client"

/**
 * SharedGoalSheet
 *
 * A bottom sheet for managing shared goal settings — viewing participants,
 * adding new ones, recording contributions, and sharing the invite link.
 *
 * Task 169.1 — Shared goals
 */

import { useState, useCallback } from "react"
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
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface SharedGoalSheetProps {
  isOpen: boolean
  goal: Goal | null
  onClose: () => void
  /** Called after sharing state changes so the parent can refresh goal data */
  onGoalUpdated?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SharedGoalSheet({ isOpen, goal, onClose, onGoalUpdated }: SharedGoalSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [participants, setParticipants] = useState<GoalParticipant[]>([])
  const [newName, setNewName] = useState("")
  const [contributeId, setContributeId] = useState<string | null>(null)
  const [contributeAmount, setContributeAmount] = useState("")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isShared, setIsShared] = useState(false)

  // Refresh participants when sheet opens
  const refreshState = useCallback(() => {
    if (!goal) return
    const shared = isGoalShared(goal.id)
    setIsShared(shared)
    if (shared) {
      setParticipants(getParticipantBreakdown(goal.id))
      const token = goal.shareToken
      if (token) setShareUrl(getSharedGoalUrl(token))
    }
  }, [goal])

  // Effect-like initialization on open
  if (isOpen && goal) {
    // We use a simple flag check to avoid re-running on every render
    if (participants.length === 0 && !isShared) {
      refreshState()
    }
  }

  const handleEnableSharing = useCallback(() => {
    if (!goal) return
    const token = createSharedGoalToken(goal.id)
    setIsShared(true)
    setShareUrl(getSharedGoalUrl(token))
    onGoalUpdated?.()
  }, [goal, onGoalUpdated])

  const handleDisableSharing = useCallback(() => {
    if (!goal) return
    revokeSharedGoalToken(goal.id)
    setIsShared(false)
    setShareUrl(null)
    setParticipants([])
    onGoalUpdated?.()
  }, [goal, onGoalUpdated])

  const handleAddParticipant = useCallback(() => {
    if (!goal || !newName.trim()) return
    const p = addParticipant(goal.id, newName.trim())
    if (p) {
      setParticipants(prev => [...prev, p])
      setNewName("")
      onGoalUpdated?.()
    }
  }, [goal, newName, onGoalUpdated])

  const handleContribute = useCallback(() => {
    if (!goal || !contributeId) return
    const amount = parseFloat(contributeAmount)
    if (!amount || amount <= 0) return
    recordParticipantContribution(goal.id, contributeId, amount)
    setParticipants(getParticipantBreakdown(goal.id))
    setContributeId(null)
    setContributeAmount("")
    onGoalUpdated?.()
  }, [goal, contributeId, contributeAmount, onGoalUpdated])

  const handleRemoveParticipant = useCallback(
    (participantId: string) => {
      if (!goal) return
      removeParticipant(goal.id, participantId)
      setParticipants(prev => prev.filter(p => p.id !== participantId))
      onGoalUpdated?.()
    },
    [goal, onGoalUpdated]
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
              background: "rgba(0,0,0,0.5)",
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
                background: "rgba(255,255,255,0.15)",
                margin: "0 auto 20px",
              }}
            />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>{goal.emoji}</span>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
                  {goal.name}
                </h3>
                <p style={{ fontSize: 13, color: "var(--sub)" }}>
                  Shared goal settings
                </p>
              </div>
            </div>

            {/* Enable/Disable sharing */}
            {!isShared ? (
              <GlassCard elevation="low" style={{ padding: "20px", marginBottom: 16, textAlign: "center" }}>
                <p style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">👥</p>
                <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 6, fontWeight: 500 }}>
                  Save together
                </p>
                <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 16 }}>
                  Invite friends or family to contribute toward this goal. Everyone can see progress and chip in.
                </p>
                <motion.button
                  onClick={handleEnableSharing}
                  whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                  transition={springs.snappy}
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: FONT_FAMILY,
                    color: "#fff",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Make this a shared goal
                </motion.button>
              </GlassCard>
            ) : (
              <>
                {/* Share link */}
                {shareUrl && (
                  <GlassCard elevation="low" style={{ padding: "14px 16px", marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                      Invite link
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        readOnly
                        value={shareUrl}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          color: "var(--sub)",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
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
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: FONT_FAMILY,
                          color: copied ? "var(--success)" : "var(--accent)",
                          background: copied ? "rgba(6, 214, 160, 0.1)" : "var(--accent-muted)",
                          border: "none",
                          borderRadius: 6,
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
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>
                    Contributors ({participants.length})
                  </p>

                  {participants.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 12 }}>
                      No one has joined yet. Share the link above to invite people.
                    </p>
                  )}

                  {participants.map(p => (
                    <GlassCard
                      key={p.id}
                      elevation="low"
                      style={{ padding: "12px 14px", marginBottom: 8 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                            {p.name}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
                            ${p.contributedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} contributed
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {contributeId === p.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>$</span>
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
                                  fontSize: 12,
                                  fontFamily: FONT_FAMILY,
                                  color: "var(--text)",
                                  background: "rgba(255,255,255,0.06)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 4,
                                  outline: "none",
                                }}
                                autoFocus
                                aria-label={`Contribution amount for ${p.name}`}
                              />
                              <button
                                onClick={handleContribute}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  fontFamily: FONT_FAMILY,
                                  color: "#fff",
                                  background: "var(--accent)",
                                  border: "none",
                                  borderRadius: 4,
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
                                  fontSize: 11,
                                  fontFamily: FONT_FAMILY,
                                  color: "var(--accent)",
                                  background: "var(--accent-muted)",
                                  border: "none",
                                  borderRadius: 4,
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
                                  fontSize: 11,
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
                        fontSize: 13,
                        fontFamily: FONT_FAMILY,
                        color: "var(--text)",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
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
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: FONT_FAMILY,
                        color: newName.trim() ? "var(--accent)" : "var(--muted)",
                        background: "var(--accent-muted)",
                        border: "none",
                        borderRadius: 8,
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
                  <GlassCard elevation="low" style={{ padding: "14px 16px", marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                      Contribution breakdown
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {participants.map(p => {
                        const pct = goal.targetAmount > 0
                          ? Math.min((p.contributedAmount / goal.targetAmount) * 100, 100)
                          : 0
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: "var(--text)", minWidth: 70 }}>
                              {p.name}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: borderRadius.full,
                                background: "rgba(255,255,255,0.06)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  borderRadius: borderRadius.full,
                                  background: "var(--accent)",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 11,
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
                        fontSize: 12,
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
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: FONT_FAMILY,
                    color: "var(--error)",
                    background: "rgba(239, 68, 68, 0.06)",
                    border: "1px solid rgba(239, 68, 68, 0.15)",
                    borderRadius: 10,
                    cursor: "pointer",
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
                marginTop: 16,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: FONT_FAMILY,
                color: "var(--sub)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 10,
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
