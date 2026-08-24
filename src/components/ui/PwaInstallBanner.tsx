/**
 * PwaInstallBanner — a warm, unobtrusive banner prompting users to install Folio.
 * Only shown after the user is engaged (3+ sessions or onboarding complete).
 *
 * Requirements: 28.7 — Service worker & PWA optimization
 * Task 477.1 — Install prompt timing
 */

"use client"

import { motion, AnimatePresence } from "framer-motion"
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

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
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            zIndex: 1100,
          }}
          role="banner"
          aria-label="Install Folio app"
        >
          <GlassCard
            elevation="high"
            style={{
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
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
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const styles: Record<string, React.CSSProperties> = {
  content: {
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    background: "var(--fill-06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    borderRadius: radius.control,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.semibold,
    color: "var(--text)",
    lineHeight: 1.3,
  },
  subtitle: {
    margin: "2px 0 0",
    fontSize: typography['body-sm'].fontSize,
    color: "var(--sub)",
    lineHeight: 1.3,
  },
  actions: {
    display: "flex",
    gap: spacing.xs,
    justifyContent: "flex-end",
  },
  installButton: {
    padding: "8px 20px",
    borderRadius: radius.control,
    border: "none",
    background: "var(--accent-700)",
    color: "var(--text)",
    fontSize: typography['body-sm'].fontSize,
    fontWeight: fontWeights.semibold,
    cursor: "pointer",
    fontFamily: FONT_FAMILY,
  },
  dismissButton: {
    padding: "8px 16px",
    borderRadius: radius.control,
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontSize: typography['body-sm'].fontSize,
    fontWeight: fontWeights.medium,
    cursor: "pointer",
    fontFamily: FONT_FAMILY,
  },
}
