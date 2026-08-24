"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { triggerHaptic } from "@/lib/haptics"
import { uploadReceipt, deleteReceipt, getReceiptUrl } from "@/lib/receiptStorage"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

interface ReceiptAttachmentProps {
  /** Transaction ID for storage key */
  transactionId: string
  /** Current receipt URL (from transaction or localStorage) */
  receiptUrl?: string | null
  /** Called when receipt URL changes (upload or remove) */
  onChange?: (url: string | null) => void
  /** Compact mode for inline editor */
  compact?: boolean
}

/**
 * ReceiptAttachment — optional photo attachment for transactions.
 *
 * Features:
 * - Camera/file picker button
 * - Thumbnail preview when attached
 * - Tap thumbnail for lightbox view
 * - Remove button
 * - Offline-friendly (shows local preview, queues upload)
 *
 * Task 130.2
 */
export function ReceiptAttachment({
  transactionId,
  receiptUrl: initialUrl,
  onChange,
  compact = false,
}: ReceiptAttachmentProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(
    initialUrl ?? getReceiptUrl(transactionId)
  )
  const [isUploading, setIsUploading] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  // Escape key dismissal for lightbox
  useEffect(() => {
    if (!showLightbox) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setShowLightbox(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showLightbox])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Only accept images
    if (!file.type.startsWith("image/")) return

    setIsUploading(true)
    triggerHaptic("light")

    const url = await uploadReceipt(transactionId, file)
    if (url) {
      setReceiptUrl(url)
      onChange?.(url)
    }

    setIsUploading(false)
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [transactionId, onChange])

  const handleRemove = useCallback(async () => {
    triggerHaptic("light")
    await deleteReceipt(transactionId)
    setReceiptUrl(null)
    onChange?.(null)
  }, [transactionId, onChange])

  // Hidden file input
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handleFileSelect}
      style={{ display: "none" }}
      aria-hidden="true"
    />
  )

  // No receipt attached — show add button
  if (!receiptUrl) {
    return (
      <div style={{ textAlign: compact ? "left" : "center" }}>
        {fileInput}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Attach receipt photo"
          style={{
            background: "transparent",
            border: "1px dashed var(--fill-15)",
            borderRadius: radius.control,
            padding: compact ? "6px 12px" : "8px 14px",
            fontSize: typography['body-sm'].fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.regular,
            color: "var(--sub)",
            cursor: isUploading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            opacity: isUploading ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">📷</span>
          {isUploading ? "Uploading..." : "Add receipt"}
        </button>
      </div>
    )
  }

  // Receipt attached — show thumbnail
  return (
    <div style={{ textAlign: compact ? "left" : "center" }}>
      {fileInput}

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing.sm,
          padding: "8px 12px",
          background: "var(--fill-04)",
          border: "1px solid var(--fill-10)",
          borderRadius: radius.control,
        }}
      >
        {/* Thumbnail */}
        <button
          type="button"
          onClick={() => setShowLightbox(true)}
          aria-label="View receipt photo"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.min,
            overflow: "hidden",
            border: "1px solid var(--fill-10)",
            cursor: "pointer",
            padding: 0,
            background: "transparent",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt="Receipt"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </button>

        <span
          style={{
            fontSize: typography['body-sm'].fontSize,
            fontFamily: FONT_FAMILY,
            color: "var(--sub)",
          }}
        >
          Receipt attached
        </span>

        {/* Remove button */}
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove receipt"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: typography.body.fontSize,
            color: "var(--muted)",
            padding: "4px",
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div
            key="receipt-lightbox"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.snappy}
            onClick={() => setShowLightbox(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "var(--color-canvas)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: spacing.lg,
              cursor: "pointer",
            }}
            role="dialog"
            aria-label="Receipt photo full view"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt="Receipt full view"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: radius.control,
              }}
            />
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              aria-label="Close receipt view"
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "var(--fill-10)",
                border: "none",
                borderRadius: "50%",
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: typography.subhead.fontSize,
                color: "var(--text)",
              }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
