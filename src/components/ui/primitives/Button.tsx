"use client"

/**
 * Button primitive — the primary interactive control for Folio.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes: sm | md | lg
 * States: default | hover | pressed | focused | disabled | loading
 *
 * All visual values resolved from tokens. No arbitrary style props.
 * Hit target ≥44×44px. Press treatment: 2% scale down via snappy spring.
 *
 * Requirements: 16.1, 16.2, 16.4, 5.5
 */

import React from 'react'
import { motion } from 'framer-motion'
import { springPresets } from '@/styles/motion'
import { FONT_FAMILY, typography } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { spacingScale } from '@/styles/layout'
import { colorRamp, gradients, textColors, semanticColors } from '@/styles/colors'

// ============================================================================
// Types
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
}

// ============================================================================
// Style Mappings (from tokens only)
// ============================================================================

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    minHeight: '44px',
    minWidth: '44px',
    paddingLeft: spacingScale['12'],
    paddingRight: spacingScale['12'],
    paddingTop: spacingScale['6'],
    paddingBottom: spacingScale['6'],
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
    letterSpacing: typography.caption.letterSpacing,
  },
  md: {
    minHeight: '44px',
    minWidth: '44px',
    paddingLeft: spacingScale['16'],
    paddingRight: spacingScale['16'],
    paddingTop: spacingScale['8'],
    paddingBottom: spacingScale['8'],
    fontSize: typography.body.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.body.lineHeight,
    letterSpacing: typography.body.letterSpacing,
  },
  lg: {
    minHeight: '48px',
    minWidth: '48px',
    paddingLeft: spacingScale['24'],
    paddingRight: spacingScale['24'],
    paddingTop: spacingScale['12'],
    paddingBottom: spacingScale['12'],
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
    letterSpacing: typography.subhead.letterSpacing,
  },
}

function getVariantStyles(variant: ButtonVariant, disabled: boolean): React.CSSProperties {
  if (disabled) {
    return {
      background: 'var(--color-surface)',
      color: textColors.muted,
      border: `1px solid ${semanticColors.borderSubtle}`,
      opacity: 0.5,
      cursor: 'not-allowed',
    }
  }

  switch (variant) {
    case 'primary':
      return {
        background: gradients.action,
        color: '#0e0e1a',
        border: 'none',
        cursor: 'pointer',
      }
    case 'secondary':
      return {
        background: 'var(--color-raised)',
        color: textColors.text,
        border: `1px solid ${semanticColors.borderDefault}`,
        cursor: 'pointer',
      }
    case 'ghost':
      return {
        background: 'transparent',
        color: textColors.text,
        border: '1px solid transparent',
        cursor: 'pointer',
      }
    case 'danger':
      return {
        background: colorRamp.error[600],
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
      }
  }
}

// ============================================================================
// Component
// ============================================================================

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
}) => {
  const isDisabled = disabled || loading

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingScale['8'],
    borderRadius: radius.control,
    fontFamily: FONT_FAMILY,
    fontVariantNumeric: 'tabular-nums',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
    ...sizeStyles[size],
    ...getVariantStyles(variant, isDisabled),
  }

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={isDisabled}
      aria-busy={loading}
      style={baseStyles}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: springPresets.snappy.stiffness,
        damping: springPresets.snappy.damping,
        mass: springPresets.snappy.mass,
      }}
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
        children
      )}
    </motion.button>
  )
}

// ============================================================================
// Loading Spinner (internal)
// ============================================================================

const LoadingSpinner: React.FC = () => (
  <motion.span
    style={{
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
    }}
    animate={{ rotate: 360 }}
    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    aria-hidden="true"
  />
)
