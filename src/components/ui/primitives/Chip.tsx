"use client"

/**
 * Chip primitive — compact selection/action control.
 *
 * Variants: category | filter | action
 * Props: selected boolean
 * States: default | hover | pressed | selected | disabled
 *
 * All visual values resolved from tokens. No arbitrary style props.
 * Hit target ≥44×44px. Press treatment: 2% scale down via snappy spring.
 * Uses pill radius (full).
 *
 * Requirements: 16.1, 16.2, 16.4, 5.5
 */

import React from 'react'
import { motion } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { FONT_FAMILY, typography } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { spacingScale } from '@/styles/layout'
import { colorRamp, textColors, semanticColors } from '@/styles/colors'

// ============================================================================
// Types
// ============================================================================

export type ChipVariant = 'category' | 'filter' | 'action'

export interface ChipProps {
  children: React.ReactNode
  variant?: ChipVariant
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  'aria-label'?: string
}

// ============================================================================
// Style Mappings (from tokens only)
// ============================================================================

function getVariantStyles(
  variant: ChipVariant,
  selected: boolean,
  disabled: boolean
): React.CSSProperties {
  if (disabled) {
    return {
      background: 'var(--color-surface)',
      color: textColors.muted,
      border: `1px solid ${semanticColors.borderSubtle}`,
      opacity: 0.5,
      cursor: 'not-allowed',
    }
  }

  if (selected) {
    return {
      background: colorRamp.accent[200],
      color: textColors.text,
      border: `1px solid ${colorRamp.accent[400]}`,
      cursor: 'pointer',
    }
  }

  switch (variant) {
    case 'category':
      return {
        background: 'var(--color-surface)',
        color: textColors.sub,
        border: `1px solid ${semanticColors.borderDefault}`,
        cursor: 'pointer',
      }
    case 'filter':
      return {
        background: 'transparent',
        color: textColors.sub,
        border: `1px solid ${semanticColors.borderDefault}`,
        cursor: 'pointer',
      }
    case 'action':
      return {
        background: 'var(--color-raised)',
        color: textColors.text,
        border: `1px solid ${semanticColors.borderDefault}`,
        cursor: 'pointer',
      }
  }
}

// ============================================================================
// Component
// ============================================================================

export const Chip: React.FC<ChipProps> = ({
  children,
  variant = 'category',
  selected = false,
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
}) => {
  const isDisabled = disabled
  const { prefersReducedMotion } = useReducedMotion()

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingScale['6'],
    minHeight: '44px',
    minWidth: '44px',
    paddingLeft: spacingScale['12'],
    paddingRight: spacingScale['12'],
    paddingTop: spacingScale['6'],
    paddingBottom: spacingScale['6'],
    borderRadius: radius.full,
    fontFamily: FONT_FAMILY,
    fontSize: typography['body-sm'].fontSize,
    fontWeight: typography['body-sm'].fontWeight,
    lineHeight: typography['body-sm'].lineHeight,
    letterSpacing: typography['body-sm'].letterSpacing,
    fontVariantNumeric: 'tabular-nums',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    position: 'relative',
    ...getVariantStyles(variant, selected, isDisabled),
  }

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={isDisabled}
      aria-pressed={selected}
      role="option"
      className="focus-ring"
      style={baseStyles}
      whileTap={isDisabled ? undefined : (prefersReducedMotion ? { opacity: 0.92 } : { scale: 0.98 })}
      transition={springs.snappy}
    >
      {children}
    </motion.button>
  )
}
