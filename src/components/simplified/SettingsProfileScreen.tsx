"use client"

/**
 * SettingsProfileScreen — Profile sub-screen for the settings hub-and-spoke.
 *
 * Shows: avatar (with initials fallback), display name, handle, email,
 * an "Edit profile" button (opens ProfileSheet), and a "Sign out" button.
 * Clean and minimal — just the essentials of "who am I in this app."
 *
 * Requirements: 20.3
 */

import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography, FONT_FAMILY } from "@/styles/typography"
import { textColors, semanticColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { SettingsSubScreen } from "./SettingsSubScreen"

// ============================================================================
// Types
// ============================================================================

export interface SettingsProfileScreenProps {
  /** Callback to navigate back to the main settings list. */
  onBack: () => void
  /** User's email address. */
  userEmail?: string
  /** User's display name. */
  displayName?: string
  /** User's avatar URL. */
  avatarUrl?: string
  /** User's handle (without the @ prefix). */
  handle?: string | null
  /** Opens the ProfileSheet for editing. */
  onOpenProfile: () => void
  /** Signs the user out. */
  onSignOut: () => void
  /** Resets onboarding / replays the walkthrough. */
  onResetOnboarding?: () => void
  /** Replays feature demo animations. */
  onReplayDemos?: () => void
  /** Opens the backfill flow for past spending. */
  onOpenBackfill?: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function getInitials(email?: string, displayName?: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return displayName.slice(0, 2).toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return "U"
}

// ============================================================================
// Component
// ============================================================================

export function SettingsProfileScreen({
  onBack,
  userEmail,
  displayName,
  avatarUrl,
  handle,
  onOpenProfile,
  onSignOut,
  onResetOnboarding,
  onReplayDemos,
  onOpenBackfill,
}: SettingsProfileScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const initials = getInitials(userEmail, displayName)

  return (
    <SettingsSubScreen title="Profile" description="Your account and identity." onBack={onBack}>
      {/* Avatar + identity card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacingScale["12"],
          padding: spacingScale["24"],
          background: elevations.resting.fill,
          border: `1px solid ${elevations.resting.border}`,
          borderRadius: radius.control,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${colorRamp.accent[100]}, ${colorRamp.accent[200]})`,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile avatar"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              style={{
                ...typography.headline,
                color: textColors.text,
              }}
            >
              {initials}
            </span>
          )}
        </div>

        {/* Display name */}
        <p
          style={{
            ...typography.subhead,
            color: textColors.text,
            margin: 0,
            textAlign: "center",
          }}
        >
          {displayName || userEmail?.split("@")[0] || "Guest"}
        </p>

        {/* Handle */}
        {handle && (
          <p
            style={{
              ...typography["body-sm"],
              color: semanticColors.accent,
              margin: 0,
            }}
          >
            @{handle}
          </p>
        )}

        {/* Email */}
        <p
          style={{
            ...typography["body-sm"],
            color: textColors.muted,
            margin: 0,
            textAlign: "center",
            wordBreak: "break-all",
          }}
        >
          {userEmail || "Not signed in"}
        </p>
      </div>

      {/* Edit profile button */}
      <motion.button
        type="button"
        onClick={onOpenProfile}
        whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
        transition={springs.snappy}
        aria-label="Edit profile"
        style={{
          width: "100%",
          height: 48,
          marginTop: spacingScale["20"],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacingScale["8"],
          background: colorRamp.accent[50],
          border: `1px solid ${colorRamp.accent[300]}`,
          borderRadius: radius.control,
          color: textColors.text,
          ...typography.body,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Edit profile
      </motion.button>

      {/* Help & onboarding section */}
      {(onResetOnboarding || onReplayDemos || onOpenBackfill) && (
        <section
          aria-labelledby="help-onboarding-heading"
          style={{ marginTop: spacingScale["32"] }}
        >
          <h2
            id="help-onboarding-heading"
            style={{
              ...typography["body-sm"],
              color: textColors.muted,
              margin: 0,
              marginBottom: spacingScale["12"],
              fontWeight: 500,
            }}
          >
            Help & onboarding
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
            {onResetOnboarding && (
              <button
                type="button"
                onClick={onResetOnboarding}
                aria-label="Replay walkthrough"
                style={{
                  background: "none",
                  border: "none",
                  ...typography["body-sm"],
                  color: textColors.muted,
                  cursor: "pointer",
                  padding: `${spacingScale["8"]} 0`,
                  textAlign: "left",
                }}
              >
                Replay walkthrough
              </button>
            )}
            {onReplayDemos && (
              <button
                type="button"
                onClick={onReplayDemos}
                aria-label="Replay feature demos"
                style={{
                  background: "none",
                  border: "none",
                  ...typography["body-sm"],
                  color: textColors.muted,
                  cursor: "pointer",
                  padding: `${spacingScale["8"]} 0`,
                  textAlign: "left",
                }}
              >
                Replay feature demos
              </button>
            )}
            {onOpenBackfill && (
              <button
                type="button"
                onClick={onOpenBackfill}
                aria-label="Catch up on past spending"
                style={{
                  background: "none",
                  border: "none",
                  ...typography["body-sm"],
                  color: textColors.muted,
                  cursor: "pointer",
                  padding: `${spacingScale["8"]} 0`,
                  textAlign: "left",
                }}
              >
                Catch up on past spending
              </button>
            )}
          </div>
        </section>
      )}

      {/* Sign out button */}
      <motion.button
        type="button"
        onClick={onSignOut}
        whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
        transition={springs.snappy}
        aria-label="Sign out"
        style={{
          width: "100%",
          height: 48,
          marginTop: spacingScale["32"],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: `1px solid ${semanticColors.error}`,
          borderRadius: radius.control,
          color: semanticColors.error,
          ...typography.body,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Sign out
      </motion.button>
    </SettingsSubScreen>
  )
}
