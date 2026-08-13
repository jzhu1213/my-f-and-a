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
import { typography } from "@/styles/typography"
import { textColors } from "@/styles/colors"
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
// Shared button style
// ============================================================================

const actionButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(167, 139, 250, 0.15)',
  background: 'rgba(255,255,255,0.03)',
  cursor: 'pointer',
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
      <button
        type="button"
        onClick={onExportData}
        style={actionButtonStyle}
        aria-label="Export as PDF"
      >
        <span style={{ ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
          Export as PDF
        </span>
        <span style={{ fontSize: 14, color: textColors.sub }} aria-hidden="true">
          ›
        </span>
      </button>

      {/* Export as CSV */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <button
          type="button"
          onClick={onExportCSV}
          style={actionButtonStyle}
          aria-label="Export as CSV"
        >
          <span style={{ ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
            Export as CSV
          </span>
          <span style={{ fontSize: 14, color: textColors.sub }} aria-hidden="true">
            ›
          </span>
        </button>
      </div>

      {/* Reports */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <button
          type="button"
          onClick={onOpenReports}
          style={actionButtonStyle}
          aria-label="Open reports"
        >
          <span style={{ ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
            Reports
          </span>
          <span style={{ fontSize: 14, color: textColors.sub }} aria-hidden="true">
            ›
          </span>
        </button>
      </div>

      {/* Sharing management */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <button
          type="button"
          onClick={onOpenSharing}
          style={actionButtonStyle}
          aria-label="Manage sharing"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  borderRadius: 10,
                  padding: '0 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(167, 139, 250, 0.2)',
                  color: textColors.text,
                }}
                aria-label={`${activeShareCount} active share${activeShareCount === 1 ? '' : 's'}`}
              >
                {activeShareCount}
              </span>
            )}
          </span>
          <span style={{ fontSize: 14, color: textColors.sub }} aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </SettingsSubScreen>
  )
}
