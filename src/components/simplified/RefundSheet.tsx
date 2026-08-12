"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sheet } from '@/components/ui/primitives/Sheet'
import { useToast } from '@/contexts/ToastContext'
import type { Transaction } from '@/types'
import { getCategoryEmoji } from '@/lib/vocabulary'
import { FONT_FAMILY } from '@/styles/typography'

interface RefundSheetProps {
  isOpen: boolean
  onClose: () => void
  /** The original transaction being refunded */
  transaction: Transaction | null
  /** Called with the refund amount to log */
  onLogRefund: (originalTransaction: Transaction, refundAmount: number) => void
}

const MAX_AMOUNT = 99999

/**
 * RefundSheet — bottom sheet for logging a refund against an existing expense.
 *
 * Shows the original transaction details, allows partial or full refund via
 * amount input (defaults to full), and logs a refund transaction.
 *
 * **Validates: Requirements 10.1, 10.5**
 */
export function RefundSheet({ isOpen, onClose, transaction, onLogRefund }: RefundSheetProps) {
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')

  // Reset and pre-fill when opening
  useEffect(() => {
    if (isOpen && transaction) {
      setAmount(
        transaction.amount % 1 === 0
          ? String(transaction.amount)
          : transaction.amount.toFixed(2)
      )
      setTimeout(() => amountRef.current?.focus(), 120)
    }
  }, [isOpen, transaction])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    const numeric = parseFloat(raw)
    if (numeric > MAX_AMOUNT) return
    setAmount(raw)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!transaction) return
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || parsed > transaction.amount) return

    onLogRefund(transaction, parsed)

    const formatted = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`
    showToast(`Refund of ${formatted} logged ✓`, 'success')
    onClose()
  }, [amount, transaction, onLogRefund, onClose, showToast])

  const canSubmit = (() => {
    if (!transaction) return false
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= transaction.amount
  })()

  return (
    <Sheet open={isOpen && !!transaction} onClose={onClose} size="half" aria-label="Log a refund">
      {transaction && (
        <div style={{ padding: '0 24px 32px' }}>
          {/* ── Header ────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <p style={{
              fontSize: 15,
              fontFamily: FONT_FAMILY,
              fontWeight: 600,
              color: 'var(--text)',
            }}>
              Log a refund
            </p>
          </div>

          {/* ── Original Transaction Card ─────────────────── */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 24 }} aria-hidden="true">
              {getCategoryEmoji(transaction.category)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13,
                fontFamily: FONT_FAMILY,
                color: 'var(--sub)',
                marginBottom: 2,
              }}>
                Original expense
              </p>
              <p style={{
                fontSize: 16,
                fontFamily: FONT_FAMILY,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text)',
              }}>
                ${transaction.amount % 1 === 0 ? transaction.amount : transaction.amount.toFixed(2)}
                {transaction.note && (
                  <span style={{ fontWeight: 400, color: 'var(--sub)', fontSize: 13, marginLeft: 8 }}>
                    {transaction.note}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* ── Refund Amount Input ───────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <p style={{
              fontSize: 13,
              color: 'var(--muted)',
              marginBottom: 12,
              fontFamily: FONT_FAMILY,
            }}>
              Refund amount
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 4,
            }}>
              <span style={{
                fontSize: 28,
                fontFamily: FONT_FAMILY,
                fontWeight: 300,
                color: 'var(--success)',
              }}>
                $
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                aria-label="Refund amount"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 48,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text)',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: 240,
                  caretColor: 'var(--text)',
                  lineHeight: 1.1,
                }}
              />
            </div>
            {parseFloat(amount) > transaction.amount && (
              <p style={{
                fontSize: 12,
                color: 'var(--error)',
                marginTop: 8,
                fontFamily: FONT_FAMILY,
              }}>
                Can&rsquo;t exceed original (${transaction.amount % 1 === 0 ? transaction.amount : transaction.amount.toFixed(2)})
              </p>
            )}
          </div>

          {/* ── Log Refund Button ─────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Log refund"
            style={{
              width: '100%',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: canSubmit
                ? 'var(--gradient-action)'
                : 'var(--dim)',
              color: canSubmit ? 'var(--color-canvas)' : 'var(--muted)',
              fontFamily: FONT_FAMILY,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            Log Refund
          </button>
        </div>
      )}
    </Sheet>
  )
}
