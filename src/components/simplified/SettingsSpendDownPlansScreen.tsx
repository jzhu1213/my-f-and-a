"use client"

/**
 * SettingsSpendDownPlansScreen — Spend-down plans sub-flow.
 *
 * Lists existing spend-down plans with delete buttons, and provides
 * an "Add plan" form with fields for label, emoji, amount, and date range.
 * Optionally supports pre-filling from disbursements.
 *
 * Requirements: Phase 12 — Task 373.3
 */

import { useState } from "react"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, semanticColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"
import type { SpendDownPlan } from "@/lib/spendDown"
import type { Disbursement } from "@/lib/disbursements"

// ============================================================================
// Types
// ============================================================================

export interface SettingsSpendDownPlansScreenProps {
  onBack: () => void
  spendDownPlans: SpendDownPlan[]
  onAddSpendDownPlan?: (data: Omit<SpendDownPlan, 'id'>) => SpendDownPlan
  onRemoveSpendDownPlan?: (id: string) => void
  disbursements?: Disbursement[]
}

// ============================================================================
// Emoji presets
// ============================================================================

const EMOJI_OPTIONS = ['💰', '🎓', '📚', '🏠', '🍕', '🚗', '💼', '🎉']

// ============================================================================
// Section heading
// ============================================================================

function SectionHeading({ children }: { children: string }) {
  return (
    <h2
      style={{
        ...typography["body-sm"],
        color: textColors.muted,
        margin: 0,
        marginBottom: spacingScale["12"],
        fontWeight: 500,
      }}
    >
      {children}
    </h2>
  )
}

// ============================================================================
// Component
// ============================================================================

export function SettingsSpendDownPlansScreen({
  onBack,
  spendDownPlans,
  onAddSpendDownPlan,
  onRemoveSpendDownPlan,
  disbursements,
}: SettingsSpendDownPlansScreenProps) {
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [label, setLabel] = useState("")
  const [emoji, setEmoji] = useState("💰")
  const [totalAmount, setTotalAmount] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const resetForm = () => {
    setLabel("")
    setEmoji("💰")
    setTotalAmount("")
    setStartDate("")
    setEndDate("")
    setShowForm(false)
  }

  const handleAdd = () => {
    if (!onAddSpendDownPlan || !label || !totalAmount || !startDate || !endDate) return

    onAddSpendDownPlan({
      label,
      emoji,
      totalAmount: parseFloat(totalAmount),
      startDate,
      endDate,
    })

    resetForm()
  }

  const handleFillFromDisbursement = (d: Disbursement) => {
    setLabel(d.label)
    setEmoji(d.emoji)
    setTotalAmount(String(d.amount))
    setStartDate(d.startDate)
    // Compute end date from coverMonths
    const start = new Date(d.startDate + "T00:00:00")
    const end = new Date(start)
    end.setMonth(end.getMonth() + d.coverMonths)
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    setEndDate(endStr)
  }

  const isFormValid = label.trim() !== "" && totalAmount !== "" && parseFloat(totalAmount) > 0 && startDate !== "" && endDate !== ""

  return (
    <SettingsSubScreen title="Spend-down plans" onBack={onBack}>
      {/* Existing plans list */}
      {spendDownPlans.length > 0 && (
        <section aria-labelledby="existing-plans-heading" style={{ marginBottom: spacingScale["32"] }}>
          <SectionHeading>Active plans</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
            {spendDownPlans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacingScale["12"],
                  padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
                  background: elevations.resting.fill,
                  border: `1px solid ${elevations.resting.border}`,
                  borderRadius: radius.control,
                }}
              >
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{plan.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...typography.body, color: textColors.text, margin: 0, fontWeight: 500 }}>
                    {plan.label}
                  </p>
                  <p style={{ ...typography.caption, color: textColors.muted, margin: 0, marginTop: 2 }}>
                    ${plan.totalAmount.toLocaleString("en-US")} · {plan.startDate} → {plan.endDate}
                  </p>
                </div>
                {onRemoveSpendDownPlan && (
                  <button
                    type="button"
                    onClick={() => onRemoveSpendDownPlan(plan.id)}
                    aria-label={`Delete ${plan.label}`}
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "50%",
                      color: semanticColors.error,
                      fontSize: "16px",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {spendDownPlans.length === 0 && !showForm && (
        <p style={{ ...typography["body-sm"], color: textColors.sub, textAlign: "center", padding: `${spacingScale["20"]} 0` }}>
          No spend-down plans yet. Add one to track a lump sum over time.
        </p>
      )}

      {/* Add plan button / form */}
      {onAddSpendDownPlan && (
        <section>
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{
                width: "100%",
                padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
                background: colorRamp.accent[50],
                border: `1px solid ${colorRamp.accent[300]}`,
                borderRadius: radius.control,
                cursor: "pointer",
                ...typography.body,
                color: textColors.text,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              + Add plan
            </button>
          ) : (
            <div
              style={{
                padding: spacingScale["16"],
                background: elevations.resting.fill,
                border: `1px solid ${elevations.resting.border}`,
                borderRadius: radius.control,
              }}
            >
              <SectionHeading>New plan</SectionHeading>

              {/* From disbursement (optional) */}
              {disbursements && disbursements.length > 0 && (
                <div style={{ marginBottom: spacingScale["16"] }}>
                  <p style={{ ...typography.caption, color: textColors.muted, margin: 0, marginBottom: spacingScale["8"] }}>
                    Quick-fill from disbursement:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: spacingScale["4"] }}>
                    {disbursements.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleFillFromDisbursement(d)}
                        style={{
                          padding: `${spacingScale["4"]} ${spacingScale["8"]}`,
                          background: elevations.sunken.fill,
                          border: `1px solid ${elevations.resting.border}`,
                          borderRadius: radius.control,
                          cursor: "pointer",
                          ...typography.caption,
                          color: textColors.text,
                        }}
                      >
                        {d.emoji} {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Label */}
              <div style={{ marginBottom: spacingScale["12"] }}>
                <label style={{ ...typography.caption, color: textColors.muted, display: "block", marginBottom: spacingScale["4"] }}>
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Fall Aid Refund"
                  style={{
                    width: "100%",
                    padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                    ...typography.body,
                    color: textColors.text,
                    background: elevations.sunken.fill,
                    border: `1px solid ${elevations.resting.border}`,
                    borderRadius: radius.control,
                    outline: "none",
                  }}
                />
              </div>

              {/* Emoji picker */}
              <div style={{ marginBottom: spacingScale["12"] }}>
                <label style={{ ...typography.caption, color: textColors.muted, display: "block", marginBottom: spacingScale["4"] }}>
                  Emoji
                </label>
                <div style={{ display: "flex", gap: spacingScale["4"], flexWrap: "wrap" }}>
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      aria-pressed={emoji === e}
                      aria-label={`Select emoji ${e}`}
                      style={{
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        background: emoji === e ? colorRamp.accent[50] : "transparent",
                        border: `1px solid ${emoji === e ? colorRamp.accent[300] : elevations.resting.border}`,
                        borderRadius: radius.control,
                        cursor: "pointer",
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: spacingScale["12"] }}>
                <label style={{ ...typography.caption, color: textColors.muted, display: "block", marginBottom: spacingScale["4"] }}>
                  Total amount
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                    ...typography.body,
                    color: textColors.text,
                    background: elevations.sunken.fill,
                    border: `1px solid ${elevations.resting.border}`,
                    borderRadius: radius.control,
                    outline: "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
              </div>

              {/* Date range */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacingScale["8"], marginBottom: spacingScale["16"] }}>
                <div>
                  <label style={{ ...typography.caption, color: textColors.muted, display: "block", marginBottom: spacingScale["4"] }}>
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                      ...typography["body-sm"],
                      color: textColors.text,
                      background: elevations.sunken.fill,
                      border: `1px solid ${elevations.resting.border}`,
                      borderRadius: radius.control,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ ...typography.caption, color: textColors.muted, display: "block", marginBottom: spacingScale["4"] }}>
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                      ...typography["body-sm"],
                      color: textColors.text,
                      background: elevations.sunken.fill,
                      border: `1px solid ${elevations.resting.border}`,
                      borderRadius: radius.control,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: spacingScale["8"] }}>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!isFormValid}
                  style={{
                    flex: 1,
                    padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
                    background: isFormValid ? colorRamp.accent[400] : elevations.sunken.fill,
                    color: isFormValid ? "#fff" : textColors.muted,
                    border: "none",
                    borderRadius: radius.control,
                    cursor: isFormValid ? "pointer" : "not-allowed",
                    ...typography.body,
                    fontWeight: 500,
                  }}
                >
                  Add plan
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    ...typography["body-sm"],
                    color: textColors.muted,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </SettingsSubScreen>
  )
}
