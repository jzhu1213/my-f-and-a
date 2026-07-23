"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types"
import {
  getNoSpendStreak,
  getActiveChallenge,
  getNoSpendChallengeStatus,
  startChallenge,
  clearChallenge,
} from "@/lib/noSpendChallenge"
import type { NoSpendChallengeData } from "@/lib/noSpendChallenge"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"

export interface NoSpendChallengeCardProps {
  transactions: Transaction[]
}

/**
 * NoSpendChallengeCard — a small, optional, low-pressure card that shows
 * the user's no-spend streak or active challenge progress.
 *
 * Shows when:
 * - A natural no-spend streak of 3+ days is detected (auto-surfaces)
 * - The user has opted into a no-spend challenge
 *
 * The card is dismissible. Copy is warm and non-pressuring.
 *
 * Requirements: 5.4, 6.2
 */
export function NoSpendChallengeCard({ transactions }: NoSpendChallengeCardProps) {
  const [dismissed, setDismissed] = useState(false)
  const [challenge, setChallenge] = useState<NoSpendChallengeData | null>(null)

  // Hydrate challenge from localStorage after mount (SSR-safe)
  useEffect(() => {
    setChallenge(getActiveChallenge())
  }, [])

  // Current natural no-spend streak (regardless of challenge)
  const streak = useMemo(() => getNoSpendStreak(transactions), [transactions])

  // Challenge progress (if active)
  const challengeStatus = useMemo(() => {
    if (!challenge) return null
    return getNoSpendChallengeStatus(transactions, challenge.startDate, challenge.totalDays)
  }, [challenge, transactions])

  // Start a 3-day no-spend challenge
  const handleStartChallenge = useCallback(() => {
    const newChallenge = startChallenge(3)
    setChallenge(newChallenge)
  }, [])

  // Clear completed/expired challenge
  const handleClearChallenge = useCallback(() => {
    clearChallenge()
    setChallenge(null)
  }, [])

  // ── Visibility logic ──────────────────────────────────────────────────────
  // Show if:
  // 1. There's an active challenge, OR
  // 2. Natural streak is >= 3 days (auto-surface)
  const shouldShow =
    !dismissed && (challenge !== null || streak >= 3)

  if (!shouldShow) return null

  // ── Render: Active challenge ──────────────────────────────────────────────
  if (challenge && challengeStatus) {
    // Challenge expired or completed — show completion message
    if (!challengeStatus.isActive || challengeStatus.isComplete) {
      return (
        <AnimatePresence>
          <motion.section
            aria-label="No-spend challenge complete"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1.4 }} aria-hidden="true">
                  🎉
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--success)",
                      fontFamily: FONT_FAMILY,
                      lineHeight: 1.4,
                    }}
                  >
                    {challengeStatus.isComplete
                      ? "Challenge complete — you did it!"
                      : `Challenge ended — ${challengeStatus.completedDays} of ${challengeStatus.totalDays} days!`}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--sub)",
                      fontFamily: FONT_FAMILY,
                      marginTop: 4,
                      opacity: 0.8,
                    }}
                  >
                    {challengeStatus.isComplete
                      ? "Every no-spend day adds up. Nice work."
                      : "No pressure — you can always try again."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearChallenge}
                  aria-label="Dismiss challenge result"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--sub)",
                    opacity: 0.6,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </GlassCard>
          </motion.section>
        </AnimatePresence>
      )
    }

    // Active challenge in progress
    return (
      <AnimatePresence>
        <motion.section
          aria-label="No-spend challenge progress"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 20, lineHeight: 1.4 }} aria-hidden="true">
                🌱
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.4,
                  }}
                >
                  No-spend challenge: {challengeStatus.completedDays}/{challengeStatus.totalDays} days
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    marginTop: 4,
                    opacity: 0.8,
                  }}
                >
                  {challengeStatus.completedDays === 0
                    ? "Today's the first day — you've got this."
                    : `Keep it going — ${challengeStatus.totalDays - challengeStatus.completedDays} day${challengeStatus.totalDays - challengeStatus.completedDays === 1 ? '' : 's'} left.`}
                </p>
                {/* Simple progress bar */}
                <div
                  style={{
                    marginTop: 8,
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                  role="progressbar"
                  aria-valuenow={challengeStatus.completedDays}
                  aria-valuemin={0}
                  aria-valuemax={challengeStatus.totalDays}
                  aria-label={`${challengeStatus.completedDays} of ${challengeStatus.totalDays} days complete`}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(challengeStatus.completedDays / challengeStatus.totalDays) * 100}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background: "var(--success)",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss challenge card"
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--sub)",
                  opacity: 0.6,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </GlassCard>
        </motion.section>
      </AnimatePresence>
    )
  }

  // ── Render: Natural streak (no active challenge) ──────────────────────────
  return (
    <AnimatePresence>
      <motion.section
        aria-label="No-spend streak"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <GlassCard elevation="low" style={{ padding: "14px 18px", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1.4 }} aria-hidden="true">
              🌟
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.4,
                }}
              >
                No-spend day streak: {streak} day{streak === 1 ? '' : 's'}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--sub)",
                  fontFamily: FONT_FAMILY,
                  marginTop: 4,
                  opacity: 0.8,
                }}
              >
                You&rsquo;re doing great — every quiet day adds up.
              </p>
              {/* Offer to start a challenge */}
              <button
                type="button"
                onClick={handleStartChallenge}
                style={{
                  marginTop: 8,
                  background: "rgba(167, 139, 250, 0.12)",
                  border: "1px solid rgba(167, 139, 250, 0.25)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                  opacity: 0.9,
                }}
                aria-label="Start a 3-day no-spend challenge"
              >
                🌱 Try a 3-day no-spend challenge?
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss streak card"
              style={{
                background: "none",
                border: "none",
                padding: 4,
                cursor: "pointer",
                fontSize: 14,
                color: "var(--sub)",
                opacity: 0.6,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </GlassCard>
      </motion.section>
    </AnimatePresence>
  )
}
