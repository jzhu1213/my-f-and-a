/**
 * SectionHeader — Typography primitive for section headings.
 *
 * Uses the headline tier from Typography_System (24px, weight 600, line-height 1.25,
 * letter-spacing -0.02em). No variants — enforces a single heading treatment
 * across all surfaces (Req 2.8).
 *
 * This component is a plain typed wrapper (no hooks, no motion), so it can be
 * used as a server component.
 *
 * Requirements: 16.1, 16.2, 16.4
 */

import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { typography } from "@/styles/typography"
import { textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"

// ============================================================================
// Types
// ============================================================================

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLHeadingElement>, "children"> {
  /** Heading text content. */
  children?: ReactNode
}

// ============================================================================
// Component
// ============================================================================

/**
 * A section heading at the headline tier (24px, semibold, -0.02em tracking).
 *
 * Renders as an `<h2>` element for semantic structure.
 * All typography values come from the Typography_System — no local overrides.
 */
export const SectionHeader = forwardRef<HTMLHeadingElement, SectionHeaderProps>(
  function SectionHeader({ children, style, ...rest }, ref) {
    const headlineStyle: React.CSSProperties = {
      ...typography.headline,
      color: textColors.text,
      margin: 0,
      paddingBottom: spacingScale["8"],
      ...style,
    }

    return (
      <h2 ref={ref} style={headlineStyle} {...rest}>
        {children}
      </h2>
    )
  }
)
