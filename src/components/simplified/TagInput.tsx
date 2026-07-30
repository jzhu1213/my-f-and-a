"use client"

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { triggerHaptic } from '@/lib/haptics'
import { parseTagInput, MAX_TAGS_PER_TRANSACTION, MAX_TAG_LENGTH } from '@/lib/tagUtils'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'

interface TagInputProps {
  /** Current tags */
  tags: string[]
  /** Called when tags change */
  onChange: (tags: string[]) => void
  /** Suggestion chips from recent usage */
  suggestions?: string[]
  /** Whether the section starts collapsed (progressive disclosure) */
  collapsible?: boolean
}

/**
 * TagInput — lightweight tag editor with chips + text input.
 *
 * Features:
 * - Comma/Enter to add tags
 * - Click chips to remove
 * - Suggestion chips from recent tags
 * - Progressive disclosure (collapsed by default)
 * - Max 5 tags, 20 chars each
 */
export function TagInput({
  tags,
  onChange,
  suggestions = [],
  collapsible = true,
}: TagInputProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(!collapsible || tags.length > 0)

  const addTags = useCallback((raw: string) => {
    const parsed = parseTagInput(raw)
    if (parsed.length === 0) return

    const merged = [...new Set([...tags, ...parsed])].slice(0, MAX_TAGS_PER_TRANSACTION)
    onChange(merged)
    setInput('')
    triggerHaptic('light')
  }, [tags, onChange])

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag))
    triggerHaptic('light')
  }, [tags, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      addTags(input)
    }
    // Backspace on empty input removes last tag
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
      triggerHaptic('light')
    }
  }, [input, tags, addTags, onChange])

  // Filter suggestions to exclude already-added tags
  const availableSuggestions = suggestions.filter((s) => !tags.includes(s))

  if (!expanded && collapsible) {
    return (
      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => { setExpanded(true); triggerHaptic('light') }}
          aria-label="Add tags"
          style={{
            background: 'transparent',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: borderRadius.md,
            padding: '8px 14px',
            fontSize: 13,
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            color: 'var(--sub)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>#</span> Add tags
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Current tag pills */}
      {tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
          aria-label="Current tags"
        >
          <AnimatePresence>
            {tags.map((tag) => (
              <motion.button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag: ${tag}`}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                transition={springs.snappy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  background: 'rgba(129, 140, 248, 0.1)',
                  border: '1px solid rgba(129, 140, 248, 0.25)',
                  borderRadius: borderRadius.full,
                  fontSize: 12,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 500,
                  color: 'rgba(129, 140, 248, 0.9)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                #{tag}
                <span
                  style={{ fontSize: 13, lineHeight: 1, opacity: 0.7 }}
                  aria-hidden="true"
                >
                  ×
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Text input */}
      {tags.length < MAX_TAGS_PER_TRANSACTION && (
        <input
          type="text"
          placeholder={tags.length === 0 ? 'e.g. trip, birthday' : 'Add another…'}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_TAG_LENGTH + 10))}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addTags(input) }}
          aria-label="Add tag"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--line)',
            outline: 'none',
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            color: 'var(--text)',
            padding: '8px 0',
            caretColor: 'var(--text)',
          }}
        />
      )}

      {/* Helper text */}
      <span
        style={{
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          color: 'var(--muted)',
          marginTop: 4,
          display: 'block',
        }}
      >
        {tags.length >= MAX_TAGS_PER_TRANSACTION
          ? `Max ${MAX_TAGS_PER_TRANSACTION} tags`
          : 'Comma or Enter to add'}
      </span>

      {/* Suggestion chips */}
      {availableSuggestions.length > 0 && tags.length < MAX_TAGS_PER_TRANSACTION && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 8,
          }}
          aria-label="Suggested tags"
        >
          {availableSuggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                const merged = [...new Set([...tags, suggestion])].slice(0, MAX_TAGS_PER_TRANSACTION)
                onChange(merged)
                triggerHaptic('light')
              }}
              aria-label={`Add tag: ${suggestion}`}
              style={{
                padding: '4px 10px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: borderRadius.full,
                fontSize: 12,
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                color: 'var(--sub)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              #{suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
