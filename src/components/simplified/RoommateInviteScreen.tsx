"use client"

/**
 * RoommateInviteScreen
 *
 * A warm, skippable "invite a roommate" flow that connects a referral into
 * the existing shared-money surfaces — household pools (task 170.1) and
 * shared goals (task 169.1). It reuses those features' share tokens rather
 * than inventing a new mechanism.
 *
 * Flow:
 *   1. Warm intro — what inviting a roommate does, always skippable.
 *   2. Pick what to share into: an existing pool, an existing shared goal,
 *      or spin up a brand-new shared pool inline.
 *   3. Share — a warm, editable message + link with Copy and native Share.
 *
 * Lives behind Tools (progressive disclosure); never on the home screen.
 *
 * Task 201.1 — Invite-a-roommate loop
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  borderRadius,
} from "@/styles/shared"
import { getPools, createPool, type HouseholdPool } from "@/lib/householdPool"
import {
  buildInviteUrl,
  buildInviteMessage,
  recordSentInvite,
  getSentInvites,
  removeSentInvite,
  type InviteTarget,
  type RoommateInvite,
} from "@/lib/roommateInvite"
import type { Goal } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface RoommateInviteScreenProps {
  onClose: () => void
  /** The current user's display name, used to warm up the invite copy. */
  inviterName?: string
  /** The user's goals — shared goals become invite targets. */
  goals?: Goal[]
}

type Step = "intro" | "pick" | "share"

// ============================================================================
// Shared styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
}

const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "var(--accent)",
  border: "none",
  borderRadius: borderRadius.sm,
  cursor: "pointer",
}

const secondaryButton: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: borderRadius.sm,
  cursor: "pointer",
}

// ============================================================================
// Component
// ============================================================================

export function RoommateInviteScreen({
  onClose,
  inviterName,
  goals = [],
}: RoommateInviteScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [step, setStep] = useState<Step>("intro")
  const [pools, setPools] = useState<HouseholdPool[]>([])
  const [selectedTarget, setSelectedTarget] = useState<InviteTarget | null>(null)
  const [sentInvites, setSentInvites] = useState<RoommateInvite[]>([])

  // Refresh available targets + prior invites on mount.
  const refresh = useCallback(async () => {
    const fetched = await getPools()
    setPools(fetched)
    setSentInvites(getSentInvites())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Shared goals are goals the user has already marked shareable.
  const sharedGoals = useMemo(
    () => goals.filter(g => !!g.isShared),
    [goals]
  )

  const handlePickTarget = useCallback((target: InviteTarget) => {
    setSelectedTarget(target)
    setStep("share")
  }, [])

  const name = inviterName?.trim() || ""

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
      transition={springs.gentle}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 200,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          maxWidth: CONTENT_MAX_WIDTH,
          margin: "0 auto",
          padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={step === "intro" ? onClose : () => setStep(step === "share" ? "pick" : "intro")}
            style={{
              background: "none",
              border: "none",
              color: "var(--sub)",
              fontSize: 14,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
              padding: "4px 0",
              marginRight: 12,
            }}
            aria-label={step === "intro" ? "Close" : "Back"}
          >
            ← {step === "intro" ? "Back" : "Back"}
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", flex: 1 }}>
            Invite a roommate
          </h2>
        </div>

        <AnimatePresence mode="wait">
          {step === "intro" && (
            <IntroStep
              key="intro"
              sentInvites={sentInvites}
              onStart={() => setStep("pick")}
              onSkip={onClose}
              onRemoveInvite={(id) => {
                removeSentInvite(id)
                refresh()
              }}
            />
          )}
          {step === "pick" && (
            <PickTargetStep
              key="pick"
              pools={pools}
              sharedGoals={sharedGoals}
              onPick={handlePickTarget}
              onCreatedPool={(pool) => {
                refresh()
                handlePickTarget({
                  type: "pool",
                  token: pool.shareToken,
                  name: pool.name,
                  emoji: pool.emoji,
                })
              }}
            />
          )}
          {step === "share" && selectedTarget && (
            <ShareStep
              key="share"
              target={selectedTarget}
              inviterName={name}
              onDone={() => {
                refresh()
                onClose()
              }}
              onInviteAnother={() => {
                refresh()
                setSelectedTarget(null)
                setStep("pick")
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Step 1 — Warm intro
// ============================================================================

function IntroStep({
  sentInvites,
  onStart,
  onSkip,
  onRemoveInvite,
}: {
  sentInvites: RoommateInvite[]
  onStart: () => void
  onSkip: () => void
  onRemoveInvite: (id: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
        <p style={{ fontSize: 44, marginBottom: 10 }} aria-hidden="true">💌</p>
        <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          Money&apos;s easier together
        </p>
        <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
          Invite a roommate to share a pool or a goal. You split the shared stuff,
          your own daily number stays yours. No pressure, and you can skip this
          anytime.
        </p>
      </div>

      {/* Prior invites (warm follow-up list) */}
      {sentInvites.length > 0 && (
        <div>
          <p style={{ ...sectionHeader, marginBottom: 10 }}>People you&apos;ve invited</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sentInvites.map((inv) => (
              <GlassCard key={inv.id} elevation="low" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }} aria-hidden="true">{inv.targetEmoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {inv.roommateName || "A roommate"}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--sub)" }}>
                        {inv.targetType === "pool" ? "Pool" : "Goal"} · {inv.targetName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveInvite(inv.id)}
                    style={{ background: "none", border: "none", fontSize: 12, color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}
                    aria-label={`Remove invite for ${inv.roommateName || "roommate"}`}
                  >
                    Remove
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <button onClick={onStart} style={primaryButton}>
          Invite a roommate
        </button>
        <button onClick={onSkip} style={{ ...secondaryButton, width: "100%" }}>
          Maybe later
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Step 2 — Pick a shared-money target
// ============================================================================

function PickTargetStep({
  pools,
  sharedGoals,
  onPick,
  onCreatedPool,
}: {
  pools: HouseholdPool[]
  sharedGoals: Goal[]
  onPick: (target: InviteTarget) => void
  onCreatedPool: (pool: HouseholdPool) => void
}) {
  const [showCreate, setShowCreate] = useState(false)

  const hasTargets = pools.length > 0 || sharedGoals.length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.5 }}>
        What do you want to share with your roommate? Pick a shared pool or goal —
        they&apos;ll be able to view it and chip in.
      </p>

      {/* Existing pools */}
      {pools.length > 0 && (
        <div>
          <p style={{ ...sectionHeader, marginBottom: 10 }}>Shared pools</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pools.map((pool) => (
              <TargetCard
                key={pool.id}
                emoji={pool.emoji}
                title={pool.name}
                subtitle={`${pool.members.length + 1} ${pool.members.length === 0 ? "person" : "people"} · $${pool.monthlyLimit}/mo`}
                onClick={() =>
                  onPick({ type: "pool", token: pool.shareToken, name: pool.name, emoji: pool.emoji })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Existing shared goals */}
      {sharedGoals.length > 0 && (
        <div>
          <p style={{ ...sectionHeader, marginBottom: 10 }}>Shared goals</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sharedGoals.map((goal) => {
              const token = goal.shareToken ?? ""
              return (
                <TargetCard
                  key={goal.id}
                  emoji={goal.emoji || "🎯"}
                  title={goal.name}
                  subtitle={`Goal · $${goal.targetAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  onClick={() =>
                    onPick({ type: "goal", token, name: goal.name, emoji: goal.emoji || "🎯" })
                  }
                />
              )
            })}
          </div>
        </div>
      )}

      {!hasTargets && (
        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 500, marginBottom: 6 }}>
            Nothing shared yet
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5 }}>
            Start a shared pool below to invite your roommate into it. You can also
            make a goal shareable from the Goals screen.
          </p>
        </GlassCard>
      )}

      {/* Create a new pool inline */}
      <div>
        <p style={{ ...sectionHeader, marginBottom: 10 }}>Start something new</p>
        <AnimatePresence mode="wait">
          {showCreate ? (
            <CreatePoolInline
              key="create"
              onCancel={() => setShowCreate(false)}
              onCreated={onCreatedPool}
            />
          ) : (
            <button
              key="button"
              onClick={() => setShowCreate(true)}
              style={{ ...secondaryButton, width: "100%" }}
            >
              🏠 Create a shared pool
            </button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function TargetCard({
  emoji,
  title,
  subtitle,
  onClick,
}: {
  emoji: string
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={springs.snappy}>
      <GlassCard elevation="low" style={{ padding: "14px 16px", cursor: "pointer" }} onClick={onClick}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }} aria-hidden="true">{emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</p>
            <p style={{ fontSize: 12, color: "var(--sub)" }}>{subtitle}</p>
          </div>
          <span style={{ fontSize: 14, color: "var(--muted)" }} aria-hidden="true">→</span>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function CreatePoolInline({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (pool: HouseholdPool) => void
}) {
  const [name, setName] = useState("")
  const [monthlyLimit, setMonthlyLimit] = useState("")

  const canCreate = name.trim().length > 0 && parseFloat(monthlyLimit) > 0

  const handleCreate = async () => {
    if (!canCreate) return
    const pool = await createPool(name, "🏠", parseFloat(monthlyLimit))
    onCreated(pool)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
      <GlassCard elevation="low" style={{ padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--sub)", marginBottom: 4 }}>Pool name</p>
            <input
              type="text"
              placeholder="e.g. Groceries, Utilities"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              maxLength={40}
              aria-label="Pool name"
            />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--sub)", marginBottom: 4 }}>Monthly budget</p>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              style={inputStyle}
              min="0"
              aria-label="Monthly budget"
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ ...secondaryButton, flex: 1 }}>
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              style={{ ...primaryButton, flex: 1, opacity: canCreate ? 1 : 0.5 }}
            >
              Create &amp; invite
            </button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ============================================================================
// Step 3 — Share the warm invite
// ============================================================================

function ShareStep({
  target,
  inviterName,
  onDone,
  onInviteAnother,
}: {
  target: InviteTarget
  inviterName: string
  onDone: () => void
  onInviteAnother: () => void
}) {
  const [roommateName, setRoommateName] = useState("")
  const [copied, setCopied] = useState(false)
  const [recorded, setRecorded] = useState(false)

  const url = useMemo(() => buildInviteUrl(target.type, target.token), [target.type, target.token])
  const message = useMemo(
    () => buildInviteMessage(inviterName, target.type, target.name, url),
    [inviterName, target.type, target.name, url]
  )

  const persistOnce = useCallback(() => {
    if (recorded) return
    recordSentInvite(inviterName, target, roommateName)
    setRecorded(true)
  }, [recorded, inviterName, target, roommateName])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      persistOnce()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Older browsers: still record the intent so the follow-up list works.
      persistOnce()
    }
  }, [message, persistOnce])

  const handleNativeShare = useCallback(async () => {
    persistOnce()
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Join me on Folio",
          text: message,
          url,
        })
      } catch {
        // User dismissed the share sheet — no-op.
      }
    } else {
      // No native share: fall back to copying.
      handleCopy()
    }
  }, [persistOnce, message, url, handleCopy])

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {/* Target header */}
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{target.emoji}</span>
        <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", marginTop: 8 }}>{target.name}</p>
        <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 2 }}>
          {target.type === "pool" ? "Shared pool" : "Shared goal"}
        </p>
      </div>

      {/* Optional roommate name */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--sub)", marginBottom: 4 }}>
          Who are you inviting? (optional)
        </p>
        <input
          type="text"
          placeholder="Roommate's name"
          value={roommateName}
          onChange={(e) => setRoommateName(e.target.value)}
          style={inputStyle}
          maxLength={40}
          aria-label="Roommate's name"
        />
      </div>

      {/* Preview message */}
      <GlassCard elevation="low" style={{ padding: 16 }}>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
          Your invite
        </p>
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {message}
        </p>
      </GlassCard>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {canNativeShare && (
          <button onClick={handleNativeShare} style={primaryButton}>
            Share invite
          </button>
        )}
        <button
          onClick={handleCopy}
          style={canNativeShare ? { ...secondaryButton, width: "100%" } : primaryButton}
        >
          {copied ? "Copied!" : "Copy invite"}
        </button>
      </div>

      {/* Follow-up */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onInviteAnother} style={{ ...secondaryButton, flex: 1 }}>
          Invite another
        </button>
        <button onClick={onDone} style={{ ...secondaryButton, flex: 1 }}>
          Done
        </button>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", opacity: 0.7, lineHeight: 1.5 }}>
        The link is read-and-contribute only — your roommate never sees your personal budget or daily number.
      </p>
    </motion.div>
  )
}
