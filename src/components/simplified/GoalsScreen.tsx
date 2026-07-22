"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { GoalEditSheet } from "./GoalEditSheet"
import { GoalContributeSheet } from "./GoalContributeSheet"
import type { Goal } from "@/types"

// ============================================================================
// Types
// ============================================================================

/** Maximum number of savings goals a user may keep at once. */
export const MAX_GOALS = 3

/** Shape of the create/edit goal payload (mirrors useHomeData). */
export interface GoalFormData {
  name: string
  targetAmount: number
  emoji: string
}

export interface GoalsScreenProps {
  /** All of the user's savings goals. */
  goals: Goal[]
  /** Create a new savings goal (backed by useHomeData.createGoal). */
  onCreateGoal: (data: GoalFormData) => Promise<Goal | null> | void
  /** Update an existing goal (backed by useHomeData.updateGoal). */
  onUpdateGoal: (id: string, data: GoalFormData) => Promise<Goal | null> | void
  /** Add to a goal's saved amount (backed by useHomeData.contributeToGoal). */
  onContributeToGoal: (id: string, amount: number) => Promise<Goal | null> | void
  /** Delete a goal (backed by useHomeData.deleteGoal). */
  onDeleteGoal: (id: string) => Promise<boolean> | void
  /** Optional back navigation, shown as a back button when provided. */
  onBack?: () => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Percentage saved toward a goal, clamped to 0–100. */
function goalProgress(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0
  return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
}

/** A goal is complete once it reaches or passes its (positive) target. */
function isComplete(goal: Goal): boolean {
  return goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// ============================================================================
// GoalCard
// ============================================================================

interface GoalCardProps {
  goal: Goal
  reducedMotion: boolean
  onContribute: (goal: Goal) => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

function GoalCard({ goal, reducedMotion, onContribute, onEdit, onDelete }: GoalCardProps) {
  const pct = goalProgress(goal)
  const complete = isComplete(goal)
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const fillColor = complete ? "var(--success)" : "var(--accent)"

  // Two-step delete confirmation: the first tap arms the confirm, a second tap
  // commits. Auto-resets after a few seconds so it can't get stuck armed.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useEffect(() => {
    if (!confirmingDelete) return
    const t = setTimeout(() => setConfirmingDelete(false), 4000)
    return () => clearTimeout(t)
  }, [confirmingDelete])

  return (
    <GlassCard
      elevation="low"
      glow={complete ? "healthy" : "none"}
      style={{ padding: "18px 20px", marginBottom: 14 }}
    >
      {/* ── Header: emoji + name + progress badge ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
            {goal.emoji}
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {goal.name}
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
            color: complete ? "var(--success)" : "var(--sub)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {complete ? "Reached 🎉" : `${Math.round(pct)}%`}
        </span>
      </div>

      {/* ── Animated progress bar ─────────────────────────────────────────── */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${goal.name} progress: ${Math.round(pct)} percent`}
        style={{
          height: 8,
          width: "100%",
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <motion.div
          initial={{ width: reducedMotion ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={reducedMotion ? timings.fast : springs.gentle}
          style={{
            height: "100%",
            borderRadius: 999,
            background: fillColor,
          }}
        />
      </div>

      {/* ── Amounts ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ color: complete ? "var(--success)" : "var(--sub)" }}>
          ${formatAmount(goal.currentAmount)} saved
        </span>
        <span style={{ color: "var(--muted)" }}>
          {complete ? `$${formatAmount(goal.targetAmount)} goal` : `$${formatAmount(remaining)} left`}
        </span>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!complete && (
          <motion.button
            onClick={() => onContribute(goal)}
            whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
            transition={springs.snappy}
            style={{
              flex: 1,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              color: "var(--accent)",
              background: "var(--accent-muted)",
              border: "1px solid rgba(129, 140, 248, 0.25)",
              borderRadius: 10,
              cursor: "pointer",
            }}
            aria-label={`Add money to ${goal.name}`}
          >
            Add money
          </motion.button>
        )}

        {!confirmingDelete && (
          <motion.button
            onClick={() => onEdit(goal)}
            whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
            transition={springs.snappy}
            style={{
              flex: complete ? 1 : "0 0 auto",
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
              color: "var(--sub)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
            }}
            aria-label={`Edit ${goal.name}`}
          >
            Edit
          </motion.button>
        )}

        {confirmingDelete ? (
          <>
            <motion.button
              onClick={() => setConfirmingDelete(false)}
              whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
              transition={springs.snappy}
              style={{
                flex: 1,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "Inter, sans-serif",
                color: "var(--sub)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                cursor: "pointer",
              }}
              aria-label="Cancel delete"
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={() => {
                setConfirmingDelete(false)
                onDelete(goal)
              }}
              whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
              transition={springs.snappy}
              style={{
                flex: "0 0 auto",
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                color: "#fff",
                background: "var(--error)",
                border: "1px solid var(--error)",
                borderRadius: 10,
                cursor: "pointer",
              }}
              aria-label={`Confirm delete ${goal.name}`}
            >
              Delete for good
            </motion.button>
          </>
        ) : (
          <motion.button
            onClick={() => setConfirmingDelete(true)}
            whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
            transition={springs.snappy}
            style={{
              flex: "0 0 auto",
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
              color: "var(--error)",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 10,
              cursor: "pointer",
            }}
            aria-label={`Delete ${goal.name}`}
          >
            Delete
          </motion.button>
        )}
      </div>
    </GlassCard>
  )
}

// ============================================================================
// GoalsScreen Component
// ============================================================================

/**
 * GoalsScreen — the simplified, warm goals surface. Renders active and
 * completed savings goals as glass cards with emoji, name, an animated
 * progress bar, and saved/target amounts. Provides entry points to create,
 * edit, contribute to, and delete goals while enforcing the 3-goal cap.
 *
 * Goal mutation handlers are provided via props (backed by useHomeData's
 * createGoal / updateGoal / contributeToGoal / deleteGoal). The create, edit,
 * and contribute flows open local sheet state that later subtasks (25.2 sheets,
 * 25.3 page wiring) will connect to their sheet components.
 *
 * Validates: Requirements 12.3, 12.4
 */
export function GoalsScreen({
  goals,
  onCreateGoal,
  onUpdateGoal,
  onContributeToGoal,
  onDeleteGoal,
  onBack,
}: GoalsScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  // ── Sheet handoff state (filled in by subtask 25.2) ───────────────────────
  // `goalSheet` drives create/edit; `contributeGoal` drives contribution.
  const [goalSheet, setGoalSheet] = useState<{ mode: "create" | "edit"; goal: Goal | null } | null>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null)

  // ── Partition goals into active vs completed ───────────────────────────────
  const { activeGoals, completedGoals } = useMemo(() => {
    const active: Goal[] = []
    const completed: Goal[] = []
    for (const goal of goals) {
      if (isComplete(goal)) completed.push(goal)
      else active.push(goal)
    }
    return { activeGoals: active, completedGoals: completed }
  }, [goals])

  const atCap = goals.length >= MAX_GOALS
  const remainingSlots = Math.max(0, MAX_GOALS - goals.length)

  // ── Entry-point handlers ───────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (atCap) return
    setGoalSheet({ mode: "create", goal: null })
  }, [atCap])

  const handleEdit = useCallback((goal: Goal) => {
    setGoalSheet({ mode: "edit", goal })
  }, [])

  const handleContribute = useCallback((goal: Goal) => {
    setContributeGoal(goal)
  }, [])

  const handleDelete = useCallback(
    (goal: Goal) => {
      onDeleteGoal(goal.id)
    },
    [onDeleteGoal]
  )

  const closeGoalSheet = useCallback(() => setGoalSheet(null), [])
  const closeContribute = useCallback(() => setContributeGoal(null), [])

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "24px 20px 100px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* ── Back button ────────────────────────────────────────────────────── */}
      {onBack && (
        <motion.button
          onClick={onBack}
          whileTap={{ scale: prefersReducedMotion ? 1 : 0.96 }}
          transition={springs.bouncy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 0 12px",
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
          }}
          aria-label="Back"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </motion.button>
      )}

      {/* ── Title + cap indicator ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Goals</h2>
        <span style={{ fontSize: 13, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {goals.length}/{MAX_GOALS}
        </span>
      </div>
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        Save toward what matters. Keep up to {MAX_GOALS} at a time.
      </p>

      {/* ── Active goals ───────────────────────────────────────────────────── */}
      {activeGoals.length > 0 && (
        <section aria-label="Active goals" style={{ marginBottom: completedGoals.length > 0 ? 24 : 8 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 12,
            }}
          >
            Active
          </p>
          <AnimatePresence initial={false}>
            {activeGoals.map(goal => (
              <motion.div
                key={goal.id}
                layout={!prefersReducedMotion}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={timings.normal}
              >
                <GoalCard
                  goal={goal}
                  reducedMotion={prefersReducedMotion}
                  onContribute={handleContribute}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      )}

      {/* ── Completed goals ────────────────────────────────────────────────── */}
      {completedGoals.length > 0 && (
        <section aria-label="Completed goals" style={{ marginBottom: 8 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 12,
            }}
          >
            Completed
          </p>
          <AnimatePresence initial={false}>
            {completedGoals.map(goal => (
              <motion.div
                key={goal.id}
                layout={!prefersReducedMotion}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={timings.normal}
              >
                <GoalCard
                  goal={goal}
                  reducedMotion={prefersReducedMotion}
                  onContribute={handleContribute}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {goals.length === 0 && (
        <GlassCard elevation="low" style={{ padding: "32px 20px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 6, fontWeight: 500 }}>
            No goals yet
          </p>
          <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.5 }}>
            Add your first goal to start saving toward something.
          </p>
        </GlassCard>
      )}

      {/* ── Create action (3-goal cap enforced) ────────────────────────────── */}
      {atCap ? (
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            textAlign: "center",
            padding: "14px 0",
            lineHeight: 1.5,
          }}
          role="note"
        >
          You have {MAX_GOALS} goals — the max for now. Finish or remove one to add another.
        </p>
      ) : (
        <motion.button
          onClick={handleCreate}
          whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
          transition={springs.bouncy}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "14px 20px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
            color: "var(--text)",
            background: "var(--accent-muted)",
            border: "1px solid rgba(129, 140, 248, 0.25)",
            borderRadius: 12,
            cursor: "pointer",
          }}
          aria-label="Create a new goal"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New goal{goals.length > 0 ? ` (${remainingSlots} left)` : ""}
        </motion.button>
      )}

      {/* ── Create / edit goal sheet (subtask 25.2) ────────────────────────── */}
      <GoalEditSheet
        isOpen={goalSheet !== null}
        mode={goalSheet?.mode ?? "create"}
        goal={goalSheet?.goal ?? null}
        onClose={closeGoalSheet}
        onCreate={onCreateGoal}
        onUpdate={onUpdateGoal}
      />

      {/* ── Contribute sheet (subtask 25.2) ────────────────────────────────── */}
      <GoalContributeSheet
        isOpen={contributeGoal !== null}
        goal={contributeGoal}
        onClose={closeContribute}
        onContribute={onContributeToGoal}
      />
    </div>
  )
}
