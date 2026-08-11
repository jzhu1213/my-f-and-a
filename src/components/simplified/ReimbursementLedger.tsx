"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  linkButton,
  listRow,
  shadows,
} from "@/styles/shared"
import type { Reimbursement, ReimbursementDirection, SettleUpEntry } from "@/lib/reimbursements"
import { getNetBalance, getNetSummary, validateReimbursement, computeSettleUpLedger, generateReminder } from "@/lib/reimbursements"
import type { FundingSource } from "@/lib/fundingSources"
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {onBack && (
          <motion.button
            onClick={onBack}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 18,
              color: "var(--sub)",
              cursor: "pointer",
            }}
            aria-label="Go back"
          >
            ←
          </motion.button>
        )}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          IOUs & Reimbursements
        </h2>
      </div>

      {/* Net Summary Card */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeader }}>Net Summary</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 2 }}>Coming your way</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
              ${summary.totalOwedToMe.toFixed(2)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 2 }}>Headed out</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--error)", fontVariantNumeric: "tabular-nums" }}>
              ${summary.totalOwedByMe.toFixed(2)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 2 }}>Net</p>
            <p
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: summary.net >= 0 ? "var(--success)" : "var(--error)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {summary.net >= 0 ? "+" : ""}${summary.net.toFixed(2)}
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
          borderRadius: 12,
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid var(--border)",
          marginBottom: 20,
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
              borderRadius: 9,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
              color: activeTab === tab ? "var(--text)" : "var(--muted)",
              background: activeTab === tab ? "rgba(255,255,255,0.08)" : "transparent",
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
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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
                  background: "rgba(0,0,0,0.6)",
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
                  <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                    Settle with {settlingPerson.personName}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 16 }}>
                    {settlingPerson.iouCount} IOU{settlingPerson.iouCount !== 1 ? 's' : ''} · ${Math.abs(settlingPerson.netAmount).toFixed(2)} net
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
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      fontFamily: FONT_FAMILY,
                      color: "var(--text)",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      cursor: settling ? "not-allowed" : "pointer",
                      textAlign: "left",
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
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: FONT_FAMILY,
                        color: "var(--text)",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        cursor: settling ? "not-allowed" : "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        opacity: settling ? 0.6 : 1,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{source.emoji}</span>
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
                      marginTop: 8,
                      fontSize: 13,
                      fontWeight: 500,
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
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: "var(--success)",
            background: "rgba(74, 222, 128, 0.08)",
            border: "1.5px solid rgba(74, 222, 128, 0.3)",
            borderRadius: 12,
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
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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
                      borderRadius: 9,
                      border: "none",
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: FONT_FAMILY,
                      cursor: "pointer",
                      color: direction === d ? "var(--text)" : "var(--muted)",
                      background: direction === d ? "rgba(255,255,255,0.08)" : "transparent",
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
                <p style={{ fontSize: 12, color: "var(--error)", marginTop: 8 }}>
                  {formError}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
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
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "var(--success)",
                    border: "none",
                    borderRadius: 8,
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
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeader }}>By Person</p>
          {Array.from(balances.entries()).map(([person, net]) => (
            <div key={person} style={listRow}>
              <span style={{ fontSize: 14, color: "var(--text)" }}>{person}</span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: net >= 0 ? "var(--success)" : "var(--error)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {net >= 0 ? `+$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`}
              </span>
            </div>
          ))}
        </GlassCard>
      )}

      {/* Unsettled IOUs */}
      {unsettled.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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
  const absAmount = Math.abs(entry.netAmount).toFixed(2)
  const isCopied = copiedPerson === entry.personName

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
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
          fontSize: 13,
          fontWeight: 600,
          background: entry.direction === 'they_owe'
            ? "rgba(74, 222, 128, 0.12)"
            : "rgba(248, 113, 113, 0.12)",
          color: entry.direction === 'they_owe' ? "var(--success)" : "var(--error)",
        }}
        aria-hidden="true"
      >
        {entry.direction === 'they_owe' ? '←' : '→'}
      </span>

      {/* Person and details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", margin: 0 }}>
          {entry.personName}
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          {entry.iouCount} IOU{entry.iouCount !== 1 ? 's' : ''} · {entry.direction === 'they_owe' ? 'coming your way' : 'headed their way'}
        </p>
      </div>

      {/* Net amount */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: entry.direction === 'they_owe' ? "var(--success)" : "var(--error)",
          marginRight: 6,
        }}
      >
        ${absAmount}
      </span>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 4 }}>
        <motion.button
          onClick={onRemind}
          whileTap={{ scale: 0.93 }}
          transition={springs.snappy}
          style={{
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: isCopied ? "var(--success)" : "var(--sub)",
            background: isCopied ? "rgba(74, 222, 128, 0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isCopied ? "rgba(74, 222, 128, 0.25)" : "var(--border)"}`,
            borderRadius: 6,
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
          whileTap={{ scale: 0.93 }}
          transition={springs.snappy}
          style={{
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: "var(--success)",
            background: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.25)",
            borderRadius: 6,
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
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Direction icon */}
      <span
        style={{ fontSize: 16, opacity: 0.7 }}
        aria-hidden="true"
        title={r.direction === "owed_to_me" ? "Coming your way" : "Headed their way"}
      >
        {r.direction === "owed_to_me" ? "←" : "→"}
      </span>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: r.settled ? "var(--muted)" : "var(--text)",
            textDecoration: r.settled ? "line-through" : "none",
            margin: 0,
          }}
        >
          {r.personName}
        </p>
        {r.note && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            {r.note}
          </p>
        )}
      </div>

      {/* Amount */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: r.settled
            ? "var(--muted)"
            : r.direction === "owed_to_me"
              ? "var(--success)"
              : "var(--error)",
        }}
      >
        ${r.amount.toFixed(2)}
      </span>

      {/* Actions */}
      {!r.settled && onSettle && (
        <motion.button
          onClick={onSettle}
          whileTap={{ scale: 0.93 }}
          transition={springs.snappy}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: "var(--success)",
            background: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.25)",
            borderRadius: 6,
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
          whileTap={{ scale: 0.93 }}
          transition={springs.snappy}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: "var(--sub)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            borderRadius: 6,
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
          whileTap={{ scale: 0.93 }}
          transition={springs.snappy}
          style={{
            padding: "4px 8px",
            fontSize: 12,
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
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  outline: "none",
}
