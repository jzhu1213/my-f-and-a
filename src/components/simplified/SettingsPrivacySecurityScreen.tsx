"use client"

/**
 * SettingsPrivacySecurityScreen — Privacy & security sub-screen.
 *
 * Composes the self-contained AppLockSetting (device lock setup),
 * SessionsSetting (active sessions/devices), an analytics opt-out toggle,
 * and a privacy dashboard link. Wrapped in the shared SettingsSubScreen layout.
 *
 * Requirements: 20.3, 33.1
 */

import { useCallback, useEffect, useState } from "react"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights, FONT_FAMILY } from "@/styles/typography"
import { radius } from '@/styles/surfaces'
import { textColors } from "@/styles/colors"
import { sectionHeader } from "@/styles/shared"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { ListRow } from "@/components/ui/primitives/ListRow"
import { GlassCard } from "@/components/ui/GlassCard"
import { AppLockSetting } from "./AppLockSetting"
import { SessionsSetting } from "./SessionsSetting"
import { isOptedOut, optIn, optOut } from "@/lib/analytics"

// ============================================================================
// Types
// ============================================================================

export interface SettingsPrivacySecurityScreenProps {
  onBack: () => void
  onOpenPrivacyDashboard?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SettingsPrivacySecurityScreen({ onBack, onOpenPrivacyDashboard }: SettingsPrivacySecurityScreenProps) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)

  // Hydrate from localStorage on mount (SSR-safe)
  useEffect(() => {
    setAnalyticsEnabled(!isOptedOut())
  }, [])

  const handleToggleAnalytics = useCallback(() => {
    if (analyticsEnabled) {
      optOut()
      setAnalyticsEnabled(false)
    } else {
      optIn()
      setAnalyticsEnabled(true)
    }
  }, [analyticsEnabled])

  return (
    <SettingsSubScreen title="Privacy" description="Keep your data safe and control who sees what." onBack={onBack}>
      <AppLockSetting />

      <div style={{ marginTop: spacingScale['32'] }}>
        <SessionsSetting />
      </div>

      {/* Analytics opt-out toggle (Task 533.3) */}
      <div style={{ marginTop: spacingScale['32'] }}>
        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          <p style={{ ...sectionHeader }}>Analytics</p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacingScale["12"],
              padding: "12px 14px",
              borderRadius: radius.control,
              background: analyticsEnabled ? "var(--accent-100)" : "var(--fill-04)",
              border: analyticsEnabled
                ? "1px solid var(--accent-300)"
                : "1px solid var(--border)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.medium,
                  color: textColors.text,
                }}
              >
                Usage analytics
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: typography['body-sm'].fontSize,
                  color: textColors.sub,
                  lineHeight: 1.4,
                  marginTop: 4,
                }}
              >
                {analyticsEnabled ? "On" : "Off"}
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={analyticsEnabled}
              aria-label="Usage analytics"
              onClick={handleToggleAnalytics}
              style={{
                position: "relative",
                width: 48,
                height: 28,
                borderRadius: 14,
                border: "none",
                background: analyticsEnabled ? "var(--accent-500)" : "var(--fill-06)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 0.2s ease",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: analyticsEnabled ? 23 : 3,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--text)",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: textColors.sub,
              lineHeight: 1.5,
              marginTop: spacingScale["12"],
              fontFamily: FONT_FAMILY,
            }}
          >
            Anonymous usage data helps us improve Folio. No personal information is
            collected — we only see which features are used and where people get stuck.
          </p>
        </GlassCard>
      </div>

      <div style={{ marginTop: spacingScale['32'] }}>
        <ListRow
          variant="dense"
          onPress={onOpenPrivacyDashboard}
          aria-label="Open privacy dashboard"
          style={{
            borderRadius: radius.control,
            border: '1px solid var(--accent-200)',
            background: 'var(--fill-03)',
          }}
        >
          <span style={{ flex: 1, ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
            Privacy dashboard
          </span>
          <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
            ›
          </span>
        </ListRow>
      </div>
    </SettingsSubScreen>
  )
}
