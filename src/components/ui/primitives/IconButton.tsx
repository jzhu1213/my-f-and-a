"use client"

/**
 * IconButton primitive — icon-only interactive control.
 *
 * Variants: filled | ghost
 * Sizes: sm | md
 * States: default | hover | pressed | focused | disabled
 *
 * All visual values resolved from tokens. No arbitrary style props.
 * Hit target ≥44×44px. Press treatment: 2% scale down via snappy spring.
 *
 * Requirements: 16.1, 16.2, 16.4, 5.5
 */

import React from 'react'
import { motion } from 'framer-motion'
import { springPresets } from '@/styles/motion'
import { radius } from '@/styles/surfaces'
import { textColors, semanticColors } from '@/styles/colors'

// ============================================================================
// Types
// ============================================================================

export type IconButtonVariant = 'filled' | 'ghost'
export type IconButtonSize = 'sm' | 'md'

export interface IconButtonProps {
  children: React.ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
  disabled?: boolean
  onClick?: () => void
  'aria-label': string
}

// ============================================================================
// Style Mappings (from tokens only)
// ============================================================================

const sizeStyles: Record<IconButtonSize, React.CSSProperties> = {
  sm: {
    width: '44px',
    height: '44px',
  },
  md: {
    width: '48px',
    height: '48px',
  },
}

function getVariantStyles(variant: IconButtonVariant, disabled: boolean): React.CSSProperties {
  if (disabled) {
    return {
      background: 'transparent',
      color: textColors.muted,
      border: '1px solid transparent',
      opacity: 0.5,
      cursor: 'not-allowed',
    }
  }

  switch (variant) {
    case 'filled':
      return {
        background: 'var(--color-raised)',
        color: textColors.text,
        border: `1px solid ${semanticColors.borderDefault}`,
        cursor: 'pointer',
      }
    case 'ghost':
      return {
        background: 'transparent',
        color: textColors.sub,
        border: '1px solid transparent',
        cursor: 'pointer',
      }
  }
}

// ============================================================================
// Component
// ============================================================================

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    padding: 0,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    position: 'relative',
    ...sizeStyles[size],
    ...getVariantStyles(variant, disabled),
  }

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className="focus-ring"
      style={baseStyles}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: springPresets.snappy.stiffness,
        damping: springPresets.snappy.damping,
        mass: springPresets.snappy.mass,
      }}
    >
      {children}
    </motion.button>
  )
}
