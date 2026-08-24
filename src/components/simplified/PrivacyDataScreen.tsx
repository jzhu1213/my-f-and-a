"use client"

/**
 * PrivacyDataScreen â€” Privacy & Data dashboard (Task 191.1)
 *
 * A single, calm surface where a user can:
 *   1. See what data Folio stores about them (categories + counts).
 *   2. Export everything in one tap (reuses the existing full-data export and
 *      the filtered Reports flow from task 185.1 â€” no export logic is
 *      reimplemented here).
 *   3. Delete their account + all data in a GDPR/CCPA-style flow, guarded by an
 *      explicit type-to-confirm step.
 *
 * Lives behind Settings â†’ Privacy & security via progressive disclosure â€”
 * never on the home screen.
 *
 * Guardrails:
 *   â€¢ Warm, shame-free, human copy. Control is framed as a right, not a chore.
 *   â€¢ Soft purple theme; prefers-reduced-motion honored.
 *   â€¢ Accessible: labelled controls, keyboard-operable, live status regions.
 *   â€¢ Deletion is destructive and irreversible â€” clear confirmation required.
 */

import { useMemo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  borderRadius,
  dangerZone,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

/** One row in the "What's stored" summary. */
export interface StoredDataCategory {
  key: string
  emoji: string
  label: string
  count: number
  /** Warm one-liner describing what this category is. */
  note: string
}

export interface PrivacyDataScreenProps {
  /** Signed-in email, shown under the profile category. */
  userEmail?: string
  /** Categories of stored data with counts, built by the caller. */
  categories: StoredDataCategory[]
  onBack: () => void
  /** One-tap full export â€” reuses the existing full-data (JSON) export. */
  onExportAll: () => void
  /** Opens the filtered Reports overlay (task 185.1) for PDF/CSV by filter. */
  onOpenReports?: () => void
  /** Exports all transactions as CSV â€” reuses the existing CSV export. */
  onExportCSV?: () => void
  /**
   * Permanently deletes the account + all data. Resolves when done; the caller
   * handles sign-out / navigation. May throw / reject on failure.
   */
  onDeleteEverything: () => Promise<void> | void
  /** Optional toast surface for success/error feedback. */
  onNotify?: (message: string, kind?: "success" | "error") => void
}

// ============================================================================
// Component
// ============================================================================

export function PrivacyDataScreen({
  userEmail,
  categories,
  onBack,
  onExportAll,
  onOpenReports,
  onExportCSV,
  onDeleteEverything,
  onNotify,
}: PrivacyDataScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const totalItems = useMemo(
    () => categories.reduce((sum, c) => sum + c.count, 0),
    [categories]
  )

  const canDelete = confirmText.trim().toUpperCase() === "DELETE" && !isDeleting

  const handleConfirmDelete = useCallback(async () => {
    if (!canDelete) return
    setIsDeleting(true)
    try {
      await onDeleteEverything()
      // On success the caller signs out / resets â€” no further UI needed here.
    } catch {
      onNotify?.("We couldn't finish deleting just now. Nothing was lost â€” try again in a moment.", "error")
      setIsDeleting(false)
    }
  }, [canDelete, onDeleteEverything, onNotify])

  const containerStyle = {
    maxWidth: CONTENT_MAX_WIDTH,
    margin: "0 auto",
    padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
    fontFamily: FONT_FAMILY,
  } as const

  const primaryButton = (enabled: boolean) =>
    ({
      width: "100%",
      padding: "14px 20px",
      borderRadius: borderRadius.full,
      background: enabled ? "var(--accent-500)" : "var(--accent-300)",
      border: "none",
      color: "var(--text)",
      fontSize: typography.body.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: fontWeights.semibold,
      cursor: enabled ? "pointer" : "not-allowed",
    }) as const

  const secondaryButton = {
    width: "100%",
    padding: "14px 20px",
    borderRadius: borderRadius.full,
    background: "var(--fill-04)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: typography.body.fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: fontWeights.semibold,
    cursor: "pointer",
  } as const

  return (
    <div style={containerStyle}>
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
        â† Back
      </button>

      <h1 style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.bold, color: "var(--text)", marginBottom: 6 }}>
        Privacy &amp; data
      </h1>
      <p style={{ fontSize: typography.body.fontSize, color: "var(--sub)", marginBottom: spacing.lg, lineHeight: 1.5 }}>
        Your money data is yours. Here&apos;s exactly what Folio keeps, how to take a copy,
        and how to erase it all whenever you want.
      </p>

      {/* â”€â”€ Section 1: What's stored â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section aria-labelledby="privacy-stored-heading" style={{ marginBottom: 28 }}>
        <h2
          id="privacy-stored-heading"
          style={{ ...sectionHeader, marginBottom: spacing.sm }}
        >
          What&apos;s stored
        </h2>

        <GlassCard elevation="low" style={{ padding: "6px 20px" }}>
          {/* Profile row (always present) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: spacing.sm,
              padding: "14px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.2 }}>ðŸ‘¤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)" }}>Profile</div>
              <div style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                {userEmail ? `Signed in as ${userEmail}` : "Your account and preferences"}
              </div>
            </div>
          </div>

          {categories.map((cat, idx) => (
            <div
              key={cat.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: spacing.sm,
                padding: "14px 0",
                borderBottom: idx < categories.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.2 }}>
                {cat.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: spacing.xs,
                  }}
                >
                  <span style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)" }}>
                    {cat.label}
                  </span>
                  <span
                    style={{
                      fontSize: typography.body.fontSize,
                      color: "var(--sub)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {cat.count}
                  </span>
                </div>
                <div style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                  {cat.note}
                </div>
              </div>
            </div>
          ))}
        </GlassCard>

        <p
          role="status"
          aria-live="polite"
          style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}
        >
          {totalItems === 0
            ? "Nothing tracked yet â€” this fills in as you use Folio."
            : `${totalItems} ${totalItems === 1 ? "item" : "items"} in total. All of it stays private to your account.`}
        </p>
      </section>

      {/* â”€â”€ Section 2: Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section aria-labelledby="privacy-export-heading" style={{ marginBottom: 28 }}>
        <h2
          id="privacy-export-heading"
          style={{ ...sectionHeader, marginBottom: spacing.sm }}
        >
          Take a copy
        </h2>

        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: spacing.md, lineHeight: 1.5 }}>
            Download everything above as a single file â€” yours to keep, back up, or move
            anywhere.
          </p>

          <motion.button
            onClick={onExportAll}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={springs.snappy}
            style={{ ...primaryButton(true), marginBottom: onOpenReports || onExportCSV ? 12 : 0 }}
            aria-label="Export all of your Folio data as a single file"
          >
            â¬‡ Export everything
          </motion.button>

          {onOpenReports && (
            <motion.button
              onClick={onOpenReports}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={springs.snappy}
              style={{ ...secondaryButton, marginBottom: onExportCSV ? 12 : 0 }}
              aria-label="Open reports to filter and export by tag, merchant, or category"
            >
              ðŸ“„ Filtered reports (PDF)
            </motion.button>
          )}

          {onExportCSV && (
            <motion.button
              onClick={onExportCSV}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={springs.snappy}
              style={secondaryButton}
              aria-label="Export your transactions as a CSV spreadsheet"
            >
              â¬‡ Transactions (CSV)
            </motion.button>
          )}
        </GlassCard>
      </section>

      {/* â”€â”€ Section 3: Delete everything (GDPR / CCPA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section aria-labelledby="privacy-delete-heading">
        <h2
          id="privacy-delete-heading"
          style={{ ...sectionHeader, marginBottom: spacing.sm, color: "var(--error)" }}
        >
          Delete everything
        </h2>

        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          {!showDeleteConfirm ? (
            <>
              <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: spacing.md, lineHeight: 1.5 }}>
                You can erase your account and every record above at any time. This is
                permanent and can&apos;t be undone â€” so grab an export first if you want a copy.
              </p>
              <motion.button
                onClick={() => setShowDeleteConfirm(true)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: borderRadius.full,
                  background: "transparent",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  fontSize: typography.body.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.semibold,
                  cursor: "pointer",
                }}
                aria-label="Start deleting your account and all data"
              >
                Delete my account &amp; data
              </motion.button>
            </>
          ) : (
            <div style={dangerZone}>
              <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--error)", marginBottom: spacing.xs }}>
                âš ï¸ This erases everything
              </p>
              <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--text)", marginBottom: spacing.sm, lineHeight: 1.5 }}>
                We&apos;ll permanently remove your profile, transactions, budgets, goals,
                savings, funding sources, and everything else. There&apos;s no way to get it
                back.
              </p>
              <label
                htmlFor="privacy-delete-confirm"
                style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", display: "block", marginBottom: spacing.xs }}
              >
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                id="privacy-delete-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                disabled={isDeleting}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: spacing.sm,
                  fontSize: typography.body.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: "var(--text)",
                  background: "var(--color-sunken)",
                  border: "1px solid var(--border)",
                  borderRadius: borderRadius.sm,
                  outline: "none",
                }}
                aria-label="Type DELETE to confirm account and data deletion"
              />
              <div style={{ display: "flex", gap: spacing.xs }}>
                <motion.button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setConfirmText("")
                  }}
                  disabled={isDeleting}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
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
                    borderRadius: borderRadius.sm,
                    cursor: isDeleting ? "not-allowed" : "pointer",
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                  aria-label="Cancel deletion and keep my data"
                >
                  Keep my data
                </motion.button>
                <motion.button
                  onClick={handleConfirmDelete}
                  disabled={!canDelete}
                  whileTap={prefersReducedMotion || !canDelete ? undefined : { scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: canDelete ? "var(--text)" : "var(--muted)",
                    background: canDelete ? "var(--error)" : "var(--fill-03)",
                    border: "none",
                    borderRadius: borderRadius.sm,
                    cursor: canDelete ? "pointer" : "not-allowed",
                    opacity: canDelete ? 1 : 0.5,
                  }}
                  aria-label="Permanently delete my account and all data"
                >
                  {isDeleting ? "Deletingâ€¦" : "Delete forever"}
                </motion.button>
              </div>
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
