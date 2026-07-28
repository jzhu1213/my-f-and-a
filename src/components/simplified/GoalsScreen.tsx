"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { GoalEditSheet } from "./GoalEditSheet"
import { GoalContributeSheet } from "./GoalContributeSheet"
import { SaveUpPlanSheet } from "./SaveUpPlanSheet"
import { computeDeadlineFeasibility, formatTargetDate } from "@/lib/goalDeadlineUtils"
import {
  loadAutoContributeRules,
  saveAutoContributeRules,
  upsertAutoContributeRule,
  removeAutoContributeRule,
  type AutoContributeRule,
} from "@/lib/autoContributeUtils"
import type { Goal } from "@/types"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"

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
  /** Optional ISO date string for the goal deadline */
  targetDate?: string
}

export interface GoalsScreenProps {
  /** All of the user's savings goals. */
  goals: Goal[]
  /** Monthly income used for deadline feasibility checks. */
  monthlyIncome?: number
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
  monthlyIncome: number
  onContribute: (goal: Goal) => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

function GoalCard({ goal, reducedMotion, monthlyIncome, onContribute, onEdit, onDelete }: GoalCardProps) {
  const pct = goalProgress(goal)
  const complete = isComplete(goal)
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const fillColor = complete ? "var(--success)" : "var(--accent)"

  // Compute deadline feasibility when a target date is set
  const deadlineInfo = useMemo(
    () => computeDeadlineFeasibility(goal, monthlyIncome),
    [goal, monthlyIncome]
  )

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
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
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
            {goal.targetDate && !complete && (
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: deadlineInfo?.expired ? "var(--error)" : "var(--muted)",
                  marginTop: 2,
                }}
              >
                {deadlineInfo?.expired ? "Past deadline" : `Target: ${formatTargetDate(goal.targetDate)}`}
              </span>
            )}
          </div>
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
          borderRadius: borderRadius.full,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          marginBottom: deadlineInfo && !complete ? 8 : 12,
        }}
      >
        <motion.div
          initial={{ width: reducedMotion ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={reducedMotion ? timings.fast : springs.gentle}
          style={{
            height: "100%",
            borderRadius: borderRadius.full,
            background: fillColor,
          }}
        />
      </div>

      {/* ── Deadline feasibility message (progressive disclosure) ─────────── */}
      {deadlineInfo && !complete && (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: deadlineInfo.feasible ? "var(--sub)" : "var(--warning, #fbbf24)",
            marginBottom: 12,
            padding: "6px 10px",
            background: deadlineInfo.feasible
              ? "rgba(255,255,255,0.02)"
              : "rgba(251, 191, 36, 0.06)",
            borderRadius: 8,
            border: deadlineInfo.feasible
              ? "1px solid rgba(255,255,255,0.04)"
              : "1px solid rgba(251, 191, 36, 0.15)",
          }}
        >
          {deadlineInfo.message}
        </p>
      )}

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
              fontFamily: FONT_FAMILY,
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
              fontFamily: FONT_FAMILY,
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
                fontFamily: FONT_FAMILY,
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
                fontFamily: FONT_FAMILY,
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
              fontFamily: FONT_FAMILY,
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
  monthlyIncome = 0,
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
  const [saveUpOpen, setSaveUpOpen] = useState(false)

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

  // ── Auto-Contribute Rules ─────────────────────────────────────────────────
  const [autoRules, setAutoRules] = useState<AutoContributeRule[]>([])
  const [editingAutoRule, setEditingAutoRule] = useState<{ goalId: string; amount: string } | null>(null)

  // Load rules from localStorage on mount
  useEffect(() => {
    setAutoRules(loadAutoContributeRules())
  }, [])

  const handleSaveAutoRule = useCallback((goalId: string, amountStr: string) => {
    const amount = parseFloat(amountStr)
    if (!amount || amount <= 0) return
    const updated = upsertAutoContributeRule(autoRules, goalId, amount, true)
    setAutoRules(updated)
    saveAutoContributeRules(updated)
    setEditingAutoRule(null)
  }, [autoRules])

  const handleToggleAutoRule = useCallback((goalId: string, enabled: boolean) => {
    const rule = autoRules.find(r => r.goalId === goalId)
    if (!rule) return
    const updated = upsertAutoContributeRule(autoRules, goalId, rule.amount, enabled)
    setAutoRules(updated)
    saveAutoContributeRules(updated)
  }, [autoRules])

  const handleRemoveAutoRule = useCallback((goalId: string) => {
    const updated = removeAutoContributeRule(autoRules, goalId)
    setAutoRules(updated)
    saveAutoContributeRules(updated)
  }, [autoRules])

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "24px 20px 100px",
        fontFamily: FONT_FAMILY,
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
            fontFamily: FONT_FAMILY,
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
                  monthlyIncome={monthlyIncome}
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
                  monthlyIncome={monthlyIncome}
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
            fontFamily: FONT_FAMILY,
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

      {/* ── Plan a big purchase link ───────────────────────────────────────── */}
      <motion.button
        onClick={() => setSaveUpOpen(true)}
        whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
        transition={springs.snappy}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "12px 20px",
          marginTop: 12,
          fontSize: 14,
          fontWeight: 500,
          fontFamily: FONT_FAMILY,
          color: "var(--sub)",
          background: "none",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          cursor: "pointer",
        }}
        aria-label="Plan a big purchase"
      >
        🎯 Plan a big purchase
      </motion.button>

      {/* ── Auto-Contribute Settings ──────────────────────────────────── */}
      {activeGoals.length > 0 && (
        <section aria-label="Auto-contribute settings" style={{ marginTop: 24, marginBottom: 8 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 6,
            }}
          >
            Auto-save on payday
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--sub)",
              marginBottom: 12,
              lineHeight: 1.4,
            }}
          >
            Set a fixed amount to save toward your goals each time you log income.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeGoals.map(goal => {
              const rule = autoRules.find(r => r.goalId === goal.id)
              const isEditing = editingAutoRule?.goalId === goal.id

              return (
                <GlassCard key={goal.id} elevation="low" style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{goal.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 500,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {goal.name}
                      </p>
                      {rule && !isEditing && (
                        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          ${rule.amount}/paycheck {!rule.enabled && "(paused)"}
                        </p>
                      )}
                    </div>

                    {/* Toggle / Add / Edit actions */}
                    {rule && !isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => handleToggleAutoRule(goal.id, !rule.enabled)}
                          aria-label={rule.enabled ? "Pause auto-save" : "Resume auto-save"}
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            border: "none",
                            cursor: "pointer",
                            position: "relative",
                            background: rule.enabled
                              ? "rgba(74, 222, 128, 0.4)"
                              : "rgba(255,255,255,0.1)",
                            transition: "background 0.2s",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              left: rule.enabled ? 18 : 2,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: rule.enabled ? "#4ade80" : "var(--muted)",
                              transition: "left 0.2s, background 0.2s",
                            }}
                          />
                        </button>
                        <button
                          onClick={() => setEditingAutoRule({ goalId: goal.id, amount: String(rule.amount) })}
                          aria-label={`Edit auto-save for ${goal.name}`}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--muted)",
                            fontSize: 12,
                            cursor: "pointer",
                            padding: "2px 4px",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleRemoveAutoRule(goal.id)}
                          aria-label={`Remove auto-save for ${goal.name}`}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--error)",
                            fontSize: 12,
                            cursor: "pointer",
                            padding: "2px 4px",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>$</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={editingAutoRule.amount}
                          onChange={(e) => setEditingAutoRule({ goalId: goal.id, amount: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveAutoRule(goal.id, editingAutoRule.amount)
                            if (e.key === "Escape") setEditingAutoRule(null)
                          }}
                          aria-label={`Auto-save amount for ${goal.name}`}
                          style={{
                            width: 60,
                            padding: "4px 8px",
                            fontSize: 13,
                            fontFamily: FONT_FAMILY,
                            color: "var(--text)",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--line)",
                            borderRadius: 6,
                            outline: "none",
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveAutoRule(goal.id, editingAutoRule.amount)}
                          aria-label="Save"
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: FONT_FAMILY,
                            color: "#fff",
                            background: "#4ade80",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingAutoRule(null)}
                          aria-label="Cancel"
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            fontFamily: FONT_FAMILY,
                            color: "var(--muted)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingAutoRule({ goalId: goal.id, amount: "25" })}
                        aria-label={`Set up auto-save for ${goal.name}`}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          fontFamily: FONT_FAMILY,
                          color: "var(--accent)",
                          background: "var(--accent-muted)",
                          border: "1px solid rgba(129, 140, 248, 0.2)",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        + Auto-save
                      </button>
                    )}
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </section>
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

      {/* ── Save-up plan sheet ─────────────────────────────────────────────── */}
      <SaveUpPlanSheet
        isOpen={saveUpOpen}
        onClose={() => setSaveUpOpen(false)}
        onCreateGoal={atCap ? undefined : onCreateGoal}
      />
    </div>
  )
}
