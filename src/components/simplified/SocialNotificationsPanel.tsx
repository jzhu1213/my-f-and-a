"use client"

import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"
import { useSocialNotifications } from "@/hooks/useSocialNotifications"
import type { SocialNotification, NotificationType } from "@/lib/social/notifications"

// ============================================================================
// Copy & Icons per notification type
// ============================================================================

interface NotificationMeta {
  emoji: string
  label: string
  formatBody: (payload: Record<string, unknown>) => string
}

const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  friend_request: {
    emoji: "👋",
    label: "Friend request",
    formatBody: (p) => {
      const name = (p.actor_name as string) || "Someone"
      return `${name} wants to connect with you`
    },
  },
  friend_accepted: {
    emoji: "🎉",
    label: "Friend accepted",
    formatBody: (p) => {
      const name = (p.actor_name as string) || "Your friend"
      return `${name} accepted your request — you're connected!`
    },
  },
  split_added: {
    emoji: "💸",
    label: "Added to a split",
    formatBody: (p) => {
      const name = (p.actor_name as string) || "Someone"
      const amount = p.amount ? ` for $${p.amount}` : ""
      return `${name} added you to a split${amount}`
    },
  },
  settle_reminder: {
    emoji: "🔔",
    label: "Friendly nudge",
    formatBody: (p) => {
      const name = (p.actor_name as string) || "Your friend"
      return `${name} sent a gentle reminder to settle up — no rush`
    },
  },
  settle_confirmed: {
    emoji: "✅",
    label: "Settled",
    formatBody: (p) => {
      const name = (p.actor_name as string) || "Your friend"
      return `${name} confirmed the settlement — all square!`
    },
  },
}

// ============================================================================
// Time formatting
// ============================================================================

function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ============================================================================
// NotificationItem
// ============================================================================

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: SocialNotification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const meta = NOTIFICATION_META[notification.type]
  const body = meta.formatBody(notification.payload)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={springs.snappy}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (!notification.read) onMarkRead(notification.id)
        }
      }}
      aria-label={`${meta.label}: ${body}${notification.read ? "" : " (unread)"}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: borderRadius.sm,
        background: notification.read
          ? "transparent"
          : "rgba(167, 139, 250, 0.06)",
        cursor: notification.read ? "default" : "pointer",
        transition: "background 0.2s ease",
        position: "relative",
      }}
    >
      {/* Unread indicator dot */}
      {!notification.read && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 4,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent, rgba(167, 139, 250, 0.8))",
          }}
          aria-hidden="true"
        />
      )}

      {/* Emoji */}
      <span
        style={{ fontSize: 18, lineHeight: 1.3, marginLeft: notification.read ? 0 : 8 }}
        aria-hidden="true"
      >
        {meta.emoji}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            fontWeight: notification.read ? 400 : 500,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {body}
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--muted)",
            fontFamily: FONT_FAMILY,
            marginTop: 2,
            margin: 0,
          }}
        >
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Delete button */}
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notification.id)
        }}
        whileTap={{ scale: 0.9 }}
        transition={springs.snappy}
        aria-label="Remove notification"
        style={{
          background: "none",
          border: "none",
          padding: 4,
          cursor: "pointer",
          color: "var(--muted)",
          fontSize: 14,
          lineHeight: 1,
          opacity: 0.6,
          flexShrink: 0,
        }}
      >
        ✕
      </motion.button>
    </motion.div>
  )
}

// ============================================================================
// SocialNotificationsPanel
// ============================================================================

/**
 * SocialNotificationsPanel — displays recent social notifications from the
 * `notifications` table (friend requests, split added, settle reminders, etc.).
 *
 * Designed to be embedded in the NotificationCenter settings screen as a
 * new "Social activity" section.
 *
 * Requirements: task 286.2
 */
export function SocialNotificationsPanel() {
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    deleteNotification,
  } = useSocialNotifications()

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!loading && notifications.length === 0) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            fontFamily: FONT_FAMILY,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          All caught up — nothing new here ✨
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header with unread count and mark-all-read */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {unreadCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 9,
                background: "rgba(167, 139, 250, 0.25)",
                color: "var(--accent, rgba(167, 139, 250, 1))",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
              }}
              aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <motion.button
            type="button"
            onClick={markAllRead}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              color: "var(--accent, rgba(167, 139, 250, 0.9))",
              fontSize: 12,
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
            }}
            aria-label="Mark all notifications as read"
          >
            Mark all read
          </motion.button>
        )}
      </div>

      {/* Loading state */}
      {loading && notifications.length === 0 && (
        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontFamily: FONT_FAMILY,
            textAlign: "center",
            padding: "8px 0",
          }}
        >
          Loading…
        </p>
      )}

      {/* Notification list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <AnimatePresence mode="popLayout">
          {notifications.slice(0, 10).map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={markRead}
              onDelete={deleteNotification}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
