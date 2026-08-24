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
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  linkButton,
  borderRadius,
} from "@/styles/shared"
import {
  getShareLinks,
  createShareLink,
  revokeShareLink,
  getShareUrl,
  refreshAllSharedSummaries,
  describeExpiry,
  getShareLinkStatus,
  EXPIRY_OPTIONS,
  ALL_SHARE_SECTIONS,
  type ShareLink,
  type ShareSection,
} from "@/lib/sharingUtils"
import type { Transaction, Budget } from "@/types"
import type { DailyAllowance } from "@/types/folio"

// ============================================================================
// Section metadata (warm labels for scope toggles)
// ============================================================================

const SECTION_META: Record<ShareSection, { label: string; hint: string }> = {
  status: { label: "Daily budget status", hint: "How you're doing today" },
  weekSpending: { label: "Weekly spending total", hint: "One number for the week" },
  categories: { label: "Category progress", hint: "Percent used per category" },
}

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
  // Expiry preset (days | null) and which sections the recipient can see.
  const [expiryDays, setExpiryDays] = useState<number | null>(30)
  const [scopeSections, setScopeSections] = useState<ShareSection[]>([...ALL_SHARE_SECTIONS])

  // Load links on mount and refresh shared data
  useEffect(() => {
    async function loadAndRefresh() {
      const fetched = await getShareLinks()
      setLinks(fetched)
      await refreshAllSharedSummaries(userId, transactions, budgets, allowance)
    }
    loadAndRefresh()
  }, [userId, transactions, budgets, allowance])

  // A link is shown as "active" only when it's active AND not expired.
  const activeLinks = links.filter(l => getShareLinkStatus(l) === "active")
  const expiredLinks = links.filter(l => getShareLinkStatus(l) === "expired")

  const toggleSection = useCallback((section: ShareSection) => {
    setScopeSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...ALL_SHARE_SECTIONS].filter(s => s === section || prev.includes(s))
    )
  }, [])

  const resetForm = useCallback(() => {
    setShowForm(false)
    setNewLabel("")
    setExpiryDays(30)
    setScopeSections([...ALL_SHARE_SECTIONS])
  }, [])

  const handleCreate = useCallback(() => {
    if (!newLabel.trim() || scopeSections.length === 0) return
    async function doCreate() {
      const link = await createShareLink(userId, newLabel.trim(), {
        expiresInDays: expiryDays,
        scope: { access: "read-only", sections: scopeSections },
      })
      // Store the summary for this new link
      await refreshAllSharedSummaries(userId, transactions, budgets, allowance)
      const fetched = await getShareLinks()
      setLinks(fetched)
      resetForm()
      // Auto-copy the new link
      const url = getShareUrl(link.token)
      navigator.clipboard?.writeText(url).catch(() => {})
      setCopiedToken(link.token)
      setTimeout(() => setCopiedToken(null), 2000)
    }
    doCreate()
  }, [newLabel, scopeSections, expiryDays, userId, transactions, budgets, allowance, resetForm])

  const handleRevoke = useCallback((id: string) => {
    async function doRevoke() {
      await revokeShareLink(id)
      const fetched = await getShareLinks()
      setLinks(fetched)
    }
    doRevoke()
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
          fontSize: typography.body.fontSize,
          cursor: "pointer",
          marginBottom: spacing.md,
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
          fontSize: typography.headline.fontSize,
          fontWeight: fontWeights.bold,
          color: "var(--text)",
          marginBottom: spacing.xs,
        }}
      >
        Sharing
      </h2>
      <p
        style={{
          fontSize: typography.body.fontSize,
          color: "var(--sub)",
          marginBottom: spacing.lg,
          lineHeight: 1.5,
        }}
      >
        Share a snapshot with someone you trust — they&apos;ll see how you&apos;re
        doing overall, not every purchase.
      </p>

      {/* Info card */}
      <GlassCard elevation="low" style={{ padding: "16px 18px", marginBottom: HORIZONTAL_PADDING }}>
        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.6 }}>
          <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">🔒</span>{" "}
          <strong style={{ color: "var(--text)", fontWeight: fontWeights.medium }}>You&apos;re in control:</strong>{" "}
          links are read-only, you pick exactly what they show, they expire on
          your schedule, and you can revoke any of them anytime. No individual
          purchases or amounts are ever shared.
        </p>
      </GlassCard>

      {/* Active share links */}
      {activeLinks.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
          <p style={{ ...sectionHeader }}>Active links</p>
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
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.medium,
                    color: "var(--text)",
                    marginBottom: 2,
                  }}
                >
                  {link.label}
                </p>
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    color: "var(--muted)",
                  }}
                >
                  {describeExpiry(link)}
                  {link.lastViewedAt && (
                    <> · Last viewed {new Date(link.lastViewedAt).toLocaleDateString()}</>
                  )}
                </p>
                <p
                  style={{
                    fontSize: typography.caption.fontSize,
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  Shows:{" "}
                  {(link.scope?.sections ?? ALL_SHARE_SECTIONS)
                    .map(s => SECTION_META[s].label)
                    .join(", ")}
                </p>
              </div>

              <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
                {/* Copy button */}
                <motion.button
                  onClick={() => handleCopy(link.token)}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  style={{
                    padding: "6px 12px",
                    borderRadius: borderRadius.full,
                    background: copiedToken === link.token
                      ? "var(--success-200)"
                      : "var(--fill-06)",
                    border: "1px solid var(--fill-10)",
                    color: copiedToken === link.token
                      ? "var(--success)"
                      : "var(--sub)",
                    fontSize: typography['body-sm'].fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.medium,
                    cursor: "pointer",
                  }}
                  aria-label={`Copy link for ${link.label}`}
                >
                  {copiedToken === link.token ? "Copied!" : "Copy"}
                </motion.button>

                {/* Revoke button */}
                <motion.button
                  onClick={() => handleRevoke(link.id)}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  style={{
                    padding: "6px 12px",
                    borderRadius: borderRadius.full,
                    background: "var(--error-100)",
                    border: "1px solid var(--error-200)",
                    color: "var(--error)",
                    fontSize: typography['body-sm'].fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.medium,
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
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
        <p style={{ ...sectionHeader }}>
          {activeLinks.length > 0 ? "Share with someone else" : "Create a share link"}
        </p>
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
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
                fontSize: typography['body-sm'].fontSize,
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
                borderBottom: "1px solid var(--fill-15)",
                outline: "none",
                fontSize: typography.body.fontSize,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                padding: "8px 0",
                marginBottom: 18,
              }}
            />

            {/* Expiry selector */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 18px" }}>
              <legend
                style={{
                  fontSize: typography['body-sm'].fontSize,
                  color: "var(--sub)",
                  marginBottom: spacing.xs,
                  padding: 0,
                }}
              >
                When should it expire?
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
                {EXPIRY_OPTIONS.map(opt => {
                  const selected = expiryDays === opt.days
                  return (
                    <motion.button
                      key={opt.label}
                      type="button"
                      onClick={() => setExpiryDays(opt.days)}
                      whileTap={{ scale: 0.95 }}
                      transition={springs.snappy}
                      aria-pressed={selected}
                      style={{
                        padding: "7px 14px",
                        borderRadius: borderRadius.full,
                        background: selected
                          ? "var(--accent-500)"
                          : "var(--fill-06)",
                        border: selected
                          ? "1px solid var(--accent-500)"
                          : "1px solid var(--fill-10)",
                        color: selected ? "var(--text)" : "var(--sub)",
                        fontSize: typography['body-sm'].fontSize,
                        fontFamily: FONT_FAMILY,
                        fontWeight: fontWeights.medium,
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </motion.button>
                  )
                })}
              </div>
            </fieldset>

            {/* Scope selector */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 18px" }}>
              <legend
                style={{
                  fontSize: typography['body-sm'].fontSize,
                  color: "var(--sub)",
                  marginBottom: spacing.xs,
                  padding: 0,
                }}
              >
                What can they see?
              </legend>
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                {ALL_SHARE_SECTIONS.map(section => {
                  const checked = scopeSections.includes(section)
                  const meta = SECTION_META[section]
                  return (
                    <label
                      key={section}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: spacing.sm,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSection(section)}
                        style={{
                          marginTop: 2,
                          accentColor: "var(--accent-500)",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>
                        <span
                          style={{
                            fontSize: typography['body-sm'].fontSize,
                            color: "var(--text)",
                            fontFamily: FONT_FAMILY,
                            display: "block",
                          }}
                        >
                          {meta.label}
                        </span>
                        <span
                          style={{
                            fontSize: typography.caption.fontSize,
                            color: "var(--muted)",
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {meta.hint}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {scopeSections.length === 0 && (
                <p
                  style={{
                    fontSize: typography.caption.fontSize,
                    color: "var(--error)",
                    marginTop: spacing.xs,
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  Pick at least one thing to share.
                </p>
              )}
            </fieldset>

            <div style={{ display: "flex", gap: spacing.xs }}>
              <motion.button
                onClick={handleCreate}
                disabled={!newLabel.trim() || scopeSections.length === 0}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  padding: "10px 20px",
                  borderRadius: borderRadius.full,
                  background: newLabel.trim() && scopeSections.length > 0
                    ? "var(--accent-500)"
                    : "var(--fill-08)",
                  border: "none",
                  color: newLabel.trim() && scopeSections.length > 0 ? "var(--text)" : "var(--muted)",
                  fontSize: typography['body-sm'].fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.semibold,
                  cursor: newLabel.trim() && scopeSections.length > 0 ? "pointer" : "not-allowed",
                }}
              >
                Generate link
              </motion.button>
              <button
                onClick={resetForm}
                style={{
                  padding: "10px 14px",
                  borderRadius: borderRadius.full,
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: typography['body-sm'].fontSize,
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

      {/* Expired links (collapsed info) */}
      {expiredLinks.length > 0 && (
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: spacing.xs,
          }}
        >
          {expiredLinks.length} expired{" "}
          {expiredLinks.length === 1 ? "link" : "links"} — no longer accessible
        </p>
      )}

      {/* Revoked links (collapsed info) */}
      {links.filter(l => !l.isActive).length > 0 && (
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: spacing.xs,
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
