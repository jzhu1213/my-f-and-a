"use client"

import { useState, useEffect, useCallback } from 'react'
import { Sheet } from '@/components/ui/primitives/Sheet'
import { triggerHaptic } from '@/lib/haptics'
import { FONT_FAMILY, spacing, typography, fontWeights, pxToRem } from '@/styles/typography'
import { colorRamp, fills, shadows, HORIZONTAL_PADDING } from '@/styles/shared'
import { radius } from '@/styles/surfaces'

/** Data passed to the parent when feedback is submitted. */
export interface FeedbackSubmission {
  /** NPS-style rating from 1 (worst) to 5 (best). */
  rating: number
  /** Optional freeform comment. Empty string when the user left it blank. */
  text: string
}

interface FeedbackSheetProps {
  /** Whether the sheet is visible. */
  isOpen: boolean
  /** Close the sheet (backdrop tap, Escape, cancel). */
  onClose: () => void
  /**
   * Called when the user submits feedback. Receives the chosen rating and any
   * freeform text. Kept abstract so storage/prompt-timing can be wired later
   * (subtasks 536.2 / 536.3).
   */
  onSubmit: (feedback: FeedbackSubmission) => void
}

/** Maximum length of the freeform comment (defensive cap). */
const MAX_TEXT_LENGTH = 500

/**
 * The 1–5 NPS-style faces. `value` is the rating; `emoji`/`label` drive the
 * visual and accessible name. Ordered worst → best so higher = happier.
 */
const RATING_FACES: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Not great' },
  { value: 2, emoji: '😕', label: 'Could be better' },
  { value: 3, emoji: '😐', label: 'It’s okay' },
  { value: 4, emoji: '🙂', label: 'Pretty good' },
  { value: 5, emoji: '😍', label: 'Love it' },
]

/**
 * Strip HTML tags and entities, then clamp to {@link MAX_TEXT_LENGTH}.
 * Mirrors how transaction notes are sanitized elsewhere in the app.
 */
function sanitizeFeedbackText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .slice(0, MAX_TEXT_LENGTH)
}

/**
 * FeedbackSheet — a warm, non-intrusive bottom sheet for collecting feedback.
 *
 * Contents:
 * - An NPS-style 1–5 emoji rating (single-select, keyboard accessible).
 * - An optional freeform comment ("What could be better?").
 * - A submit button (enabled once a rating is chosen).
 *
 * This subtask builds the component only — it does not persist feedback or
 * decide when to prompt. The `onSubmit` callback is intentionally abstract.
 *
 * Validates: Requirements 33.3
 */
export function FeedbackSheet({ isOpen, onClose, onSubmit }: FeedbackSheetProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [text, setText] = useState('')

  // Reset state each time the sheet opens.
  useEffect(() => {
    if (isOpen) {
      setRating(null)
      setText('')
    }
  }, [isOpen])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(sanitizeFeedbackText(e.target.value))
  }, [])

  const handleSelectRating = useCallback((value: number) => {
    setRating(value)
    triggerHaptic('light')
  }, [])

  const canSubmit = rating !== null

  const handleSubmit = useCallback(() => {
    if (rating === null) return
    onSubmit({ rating, text: text.trim() })
    onClose()
  }, [rating, text, onSubmit, onClose])

  return (
    <Sheet open={isOpen} onClose={onClose} size="half" aria-label="Send feedback">
      <div style={{ padding: '0 24px 32px' }}>
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <h2
            style={{
              fontSize: typography.subhead.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: fontWeights.semibold,
              color: 'var(--text)',
              margin: '0 0 6px',
            }}
          >
            How’s Folio feeling?
          </h2>
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontFamily: FONT_FAMILY,
              color: 'var(--sub)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Your take helps us make it better.
          </p>
        </div>

        {/* ── Rating faces (single-select) ───────────────── */}
        <div
          role="radiogroup"
          aria-label="Rate your experience from 1 to 5"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: spacing.xs,
            marginBottom: spacing.lg,
          }}
        >
          {RATING_FACES.map((face) => {
            const selected = rating === face.value
            return (
              <button
                key={face.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${face.value} of 5 — ${face.label}`}
                onClick={() => handleSelectRating(face.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  width: 56,
                  minHeight: 56,
                  padding: '8px 4px',
                  background: selected ? colorRamp.accent[200] : fills[4],
                  border: selected
                    ? `1px solid ${colorRamp.accent[400]}`
                    : `1px solid ${fills[10]}`,
                  borderRadius: radius.control,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
                  transform: selected ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">
                  {face.emoji}
                </span>
                <span
                  style={{
                    fontSize: pxToRem(11),
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.medium,
                    fontVariantNumeric: 'tabular-nums',
                    color: selected ? 'var(--accent)' : 'var(--muted)',
                  }}
                  aria-hidden="true"
                >
                  {face.value}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Optional freeform text ─────────────────────── */}
        <div style={{ marginBottom: HORIZONTAL_PADDING }}>
          <label htmlFor="feedback-text" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>
            What could be better?
          </label>
          <textarea
            id="feedback-text"
            value={text}
            onChange={handleTextChange}
            maxLength={MAX_TEXT_LENGTH}
            rows={3}
            placeholder="What could be better?"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: fills[4],
              border: `1px solid ${fills[10]}`,
              borderRadius: radius.control,
              outline: 'none',
              resize: 'none',
              fontSize: typography.body.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: 1.5,
              color: 'var(--text)',
              padding: '12px 14px',
              caretColor: 'var(--accent)',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--fill-10)' }}
          />
        </div>

        {/* ── Submit ─────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Send feedback"
          style={{
            width: '100%',
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canSubmit ? 'var(--gradient-action)' : 'var(--dim)',
            color: canSubmit ? 'var(--text)' : 'var(--muted)',
            fontFamily: FONT_FAMILY,
            fontSize: pxToRem(16),
            fontWeight: fontWeights.semibold,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.5,
            boxShadow: canSubmit ? shadows.glowAccentStrong : 'none',
            transition: 'opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          Send feedback
        </button>
      </div>
    </Sheet>
  )
}
