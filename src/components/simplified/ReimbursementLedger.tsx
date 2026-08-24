"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  linkButton,
  listRow,
  shadows,
} from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import type { Reimbursement, ReimbursementDirection, SettleUpEntry } from "@/lib/reimbursements"
import { getNetBalance, getNetSummary, validateReimbursement, computeSettleUpLedger, generateReminder } from "@/lib/reimbursements"
import type { FundingSource } from "@/lib/fundingSources"
import { formatCurrency } from "@/lib/currencyUtils"
import { getHomeCurrency } from "@/lib/currencyPreferences"
import {
  getReimbursements,
  createReimbursement,
  settleReimbursement,
  unsettleReimbursement,
  deleteReimbursement,
  settleAllForPerson,
  getFundingSources,
} from "@/lib/supabaseData"

// ============================================================================
// Types
// ============================================================================

export interface ReimbursementLedgerProps {
  userId: string
  onBack?: () => void
}

type LedgerTab = 'ious' | 'settle'

// ============================================================================
// Component
// ============================================================================

/**
 * ReimbursementLedger — simplified IOU tracking surface.
 * Shows money owed to and by the user, grouped by person with net summaries.
 * Settling is optimistic and reversible on persistence failure.
 * Includes a settle-up ledger view with per-person net balances, remind, and
 * batch settle with optional funding source recording.
 *
 * Validates: Requirements 12.3, 13.7, Task 168
 */
export function ReimbursementLedger({ userId, onBack }: ReimbursementLedgerProps) {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<LedgerTab>('ious')

  // Funding sources for settle-via-source flow
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)

  // Settle-up source picker state
  const [settlingPerson, setSettlingPerson] = useState<SettleUpEntry | null>(null)
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [settling, setSettling] = useState(false)

  // Escape key dismissal for source picker modal (task 511.3)
  useEffect(() => {
    if (!showSourcePicker) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setShowSourcePicker(false)
        setSettlingPerson(null)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showSourcePicker])

  // Clipboard feedback
  const [copiedPerson, setCopiedPerson] = useState<string | null>(null)

  // Form state
  const [personName, setPersonName] = useState("")
  const [amount, setAmount] = useState("")
  const [direction, setDirection] = useState<ReimbursementDirection>("owed_to_me")
  const [note, setNote] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Load data on mount
  const loadData = useCallback(async () => {
    const [data, sources] = await Promise.all([
      getReimbursements(userId),
      !sourcesLoaded ? getFundingSources(userId) : Promise.resolve(fundingSources),
    ])
    setReimbursements(data)
    setFundingSources(sources)
    setSourcesLoaded(true)
    setLoaded(true)
  }, [userId, sourcesLoaded, fundingSources])

  // Initial load
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const parsed = parseFloat(amount)
    const validation = validateReimbursement({
      personName,
      amount: parsed,
      direction,
    })

    if (!validation.valid) {
      setFormError(validation.error ?? "Invalid input")
      return
    }

    setSubmitting(true)
    setFormError("")

    const result = await createReimbursement(userId, {
      personName: personName.trim(),
      direction,
      amount: parsed,
      note: note.trim() || undefined,
    })

    if (result) {
      setReimbursements(prev => [result, ...prev])
      setPersonName("")
      setAmount("")
      setNote("")
      setDirection("owed_to_me")
      setShowForm(false)
    } else {
      setFormError("Couldn't save — check your connection")
    }

    setSubmitting(false)
  }

  const handleSettle = async (id: string) => {
    // Optimistic update
    const prev = reimbursements
    setReimbursements(rs =>
      rs.map(r => r.id === id ? { ...r, settled: true, settledAt: new Date().toISOString() } : r)
    )

    const result = await settleReimbursement(userId, id)
    if (!result) {
      // Rollback on failure
      setReimbursements(prev)
    }
  }

  const handleUnsettle = async (id: string) => {
    // Optimistic update
    const prev = reimbursements
    setReimbursements(rs =>
      rs.map(r => r.id === id ? { ...r, settled: false, settledAt: null } : r)
    )

    const result = await unsettleReimbursement(userId, id)
    if (!result) {
      // Rollback on failure
      setReimbursements(prev)
    }
  }

  const handleDelete = async (id: string) => {
    const prev = reimbursements
    setReimbursements(rs => rs.filter(r => r.id !== id))

    const success = await deleteReimbursement(userId, id)
    if (!success) {
      setReimbursements(prev)
    }
  }

  // ── Settle-up handlers ──────────────────────────────────────────────────────

  const handleRemind = async (entry: SettleUpEntry) => {
    const message = generateReminder(entry)
    try {
      await navigator.clipboard.writeText(message)
      setCopiedPerson(entry.personName)
      setTimeout(() => setCopiedPerson(null), 2000)
    } catch {
      // Fallback: some browsers block clipboard in non-secure contexts
      setCopiedPerson(null)
    }
  }

  const handleSettleAllForPerson = (entry: SettleUpEntry) => {
    setSettlingPerson(entry)
    setShowSourcePicker(true)
  }

  const handleConfirmSettle = async (fundingSourceId?: string) => {
    if (!settlingPerson) return
    setSettling(true)

    // Optimistic update
    const prev = reimbursements
    const idsToSettle = new Set(settlingPerson.iouIds)
    setReimbursements(rs =>
      rs.map(r =>
        idsToSettle.has(r.id)
          ? { ...r, settled: true, settledAt: new Date().toISOString(), settledViaSourceId: fundingSourceId }
          : r
      )
    )

    const result = await settleAllForPerson(userId, settlingPerson.iouIds, fundingSourceId)
    if (result.length === 0) {
      // Rollback on failure
      setReimbursements(prev)
    }

    setSettling(false)
    setShowSourcePicker(false)
    setSettlingPerson(null)
  }

  // ── Computed values ─────────────────────────────────────────────────────────

  const summary = getNetSummary(reimbursements)
  const balances = getNetBalance(reimbursements)
  const unsettled = reimbursements.filter(r => !r.settled)
  const settled = reimbursements.filter(r => r.settled)
  const settleUpLedger = computeSettleUpLedger(reimbursements)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: HORIZONTAL_PADDING }}>
        {onBack && (
          <motion.button
            onClick={onBack}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: typography.subhead.fontSize,
              color: "var(--sub)",
              cursor: "pointer",
            }}
            aria-label="Go back"
          >
            ←
          </motion.button>
        )}
        <h2 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.bold, color: "var(--text)", margin: 0 }}>
          IOUs & Reimbursements
        </h2>
      </div>

      {/* Net Summary Card */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
        <p style={{ ...sectionHeader }}>Net Summary</p>
        <div style={{ display: "flex", gap: HORIZONTAL_PADDING, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: 2 }}>Coming your way</p>
            <p style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.bold, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(summary.totalOwedToMe, getHomeCurrency())}
            </p>
          </div>
          <div>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: 2 }}>Headed out</p>
            <p style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.bold, color: "var(--error)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(summary.totalOwedByMe, getHomeCurrency())}
            </p>
          </div>
          <div>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: 2 }}>Net</p>
            <p
              style={{
                fontSize: typography.subhead.fontSize,
                fontWeight: fontWeights.bold,
                color: summary.net >= 0 ? "var(--success)" : "var(--error)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {summary.net >= 0 ? "+" : ""}{formatCurrency(summary.net, getHomeCurrency())}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          borderRadius: radius.control,
          background: "var(--fill-04)",
          border: "1px solid var(--border)",
          marginBottom: HORIZONTAL_PADDING,
        }}
      >
        {([['ious', 'IOUs'], ['settle', 'Settle Up']] as const).map(([tab, label]) => (
          <motion.button
            key={tab}
            onClick={() => setActiveTab(tab)}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: radius.control,
              border: "none",
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.medium,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
              color: activeTab === tab ? "var(--text)" : "var(--muted)",
              background: activeTab === tab ? "var(--fill-08)" : "transparent",
              boxShadow: activeTab === tab ? shadows.sm : "none",
              transition: "background 0.2s, color 0.2s",
            }}
            aria-pressed={activeTab === tab}
          >
            {label}
          </motion.button>
        ))}
      </div>

      {/* ── Settle-Up Ledger Tab ──────────────────────────────────────────────── */}
      {activeTab === 'settle' && (
        <>
          {settleUpLedger.length === 0 && (
            <EmptyState
              illustration="generic"
              title="All squared up"
              subtitle="No outstanding balances with anyone."
              actionColor="success"
            />
          )}

          {settleUpLedger.length > 0 && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
              <p style={{ ...sectionHeader }}>Settle-Up Summary</p>
              {settleUpLedger.map(entry => (
                <SettleUpRow
                  key={entry.personName}
                  entry={entry}
                  copiedPerson={copiedPerson}
                  onRemind={() => handleRemind(entry)}
                  onSettle={() => handleSettleAllForPerson(entry)}
                />
              ))}
            </GlassCard>
          )}

          {/* Funding Source Picker Modal */}
          <AnimatePresence>
            {showSourcePicker && settlingPerson && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "var(--color-canvas)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 100,
                  padding: 20,
                }}
                onClick={() => { setShowSourcePicker(false); setSettlingPerson(null) }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={springs.gentle}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    background: "var(--surface)",
                    borderRadius: 16,
                    padding: "20px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)", marginBottom: 4 }}>
                    Settle with {settlingPerson.personName}
                  </p>
                  <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: spacing.md }}>
                    {settlingPerson.iouCount} IOU{settlingPerson.iouCount !== 1 ? 's' : ''} · {formatCurrency(Math.abs(settlingPerson.netAmount), getHomeCurrency())} net
                  </p>

                  <p style={{ ...sectionHeader }}>How are you settling?</p>

                  {/* Skip source option */}
                  <motion.button
                    onClick={() => handleConfirmSettle(undefined)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    disabled={settling}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      marginBottom: spacing.xs,
                      fontSize: typography.body.fontSize,
                      fontWeight: fontWeights.medium,
                      fontFamily: FONT_FAMILY,
                      color: "var(--text)",
                      background: "var(--fill-04)",
                      border: "1px solid var(--border)",
                      borderRadius: radius.control,
                      cursor: settling ? "not-allowed" : "pointer",
                      textAlign: "start",
                      opacity: settling ? 0.6 : 1,
                    }}
                  >
                    Just mark settled (no source)
                  </motion.button>

                  {/* Funding source options */}
                  {fundingSources.map(source => (
                    <motion.button
                      key={source.id}
                      onClick={() => handleConfirmSettle(source.id)}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      disabled={settling}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        marginBottom: 6,
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.medium,
                        fontFamily: FONT_FAMILY,
                        color: "var(--text)",
                        background: "var(--fill-04)",
                        border: "1px solid var(--border)",
                        borderRadius: radius.control,
                        cursor: settling ? "not-allowed" : "pointer",
                        textAlign: "start",
                        display: "flex",
                        alignItems: "center",
                        gap: spacing.sm,
                        opacity: settling ? 0.6 : 1,
                      }}
                    >
                      <span style={{ fontSize: typography.subhead.fontSize }}>{source.emoji}</span>
                      <span>{source.label}</span>
                    </motion.button>
                  ))}

                  {/* Cancel */}
                  <motion.button
                    onClick={() => { setShowSourcePicker(false); setSettlingPerson(null) }}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      marginTop: spacing.xs,
                      fontSize: typography['body-sm'].fontSize,
                      fontWeight: fontWeights.medium,
                      fontFamily: FONT_FAMILY,
                      color: "var(--muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── IOUs Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'ious' && (
        <>
      {/* Add IOU Button */}
      {!showForm && (
        <motion.button
          onClick={() => setShowForm(true)}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={{
            width: "100%",
            padding: "12px 20px",
            marginBottom: HORIZONTAL_PADDING,
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: "var(--success)",
            background: "var(--success-100)",
            border: "1.5px solid var(--success-300)",
            borderRadius: radius.control,
            cursor: "pointer",
          }}
          aria-label="Add new IOU"
        >
          + Add IOU
        </motion.button>
      )}

      {/* Add IOU Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.gentle}
          >
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
              <p style={{ ...sectionHeader }}>New IOU</p>

              {/* Direction toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {(["owed_to_me", "owed_by_me"] as const).map(d => (
                  <motion.button
                    key={d}
                    onClick={() => setDirection(d)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: radius.control,
                      border: "none",
                      fontSize: typography['body-sm'].fontSize,
                      fontWeight: fontWeights.medium,
                      fontFamily: FONT_FAMILY,
                      cursor: "pointer",
                      color: direction === d ? "var(--text)" : "var(--muted)",
                      background: direction === d ? "var(--fill-08)" : "transparent",
                    }}
                    aria-pressed={direction === d}
                  >
                    {d === "owed_to_me" ? "They're paying me" : "I'm paying them"}
                  </motion.button>
                ))}
              </div>

              {/* Person name */}
              <input
                type="text"
                placeholder="Person's name"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                style={inputStyle}
                aria-label="Person name"
              />

              {/* Amount */}
              <input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                style={{ ...inputStyle, marginTop: 10 }}
                aria-label="IOU amount"
              />

              {/* Note */}
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{ ...inputStyle, marginTop: 10 }}
                aria-label="IOU note"
              />

              {formError && (
                <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--error)", marginTop: spacing.xs }}>
                  {formError}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: spacing.xs, marginTop: 14 }}>
                <motion.button
                  onClick={() => {
                    setShowForm(false)
                    setFormError("")
                  }}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.medium,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "var(--fill-06)",
                    border: "1px solid var(--border)",
                    borderRadius: radius.control,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleAdd}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "var(--success)",
                    border: "none",
                    borderRadius: radius.control,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "Saving…" : "Add"}
                </motion.button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Per-person breakdown */}
      {balances.size > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
          <p style={{ ...sectionHeader }}>By Person</p>
          {Array.from(balances.entries()).map(([person, net]) => (
            <div key={person} style={listRow}>
              <span style={{ fontSize: typography.body.fontSize, color: "var(--text)" }}>{person}</span>
              <span
                style={{
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.semibold,
                  color: net >= 0 ? "var(--success)" : "var(--error)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {net >= 0 ? `+${formatCurrency(net, getHomeCurrency())}` : `-${formatCurrency(Math.abs(net), getHomeCurrency())}`}
              </span>
            </div>
          ))}
        </GlassCard>
      )}

      {/* Unsettled IOUs */}
      {unsettled.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
          <p style={{ ...sectionHeader }}>Open IOUs</p>
          {unsettled.map(r => (
            <IOURow
              key={r.id}
              reimbursement={r}
              onSettle={() => handleSettle(r.id)}
              onDelete={() => handleDelete(r.id)}
            />
          ))}
        </GlassCard>
      )}

      {/* Settled IOUs */}
      {settled.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
          <p style={{ ...sectionHeader }}>Settled</p>
          {settled.slice(0, 10).map(r => (
            <IOURow
              key={r.id}
              reimbursement={r}
              onUnsettle={() => handleUnsettle(r.id)}
              onDelete={() => handleDelete(r.id)}
            />
          ))}
        </GlassCard>
      )}

      {/* Empty state */}
      {loaded && reimbursements.length === 0 && (
        <EmptyState
          illustration="generic"
          title="No IOUs yet"
          subtitle="Keep track of shared expenses with friends — no rush, just clarity."
          actionLabel="+ Add IOU"
          onAction={() => setShowForm(true)}
        />
      )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface SettleUpRowProps {
  entry: SettleUpEntry
  copiedPerson: string | null
  onRemind: () => void
  onSettle: () => void
}

function SettleUpRow({ entry, copiedPerson, onRemind, onSettle }: SettleUpRowProps) {
  const absAmount = Math.abs(entry.netAmount)
  const isCopied = copiedPerson === entry.personName

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: "10px 0",
        borderBottom: "1px solid var(--fill-04)",
      }}
    >
      {/* Direction indicator */}
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: typography['body-sm'].fontSize,
          fontWeight: fontWeights.semibold,
          background: entry.direction === 'they_owe'
            ? "var(--success-200)"
            : "var(--error-200)",
          color: entry.direction === 'they_owe' ? "var(--success)" : "var(--error)",
        }}
        aria-hidden="true"
      >
        {entry.direction === 'they_owe' ? '←' : '→'}
      </span>

      {/* Person and details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: "var(--text)", margin: 0 }}>
          {entry.personName}
        </p>
        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", margin: 0 }}>
          {entry.iouCount} IOU{entry.iouCount !== 1 ? 's' : ''} · {entry.direction === 'they_owe' ? 'coming your way' : 'headed their way'}
        </p>
      </div>

      {/* Net amount */}
      <span
        style={{
          fontSize: typography.body.fontSize,
          fontWeight: fontWeights.semibold,
          fontVariantNumeric: "tabular-nums",
          color: entry.direction === 'they_owe' ? "var(--success)" : "var(--error)",
          marginInlineEnd: 6,
        }}
      >
        {formatCurrency(absAmount, getHomeCurrency())}
      </span>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 4 }}>
        <motion.button
          onClick={onRemind}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            padding: "5px 9px",
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: isCopied ? "var(--success)" : "var(--sub)",
            background: isCopied ? "var(--success-100)" : "var(--fill-04)",
            border: `1px solid ${isCopied ? "var(--success-300)" : "var(--border)"}`,
            borderRadius: radius.min,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-label={`Copy reminder for ${entry.personName}`}
          title="Copy reminder to clipboard"
        >
          {isCopied ? '✓ Copied' : 'Remind'}
        </motion.button>
        <motion.button
          onClick={onSettle}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            padding: "5px 9px",
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: "var(--success)",
            background: "var(--success-100)",
            border: "1px solid var(--success-300)",
            borderRadius: radius.min,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-label={`Settle all IOUs with ${entry.personName}`}
        >
          Settle
        </motion.button>
      </div>
    </div>
  )
}

interface IOURowProps {
  reimbursement: Reimbursement
  onSettle?: () => void
  onUnsettle?: () => void
  onDelete?: () => void
}

function IOURow({ reimbursement: r, onSettle, onUnsettle, onDelete }: IOURowProps) {
  // Task 426.2: Determine if this IOU has foreign currency info
  const hasForeignCurrency = !!(r.currency && r.originalAmount != null && r.exchangeRate)
  const homeCurrency = getHomeCurrency()

  // Compute if rate has changed significantly (>5%) — compare stored rate to current
  // For now, we use the stored rate since live rate fetching isn't available in-component.
  // Infrastructure is ready for future live rate display.
  // const rateChanged = false // Placeholder for future live rate comparison

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: "8px 0",
        borderBottom: "1px solid var(--fill-04)",
      }}
    >
      {/* Direction icon */}
      <span
        style={{ fontSize: typography.body.fontSize, opacity: 0.7 }}
        aria-hidden="true"
        title={r.direction === "owed_to_me" ? "Coming your way" : "Headed their way"}
      >
        {r.direction === "owed_to_me" ? "←" : "→"}
      </span>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            color: r.settled ? "var(--muted)" : "var(--text)",
            textDecoration: r.settled ? "line-through" : "none",
            margin: 0,
          }}
        >
          {r.personName}
        </p>
        {r.note && (
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", margin: 0 }}>
            {r.note}
          </p>
        )}
      </div>

      {/* Amount — task 426.2: show both currencies when foreign */}
      <div style={{ textAlign: "end", minWidth: 0 }}>
        {hasForeignCurrency ? (
          <>
            {/* Original foreign amount (prominent) */}
            <span
              style={{
                display: "block",
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                fontVariantNumeric: "tabular-nums",
                color: r.settled
                  ? "var(--muted)"
                  : r.direction === "owed_to_me"
                    ? "var(--success)"
                    : "var(--error)",
              }}
            >
              {formatCurrency(r.originalAmount!, r.currency)}
            </span>
            {/* Home-currency equivalent (secondary) */}
            <span
              style={{
                display: "block",
                fontSize: typography.caption.fontSize,
                fontVariantNumeric: "tabular-nums",
                color: "var(--muted)",
                marginTop: 1,
              }}
            >
              ≈ {formatCurrency(r.amount, homeCurrency)}
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              fontVariantNumeric: "tabular-nums",
              color: r.settled
                ? "var(--muted)"
                : r.direction === "owed_to_me"
                  ? "var(--success)"
                  : "var(--error)",
            }}
          >
            {formatCurrency(r.amount, homeCurrency)}
          </span>
        )}
      </div>

      {/* Actions */}
      {!r.settled && onSettle && (
        <motion.button
          onClick={onSettle}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            padding: "4px 10px",
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: "var(--success)",
            background: "var(--success-100)",
            border: "1px solid var(--success-300)",
            borderRadius: radius.min,
            cursor: "pointer",
          }}
          aria-label={`Settle IOU with ${r.personName}`}
        >
          Settle
        </motion.button>
      )}
      {r.settled && onUnsettle && (
        <motion.button
          onClick={onUnsettle}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            padding: "4px 10px",
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: "var(--sub)",
            background: "var(--fill-04)",
            border: "1px solid var(--border)",
            borderRadius: radius.min,
            cursor: "pointer",
          }}
          aria-label={`Undo settle for IOU with ${r.personName}`}
        >
          Undo
        </motion.button>
      )}
      {onDelete && (
        <motion.button
          onClick={onDelete}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            padding: "4px 8px",
            fontSize: typography['body-sm'].fontSize,
            fontFamily: FONT_FAMILY,
            color: "var(--muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          aria-label={`Delete IOU with ${r.personName}`}
        >
          ×
        </motion.button>
      )}
    </div>
  )
}

// ============================================================================
// Shared styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: typography.body.fontSize,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "var(--color-sunken)",
  border: "1px solid var(--border)",
  borderRadius: radius.control,
  outline: "none",
}
