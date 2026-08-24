"use client"

/**
 * SettingsPrivacySecurityScreen — Privacy & security sub-screen.
 *
 * Composes the self-contained AppLockSetting (device lock setup),
 * SessionsSetting (active sessions/devices), and a privacy dashboard
 * link. Wrapped in the shared SettingsSubScreen layout.
 *
 * Requirements: 20.3
 */

import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { radius } from '@/styles/surfaces'
import { textColors } from "@/styles/colors"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { ListRow } from "@/components/ui/primitives/ListRow"
import { AppLockSetting } from "./AppLockSetting"
import { SessionsSetting } from "./SessionsSetting"

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
  return (
    <SettingsSubScreen title="Privacy" description="Keep your data safe and control who sees what." onBack={onBack}>
      <AppLockSetting />

      <div style={{ marginTop: spacingScale['32'] }}>
        <SessionsSetting />
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
