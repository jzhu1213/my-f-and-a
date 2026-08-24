"use client"

/**
 * ActiveChallenges — Inline widget for the ToolsScreen.
 *
 * Shows:
 * 1. Active challenges with progress bar, days remaining, title
 * 2. Recently completed/failed challenges with warm messaging
 * 3. Challenge history expandable section
 *
 * Fires celebration events on completion detection.
 * Handles retry flow for expired challenges.
 *
 * Requirements: 25.2
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import type { CelebrationEvent } from "@/types/folio"
import {
  getChallengeData,
  getActiveChallenges,
  getCompletedChallenges,
  expireOverdueChallenges,
  startChallenge,
  getDaysRemaining,
  getProgressMessage,
  getCompletionMessage,
  getExpiredMessage,
  type Challenge,
  type ChallengeData,
} from "@/lib/challenges"

// ============================================================================
// Types
// ============================================================================

export interface ActiveChallengesProps {
  /** Callback to fire a celebration event (from page.tsx state) */
  onCelebrate?: (event: CelebrationEvent) => void
}

// ============================================================================
// Sub-components
// ============================================================================

/** Progress bar for active challenges */
function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <div
      style={{
        width: "100%",
        height: 6,
        borderRadius: radius.full,
        background: colorRamp.accent[100],
        overflow: "hidden",
      }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percent}% complete`}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: percent / 100 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: radius.full,
          background: percent >= 100 ? colorRamp.success[500] : colorRamp.accent[500],
          transformOrigin: "left center",
        }}
      />
    </div>
  )
}

/** Single active challenge card */
function ActiveChallengeCard({ challenge }: { challenge: Challenge }) {
  const daysLeft = getDaysRemaining(challenge)
  const progressMsg = getProgressMessage(challenge)
  const percent = challenge.targetValue > 0
    ? Math.min(100, Math.round((challenge.progress / challenge.targetValue) * 100))
    : 0

  return (
    <div
      style={{
        padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
        borderRadius: radius.control,
        background: elevations.resting.fill,
        border: `1px solid ${elevations.resting.border}`,
      }}
      aria-label={`Challenge: ${challenge.title}, ${percent}% complete, ${daysLeft === 0 ? "last day" : `${daysLeft} days left`}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacingScale["8"] }}>
        <p style={{ ...typography.body, color: textColors.text, flex: 1, marginRight: spacingScale["8"] }}>
          {challenge.title}
        </p>
        <span style={{ ...typography.caption, color: textColors.muted, whiteSpace: "nowrap" }}>
          {daysLeft === 0 ? "Last day" : `${daysLeft}d left`}
        </span>
      </div>

      <ProgressBar progress={challenge.progress} target={challenge.targetValue} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: spacingScale["6"] }}>
        <span style={{ ...typography.caption, color: textColors.sub }}>
          {challenge.progress}/{challenge.targetValue} · {percent}%
        </span>
        {progressMsg && (
          <span style={{ ...typography.caption, color: colorRamp.accent[400] }}>
            {progressMsg}
          </span>
        )}
      </div>
    </div>
  )
}

/** Completed challenge row */
function CompletedRow({ challenge }: { challenge: Challenge }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacingScale["8"],
        padding: `${spacingScale["6"]} 0`,
      }}
    >
      <span style={{ fontSize: typography.body.fontSize, lineHeight: 1 }}>✓</span>
      <span style={{ ...typography["body-sm"], color: textColors.sub, flex: 1 }}>
        {challenge.title}
      </span>
      <span style={{ ...typography.caption, color: colorRamp.success[400] }}>Done</span>
    </div>
  )
}

/** Expired (not-completed) challenge row with retry option */
function ExpiredRow({ challenge, onRetry }: { challenge: Challenge; onRetry: (c: Challenge) => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacingScale["8"],
        padding: `${spacingScale["6"]} 0`,
      }}
    >
      <span style={{ fontSize: typography.body.fontSize, lineHeight: 1 }}>○</span>
      <span style={{ ...typography["body-sm"], color: textColors.muted, flex: 1 }}>
        {challenge.title}
      </span>
      <button
        onClick={() => onRetry(challenge)}
        aria-label={`Retry challenge: ${challenge.title}`}
        style={{
          background: "none",
          border: "none",
          padding: `${spacingScale["2"]} ${spacingScale["8"]}`,
          borderRadius: radius.full,
          cursor: "pointer",
          ...typography.caption,
          color: colorRamp.accent[400],
        }}
      >
        Retry
      </button>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ActiveChallenges({ onCelebrate }: ActiveChallengesProps) {
  const [data, setData] = useState<ChallengeData | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set())
  const { prefersReducedMotion } = useReducedMotion()

  // Load and expire challenges on mount
  useEffect(() => {
    expireOverdueChallenges()
    setData(getChallengeData())
  }, [])

  const activeChallenges = useMemo(
    () => (data ? getActiveChallenges(data) : []),
    [data],
  )

  const completedChallenges = useMemo(
    () => (data ? getCompletedChallenges(data) : []),
    [data],
  )

  const expiredChallenges = useMemo(
    () =>
      data
        ? data.challenges.filter((c) => !c.isActive && !c.isComplete)
        : [],
    [data],
  )

  // History stats
  const totalPast = completedChallenges.length + expiredChallenges.length
  const completedCount = completedChallenges.length

  // Detect newly completed challenges and fire celebrations
  useEffect(() => {
    if (!onCelebrate || !data) return

    for (const challenge of completedChallenges) {
      if (!celebratedIds.has(challenge.id)) {
        setCelebratedIds((prev) => new Set(prev).add(challenge.id))
        onCelebrate({
          id: `challenge-complete-${challenge.id}`,
          type: "challenge_complete",
          title: "You did it!",
          message: getCompletionMessage(challenge),
          emoji: "🎉",
          animation: "confetti",
          duration: 3000,
          sound: "cheerful",
        })
      }
    }
  }, [completedChallenges, celebratedIds, onCelebrate, data])

  // Retry handler — start same challenge again
  const handleRetry = useCallback((challenge: Challenge) => {
    const result = startChallenge({
      title: challenge.title,
      description: challenge.description,
      type: challenge.type,
      targetValue: challenge.targetValue,
      duration: challenge.duration,
      category: challenge.category,
    })
    if (result) {
      setData(result)
    }
  }, [])

  // Nothing to show if no challenges exist at all
  if (!data || data.challenges.length === 0) return null

  return (
    <Card
      style={{
        padding: `${spacingScale["16"]} ${spacingScale["16"]}`,
        display: "flex",
        flexDirection: "column",
        gap: spacingScale["12"],
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ ...typography.subhead, color: textColors.text }}>
          Challenges
        </p>
        {totalPast > 0 && (
          <span style={{ ...typography.caption, color: textColors.muted }}>
            {completedCount} of {totalPast} completed
          </span>
        )}
      </div>

      {/* Active challenges */}
      {activeChallenges.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {activeChallenges.map((challenge) => (
            <ActiveChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}

      {/* Recently expired — show gentle message + retry */}
      {activeChallenges.length === 0 && expiredChallenges.length > 0 && (
        <div
          style={{
            padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
            borderRadius: radius.control,
            background: elevations.resting.fill,
            border: `1px solid ${elevations.resting.border}`,
          }}
        >
          <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["4"] }}>
            {getExpiredMessage()}
          </p>
          <p style={{ ...typography.caption, color: textColors.muted }}>
            No penalty — pick up where you left off or try something new.
          </p>
        </div>
      )}

      {/* Challenge History toggle */}
      {totalPast > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-label={showHistory ? "Hide challenge history" : "Show challenge history"}
            aria-expanded={showHistory}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacingScale["6"],
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              ...typography.caption,
              color: colorRamp.accent[400],
            }}
          >
            <motion.span
              animate={{ rotate: showHistory ? 90 : 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
              style={{ display: "inline-flex" }}
            >
              <Icon name="action:forward" size={12} />
            </motion.span>
            Challenge history
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden", marginTop: spacingScale["8"] }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {completedChallenges.map((c) => (
                    <CompletedRow key={c.id} challenge={c} />
                  ))}
                  {expiredChallenges.map((c) => (
                    <ExpiredRow key={c.id} challenge={c} onRetry={handleRetry} />
                  ))}
                </div>

                {/* Summary stat */}
                {totalPast >= 3 && (
                  <p style={{ ...typography.caption, color: textColors.muted, marginTop: spacingScale["8"] }}>
                    {completedCount} of {totalPast} completed — {completedCount >= totalPast * 0.6 ? "solid." : "keep going!"}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  )
}
