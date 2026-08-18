"use client"

/**
 * HistorySearchBar — prominent full-width search input for the History screen.
 *
 * Features:
 * - Full-text search across transactions (debounced 150ms)
 * - Match count display
 * - Clear button
 * - Search suggestions dropdown (recent searches + quick filters) when focused
 *   but empty
 * - Highlight matching text in results via HighlightText export
 *
 * Requirements: 22.1
 */

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius, fills } from '@/styles/shared'
import { springs } from '@/lib/animations'
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  QUICK_FILTERS,
} from '@/lib/transactionSearch'
import type { QuickFilter } from '@/lib/transactionSearch'

// ============================================================================
// Types
// ============================================================================

export interface HistorySearchBarProps {
  /** Current search query (controlled) */
  value: string
  /** Called on debounced query change */
  onChange: (query: string) => void
  /** Number of matching results to display */
  resultCount?: number
  /** Total transactions (to show "X of Y") */
  totalCount?: number
  /** Called when a quick filter is applied */
  onQuickFilter?: (filter: QuickFilter) => void
}

// ============================================================================
// HighlightText — exported for use in TransactionList
// ============================================================================

export function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: { text: string; highlighted: boolean }[] = []

  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlighted: false })
    }
    parts.push({ text: text.slice(index, index + query.length), highlighted: true })
    lastIndex = index + query.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false })
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark
            key={i}
            style={{
              background: 'rgba(129, 140, 248, 0.25)',
              borderRadius: 3,
              padding: '0 2px',
              color: 'inherit',
            }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

// ============================================================================
// HistorySearchBar Component
// ============================================================================

export function HistorySearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  onQuickFilter,
}: HistorySearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const liveRegionId = useId()

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Load recent searches when focused
  useEffect(() => {
    if (isFocused) {
      setRecentSearches(getRecentSearches())
    }
  }, [isFocused])

  // Debounced onChange (150ms)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value
      setLocalValue(newVal)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        onChange(newVal)
        if (newVal.trim()) {
          addRecentSearch(newVal.trim())
        }
      }, 150)
    },
    [onChange]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  const handleRecentClick = useCallback(
    (query: string) => {
      setLocalValue(query)
      onChange(query)
      setIsFocused(false)
      inputRef.current?.blur()
    },
    [onChange]
  )

  const handleQuickFilterClick = useCallback(
    (filter: QuickFilter) => {
      if (onQuickFilter) {
        onQuickFilter(filter)
      } else {
        // Fallback: use as a text search query
        setLocalValue(filter.query)
        onChange(filter.query)
      }
      setIsFocused(false)
      inputRef.current?.blur()
    },
    [onChange, onQuickFilter]
  )

  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setRecentSearches([])
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showDropdown = isFocused && !localValue.trim()
  const hasResults = resultCount !== undefined && localValue.trim()

  // Build screen reader announcement for result count changes
  const liveAnnouncement = hasResults
    ? `${resultCount} result${resultCount !== 1 ? 's' : ''} found${totalCount !== undefined ? ` out of ${totalCount}` : ''}`
    : ''

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Live region for announcing result count to screen readers */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {liveAnnouncement}
      </div>

      {/* Search input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: fills[4],
          border: `1px solid ${isFocused ? 'rgba(129, 140, 248, 0.4)' : fills[8]}`,
          borderRadius: borderRadius.md,
          transition: 'border-color 0.2s',
        }}
      >
        {/* Search icon */}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--sub)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.7 }}
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label="Search transactions"
          placeholder="Search your spending history..."
          value={localValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 15,
            fontFamily: FONT_FAMILY,
            color: 'var(--text)',
            padding: 0,
          }}
        />

        {/* Match count */}
        {hasResults && (
          <span
            style={{
              fontSize: 12,
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              color: 'var(--sub)',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {resultCount}{totalCount !== undefined ? ` of ${totalCount}` : ''}
          </span>
        )}

        {/* Clear button */}
        {localValue && (
          <motion.button
            type="button"
            onClick={handleClear}
            whileTap={{ scale: 0.9 }}
            transition={springs.snappy}
            aria-label="Clear search"
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: fills[8],
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text)"
              strokeWidth={2.5}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showDropdown && (recentSearches.length > 0 || QUICK_FILTERS.length > 0) && (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-label="Search suggestions"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 6,
              background: 'var(--surface)',
              border: `1px solid ${fills[8]}`,
              borderRadius: borderRadius.md,
              padding: '12px 0',
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div style={{ padding: '0 14px', marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Recent
                  </span>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    aria-label="Clear recent searches"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px 6px',
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--sub)',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {recentSearches.map((search) => (
                    <button
                      key={search}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleRecentClick(search)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = fills[4]
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <svg
                        width={14}
                        height={14}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                      <span
                        style={{
                          fontSize: 13,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--text)',
                          fontWeight: 400,
                        }}
                      >
                        {search}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick filters */}
            <div style={{ padding: '0 14px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                Quick filters
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_FILTERS.map((filter) => (
                  <motion.button
                    key={filter.label}
                    type="button"
                    onClick={() => handleQuickFilterClick(filter)}
                    whileTap={{ scale: 0.95 }}
                    transition={springs.snappy}
                    style={{
                      padding: '7px 14px',
                      fontSize: 13,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--text)',
                      background: fills[6],
                      border: `1px solid ${fills[10]}`,
                      borderRadius: 99,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {filter.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
