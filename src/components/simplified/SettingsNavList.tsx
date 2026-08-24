"use client"

/**
 * SettingsNavList — Renders the grouped navigation rows for the settings hub.
 *
 * Extracted from SettingsScreen to reduce component size (Req 20.5).
 */

import { ListRow } from "@/components/ui"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors } from "@/styles/colors"
import { elevations } from "@/styles/surfaces"
import type { SettingsCategory, NavRowDef } from "./SettingsScreen"

interface SettingsNavListProps {
  rows: NavRowDef[]
  getBadge: (id: SettingsCategory) => string | undefined
  onRowPress: (id: SettingsCategory) => void
  rowRefs: React.MutableRefObject<Map<SettingsCategory, HTMLDivElement | null>>
}

export function SettingsNavList({ rows, getBadge, onRowPress, rowRefs }: SettingsNavListProps) {
  const elements: React.ReactNode[] = []
  let lastGroup: number | null = null

  rows.forEach((row) => {
    // Insert spacing gap between groups (385.1: reduced from 16 to 12 for viewport fit)
    if (lastGroup !== null && row.group !== lastGroup) {
      elements.push(
        <div key={`gap-${row.id}`} style={{ height: spacingScale["12"] }} aria-hidden="true" />
      )
    }
    lastGroup = row.group

    const badge = getBadge(row.id)

    elements.push(
      <div key={row.id} role="listitem">
        <ListRow
          ref={(el: HTMLDivElement | null) => { rowRefs.current.set(row.id, el) }}
          variant="dense"
          onPress={() => onRowPress(row.id)}
          aria-label={`Open ${row.label} settings`}
          style={{
            minHeight: '52px',
            paddingInlineStart: spacingScale["20"],
            paddingInlineEnd: spacingScale["16"],
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
          }}
        >
          {/* Icon */}
          <span
            aria-hidden="true"
            style={{
              fontSize: typography.subhead.fontSize,
              lineHeight: 1,
              width: '28px',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {row.icon}
          </span>

          {/* Label */}
          <span style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span style={{ ...typography.body, color: textColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.label}
            </span>
          </span>

          {/* Badge chip (384.2) */}
          {badge && (
            <span style={{
              ...typography.caption,
              color: textColors.muted,
              background: elevations.sunken.fill,
              borderRadius: '10px',
              padding: `2px ${spacingScale["8"]}`,
              flexShrink: 0,
              lineHeight: 1.4,
            }}>
              {badge}
            </span>
          )}

          {/* Chevron */}
          <span
            aria-hidden="true"
            style={{
              ...typography.body,
              color: textColors.muted,
              flexShrink: 0,
            }}
          >
            ›
          </span>
        </ListRow>
      </div>
    )
  })

  return <>{elements}</>
}
