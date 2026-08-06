"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { useAuth } from "@/contexts/AuthContext"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeadingStrong, borderRadius } from "@/styles/shared"
import {
  describeCurrentDevice,
  formatLastSeen,
  type ActiveSession,
} from "@/lib/sessionManagement"
import {
  registerSession,
  getActiveSessions,
  revokeSession,
  revokeOtherSessions,
  signOutOtherSessions,
} from "@/lib/supabaseData"

// ============================================================================
// SessionsSetting
// ============================================================================

/**
 * SessionsSetting — the "where you're signed in" control (task 192.1).
 *
 * Lives behind Settings → Privacy & security via progressive disclosure. Shows
 * the devices where Folio is open on this account and lets the user revoke
 * access. Two revoke primitives:
 *
 *   • Per-device "Sign out" — removes that device from the list (registry).
 *   • "Sign out all other devices" — the hard guarantee: invalidates every
 *     other device's session token via Supabase auth, current device stays in.
 *
 * Fully additive and backward-compatible: if the sessions table isn't set up on
 * the backend yet, this still shows the current device (synthesized locally) so
 * the surface never looks broken.
 *
 * Warm, shame-free copy; respects prefers-reduced-motion; labelled controls.
 */
export function SessionsSetting() {
  const { user } = useAuth()
  const { prefersReducedMotion } = useReducedMotion()

  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [signingOutOthers, setSigningOutOthers] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Build a locally-synthesized "this device" row as a graceful fallback.
  const buildLocalFallback = useCallback((deviceId: string, label: string): ActiveSession[] => {
    const nowIso = new Date().toISOString()
    return [
      {
        deviceId,
        label,
        createdAt: nowIso,
        lastSeenAt: nowIso,
        isCurrent: true,
      },
    ]
  }, [])

  // Register this device (heartbeat on mount) then load the list.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const device = describeCurrentDevice()
    setCurrentDeviceId(device.deviceId)

    ;(async () => {
      setLoading(true)
      await registerSession(user.id, device)
      const list = await getActiveSessions(user.id, device.deviceId)
      if (cancelled) return
      // Fall back to the current device if the table isn't available yet.
      setSessions(list.length > 0 ? list : buildLocalFallback(device.deviceId, device.label))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, buildLocalFallback])

  // ── Revoke a single device from the list ────────────────────────────────────
  const handleRevoke = useCallback(
    async (deviceId: string) => {
      if (!user?.id || busyId) return
      setBusyId(deviceId)
      setStatus(null)
      const ok = await revokeSession(user.id, deviceId)
      if (ok) {
        setSessions((prev) => prev.filter((s) => s.deviceId !== deviceId))
        setStatus("Signed out that device.")
      } else {
        setStatus("Couldn't sign that device out just now — try again in a moment.")
      }
      setBusyId(null)
    },
    [user?.id, busyId]
  )

  // ── Sign out every other device (hard revoke) ───────────────────────────────
  const handleSignOutOthers = useCallback(async () => {
    if (!user?.id || signingOutOthers) return
    setSigningOutOthers(true)
    setStatus(null)
    const { error } = await signOutOtherSessions()
    if (!error) {
      await revokeOtherSessions(user.id, currentDeviceId)
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      setStatus("Signed out everywhere else. This device stays signed in.")
    } else {
      setStatus("Couldn't sign out the other devices just now — try again in a moment.")
    }
    setSigningOutOthers(false)
  }, [user?.id, currentDeviceId, signingOutOthers])

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginTop: 16 }}>
      <p style={{ ...sectionHeadingStrong }}>Where you&rsquo;re signed in</p>

      <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, marginBottom: 16 }}>
        The devices with Folio open on your account. Sign out any you don&rsquo;t recognise —
        it&rsquo;s always your call.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading your devices…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((session) => (
            <div
              key={session.deviceId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: borderRadius.md,
                background: session.isCurrent
                  ? "rgba(167, 139, 250, 0.1)"
                  : "rgba(255,255,255,0.04)",
                border: session.isCurrent
                  ? "1px solid rgba(167, 139, 250, 0.25)"
                  : "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1.2 }}>
                  {deviceEmoji(session.label)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.label}
                    {session.isCurrent && (
                      <span style={{ color: "var(--sub)", fontWeight: 500 }}> · This device</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {session.isCurrent ? "Active now" : formatLastSeen(session.lastSeenAt)}
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  type="button"
                  onClick={() => void handleRevoke(session.deviceId)}
                  disabled={busyId === session.deviceId}
                  style={{
                    flexShrink: 0,
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--sub)",
                    cursor: busyId === session.deviceId ? "not-allowed" : "pointer",
                    fontFamily: FONT_FAMILY,
                  }}
                  aria-label={`Sign out ${session.label}`}
                >
                  {busyId === session.deviceId ? "Signing out…" : "Sign out"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Bulk sign-out (hard revoke) ─────────────────────────────────────── */}
      {!loading && otherCount > 0 && (
        <motion.button
          type="button"
          onClick={() => void handleSignOutOthers()}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          transition={springs.snappy}
          disabled={signingOutOthers}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "12px 0",
            borderRadius: borderRadius.sm,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--sub)",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            cursor: signingOutOthers ? "not-allowed" : "pointer",
          }}
          aria-label="Sign out all other devices"
        >
          {signingOutOthers ? "Signing out…" : "Sign out all other devices"}
        </motion.button>
      )}

      {status && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontSize: 13, color: "var(--sub)", marginTop: 12, lineHeight: 1.5 }}
        >
          {status}
        </p>
      )}
    </GlassCard>
  )
}

/** Pick a warm glyph for a device label. Pure. */
function deviceEmoji(label: string): string {
  if (/iPhone|Android|Phone/i.test(label)) return "📱"
  if (/iPad|Tablet/i.test(label)) return "📱"
  if (/Mac|Windows|Linux|Chromebook/i.test(label)) return "💻"
  return "🖥️"
}
