"use client"

import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import {
  getCreditScoreHistory,
  addCreditScoreEntry,
  getScoreRangeLabel,
  getScoreColor,
  isValidCreditScore,
} from '@/lib/creditScoreCheckin'
import type { CreditScoreEntry } from '@/lib/creditScoreCheckin'
import { FONT_FAMILY } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeading,
  borderRadius,
} from '@/styles/shared'

// ============================================================================
// CreditScoreCheckin
// ============================================================================

interface CreditScoreCheckinProps {
  onBack: () => void
}

export function CreditScoreCheckin({ onBack }: CreditScoreCheckinProps) {
  const [scoreInput, setScoreInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [history, setHistory] = useState<CreditScoreEntry[]>(() => getCreditScoreHistory())
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const latest = history.length > 0 ? history[0] : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setShowSuccess(false)

    const score = Number(scoreInput)
    if (!scoreInput.trim() || isNaN(score)) {
      setError('Enter a number between 300 and 850')
      return
    }
    if (!isValidCreditScore(score)) {
      setError('Credit scores range from 300 to 850')
      return
    }

    const success = addCreditScoreEntry(score, noteInput)
    if (success) {
      setScoreInput('')
      setNoteInput('')
      setHistory(getCreditScoreHistory())
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
  }

  return (
    <div
      style={{
        paddingBottom: DOCK_PADDING_BOTTOM,
        maxWidth: CONTENT_MAX_WIDTH,
        margin: '0 auto',
        padding: `48px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--sub)',
          fontSize: 14,
          fontFamily: FONT_FAMILY,
          cursor: 'pointer',
          marginBottom: 20,
        }}
        aria-label="Back to Lessons"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <h2 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY, marginBottom: 8 }}>
        Credit Score Check-In
      </h2>
      <p style={{ fontSize: 14, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginBottom: 24, lineHeight: 1.5 }}>
        Track your credit score over time. No bureau connection needed — just log it here whenever you check.
      </p>

      {/* Current Score Display */}
      {latest && (
        <GlassCard elevation="high" glow="healthy">
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ ...sectionHeading, marginBottom: 8 }}>Your latest score</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 300,
                  color: getScoreColor(latest.score),
                  fontFamily: FONT_FAMILY,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {latest.score}
              </span>
              <span style={{ fontSize: 14, color: 'var(--sub)', fontFamily: FONT_FAMILY }}>
                {getScoreRangeLabel(latest.score)}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginTop: 8 }}>
              Logged {formatDate(latest.date)}
            </p>
            {latest.note && (
              <p style={{ fontSize: 12, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginTop: 4, fontStyle: 'italic' }}>
                &ldquo;{latest.note}&rdquo;
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* Score Entry Form */}
      <div style={{ marginTop: 24 }}>
        <GlassCard elevation="medium">
          <form onSubmit={handleSubmit} style={{ padding: 20 }}>
            <p style={{ ...sectionHeading, marginBottom: 12 }}>
              {latest ? 'Update your score' : 'Log your first score'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Score input */}
              <div>
                <label
                  htmlFor="credit-score-input"
                  style={{ display: 'block', fontSize: 12, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginBottom: 4 }}
                >
                  Credit score (300–850)
                </label>
                <input
                  id="credit-score-input"
                  type="number"
                  min={300}
                  max={850}
                  value={scoreInput}
                  onChange={(e) => { setScoreInput(e.target.value); setError('') }}
                  placeholder="e.g. 720"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: error ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: borderRadius.sm,
                    color: 'var(--text)',
                    fontSize: 16,
                    fontFamily: FONT_FAMILY,
                    fontVariantNumeric: 'tabular-nums',
                    outline: 'none',
                  }}
                  aria-describedby={error ? 'score-error' : undefined}
                />
              </div>

              {/* Note input */}
              <div>
                <label
                  htmlFor="credit-score-note"
                  style={{ display: 'block', fontSize: 12, color: 'var(--sub)', fontFamily: FONT_FAMILY, marginBottom: 4 }}
                >
                  Note (optional)
                </label>
                <input
                  id="credit-score-note"
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g. Checked via bank app"
                  maxLength={100}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: borderRadius.sm,
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: FONT_FAMILY,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <p id="score-error" role="alert" style={{ fontSize: 12, color: 'rgba(248, 113, 113, 0.9)', fontFamily: FONT_FAMILY }}>
                  {error}
                </p>
              )}

              {/* Success message */}
              {showSuccess && (
                <p role="status" style={{ fontSize: 12, color: 'var(--success)', fontFamily: FONT_FAMILY }}>
                  ✓ Score saved!
                </p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: 'rgba(6, 214, 160, 0.15)',
                  border: '1px solid rgba(6, 214, 160, 0.3)',
                  borderRadius: borderRadius.sm,
                  color: 'var(--success)',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: 'pointer',
                }}
              >
                {latest ? 'Save updated score' : 'Log score'}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>

      {/* Score Range Guide */}
      <div style={{ marginTop: 24 }}>
        <GlassCard elevation="low">
          <div style={{ padding: 16 }}>
            <p style={{ ...sectionHeading, marginBottom: 12 }}>Score ranges</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Excellent', range: '800–850', color: 'var(--success)' },
                { label: 'Very Good', range: '740–799', color: 'var(--success)' },
                { label: 'Good', range: '670–739', color: 'rgba(6, 214, 160, 0.7)' },
                { label: 'Fair', range: '580–669', color: 'var(--warning)' },
                { label: 'Building', range: '300–579', color: 'rgba(245, 158, 11, 0.7)' },
              ].map(tier => (
                <div key={tier.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: tier.color }} />
                    <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: FONT_FAMILY }}>{tier.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: FONT_FAMILY, fontVariantNumeric: 'tabular-nums' }}>
                    {tier.range}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* History */}
      {history.length > 1 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ ...sectionHeading, marginBottom: 12 }}>History</p>
          <GlassCard elevation="low">
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {history.slice(0, 10).map((entry, i) => (
                  <div
                    key={`${entry.date}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderTop: i > 0 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                        {formatDate(entry.date)}
                      </span>
                      {entry.note && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: FONT_FAMILY, fontStyle: 'italic' }}>
                          {entry.note}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: getScoreColor(entry.score),
                        fontFamily: FONT_FAMILY,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {entry.score}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: FONT_FAMILY }}>
                        {getScoreRangeLabel(entry.score)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Encouragement */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: FONT_FAMILY, lineHeight: 1.5 }}>
          Tip: Check your score for free through your bank app or Credit Karma. Checking your own score never hurts it.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}
