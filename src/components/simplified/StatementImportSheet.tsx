/**
 * StatementImportSheet — CSV bank statement import with review & batch save.
 *
 * Flow:
 * 1. User drops/picks a CSV file
 * 2. Parser detects format, auto-categorizes rows
 * 3. User reviews: editable category, note, include/exclude checkbox
 * 4. Duplicates warned (highlighted)
 * 5. User confirms → batch insert into Supabase
 * 6. Summary shown
 *
 * Task 362.2, 362.3
 */

'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/lib/animations'
import type { TransactionCategory, Transaction } from '@/types'
import { parseStatement, type ImportCandidate } from '@/lib/statementImport'
import { insertTransaction } from '@/lib/supabaseData'
import { FONT_FAMILY, pxToRem, typography, spacing, fontWeights } from '@/styles/typography'
import {
  fills,
  borderRadius,
  colorRamp,
  glassSurface,
  emptyStateContainer,
  emptyStateTitle,
  emptyStateSubtitle,
  CONTENT_MAX_WIDTH,
} from '@/styles/shared'
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

export interface StatementImportSheetProps {
  /** Current user ID for saving transactions */
  userId: string
  /** Existing transactions for duplicate detection */
  transactions: Transaction[]
  /** Close the sheet / overlay */
  onBack: () => void
  /** Callback after successful import (to refresh data) */
  onImportComplete?: (count: number) => void
}

type ImportPhase = 'upload' | 'review' | 'importing' | 'done'

const ALL_CATEGORIES: TransactionCategory[] = [
  'food', 'drinks', 'rent', 'transport', 'school',
  'fun', 'health', 'subscriptions', 'gig', 'income', 'other',
]

// ============================================================================
// Component
// ============================================================================

export function StatementImportSheet({
  userId,
  transactions,
  onBack,
  onImportComplete,
}: StatementImportSheetProps) {
  const [phase, setPhase] = useState<ImportPhase>('upload')
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [detectedFormat, setDetectedFormat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null!)
  const { prefersReducedMotion } = useReducedMotion()

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    setError(null)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseStatement(text, transactions)
      if (result.success) {
        setCandidates(result.candidates)
        setDetectedFormat(result.detectedFormat)
        setPhase('review')
      } else {
        setError(result.error)
      }
    }
    reader.onerror = () => {
      setError('Could not read the file. Try again?')
    }
    reader.readAsText(file)
  }, [transactions])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Candidate editing ──────────────────────────────────────────────────────

  const toggleIncluded = useCallback((id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, included: !c.included } : c
    ))
  }, [])

  const updateCategory = useCallback((id: string, category: TransactionCategory) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, category } : c
    ))
  }, [])

  const updateNote = useCallback((id: string, note: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, note } : c
    ))
  }, [])

  // ── Import / Save ──────────────────────────────────────────────────────────

  const includedCandidates = useMemo(
    () => candidates.filter(c => c.included),
    [candidates]
  )

  const handleImport = useCallback(async () => {
    setPhase('importing')
    let successCount = 0

    for (const candidate of includedCandidates) {
      const result = await insertTransaction(userId, {
        date: candidate.date,
        amount: candidate.amount,
        type: candidate.type,
        category: candidate.category,
        note: candidate.note || candidate.description || undefined,
        accountType: 'personal',
      })
      if (result) successCount++
    }

    setImportedCount(successCount)
    setPhase('done')
    onImportComplete?.(successCount)
  }, [includedCandidates, userId, onImportComplete])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      maxWidth: CONTENT_MAX_WIDTH,
      margin: '0 auto',
      padding: '0 20px',
      paddingBottom: 120,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--sub)',
            fontSize: pxToRem(24),
            cursor: 'pointer',
            padding: 4,
            lineHeight: 1,
            fontFamily: FONT_FAMILY,
          }}
        >
          ←
        </button>
        <h1 style={{ ...typography.headline, color: 'var(--text)', margin: 0 }}>
          Import Statement
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'upload' && (
          <motion.div
            key="upload"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            <UploadPhase
              isDragging={isDragging}
              error={error}
              fileInputRef={fileInputRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileSelect={handleFileSelect}
              onPickFile={() => fileInputRef.current?.click()}
            />
          </motion.div>
        )}

        {phase === 'review' && (
          <motion.div
            key="review"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            <ReviewPhase
              candidates={candidates}
              detectedFormat={detectedFormat}
              includedCount={includedCandidates.length}
              onToggleIncluded={toggleIncluded}
              onUpdateCategory={updateCategory}
              onUpdateNote={updateNote}
              onImport={handleImport}
              onBack={() => { setPhase('upload'); setCandidates([]); setError(null) }}
            />
          </motion.div>
        )}

        {phase === 'importing' && (
          <motion.div
            key="importing"
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            style={{ ...emptyStateContainer, paddingTop: 80 }}
          >
            <div style={{ ...emptyStateTitle }}>Importing…</div>
            <div style={{ ...emptyStateSubtitle }}>
              Saving {includedCandidates.length} transactions
            </div>
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div
            key="done"
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
          >
            <DonePhase importedCount={importedCount} onClose={onBack} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Upload Phase
// ============================================================================

function UploadPhase({
  isDragging,
  error,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  onPickFile,
}: {
  isDragging: boolean
  error: string | null
  fileInputRef: React.RefObject<HTMLInputElement>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPickFile: () => void
}) {
  return (
    <div>
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          ...glassSurface,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing.md,
          textAlign: 'center',
          border: isDragging
            ? `2px dashed var(--accent)`
            : `1px solid ${fills[8]}`,
          background: isDragging ? colorRamp.accent[50] : fills[3],
          borderRadius: borderRadius.lg,
          transition: 'border-color 0.2s, background 0.2s',
          cursor: 'pointer',
        }}
        onClick={onPickFile}
        role="button"
        aria-label="Drop a CSV file here or click to browse"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPickFile() }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>📄</div>
        <div style={{ ...emptyStateTitle }}>
          Drop your bank statement here
        </div>
        <div style={{ ...emptyStateSubtitle }}>
          CSV files from Chase, Bank of America, Wells Fargo, Capital One, or any standard format
        </div>
        <button
          style={{
            marginTop: spacing.xs,
            padding: '10px 24px',
            borderRadius: radius.full,
            border: 'none',
            background: colorRamp.accent[200],
            color: 'var(--accent)',
            fontSize: pxToRem(13),
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            cursor: 'pointer',
          }}
          onClick={(e) => { e.stopPropagation(); onPickFile() }}
        >
          Browse files
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFileSelect}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Error display */}
      {error && (
        <div style={{
          marginTop: spacing.md,
          padding: '12px 16px',
          borderRadius: borderRadius.sm,
          background: 'var(--error-100)',
          border: '1px solid var(--error-300)',
          color: 'var(--error)',
          fontSize: pxToRem(13),
          fontFamily: FONT_FAMILY,
        }}>
          {error}
        </div>
      )}

      {/* Info note */}
      <p style={{
        ...typography['body-sm'],
        color: 'var(--muted)',
        marginTop: spacing.lg,
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        Your data is parsed locally and never leaves your device until you confirm the import.
      </p>
    </div>
  )
}

// ============================================================================
// Review Phase
// ============================================================================

function ReviewPhase({
  candidates,
  detectedFormat,
  includedCount,
  onToggleIncluded,
  onUpdateCategory,
  onUpdateNote,
  onImport,
  onBack,
}: {
  candidates: ImportCandidate[]
  detectedFormat: string
  includedCount: number
  onToggleIncluded: (id: string) => void
  onUpdateCategory: (id: string, category: TransactionCategory) => void
  onUpdateNote: (id: string, note: string) => void
  onImport: () => void
  onBack: () => void
}) {
  const duplicateCount = candidates.filter(c => c.isDuplicate).length

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
      }}>
        <div>
          <p style={{ ...typography['body-sm'], color: 'var(--sub)', margin: 0 }}>
            Detected: <strong style={{ color: 'var(--text)' }}>{detectedFormat}</strong>
          </p>
          <p style={{ ...typography.caption, color: 'var(--muted)', margin: '4px 0 0' }}>
            {candidates.length} rows found · {includedCount} selected
            {duplicateCount > 0 && (
              <span style={{ color: 'var(--warning)' }}>
                {' '}· {duplicateCount} possible duplicate{duplicateCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--sub)',
            fontSize: pxToRem(13),
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
          }}
        >
          ← Pick another file
        </button>
      </div>

      {/* Transaction rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        {candidates.map(candidate => (
          <ImportRow
            key={candidate.id}
            candidate={candidate}
            onToggleIncluded={() => onToggleIncluded(candidate.id)}
            onUpdateCategory={(cat) => onUpdateCategory(candidate.id, cat)}
            onUpdateNote={(note) => onUpdateNote(candidate.id, note)}
          />
        ))}
      </div>

      {/* Import button */}
      <div style={{ position: 'sticky', bottom: 24, marginTop: spacing.lg, zIndex: 10 }}>
        <button
          onClick={onImport}
          disabled={includedCount === 0}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: borderRadius.md,
            border: 'none',
            background: includedCount > 0 ? 'var(--accent)' : fills[6],
            color: includedCount > 0 ? '#fff' : 'var(--muted)',
            fontSize: pxToRem(15),
            fontWeight: fontWeights.semibold,
            fontFamily: FONT_FAMILY,
            cursor: includedCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: includedCount > 0 ? 'var(--shadow-glow-accent-strong)' : 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          Import {includedCount} transaction{includedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Import Row
// ============================================================================

function ImportRow({
  candidate,
  onToggleIncluded,
  onUpdateCategory,
  onUpdateNote,
}: {
  candidate: ImportCandidate
  onToggleIncluded: () => void
  onUpdateCategory: (cat: TransactionCategory) => void
  onUpdateNote: (note: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        ...glassSurface,
        padding: '12px 14px',
        opacity: candidate.included ? 1 : 0.5,
        borderColor: candidate.isDuplicate
          ? 'var(--warning-400)'
          : undefined,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={candidate.included}
          onChange={onToggleIncluded}
          aria-label={`Include ${candidate.description}`}
          style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--accent)' }}
        />

        {/* Content */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
          aria-expanded={expanded}
          aria-label={`${candidate.description}, tap to ${expanded ? 'collapse' : 'expand'}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{
                ...typography['body-sm'],
                color: 'var(--text)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 220,
              }}>
                {candidate.description || '(no description)'}
              </p>
              <p style={{ ...typography.caption, color: 'var(--muted)', margin: '2px 0 0' }}>
                {candidate.date} · {candidate.category}
                {candidate.isDuplicate && (
                  <span style={{ color: 'var(--warning)', marginLeft: 6 }}>
                    ⚠ possible duplicate
                  </span>
                )}
              </p>
            </div>
            <span style={{
              ...typography['body-sm'],
              fontWeight: fontWeights.semibold,
              fontVariantNumeric: 'tabular-nums',
              color: candidate.type === 'income' ? 'var(--success, #4ade80)' : 'var(--text)',
              flexShrink: 0,
              marginLeft: spacing.xs,
            }}>
              {candidate.type === 'income' ? '+' : '−'}${candidate.amount.toFixed(2)}
            </span>
          </div>
        </button>
      </div>

      {/* Expanded edit area */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 10, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {/* Category select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <label
                  style={{ ...typography.caption, color: 'var(--muted)', minWidth: 60 }}
                >
                  Category
                </label>
                <select
                  value={candidate.category}
                  onChange={(e) => onUpdateCategory(e.target.value as TransactionCategory)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: borderRadius.sm,
                    border: `1px solid ${fills[10]}`,
                    background: fills[4],
                    color: 'var(--text)',
                    fontSize: pxToRem(13),
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <label
                  style={{ ...typography.caption, color: 'var(--muted)', minWidth: 60 }}
                >
                  Note
                </label>
                <input
                  type="text"
                  value={candidate.note}
                  onChange={(e) => onUpdateNote(e.target.value)}
                  placeholder="Add a note…"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: borderRadius.sm,
                    border: `1px solid ${fills[10]}`,
                    background: fills[4],
                    color: 'var(--text)',
                    fontSize: pxToRem(13),
                    fontFamily: FONT_FAMILY,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Done Phase
// ============================================================================

function DonePhase({ importedCount, onClose }: { importedCount: number; onClose: () => void }) {
  return (
    <div style={{ ...emptyStateContainer, paddingTop: 60 }}>
      <div style={{ fontSize: 48, lineHeight: 1, marginBottom: spacing.xs }}>✓</div>
      <div style={{ ...emptyStateTitle }}>
        Imported {importedCount} transaction{importedCount !== 1 ? 's' : ''} from your statement
      </div>
      <div style={{ ...emptyStateSubtitle }}>
        They&apos;re now part of your spending history and reflect in your allowance.
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: spacing.md,
          padding: '12px 28px',
          borderRadius: radius.full,
          border: 'none',
          background: colorRamp.accent[200],
          color: 'var(--accent)',
          fontSize: pxToRem(14),
          fontWeight: fontWeights.medium,
          fontFamily: FONT_FAMILY,
          cursor: 'pointer',
        }}
      >
        Done
      </button>
    </div>
  )
}
