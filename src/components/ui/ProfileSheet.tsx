"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { BottomSheet } from './BottomSheet'
import { signOut, updateProfilePreferences } from '@/lib/supabaseData'
import { GlassCard } from './GlassCard'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { HORIZONTAL_PADDING, shadows } from '@/styles/shared'
import { radius } from '@/styles/surfaces'
import { validateHandle, normalizeHandle, HANDLE_ERRORS } from '@/lib/social/handles'
import { FriendsSection } from './FriendsSection'

interface ProfileSheetProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
  displayName?: string
  avatarUrl?: string
  userId?: string
  handle?: string | null
  discoverable?: boolean
  onSignOut: () => void
  onProfileUpdate?: () => void
}

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
  return 'U'
}

export function ProfileSheet({ 
  isOpen, 
  onClose, 
  userEmail, 
  displayName: initialDisplayName,
  avatarUrl: initialAvatarUrl,
  userId,
  handle: initialHandle,
  discoverable: initialDiscoverable = false,
  onSignOut,
  onProfileUpdate,
}: ProfileSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(initialDisplayName || '')
  const [avatarUrlInput, setAvatarUrlInput] = useState(initialAvatarUrl || '')
  const [handleInput, setHandleInput] = useState(initialHandle || '')
  const [discoverable, setDiscoverable] = useState(initialDiscoverable)
  const [handleError, setHandleError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Update local state when props change
  useEffect(() => {
    setDisplayName(initialDisplayName || '')
  }, [initialDisplayName])

  useEffect(() => {
    setAvatarUrlInput(initialAvatarUrl || '')
  }, [initialAvatarUrl])

  useEffect(() => {
    setHandleInput(initialHandle || '')
  }, [initialHandle])

  useEffect(() => {
    setDiscoverable(initialDiscoverable)
  }, [initialDiscoverable])

  const handleSignOut = async () => {
    await signOut()
    onSignOut()
    onClose()
  }

  const handleHandleChange = (value: string) => {
    const normalized = normalizeHandle(value)
    setHandleInput(normalized)
    if (normalized.length === 0) {
      setHandleError(null)
      return
    }
    const result = validateHandle(normalized)
    setHandleError(result.valid ? null : result.error || null)
  }

  const handleSave = async () => {
    if (!userId) return

    // Validate handle before saving
    if (handleInput.length > 0) {
      const result = validateHandle(handleInput)
      if (!result.valid) {
        setHandleError(result.error || null)
        return
      }
    }
    
    setIsSaving(true)
    const result = await updateProfilePreferences(userId, {
      displayName: displayName.trim() || undefined,
      avatarUrl: avatarUrlInput.trim() || undefined,
      handle: handleInput.trim() || null,
      discoverable,
    })
    setIsSaving(false)

    if (result) {
      setIsEditing(false)
      setHandleError(null)
      onProfileUpdate?.()
    } else {
      // Check if it's likely a handle uniqueness conflict
      setHandleError(HANDLE_ERRORS.collision)
    }
  }

  const handleCancel = () => {
    setDisplayName(initialDisplayName || '')
    setAvatarUrlInput(initialAvatarUrl || '')
    setHandleInput(initialHandle || '')
    setDiscoverable(initialDiscoverable)
    setHandleError(null)
    setIsEditing(false)
  }

  const initials = getInitials(userEmail, initialDisplayName)
  const currentAvatarUrl = isEditing ? avatarUrlInput : (initialAvatarUrl || '')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: typography.body.fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: fontWeights.regular,
    color: 'var(--text)',
    background: 'var(--fill-05)',
    border: '1px solid var(--fill-10)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: typography['body-sm'].fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: fontWeights.medium,
    color: 'var(--muted)',
    marginBottom: spacing.xxs,
    display: 'block',
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} ariaLabel="Account">
      <div style={{ padding: `0 ${spacing.lg}px ${spacing.xl}px` }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.lg,
          }}
        >
          <h2
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: typography.subhead.fontSize,
              fontWeight: fontWeights.semibold,
              color: 'var(--text)',
            }}
          >
            Your Profile
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              color: 'var(--muted)',
              padding: spacing.xxs,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info card with GlassCard */}
        <GlassCard
          elevation="low"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
            padding: HORIZONTAL_PADDING,
            marginBottom: HORIZONTAL_PADDING,
          }}
        >
          {/* Avatar with initials */}
          <div
            style={{
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'linear-gradient(135deg, var(--warning-200), var(--accent-200))',
              borderRadius: '50%',
              fontSize: typography.subhead.fontSize,
              fontWeight: fontWeights.semibold,
              fontFamily: FONT_FAMILY,
              color: 'var(--text)',
            }}
          >
            {currentAvatarUrl ? (
              <img 
                src={currentAvatarUrl} 
                alt="Profile" 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: typography.body.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {initialDisplayName || userEmail?.split('@')[0] || 'Guest'}
            </p>
            {initialHandle && (
              <p
                style={{
                  fontSize: typography['body-sm'].fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.regular,
                  color: 'var(--accent)',
                  marginTop: 2,
                }}
              >
                @{initialHandle}
              </p>
            )}
            <p
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.regular,
                color: 'var(--muted)',
                marginTop: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userEmail || 'Not signed in'}
            </p>
          </div>
        </GlassCard>

        {/* Editing form */}
        {isEditing && userEmail && (
          <GlassCard
            elevation="low"
            style={{
              padding: HORIZONTAL_PADDING,
              marginBottom: HORIZONTAL_PADDING,
            }}
          >
            {/* Display Name */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={labelStyle}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you'd like to be called"
                className="focus-ring"
                style={inputStyle}
              />
            </div>

            {/* Handle */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={labelStyle}>Handle</label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: typography.body.fontSize,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--muted)',
                    pointerEvents: 'none',
                  }}
                >
                  @
                </span>
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => handleHandleChange(e.target.value)}
                  placeholder="yourhandle"
                  className="focus-ring"
                  style={{
                    ...inputStyle,
                    paddingLeft: 28,
                    borderColor: handleError ? 'var(--error-400)' : 'var(--fill-10)',
                  }}
                />
              </div>
              {handleError && (
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--error)',
                    marginTop: 4,
                  }}
                >
                  {handleError}
                </p>
              )}
              <p
                style={{
                  fontSize: typography.caption.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--dim)',
                  marginTop: 4,
                }}
              >
                3–20 characters, lowercase letters, numbers, underscores
              </p>
            </div>

            {/* Avatar URL */}
            <div style={{ marginBottom: HORIZONTAL_PADDING }}>
              <label style={labelStyle}>Avatar URL</label>
              <input
                type="url"
                value={avatarUrlInput}
                onChange={(e) => setAvatarUrlInput(e.target.value)}
                placeholder="https://example.com/your-photo.jpg"
                className="focus-ring"
                style={inputStyle}
              />
              <p
                style={{
                  fontSize: typography.caption.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--dim)',
                  marginTop: 4,
                }}
              >
                Link to a profile picture (optional)
              </p>
            </div>

            {/* Discoverable toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: spacing.sm,
                padding: `${spacing.sm}px 0`,
                borderTop: '1px solid var(--fill-06)',
              }}
            >
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.medium,
                    color: 'var(--text)',
                    marginBottom: 4,
                  }}
                >
                  Discoverable
                </p>
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--muted)',
                    lineHeight: 1.4,
                  }}
                >
                  When on, friends can find you by your handle. Your other data stays private.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={discoverable}
                aria-label="Toggle discoverability"
                onClick={() => setDiscoverable(!discoverable)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: radius.control,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: 2,
                  background: discoverable
                    ? 'var(--accent-400)'
                    : 'var(--fill-12)',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: discoverable ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--text)',
                    transition: 'left 0.2s',
                    boxShadow: shadows.sm,
                  }}
                />
              </button>
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.md }}>
              <motion.button
                onClick={handleSave}
                disabled={isSaving}
                whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                transition={springs.snappy}
                style={{
                  flex: 1,
                  height: 40,
                  fontSize: typography.body.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.medium,
                  color: 'var(--text)',
                  background: 'var(--accent-200)',
                  border: '1px solid var(--accent-300)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </motion.button>
              <motion.button
                onClick={handleCancel}
                whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                transition={springs.snappy}
                style={{
                  flex: 1,
                  height: 40,
                  fontSize: typography.body.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.medium,
                  color: 'var(--muted)',
                  background: 'transparent',
                  border: '1px solid var(--fill-10)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </motion.button>
            </div>
          </GlassCard>
        )}

        {/* Edit profile button */}
        {userEmail && !isEditing && (
          <motion.button
            onClick={() => setIsEditing(true)}
            whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
            transition={springs.bouncy}
            aria-label="Edit profile"
            style={{
              width: '100%',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--fill-04)',
              color: 'var(--text)',
              fontFamily: FONT_FAMILY,
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--fill-10)',
              cursor: 'pointer',
              marginBottom: spacing.sm,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--fill-06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--fill-04)'
            }}
          >
            Edit profile
          </motion.button>
        )}

        {/* Friends section */}
        {userEmail && !isEditing && (
          <FriendsSection userId={userId} />
        )}

        {/* Sign out button or sign-in prompt */}
        {userEmail ? (
          <motion.button
            onClick={handleSignOut}
            whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
            transition={springs.bouncy}
            aria-label="Sign out"
            style={{
              width: '100%',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: 'var(--error)',
              fontFamily: FONT_FAMILY,
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--error-300)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--error)'
              e.currentTarget.style.background = 'var(--error-100)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--error-300)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Sign Out
          </motion.button>
        ) : (
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: fontWeights.regular,
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            Sign in to sync data across devices
          </p>
        )}

        {/* App info */}
        <p
          style={{
            fontSize: typography.caption.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.regular,
            textAlign: 'center',
            color: 'var(--dim)',
            marginTop: spacing.lg,
          }}
        >
          folio · personal finance
        </p>
      </div>
    </BottomSheet>
  )
}
