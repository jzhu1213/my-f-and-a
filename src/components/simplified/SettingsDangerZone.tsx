"use client"

/**
 * SettingsDangerZone — Delete account confirmation UI.
 *
 * Extracted from SettingsScreen to reduce component size (Req 20.5).
 */

import { useState } from "react"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, semanticColors } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"

interface SettingsDangerZoneProps {
  onDeleteAccount: () => void
}

export function SettingsDangerZone({ onDeleteAccount }: SettingsDangerZoneProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  return (
    <div style={{
      marginTop: spacingScale["32"],
      paddingTop: spacingScale["20"],
      borderTop: `1px solid ${elevations.resting.border}`,
    }}>
      <div
        style={{
          paddingLeft: spacingScale["20"],
          paddingRight: spacingScale["16"],
        }}
      >
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              background: "none",
              border: "none",
              ...typography["body-sm"],
              color: semanticColors.error,
              cursor: "pointer",
              padding: `${spacingScale["12"]} 0`,
            }}
            aria-label="Delete account"
          >
            Delete account
          </button>
        ) : (
          <div style={{
            padding: spacingScale["16"],
            borderRadius: radius.control,
            background: elevations.sunken.fill,
            border: `1px solid ${semanticColors.error}`,
          }}>
            <p style={{ ...typography.body, color: semanticColors.error, marginBottom: spacingScale["8"] }}>
              ⚠️ Delete Account
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.text, marginBottom: spacingScale["12"] }}>
              This will permanently delete all your data. This cannot be undone.
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{
                width: "100%",
                padding: spacingScale["8"],
                marginBottom: spacingScale["12"],
                ...typography.body,
                color: textColors.text,
                background: elevations.canvas.fill,
                border: `1px solid ${semanticColors.error}`,
                borderRadius: radius.control,
                outline: "none",
              }}
              aria-label="Type DELETE to confirm"
            />
            <div style={{ display: "flex", gap: spacingScale["8"] }}>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); onDeleteAccount() }}
                disabled={deleteConfirmText !== "DELETE"}
                style={{
                  padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                  borderRadius: radius.control,
                  background: deleteConfirmText === "DELETE" ? semanticColors.error : elevations.sunken.fill,
                  border: "none",
                  color: textColors.text,
                  ...typography["body-sm"],
                  cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",
                  opacity: deleteConfirmText === "DELETE" ? 1 : 0.4,
                }}
                aria-label="Confirm delete account"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                style={{
                  background: "none",
                  border: "none",
                  ...typography["body-sm"],
                  color: textColors.muted,
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Cancel delete"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
