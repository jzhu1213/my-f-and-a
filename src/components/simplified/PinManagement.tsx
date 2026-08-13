"use client"

/**
 * PinManagement — Settings section for managing pinned home cards.
 *
 * Users can add, remove, and reorder their pinned cards. Shows a preview
 * of each card type. Warm empty state when no cards are pinned.
 *
 * Requirement 18.6 — Pinnable home cards
 */

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import {
  glassSurface,
  borderRadius,
  fills,
  colorRamp,
} from "@/styles/shared"
import type { PinnedCard, PinnedCardType } from "@/lib/homeWidgets"
import {
  MAX_PINNED_CARDS,
  CARD_META,
  ALL_CARD_TYPES,
  getPinnedCards,
  setPinnedCards,
  addPinnedCard,
  removePinnedCard,
  reorderPinnedCards,
} from "@/lib/homeWidgets"

// ============================================================================
// Props
// ============================================================================

export interface PinManagementProps {
  /** Callback when pinned cards change (so parent can re-render) */
  onPinnedCardsChange?: (cards: PinnedCard[]) => void
}

// ============================================================================
// Component
// ============================================================================

export function PinManagement({ onPinnedCardsChange }: PinManagementProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [pinnedCards, setPinnedCardsLocal] = useState<PinnedCard[]>(() => getPinnedCards())

  const syncCards = useCallback(
    (cards: PinnedCard[]) => {
      setPinnedCardsLocal(cards)
      onPinnedCardsChange?.(cards)
    },
    [onPinnedCardsChange]
  )

  const handleAdd = useCallback(
    (type: PinnedCardType) => {
      const updated = addPinnedCard(type)
      syncCards(updated)
    },
    [syncCards]
  )

  const handleRemove = useCallback(
    (type: PinnedCardType) => {
      const updated = removePinnedCard(type)
      syncCards(updated)
    },
    [syncCards]
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return
      const updated = reorderPinnedCards(index, index - 1)
      syncCards(updated)
    },
    [syncCards]
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= pinnedCards.length - 1) return
      const updated = reorderPinnedCards(index, index + 1)
      syncCards(updated)
    },
    [syncCards, pinnedCards.length]
  )

  const isPinned = (type: PinnedCardType) => pinnedCards.some(c => c.type === type)
  const isFull = pinnedCards.length >= MAX_PINNED_CARDS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Current pinned cards (reorderable) ─────────────────────────── */}
      {pinnedCards.length > 0 && (
        <div>
          <p style={labelStyle}>Your pinned cards ({pinnedCards.length}/{MAX_PINNED_CARDS})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <AnimatePresence initial={false}>
              {pinnedCards.map((card, index) => {
                const meta = CARD_META[card.type]
                return (
                  <motion.div
                    key={card.type}
                    layout={!prefersReducedMotion}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={springs.snappy}
                    style={{
                      ...glassSurface,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      gap: 10,
                    }}
                  >
                    {/* Reorder buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        aria-label={`Move ${meta.label} up`}
                        style={reorderBtnStyle(index === 0)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === pinnedCards.length - 1}
                        aria-label={`Move ${meta.label} down`}
                        style={reorderBtnStyle(index === pinnedCards.length - 1)}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Card preview */}
                    <span style={{ fontSize: 16 }} aria-hidden="true">{meta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                        {meta.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--sub)', fontFamily: FONT_FAMILY, opacity: 0.8 }}>
                        {meta.description}
                      </p>
                    </div>

                    {/* Remove button */}
                    <motion.button
                      type="button"
                      onClick={() => handleRemove(card.type)}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                      aria-label={`Unpin ${meta.label}`}
                      style={{
                        background: colorRamp.error[100],
                        border: `1px solid ${colorRamp.error[200]}`,
                        borderRadius: borderRadius.full,
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: 'var(--error)',
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </motion.button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {pinnedCards.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 12px',
            background: fills[3],
            border: `1px solid ${fills[6]}`,
            borderRadius: borderRadius.md,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--sub)', fontFamily: FONT_FAMILY, lineHeight: 1.5 }}>
            Your home screen is clean by default.
            <br />
            Pin up to {MAX_PINNED_CARDS} cards for a quick glance at what matters most.
          </p>
        </div>
      )}

      {/* ── Available cards to pin ─────────────────────────────────────── */}
      <div>
        <p style={labelStyle}>Available cards</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {ALL_CARD_TYPES.map((type) => {
            const meta = CARD_META[type]
            const alreadyPinned = isPinned(type)
            return (
              <div
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  gap: 10,
                  background: alreadyPinned ? fills[4] : 'transparent',
                  border: `1px solid ${alreadyPinned ? fills[8] : fills[6]}`,
                  borderRadius: borderRadius.md,
                  opacity: alreadyPinned ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 16 }} aria-hidden="true">{meta.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: FONT_FAMILY }}>
                    {meta.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--sub)', fontFamily: FONT_FAMILY, opacity: 0.8 }}>
                    {meta.description}
                  </p>
                </div>

                {alreadyPinned ? (
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: FONT_FAMILY, fontWeight: 500 }}>
                    Pinned
                  </span>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => handleAdd(type)}
                    disabled={isFull}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                    aria-label={`Pin ${meta.label}`}
                    style={{
                      background: isFull ? fills[4] : colorRamp.accent[100],
                      border: `1px solid ${isFull ? fills[6] : colorRamp.accent[300]}`,
                      borderRadius: borderRadius.full,
                      padding: '6px 12px',
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      color: isFull ? 'var(--muted)' : 'var(--accent)',
                      fontFamily: FONT_FAMILY,
                      flexShrink: 0,
                    }}
                  >
                    {isFull ? 'Full' : '+ Pin'}
                  </motion.button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Styles
// ============================================================================

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  fontFamily: FONT_FAMILY,
}

function reorderBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 8,
    lineHeight: 1,
    color: disabled ? 'var(--muted)' : 'var(--sub)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 0.8,
  }
}
