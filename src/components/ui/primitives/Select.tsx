"use client"

import { useState, useRef, useEffect, useId, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { elevations, radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { textColors, colorRamp } from "@/styles/colors"
import { typography } from "@/styles/typography"

/**
 * Select primitive — a dropdown selection control.
 *
 * Variants:
 * - `default`: Standard select with background fill, border, and shadow.
 * - `inline`: Minimal borderless select for use inside other components.
 *
 * States: default, open, focused, disabled
 *
 * All visual values resolve from the Design_Token_System.
 * Hit area ≥ 44×44px. Press animation via framer-motion (snappy spring).
 * No arbitrary style props exposed.
 *
 * Requirements: 16.1, 16.2, 16.4
 */

// ============================================================================
// Types
// ============================================================================

export interface SelectOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

export interface SelectProps {
  /** Selection options */
  readonly options: readonly SelectOption[]
  /** Currently selected value */
  readonly value?: string
  /** Placeholder text when no value is selected */
  readonly placeholder?: string
  /** Callback when selection changes */
  readonly onChange?: (value: string) => void
  /** Visual variant */
  readonly variant?: "default" | "inline"
  /** Disabled state */
  readonly disabled?: boolean
  /** Accessible label */
  readonly "aria-label"?: string
  /** Id of the labelling element */
  readonly "aria-labelledby"?: string
}

// ============================================================================
// Styles (token-derived)
// ============================================================================

const baseStyles: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  minWidth: "44px",
  cursor: "pointer",
  userSelect: "none",
  borderRadius: radius.control,
  ...typography.body,
}

const variantStyles: Record<"default" | "inline", React.CSSProperties> = {
  default: {
    background: elevations.sunken.fill,
    border: `1px solid ${elevations.resting.border}`,
    boxShadow: elevations.resting.shadow,
    padding: `${spacingScale[8]} ${spacingScale[16]}`,
    gap: spacingScale[8],
  },
  inline: {
    background: "transparent",
    border: "1px solid transparent",
    boxShadow: "none",
    padding: `${spacingScale[4]} ${spacingScale[8]}`,
    gap: spacingScale[4],
  },
}

const dropdownStyles: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 50,
  background: elevations.overlay.fill,
  border: `1px solid ${elevations.overlay.border}`,
  boxShadow: elevations.overlay.shadow,
  borderRadius: radius.control,
  padding: spacingScale[4],
  overflow: "hidden",
  backdropFilter: `blur(${elevations.overlay.blur})`,
}

const optionStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: "44px",
  padding: `${spacingScale[8]} ${spacingScale[12]}`,
  borderRadius: radius.min,
  cursor: "pointer",
  ...typography.body,
  color: textColors.text,
  transition: "background 100ms ease-out",
}

// ============================================================================
// Chevron Icon
// ============================================================================

function ChevronDown({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      animate={{ rotate: open ? 180 : 0 }}
      transition={springs.snappy}
      style={{ flexShrink: 0 }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  )
}

// ============================================================================
// Component
// ============================================================================

export function Select({
  options,
  value,
  placeholder = "Select…",
  onChange,
  variant = "default",
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const listboxId = `${id}-listbox`

  const selectedOption = options.find((o) => o.value === value)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            const opt = options[focusedIndex]
            if (opt && !opt.disabled) {
              onChange?.(opt.value)
              setIsOpen(false)
              setFocusedIndex(-1)
            }
          } else {
            setIsOpen(!isOpen)
          }
          break
        case "Escape":
          setIsOpen(false)
          setFocusedIndex(-1)
          break
        case "ArrowDown":
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
            setFocusedIndex(0)
          } else {
            setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1))
          }
          break
        case "ArrowUp":
          e.preventDefault()
          if (isOpen) {
            setFocusedIndex((prev) => Math.max(prev - 1, 0))
          }
          break
      }
    },
    [disabled, isOpen, focusedIndex, options, onChange]
  )

  const handleSelect = useCallback(
    (optValue: string) => {
      onChange?.(optValue)
      setIsOpen(false)
      setFocusedIndex(-1)
    },
    [onChange]
  )

  const toggleOpen = useCallback(() => {
    if (disabled) return
    setIsOpen((prev) => !prev)
    if (!isOpen) setFocusedIndex(-1)
  }, [disabled, isOpen])

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <motion.div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        className="focus-ring"
        whileTap={disabled ? undefined : (prefersReducedMotion ? { opacity: 0.92 } : { scale: 0.96 })}
        transition={prefersReducedMotion ? timings.fast : springs.snappy}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          color: selectedOption ? textColors.text : textColors.muted,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          borderColor: isOpen
            ? colorRamp.accent[400]
            : variantStyles[variant].border
              ? undefined
              : "transparent",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown open={isOpen} />
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={prefersReducedMotion ? timings.fast : springs.snappy}
            style={dropdownStyles}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) handleSelect(option.value)
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                style={{
                  ...optionStyles,
                  background:
                    focusedIndex === index
                      ? colorRamp.accent[50]
                      : option.value === value
                        ? colorRamp.accent[50]
                        : "transparent",
                  opacity: option.disabled ? 0.4 : 1,
                  cursor: option.disabled ? "not-allowed" : "pointer",
                }}
              >
                {option.label}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
