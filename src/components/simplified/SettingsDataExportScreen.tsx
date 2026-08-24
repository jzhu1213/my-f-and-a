"use client"

/**
 * SettingsDataExportScreen — Data & export sub-screen.
 *
 * Provides export actions (PDF, CSV), a reports link, and a sharing
 * management link with an active share count badge. Wrapped in the
 * shared SettingsSubScreen layout.
 *
 * Requirements: 20.3
 */

import { spacingScale } from "@/styles/layout"
import { typography, spacing, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { textColors } from "@/styles/colors"
import { ListRow } from "@/components/ui/primitives/ListRow"
import { SettingsSubScreen } from "./SettingsSubScreen"

// ============================================================================
// Types
// ============================================================================

export interface SettingsDataExportScreenProps {
  onBack: () => void
  onExportData?: () => void
  onExportCSV?: () => void
  onOpenReports?: () => void
  onOpenSharing?: () => void
  activeShareCount?: number
}

// ============================================================================
// Component
// ============================================================================

export function SettingsDataExportScreen({
  onBack,
  onExportData,
  onExportCSV,
  onOpenReports,
  onOpenSharing,
  activeShareCount,
}: SettingsDataExportScreenProps) {
  return (
    <SettingsSubScreen title="Export" description="Get your data out as PDF, CSV, or a shared link." onBack={onBack}>
      {/* Export as PDF */}
      <ListRow
        variant="dense"
        onPress={onExportData}
        aria-label="Export as PDF"
        style={{
          borderRadius: radius.control,
          border: '1px solid var(--accent-200)',
          background: 'var(--fill-03)',
        }}
      >
        <span style={{ flex: 1, ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
          Export as PDF
        </span>
        <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
          ›
        </span>
      </ListRow>

      {/* Export as CSV */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <ListRow
          variant="dense"
          onPress={onExportCSV}
          aria-label="Export as CSV"
          style={{
            borderRadius: radius.control,
            border: '1px solid var(--accent-200)',
            background: 'var(--fill-03)',
          }}
        >
          <span style={{ flex: 1, ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
            Export as CSV
          </span>
          <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
            ›
          </span>
        </ListRow>
      </div>

      {/* Reports */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <ListRow
          variant="dense"
          onPress={onOpenReports}
          aria-label="Open reports"
          style={{
            borderRadius: radius.control,
            border: '1px solid var(--accent-200)',
            background: 'var(--fill-03)',
          }}
        >
          <span style={{ flex: 1, ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
            Reports
          </span>
          <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
            ›
          </span>
        </ListRow>
      </div>

      {/* Sharing management */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <ListRow
          variant="dense"
          onPress={onOpenSharing}
          aria-label="Manage sharing"
          style={{
            borderRadius: radius.control,
            border: '1px solid var(--accent-200)',
            background: 'var(--fill-03)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
            <span style={{ ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
              Sharing
            </span>
            {activeShareCount != null && activeShareCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  borderRadius: radius.control,
                  padding: '0 6px',
                  fontSize: typography.caption.fontSize,
                  fontWeight: fontWeights.semibold,
                  background: 'var(--accent-200)',
                  color: textColors.text,
                }}
                aria-label={`${activeShareCount} active share${activeShareCount === 1 ? '' : 's'}`}
              >
                {activeShareCount}
              </span>
            )}
          </span>
          <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
            ›
          </span>
        </ListRow>
      </div>
    </SettingsSubScreen>
  )
}
