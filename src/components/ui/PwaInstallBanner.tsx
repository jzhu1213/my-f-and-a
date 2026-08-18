/**
 * PwaInstallBanner — a warm, unobtrusive banner prompting users to install Folio.
 * Only shown after the user is engaged (3+ sessions or onboarding complete).
 *
 * Requirements: 28.7 — Service worker & PWA optimization
 * Task 477.1 — Install prompt timing
 */

"use client"

import { motion, AnimatePresence } from "framer-motion"
import { FONT_FAMILY } from "@/styles/typography"

interface PwaInstallBannerProps {
  visible: boolean
  onInstall: () => void
  onDismiss: () => void
}

export function PwaInstallBanner({ visible, onInstall, onDismiss }: PwaInstallBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={styles.container}
          role="banner"
          aria-label="Install Folio app"
        >
          <div style={styles.content}>
            <div style={styles.iconWrapper}>
              <img
                src="/icon-192.png"
                alt=""
                width={36}
                height={36}
                style={styles.icon}
              />
            </div>
            <div style={styles.text}>
              <p style={styles.title}>Add Folio to your home screen</p>
              <p style={styles.subtitle}>Quick access, works offline</p>
            </div>
          </div>
          <div style={styles.actions}>
            <button
              onClick={onInstall}
              style={styles.installButton}
              aria-label="Install Folio"
            >
              Install
            </button>
            <button
              onClick={onDismiss}
              style={styles.dismissButton}
              aria-label="Dismiss install prompt"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 1100,
    background: "linear-gradient(135deg, #2a1f4e 0%, #1a1a2e 100%)",
    borderRadius: 16,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontFamily: FONT_FAMILY,
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    borderRadius: 8,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "#f0eef6",
    lineHeight: 1.3,
  },
  subtitle: {
    margin: "2px 0 0",
    fontSize: "0.8125rem",
    color: "rgba(240,238,246,0.6)",
    lineHeight: 1.3,
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  },
  installButton: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: "#7c5cbf",
    color: "#fff",
    fontSize: "0.8125rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: FONT_FAMILY,
  },
  dismissButton: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "rgba(240,238,246,0.5)",
    fontSize: "0.8125rem",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: FONT_FAMILY,
  },
}
