"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import type { LinkedAccount, LinkedAccountStatus } from "@/types/folio"
import { startAccountLink, linkedAccountKindLabel } from "@/lib/linkedAccounts"

// ============================================================================
// Types
// ============================================================================

export interface LinkedAccountsScreenProps {
  /** Optional list of linked accounts. Defaults to none — linking is opt-in. */
  linkedAccounts?: LinkedAccount[]
  onBack?: () => void
}

// ============================================================================
// Status display metadata (warm, shame-free)
// ============================================================================

const STATUS_DISPLAY: Record<
  LinkedAccountStatus,
  { label: string; color: string; bg: string }
> = {
  connected: {
    label: "Connected",
    color: "var(--success)",
    bg: "rgba(6, 214, 160, 0.1)",
  },
  disconnected: {
    label: "Paused",
    color: "var(--sub)",
    bg: "rgba(255, 255, 255, 0.06)",
  },
  error: {
    label: "Needs attention",
    color: "var(--warning)",
    bg: "rgba(245, 158, 11, 0.1)",
  },
}

// ============================================================================
// LinkedAccountsScreen Component
// ============================================================================

/**
 * LinkedAccountsScreen — OPTIONAL bank/card linking (e.g. Plaid).
 *
 * Reachable from Settings → More & Tools (progressive disclosure), never from
 * Home. Linking is 100% optional: Folio works fully with zero linked accounts,
 * and this screen is careful to say so warmly.
 *
 * The "Link an account" CTA calls the stubbed `startAccountLink()` helper. Since
 * a live Plaid integration needs server credentials that aren't configured for
 * the client, it shows a friendly "coming soon / not required" message instead
 * of ever erroring. No network calls are made.
 *
 * Task 107.1 (Group 14 — Adapt from Rocket Money).
 */
export function LinkedAccountsScreen({
  linkedAccounts = [],
  onBack,
}: LinkedAccountsScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  async function handleStartLink() {
    setIsChecking(true)
    try {
      // Always returns a graceful result — never throws, never hits the network.
      const result = await startAccountLink()
      setLinkMessage(result.message)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Go back"
            style={{
              background: "none",
              border: "none",
              padding: 4,
              fontSize: 18,
              color: "var(--sub)",
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
              lineHeight: 1,
            }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Linked Accounts
          </h2>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.4 }}>
            Optional — Folio works great without linking a thing
          </p>
        </div>
      </div>

      {/* ── Reassurance banner ───────────────────────────────────────── */}
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(167, 139, 250, 0.08)",
          border: "1px solid rgba(167, 139, 250, 0.15)",
          marginBottom: 20,
        }}
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--sub)",
            lineHeight: 1.5,
            fontFamily: FONT_FAMILY,
          }}
        >
          Linking a bank or card is a totally optional convenience. Nothing here
          is required — you can keep logging by hand for as long as you like. 💜
        </p>
      </div>

      {/* ── Account list / empty state ───────────────────────────────── */}
      {linkedAccounts.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "40px 20px",
          }}
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">
            🔗
          </span>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--text)",
              textAlign: "center",
              fontFamily: FONT_FAMILY,
            }}
          >
            No linked accounts
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--sub)",
              textAlign: "center",
              fontFamily: FONT_FAMILY,
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            Linking is 100% optional. If you ever want balances to update
            automatically, you can connect an account here — but it&apos;s never
            required.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {linkedAccounts.map((account) => {
            const status = STATUS_DISPLAY[account.status]
            return (
              <motion.div
                key={account.id}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={springs.snappy}
              >
                <GlassCard elevation="low" style={{ padding: "14px 16px" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    {/* Icon */}
                    <span
                      style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      {account.kind === "bank" ? "🏦" : "💳"}
                    </span>

                    {/* Name + badges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--text)",
                          marginBottom: 4,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {account.institutionName}
                        {account.mask ? ` ••${account.mask}` : ""}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Kind badge */}
                        <span
                          aria-label={`Type: ${linkedAccountKindLabel(account.kind)}`}
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            color: "var(--sub)",
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {linkedAccountKindLabel(account.kind)}
                        </span>

                        {/* Status badge */}
                        <span
                          aria-label={`Status: ${status.label}`}
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: status.bg,
                            color: status.color,
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Link CTA ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
        <motion.button
          onClick={handleStartLink}
          disabled={isChecking}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={springs.snappy}
          aria-label="Link an account"
          style={{
            padding: "12px 24px",
            borderRadius: 9999,
            border: "1.5px solid rgba(167, 139, 250, 0.4)",
            background: "transparent",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            cursor: isChecking ? "default" : "pointer",
            opacity: isChecking ? 0.6 : 1,
          }}
        >
          {isChecking ? "One sec…" : "🔗 Link an account"}
        </motion.button>
      </div>

      {/* ── Friendly result message (never an error) ─────────────────── */}
      {linkMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "var(--sub)",
              lineHeight: 1.5,
              textAlign: "center",
              fontFamily: FONT_FAMILY,
            }}
          >
            {linkMessage}
          </p>
        </div>
      )}
    </div>
  )
}
