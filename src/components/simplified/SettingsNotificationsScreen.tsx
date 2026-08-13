"use client"

/**
 * SettingsNotificationsScreen — Notifications & alerts sub-screen.
 *
 * Renders the self-contained NotificationCenter (reminder prefs, smart nudges,
 * pattern nudges, social notifications) plus the MinBalanceBufferSetting
 * (low-balance cushion control). Wrapped in the shared SettingsSubScreen layout.
 *
 * Requirements: 20.3
 */

import { spacingScale } from "@/styles/layout"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { NotificationCenter } from "./NotificationCenter"
import { MinBalanceBufferSetting } from "./MinBalanceBufferSetting"

// ============================================================================
// Types
// ============================================================================

export interface SettingsNotificationsScreenProps {
  onBack: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SettingsNotificationsScreen({ onBack }: SettingsNotificationsScreenProps) {
  return (
    <SettingsSubScreen title="Notifications" onBack={onBack}>
      <NotificationCenter />

      <div style={{ marginTop: spacingScale['32'] }}>
        <MinBalanceBufferSetting />
      </div>
    </SettingsSubScreen>
  )
}
