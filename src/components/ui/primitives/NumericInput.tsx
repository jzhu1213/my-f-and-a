"use client"

/**
 * NumericInput primitive — large numeric entry field for amounts.
 *
 * Sizes: lg | xl
 * States: default | focused | error
 *
 * All visual values resolved from tokens. No arbitrary style props.
 * Hit target ≥44×44px. Uses tabular-nums for aligned digits.
 *
 * Requirements: 16.1, 16.2, 16.4, 5.5
 */

import React, { useState, useCallback } from 'react'
import { FONT_FAMILY, typography } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { spacingScale } from '@/styles/layout'
import { textColors, semanticColors, colorRamp } from '@/styles/colors'

// ============================================================================
// Types
// ============================================================================

export type NumericInputSize = 'lg' | 'xl'

export interface NumericInputProps {
  size?: NumericInputSize
  error?: boolean
  value?: string
  placeholder?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  'aria-label'?: string
  'aria-describedby'?: string
  id?: string
  name?: string
  max?: number
  min?: number
  disabled?: boolean
}

// ============================================================================
// Style Mappings
// ============================================================================

const sizeStyles: Record<NumericInputSize, React.CSSProperties> = {
  lg: {
    minHeight: '56px',
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight,
    lineHeight: typography.headline.lineHeight,
    letterSpacing: typography.headline.letterSpacing,
  },
  xl: {
    minHeight: '72px',
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
    letterSpacing: typography.title.letterSpacing,
  },
}

// ============================================================================
// Component
// ============================================================================

export const NumericInput: React.FC<NumericInputProps> = ({
  size = 'lg',
  error = false,
  value,
  placeholder = '0.00',
  onChange,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  id,
  name,
  max,
  min,
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false)

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(e)
    },
    [onFocus]
  )

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(e)
    },
    [onBlur]
  )

  // Determine border color based on state
  const getBorderColor = (): string => {
    if (disabled) return semanticColors.borderSubtle
    if (error) return colorRamp.error[500]
    if (isFocused) return colorRamp.accent[500]
    return semanticColors.borderDefault
  }

  const baseStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: '44px',
    paddingLeft: spacingScale['16'],
    paddingRight: spacingScale['16'],
    paddingTop: spacingScale['12'],
    paddingBottom: spacingScale['12'],
    background: 'var(--color-sunken)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: radius.control,
    fontFamily: FONT_FAMILY,
    fontVariantNumeric: 'tabular-nums',
    color: disabled ? textColors.muted : textColors.text,
    outline: 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    transition: 'border-color 150ms ease-out',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'center',
    boxSizing: 'border-box',
    ...sizeStyles[size],
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*\\.?[0-9]*"
      id={id}
      name={name}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={ariaLabel ?? 'Amount'}
      aria-describedby={ariaDescribedBy}
      aria-invalid={error}
      aria-disabled={disabled}
      max={max}
      min={min}
      style={baseStyles}
    />
  )
}
