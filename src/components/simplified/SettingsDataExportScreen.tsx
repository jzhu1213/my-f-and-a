"use client"

/**
 * SettingsDataExportScreen — Data & export sub-screen.
 *
 * Provides export actions (PDF, CSV, full JSON backup), a reports link,
 * restore from backup, and a sharing management link with an active
 * share count badge. Wrapped in the shared SettingsSubScreen layout.
 *
 * Requirements: 20.3, 32.7
 */

import { useState, useRef } from "react"
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
  onBackupExport?: () => void
  onBackupRestore?: (file: File) => void
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
  onBackupExport,
  onBackupRestore,
  onOpenReports,
  onOpenSharing,
  activeShareCount,
}: SettingsDataExportScreenProps) {
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRestoreClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setShowRestoreConfirm(true)
    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }

  const handleConfirmRestore = () => {
    if (pendingFile && onBackupRestore) {
      onBackupRestore(pendingFile)
    }
    setShowRestoreConfirm(false)
    setPendingFile(null)
  }

  const handleCancelRestore = () => {
    setShowRestoreConfirm(false)
    setPendingFile(null)
  }

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

      {/* Full backup (JSON) */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <ListRow
          variant="dense"
          onPress={onBackupExport}
          aria-label="Export full backup as JSON"
          style={{
            borderRadius: radius.control,
            border: '1px solid var(--accent-200)',
            background: 'var(--fill-03)',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
            <span style={{ ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
              Full backup (JSON)
            </span>
            <span style={{ ...typography.caption, color: textColors.sub }}>
              Everything — transactions, budgets, goals, and more
            </span>
          </span>
          <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
            ›
          </span>
        </ListRow>
      </div>

      {/* Restore from backup */}
      <div style={{ marginTop: spacingScale['12'] }}>
        <ListRow
          variant="dense"
          onPress={handleRestoreClick}
          aria-label="Restore from backup"
          style={{
            borderRadius: radius.control,
            border: '1px solid var(--accent-200)',
            background: 'var(--fill-03)',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
            <span style={{ ...typography['body-sm'], color: textColors.text, fontWeight: 500 }}>
              Restore from backup
            </span>
            <span style={{ ...typography.caption, color: textColors.sub }}>
              Import a previously exported JSON backup
            </span>
          </span>
          <span style={{ fontSize: typography.body.fontSize, color: textColors.sub, flexShrink: 0 }} aria-hidden="true">
            ›
          </span>
        </ListRow>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
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

      {/* Restore confirmation dialog */}
      {showRestoreConfirm && (
        <div
          role="alertdialog"
          aria-labelledby="restore-confirm-title"
          aria-describedby="restore-confirm-desc"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            padding: spacing.md,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: radius.card,
              padding: spacing.lg,
              maxWidth: 320,
              width: '100%',
            }}
          >
            <h2
              id="restore-confirm-title"
              style={{ ...typography.headline, color: textColors.text, marginBottom: spacing.sm }}
            >
              Replace all data?
            </h2>
            <p
              id="restore-confirm-desc"
              style={{ ...typography['body-sm'], color: textColors.sub, marginBottom: spacing.md }}
            >
              Restoring from a backup replaces everything currently in your account with the backup data. This can&apos;t be undone.
            </p>
            {pendingFile && (
              <p style={{ ...typography.caption, color: textColors.sub, marginBottom: spacing.md }}>
                File: {pendingFile.name}
              </p>
            )}
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <button
                onClick={handleCancelRestore}
                style={{
                  flex: 1,
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: radius.control,
                  border: '1px solid var(--accent-200)',
                  background: 'transparent',
                  color: textColors.text,
                  ...typography['body-sm'],
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                style={{
                  flex: 1,
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: radius.control,
                  border: 'none',
                  background: 'var(--accent-500)',
                  color: '#fff',
                  ...typography['body-sm'],
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsSubScreen>
  )
}
