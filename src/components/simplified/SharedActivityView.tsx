"use client"

/**
 * SharedActivityView — A calm, informational list of recent shared events.
 *
 * Shows the last few shared events (splits added, settled, friends joined) as a
 * quiet, dismissible section. Designed for progressive disclosure inside
 * ToolsScreen — never the home screen, never a paginated feed.
 *
 * Data comes from the notifications library, filtered to social event types.
 * Dismissal is persisted in localStorage so the user can hide it.
 *
 * Requirements: new (optional), 14.4
 */

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { SectionHeader, Card } from "@/components/ui"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { radius } from "@/styles/surfaces"
import {
  fetchNotifications,
  type SocialNotification,
  type NotificationType,
} from "@/lib/social/notifications"

// ============================================================================
// Constants
// ============================================================================

const DISMISS_KEY = "folio-shared-activity-dismissed"
const MAX_EVENTS = 6

/** Notification types that count as "shared activity" */
const ACTIVITY_TYPES: NotificationType[] = [
  "split_added",
  "settle_confirmed",
  "friend_accepted",
]

// ============================================================================
// Types
// ============================================================================

interface ActivityEvent {
  id: string
  type: NotificationType
  description: string
  emoji: string
  relativeTime: string
  createdAt: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Get a friendly emoji for each event type */
function getEventEmoji(type: NotificationType): string {
  switch (type) {
    case "split_added":
      return "💸"
    case "settle_confirmed":
      return "✅"
    case "friend_accepted":
      return "🤝"
    default:
      return "📋"
  }
}

/** Generate a warm, brief description for each event type */
function getEventDescription(notification: SocialNotification): string {
  const payload = notification.payload
  const name = (payload?.actorName as string) || "Someone"

  switch (notification.type) {
    case "split_added": {
      const amount = payload?.amount as number | undefined
      if (amount) {
        return `${name} added a split for $${amount.toFixed(2)}`
      }
      return `${name} added a new split`
    }
    case "settle_confirmed":
      return `${name} settled up with you`
    case "friend_accepted":
      return `${name} joined as a friend`
    default:
      return "Something happened"
  }
}

/** Convert a date string to a friendly relative time */
function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(diffMs / 86_400_000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Check if the view was dismissed by the user */
function isDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(DISMISS_KEY) === "true"
  } catch {
    return false
  }
}

/** Persist dismissal state */
function setDismissed(value: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (value) {
      localStorage.setItem(DISMISS_KEY, "true")
    } else {
      localStorage.removeItem(DISMISS_KEY)
    }
  } catch {
    // localStorage unavailable — silent fail
  }
}

// ============================================================================
// SharedActivityView Component
// ============================================================================

export function SharedActivityView() {
  const { prefersReducedMotion } = useReducedMotion()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissedState] = useState(false)

  // Check dismiss state on mount
  useEffect(() => {
    setDismissedState(isDismissed())
  }, [])

  // Fetch notifications on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const notifications = await fetchNotifications(30)

        if (cancelled) return

        const activityNotifications = notifications
          .filter((n) => ACTIVITY_TYPES.includes(n.type))
          .slice(0, MAX_EVENTS)

        const mapped: ActivityEvent[] = activityNotifications.map((n) => ({
          id: n.id,
          type: n.type,
          description: getEventDescription(n),
          emoji: getEventEmoji(n.type),
          relativeTime: getRelativeTime(n.createdAt),
          createdAt: n.createdAt,
        }))

        setEvents(mapped)
      } catch {
        // Graceful failure — just show empty
        setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissedState(true)
    setDismissed(true)
  }, [])

  // Don't render if dismissed, loading, or no events
  if (dismissed) return null
  if (loading) return null
  if (events.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ marginBottom: spacingScale["32"] }}
      >
        {/* Section header with dismiss button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacingScale["12"],
          }}
        >
          <SectionHeader>Shared Activity</SectionHeader>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss shared activity section"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: radius.full,
              border: "none",
              background: colorRamp.accent[50],
              color: textColors.muted,
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.15s ease",
              fontSize: "16px",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = String(colorRamp.accent[100])
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = String(colorRamp.accent[50])
            }}
          >
            ×
          </button>
        </div>

        {/* Event list */}
        <Card
          style={{
            padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
            display: "flex",
            flexDirection: "column",
            gap: spacingScale["8"],
          }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacingScale["12"],
                minHeight: 40,
              }}
              role="listitem"
              aria-label={`${event.description}, ${event.relativeTime}`}
            >
              {/* Emoji icon */}
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: spacingScale["32"],
                  height: spacingScale["32"],
                  flexShrink: 0,
                  borderRadius: radius.control,
                  background: colorRamp.accent[50],
                  fontSize: "14px",
                }}
              >
                {event.emoji}
              </span>

              {/* Description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    ...typography["body-sm"],
                    color: textColors.text,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {event.description}
                </p>
              </div>

              {/* Relative time */}
              <span
                style={{
                  ...typography.caption,
                  color: textColors.muted,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {event.relativeTime}
              </span>
            </div>
          ))}
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
