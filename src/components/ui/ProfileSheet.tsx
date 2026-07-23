"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { signOut, updateProfilePreferences } from '@/lib/supabaseData'
import { GlassCard } from './GlassCard'

interface ProfileSheetProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
  displayName?: string
  avatarUrl?: string
  userId?: string
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
  avatarUrl,
  userId,
  onSignOut,
  onProfileUpdate,
}: ProfileSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(initialDisplayName || '')
  const [isSaving, setIsSaving] = useState(false)

  // Update local state when props change
  useEffect(() => {
    setDisplayName(initialDisplayName || '')
  }, [initialDisplayName])

  const handleSignOut = async () => {
    await signOut()
    onSignOut()
    onClose()
  }

  const handleSave = async () => {
    if (!userId) return
    
    setIsSaving(true)
    const result = await updateProfilePreferences(userId, {
      displayName: displayName.trim() || undefined,
    })
    setIsSaving(false)

    if (result) {
      setIsEditing(false)
      onProfileUpdate?.()
    }
  }

  const handleCancel = () => {
    setDisplayName(initialDisplayName || '')
    setIsEditing(false)
  }

  // Sheet animation variants matching ExpenseSheet/IncomeSheet
  const sheetVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        hidden: { y: '100%' },
        visible: { y: 0, transition: springs.gentle },
        exit: { y: '100%', transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const } },
      }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  }

  const initials = getInitials(userEmail, initialDisplayName)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="profile-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0, 0, 0, 0.6)',
            }}
          />

          {/* Sheet */}
          <motion.div
            key="profile-sheet"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              insetInline: 0,
              bottom: 0,
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              borderTop: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div className="sheet-handle" />

            <div style={{ padding: '0 24px 32px' }}>
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 24,
                }}
              >
                <h2
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  Account
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    color: 'var(--muted)',
                    padding: 4,
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
                  gap: 16,
                  padding: 20,
                  marginBottom: 20,
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
                    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(217, 70, 239, 0.15))',
                    borderRadius: '50%',
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    color: 'var(--text)',
                  }}
                >
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="Profile" 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        autoFocus
                        style={{
                          width: '100%',
                          fontSize: 15,
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          color: 'var(--text)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          marginBottom: 6,
                          outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <motion.button
                          onClick={handleSave}
                          disabled={isSaving}
                          whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                          transition={springs.snappy}
                          style={{
                            fontSize: 12,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            color: 'var(--text)',
                            background: 'rgba(251, 146, 60, 0.15)',
                            border: '1px solid rgba(251, 146, 60, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '4px 12px',
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
                            fontSize: 12,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            color: 'var(--muted)',
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '4px 12px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p
                        style={{
                          fontSize: 15,
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {initialDisplayName || userEmail?.split('@')[0] || 'Guest'}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 400,
                          color: 'var(--muted)',
                          marginTop: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {userEmail || 'Not signed in'}
                      </p>
                    </>
                  )}
                </div>
              </GlassCard>

              {/* Edit display name button */}
              {userEmail && !isEditing && (
                <motion.button
                  onClick={() => setIsEditing(true)}
                  whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                  transition={springs.bouncy}
                  aria-label="Edit display name"
                  style={{
                    width: '100%',
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    marginBottom: 12,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                  }}
                >
                  Edit display name
                </motion.button>
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
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 15,
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--error)'
                    e.currentTarget.style.background = 'rgba(248, 113, 113, 0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.3)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  Sign Out
                </motion.button>
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
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
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  textAlign: 'center',
                  color: 'var(--dim)',
                  marginTop: 24,
                }}
              >
                folio · personal finance
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
