"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { triggerHaptic } from "@/lib/haptics"
import { uploadReceipt, deleteReceipt, getReceiptUrl } from "@/lib/receiptStorage"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"

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
            border: "1px dashed rgba(255, 255, 255, 0.15)",
            borderRadius: borderRadius.md,
            padding: compact ? "6px 12px" : "8px 14px",
            fontSize: 13,
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            color: "var(--sub)",
            cursor: isUploading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            opacity: isUploading ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden="true">📷</span>
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
          gap: 10,
          padding: "8px 12px",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: borderRadius.md,
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
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.1)",
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
            fontSize: 12,
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
            fontSize: 14,
            color: "var(--muted)",
            padding: "4px",
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
              background: "rgba(0, 0, 0, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
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
                borderRadius: 8,
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
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 18,
                color: "#fff",
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
