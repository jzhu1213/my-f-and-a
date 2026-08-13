"use client"

// ============================================================================
// ShareMilestoneSheet — "Share your win?" bottom sheet (Task 363.2)
// ============================================================================
//
// Appears when a milestone is hit (goal completed, 30-day streak, wish list
// item achieved). Shows a preview of the shareable card, offers native share
// or download fallback, and a "Maybe later" dismiss button.
//
// This component is lazy-loaded (code-split) so it doesn't add to the initial
// bundle. It renders the milestone card to a canvas preview and uses
// navigator.share with File support where available.
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"
import {
  renderMilestoneCardImage,
  type MilestoneCardData,
} from "@/lib/milestoneCardImage"

// ============================================================================
// Types
// ============================================================================

export interface ShareMilestoneSheetProps {
  /** Whether the sheet is visible. */
  open: boolean
  /** The milestone data to render. */
  milestone: MilestoneCardData
  /** Called when the sheet is dismissed. */
  onDismiss: () => void
}

type ShareState = "idle" | "rendering" | "ready" | "sharing" | "shared" | "downloaded" | "error"

// ============================================================================
// Component
// ============================================================================

export function ShareMilestoneSheet({ open, milestone, onDismiss }: ShareMilestoneSheetProps) {
  const [state, setState] = useState<ShareState>("idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  // Render the card image when opened
  useEffect(() => {
    if (!open) {
      setState("idle")
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      blobRef.current = null
      return
    }

    let cancelled = false
    setState("rendering")

    renderMilestoneCardImage(milestone)
      .then(blob => {
        if (cancelled) return
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setState("ready")
      })
      .catch(() => {
        if (!cancelled) setState("error")
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone.type, milestone.title])

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShare = useCallback(async () => {
    if (!blobRef.current) return

    setState("sharing")
    try {
      const fileName = `folio-milestone-${milestone.type}.png`
      const file = new File([blobRef.current], fileName, { type: "image/png" })

      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean
      }

      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `Folio — ${milestone.title}`,
        })
        setState("shared")
        return
      }

      // Fallback: download the image
      const url = URL.createObjectURL(blobRef.current)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setState("downloaded")
    } catch {
      setState("error")
    }
  }, [milestone.type, milestone.title])

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="milestone-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.6)",
              zIndex: 1000,
            }}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="milestone-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Share your milestone"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1001,
              background: "#1a1a2e",
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
              padding: "24px 20px 40px",
              maxHeight: "80vh",
              overflow: "auto",
              fontFamily: FONT_FAMILY,
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "rgba(255, 255, 255, 0.2)",
                margin: "0 auto 20px",
              }}
            />

            {/* Title */}
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text, #fff)",
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              Share your win? 🎉
            </h2>

            <p
              style={{
                fontSize: 14,
                color: "var(--sub, rgba(255,255,255,0.6))",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Let the world know about your progress
            </p>

            {/* Preview */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              {state === "rendering" && (
                <div
                  style={{
                    width: 240,
                    height: 240,
                    borderRadius: borderRadius.md,
                    background: "rgba(255, 255, 255, 0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--sub, rgba(255,255,255,0.5))",
                    fontSize: 14,
                  }}
                >
                  Creating your card…
                </div>
              )}
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Your milestone share card preview"
                  style={{
                    width: 240,
                    height: 240,
                    borderRadius: borderRadius.md,
                    objectFit: "cover",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleShare}
                disabled={state === "rendering" || state === "sharing"}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 9999,
                  border: "none",
                  background: "linear-gradient(135deg, #818cf8, #a78bfa)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  cursor: state === "rendering" || state === "sharing" ? "not-allowed" : "pointer",
                  opacity: state === "rendering" || state === "sharing" ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {state === "sharing" ? "Sharing…" : state === "shared" ? "Shared ✓" : state === "downloaded" ? "Downloaded ✓" : "Share"}
              </button>

              <button
                onClick={onDismiss}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 9999,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "transparent",
                  color: "var(--sub, rgba(255,255,255,0.6))",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                }}
              >
                Maybe later
              </button>
            </div>

            {state === "error" && (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--error, #f87171)",
                  textAlign: "center",
                  marginTop: 12,
                }}
              >
                Something went wrong. Try again?
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
