"use client"

/**
 * Input primitive — text input control.
 *
 * Variants: default | search
 * Props: error boolean
 * States: default | focused | filled | error | disabled
 *
 * All visual values resolved from tokens. No arbitrary style props.
 * Hit target ≥44×44px.
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

export type InputVariant = 'default' | 'search'

export interface InputProps {
  variant?: InputVariant
  error?: boolean
  disabled?: boolean
  value?: string
  defaultValue?: string
  placeholder?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  type?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  id?: string
  name?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}

// ============================================================================
// Component
// ============================================================================

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  error = false,
  disabled = false,
  value,
  defaultValue,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  type = 'text',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  id,
  name,
  autoComplete,
  inputMode,
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
    minHeight: '44px',
    paddingLeft: variant === 'search' ? spacingScale['40'] : spacingScale['16'],
    paddingRight: spacingScale['16'],
    paddingTop: spacingScale['8'],
    paddingBottom: spacingScale['8'],
    background: 'var(--color-sunken)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: variant === 'search' ? radius.full : radius.control,
    fontFamily: FONT_FAMILY,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    letterSpacing: typography.body.letterSpacing,
    fontVariantNumeric: 'tabular-nums',
    color: disabled ? textColors.muted : textColors.text,
    outline: 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
    WebkitTapHighlightColor: 'transparent',
    boxSizing: 'border-box',
    // Focus ring via box-shadow (≥2px, ≥3:1 contrast) when focused
    boxShadow: isFocused && !disabled ? '0 0 0 2px var(--focus-ring-color)' : 'none',
  }

  return (
    <input
      type={type}
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid ?? error}
      aria-disabled={disabled}
      autoComplete={autoComplete}
      inputMode={inputMode}
      style={baseStyles}
    />
  )
}
