"use client"

/**
 * AutomationActivityLog — shows recent automation actions for transparency.
 *
 * Renders a collapsible "Activity" section showing what Folio's automation
 * has done recently and how the user responded. Builds trust by making
 * automation behavior visible and reviewable.
 *
 * Requirements: 23.7
 */

import { useState, useMemo } from "react"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors, semanticColors } from "@/styles/colors"
import { radius } from "@/styles/surfaces"
import {
  getRecentAutomationActivity,
  formatRelativeTime,
  type AutomationLogEntry,
} from "@/lib/automationActivityLog"

// ============================================================================
// Constants
// ============================================================================

const MAX_ENTRIES = 10

// ============================================================================
// Component
// ============================================================================

export function AutomationActivityLog() {
  const [expanded, setExpanded] = useState(false)
  const entries = useMemo(() => getRecentAutomationActivity(MAX_ENTRIES), [])

  const isEmpty = entries.length === 0

  return (
    <section
      aria-labelledby="activity-log-heading"
      style={{ marginBottom: spacingScale["32"] }}
    >
      {/* Section header — clickable to expand/collapse */}
      <button
        type="button"
        id="activity-log-heading"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="activity-log-list"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: `${spacingScale["12"]} 0`,
          cursor: "pointer",
          textAlign: "left",
          borderRadius: "4px",
        }}
      >
        <span
          style={{
            ...typography["body-sm"],
            color: textColors.muted,
            fontWeight: fontWeights.medium,
          }}
        >
          Activity
        </span>
        <span
          style={{
            ...typography["body-sm"],
            color: textColors.muted,
            transition: "transform 0.2s ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Collapsible log list */}
      {expanded && (
        <div
          id="activity-log-list"
          role="list"
          aria-label="Recent automation activity"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacingScale["8"],
            paddingTop: spacingScale["8"],
          }}
        >
          {isEmpty ? (
            <p
              style={{
                ...typography["body-sm"],
                color: textColors.sub,
                margin: 0,
                padding: `${spacingScale["16"]} 0`,
                textAlign: "center",
              }}
            >
              No automation activity yet
            </p>
          ) : (
            entries.map((entry) => (
              <ActivityLogItem key={entry.id} entry={entry} />
            ))
          )}
        </div>
      )}
    </section>
  )
}

// ============================================================================
// Log item
// ============================================================================

interface ActivityLogItemProps {
  entry: AutomationLogEntry
}

function ActivityLogItem({ entry }: ActivityLogItemProps) {
  const relativeTime = formatRelativeTime(entry.timestamp)

  return (
    <div
      role="listitem"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacingScale["2"],
        padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
        borderRadius: radius.min,
        background: "var(--fill-02)",
        borderLeft: `2px solid ${getAccentForType(entry.type)}`,
      }}
    >
      <span
        style={{
          ...typography["body-sm"],
          color: textColors.text,
          lineHeight: 1.4,
        }}
      >
        {entry.message}
      </span>
      <span
        style={{
          ...typography["body-sm"],
          color: textColors.muted,
          fontSize: "0.75rem",
        }}
      >
        {relativeTime}
      </span>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getAccentForType(type: AutomationLogEntry["type"]): string {
  switch (type) {
    case "confirmed":
      return semanticColors.success
    case "edited":
      return semanticColors.accent
    case "dismissed":
      return semanticColors.warning
    case "auto-disabled":
      return semanticColors.error
  }
}
