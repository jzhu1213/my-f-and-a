"use client"

/**
 * SharingScreen
 *
 * Full-screen overlay that allows users to generate and manage read-only
 * share links for their spending summary. Follows the established overlay
 * pattern (GlassCard + Inter + warm palette).
 *
 * The shared view shows only high-level stats: daily allowance status,
 * weekly spending total, and budget category breakdown — never individual
 * transactions.
 *
 * Task 115.1 — Optional read-only sharing
 */

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  linkButton,
  borderRadius,
} from "@/styles/shared"
import {
  getShareLinks,
  createShareLink,
  revokeShareLink,
  getShareUrl,
  refreshAllSharedSummaries,
  type ShareLink,
} from "@/lib/sharingUtils"
import type { Transaction, Budget } from "@/types"
import type { DailyAllowance } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface SharingScreenProps {
  userId: string
  transactions: Transaction[]
  budgets: Budget[]
  allowance: DailyAllowance | null
  onBack: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SharingScreen({
  userId,
  transactions,
  budgets,
  allowance,
  onBack,
}: SharingScreenProps) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Load links on mount and refresh shared data
  useEffect(() => {
    setLinks(getShareLinks())
    refreshAllSharedSummaries(userId, transactions, budgets, allowance)
  }, [userId, transactions, budgets, allowance])

  const activeLinks = links.filter(l => l.isActive)

  const handleCreate = useCallback(() => {
    if (!newLabel.trim()) return
    const link = createShareLink(userId, newLabel.trim())
    // Store the summary for this new link
    refreshAllSharedSummaries(userId, transactions, budgets, allowance)
    setLinks(getShareLinks())
    setNewLabel("")
    setShowForm(false)
    // Auto-copy the new link
    const url = getShareUrl(link.token)
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedToken(link.token)
    setTimeout(() => setCopiedToken(null), 2000)
  }, [newLabel, userId, transactions, budgets, allowance])

  const handleRevoke = useCallback((id: string) => {
    revokeShareLink(id)
    setLinks(getShareLinks())
  }, [])

  const handleCopy = useCallback((token: string) => {
    const url = getShareUrl(token)
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }, [])

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 16,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {/* Title */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        Sharing
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--sub)",
          marginBottom: 24,
          lineHeight: 1.5,
        }}
      >
        Share a snapshot with someone you trust — they&apos;ll see how you&apos;re
        doing overall, not every purchase.
      </p>

      {/* Info card */}
      <GlassCard elevation="low" style={{ padding: "16px 18px", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
          <span style={{ fontSize: 15 }} aria-hidden="true">🔒</span>{" "}
          <strong style={{ color: "var(--text)", fontWeight: 500 }}>What they can see:</strong>{" "}
          daily budget status, weekly spending total, and budget category progress. 
          They won&apos;t see individual purchases or amounts.
        </p>
      </GlassCard>

      {/* Active share links */}
      {activeLinks.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>Active links</p>
          {activeLinks.map((link, idx) => (
            <div
              key={link.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom:
                  idx < activeLinks.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text)",
                    marginBottom: 2,
                  }}
                >
                  {link.label}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  Created {new Date(link.createdAt).toLocaleDateString()}
                  {link.lastViewedAt && (
                    <> · Last viewed {new Date(link.lastViewedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {/* Copy button */}
                <motion.button
                  onClick={() => handleCopy(link.token)}
                  whileTap={{ scale: 0.92 }}
                  transition={springs.snappy}
                  style={{
                    padding: "6px 12px",
                    borderRadius: borderRadius.full,
                    background: copiedToken === link.token
                      ? "rgba(6, 214, 160, 0.15)"
                      : "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: copiedToken === link.token
                      ? "var(--success)"
                      : "var(--sub)",
                    fontSize: 12,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  aria-label={`Copy link for ${link.label}`}
                >
                  {copiedToken === link.token ? "Copied!" : "Copy"}
                </motion.button>

                {/* Revoke button */}
                <motion.button
                  onClick={() => handleRevoke(link.id)}
                  whileTap={{ scale: 0.92 }}
                  transition={springs.snappy}
                  style={{
                    padding: "6px 12px",
                    borderRadius: borderRadius.full,
                    background: "rgba(248, 113, 113, 0.08)",
                    border: "1px solid rgba(248, 113, 113, 0.2)",
                    color: "var(--error)",
                    fontSize: 12,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  aria-label={`Revoke link for ${link.label}`}
                >
                  Revoke
                </motion.button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {/* Create new link */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong }}>
          {activeLinks.length > 0 ? "Share with someone else" : "Create a share link"}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--sub)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          {activeLinks.length === 0
            ? "Share a glance at how you're doing with a parent or trusted person."
            : "Each person gets their own link you can revoke anytime."}
        </p>

        {showForm ? (
          <div>
            <label
              htmlFor="share-label-input"
              style={{
                fontSize: 12,
                color: "var(--sub)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Who is this for?
            </label>
            <input
              id="share-label-input"
              type="text"
              placeholder='e.g. "Mom", "Dad", "Advisor"'
              value={newLabel}
              onChange={e => setNewLabel(e.target.value.slice(0, 30))}
              maxLength={30}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && newLabel.trim()) handleCreate()
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
                outline: "none",
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                padding: "8px 0",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <motion.button
                onClick={handleCreate}
                disabled={!newLabel.trim()}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  padding: "10px 20px",
                  borderRadius: borderRadius.full,
                  background: newLabel.trim()
                    ? "rgba(129, 140, 248, 0.8)"
                    : "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: newLabel.trim() ? "#fff" : "var(--muted)",
                  fontSize: 13,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 600,
                  cursor: newLabel.trim() ? "pointer" : "not-allowed",
                }}
              >
                Generate link
              </motion.button>
              <button
                onClick={() => {
                  setShowForm(false)
                  setNewLabel("")
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: borderRadius.full,
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: 13,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <motion.button
            onClick={() => setShowForm(true)}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Create a new share link"
          >
            + New share link →
          </motion.button>
        )}
      </GlassCard>

      {/* Revoked links (collapsed info) */}
      {links.filter(l => !l.isActive).length > 0 && (
        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          {links.filter(l => !l.isActive).length} revoked{" "}
          {links.filter(l => !l.isActive).length === 1 ? "link" : "links"} — no
          longer accessible
        </p>
      )}
    </div>
  )
}
