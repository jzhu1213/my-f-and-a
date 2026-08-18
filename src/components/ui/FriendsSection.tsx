"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { GlassCard } from './GlassCard'
import { FONT_FAMILY } from '@/styles/typography'
import {
  listFriends,
  listPendingRequests,
  listOutgoingRequests,
  searchByHandle,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  getOptimisticRequests,
  type Friendship,
  type OptimisticFriendRequest,
  FRIEND_ERRORS,
} from '@/lib/social/friends'
import type { PublicProfile } from '@/lib/social/profiles'

// ============================================================================
// Props
// ============================================================================

interface FriendsSectionProps {
  userId?: string
}

// ============================================================================
// Styles
// ============================================================================

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  padding: '12px 0',
  background: 'transparent',
  border: 'none',
  width: '100%',
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 20,
  padding: '0 6px',
  borderRadius: 10,
  background: 'rgba(167, 139, 250, 0.2)',
  color: 'var(--accent, #a78bfa)',
  fontSize: 11,
  fontFamily: FONT_FAMILY,
  fontWeight: 600,
}

const friendRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
}

const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONT_FAMILY,
  background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(251, 146, 60, 0.15))',
  color: 'var(--text)',
  flexShrink: 0,
}

const smallButtonStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: FONT_FAMILY,
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  border: 'none',
  transition: 'opacity 0.15s',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  fontWeight: 400,
  color: 'var(--text)',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  outline: 'none',
}

// ============================================================================
// Helper components
// ============================================================================

function UserAvatar({ displayName, avatarUrl }: { displayName?: string | null; avatarUrl?: string | null }) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??'
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || 'User'}
        style={{ ...avatarStyle, objectFit: 'cover' as const }}
      />
    )
  }
  return <div style={avatarStyle}>{initials}</div>
}

// ============================================================================
// Main Component
// ============================================================================

export function FriendsSection({ userId }: FriendsSectionProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isExpanded, setIsExpanded] = useState(false)
  const [friends, setFriends] = useState<Friendship[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<Friendship[]>([])
  const [optimisticRequests, setOptimisticRequests] = useState<OptimisticFriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalCount = friends.length + pendingRequests.length

  // Fetch data on mount / expand
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [friendsData, pendingData, outgoingData] = await Promise.all([
        listFriends(),
        listPendingRequests(),
        listOutgoingRequests(),
      ])
      setFriends(friendsData)
      setPendingRequests(pendingData)
      setOutgoingRequests(outgoingData)
      setOptimisticRequests(getOptimisticRequests())
    } catch {
      // Silent fail — data will show as empty
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isExpanded) {
      fetchData()
    }
  }, [isExpanded, fetchData])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchByHandle(searchQuery.trim())
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  // Action handlers
  const handleSendRequest = async (addresseeId: string) => {
    const result = await sendFriendRequest(addresseeId)
    if (result) {
      setActionMessage('Friend request sent!')
      setSearchQuery('')
      setSearchResults([])
      fetchData()
    } else {
      setActionMessage(FRIEND_ERRORS.unknown)
    }
    setTimeout(() => setActionMessage(null), 3000)
  }

  const handleRespond = async (friendshipId: string, response: 'accepted' | 'declined') => {
    const result = await respondToRequest(friendshipId, response)
    if (result) {
      setActionMessage(response === 'accepted' ? 'Friend added! 🎉' : 'No worries — declined.')
      fetchData()
    } else {
      setActionMessage(FRIEND_ERRORS.unknown)
    }
    setTimeout(() => setActionMessage(null), 3000)
  }

  const handleRemove = async (friendshipId: string) => {
    if (confirmRemoveId !== friendshipId) {
      setConfirmRemoveId(friendshipId)
      // Auto-reset after 4s so it doesn't get stuck
      setTimeout(() => setConfirmRemoveId((prev) => prev === friendshipId ? null : prev), 4000)
      return
    }
    setConfirmRemoveId(null)
    const success = await removeFriend(friendshipId)
    if (success) {
      setActionMessage('Connection removed.')
      fetchData()
    } else {
      setActionMessage(FRIEND_ERRORS.unknown)
    }
    setTimeout(() => setActionMessage(null), 3000)
  }

  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/invite?from=${userId}`
    navigator.clipboard.writeText(link).then(() => {
      setActionMessage('Invite link copied!')
      setTimeout(() => setActionMessage(null), 3000)
    }).catch(() => {
      setActionMessage('Could not copy link.')
      setTimeout(() => setActionMessage(null), 3000)
    })
  }

  const isEmpty = friends.length === 0 && pendingRequests.length === 0 && outgoingRequests.length === 0

  // Don't render if not signed in
  if (!userId) return null

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Section toggle header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`Friends section, ${totalCount} total. ${isExpanded ? 'Collapse' : 'Expand'}`}
        style={sectionHeaderStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 15,
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              color: 'var(--text)',
            }}
          >
            Friends
          </span>
          {totalCount > 0 && <span style={badgeStyle}>{totalCount}</span>}
          {pendingRequests.length > 0 && (
            <span
              style={{
                ...badgeStyle,
                background: 'rgba(251, 191, 36, 0.2)',
                color: 'var(--warning, #fbbf24)',
              }}
            >
              {pendingRequests.length} new
            </span>
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={springs.gentle}
            style={{ overflow: 'hidden' }}
          >
            <GlassCard elevation="low" style={{ padding: 16, marginBottom: 12 }}>
              {/* Loading state */}
              {isLoading && (
                <p
                  style={{
                    fontSize: 13,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--muted)',
                    textAlign: 'center',
                    padding: '12px 0',
                  }}
                >
                  Loading...
                </p>
              )}

              {/* Action message toast */}
              {actionMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    fontSize: 12,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 500,
                    color: 'var(--accent, #a78bfa)',
                    background: 'rgba(167, 139, 250, 0.08)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 12,
                    textAlign: 'center',
                  }}
                >
                  {actionMessage}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && isEmpty && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px 12px',
                  }}
                >
                  <p
                    style={{
                      fontSize: 32,
                      marginBottom: 8,
                    }}
                    aria-hidden="true"
                  >
                    👋
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--text)',
                      marginBottom: 4,
                    }}
                  >
                    Add a friend to split costs together
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      color: 'var(--muted)',
                    }}
                  >
                    Search by handle or share your invite link
                  </p>
                </div>
              )}

              {/* Incoming requests */}
              {!isLoading && pendingRequests.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Incoming requests
                  </p>
                  {pendingRequests.map((req) => (
                    <div key={req.id} style={friendRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar />
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: FONT_FAMILY,
                            color: 'var(--text)',
                          }}
                        >
                          {req.requesterId.slice(0, 8)}…
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <motion.button
                          onClick={() => handleRespond(req.id, 'accepted')}
                          whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
                          transition={springs.snappy}
                          aria-label="Accept friend request"
                          style={{
                            ...smallButtonStyle,
                            background: 'rgba(167, 139, 250, 0.15)',
                            color: 'var(--accent, #a78bfa)',
                          }}
                        >
                          Accept
                        </motion.button>
                        <motion.button
                          onClick={() => handleRespond(req.id, 'declined')}
                          whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
                          transition={springs.snappy}
                          aria-label="Decline friend request"
                          style={{
                            ...smallButtonStyle,
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--muted)',
                          }}
                        >
                          Decline
                        </motion.button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Outgoing requests */}
              {!isLoading && outgoingRequests.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Sent requests
                  </p>
                  {outgoingRequests.map((req) => (
                    <div key={req.id} style={friendRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar />
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: FONT_FAMILY,
                            color: 'var(--text)',
                          }}
                        >
                          {req.addresseeId.slice(0, 8)}…
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          fontStyle: 'italic',
                          color: 'var(--dim)',
                        }}
                      >
                        Waiting…
                      </span>
                    </div>
                  ))}
                  {/* Optimistic requests */}
                  {optimisticRequests.map((req) => (
                    <div key={req.id} style={friendRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar />
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: FONT_FAMILY,
                            color: 'var(--text)',
                          }}
                        >
                          {req.addresseeId.slice(0, 8)}…
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          fontStyle: 'italic',
                          color: req.status === 'failed' ? 'var(--error, #f87171)' : 'var(--dim)',
                        }}
                      >
                        {req.status === 'failed' ? 'Failed — will retry' : 'Sending…'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Accepted friends */}
              {!isLoading && friends.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Your friends
                  </p>
                  {friends.map((friend) => {
                    const otherId = friend.requesterId === userId ? friend.addresseeId : friend.requesterId
                    return (
                      <div key={friend.id} style={friendRowStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar />
                          <span
                            style={{
                              fontSize: 13,
                              fontFamily: FONT_FAMILY,
                              color: 'var(--text)',
                            }}
                          >
                            {otherId.slice(0, 8)}…
                          </span>
                        </div>
                        <motion.button
                          onClick={() => handleRemove(friend.id)}
                          whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
                          transition={springs.snappy}
                          aria-label={confirmRemoveId === friend.id ? "Confirm remove friend" : "Remove friend"}
                          style={{
                            ...smallButtonStyle,
                            background: confirmRemoveId === friend.id ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            color: confirmRemoveId === friend.id ? 'var(--error)' : 'var(--muted)',
                          }}
                        >
                          {confirmRemoveId === friend.id ? 'Confirm?' : 'Remove'}
                        </motion.button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add a friend — search */}
              {!isLoading && (
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Add a friend
                  </p>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by handle..."
                    aria-label="Search for a friend by handle"
                    className="focus-ring"
                    style={inputStyle}
                  />

                  {/* Search results */}
                  {isSearching && (
                    <p
                      style={{
                        fontSize: 12,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--dim)',
                        marginTop: 8,
                      }}
                    >
                      Searching…
                    </p>
                  )}
                  {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--muted)',
                        marginTop: 8,
                      }}
                    >
                      No one found — try a different handle or share your invite link
                    </p>
                  )}
                  {searchResults.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {searchResults.map((profile) => (
                        <div key={profile.id} style={friendRowStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <UserAvatar
                              displayName={profile.displayName}
                              avatarUrl={profile.avatarUrl}
                            />
                            <div>
                              <p
                                style={{
                                  fontSize: 13,
                                  fontFamily: FONT_FAMILY,
                                  fontWeight: 500,
                                  color: 'var(--text)',
                                }}
                              >
                                {profile.displayName || profile.handle}
                              </p>
                              <p
                                style={{
                                  fontSize: 11,
                                  fontFamily: FONT_FAMILY,
                                  color: 'var(--accent, #a78bfa)',
                                }}
                              >
                                @{profile.handle}
                              </p>
                            </div>
                          </div>
                          <motion.button
                            onClick={() => handleSendRequest(profile.id)}
                            whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
                            transition={springs.snappy}
                            aria-label={`Send friend request to ${profile.displayName || profile.handle}`}
                            style={{
                              ...smallButtonStyle,
                              background: 'rgba(167, 139, 250, 0.15)',
                              color: 'var(--accent, #a78bfa)',
                            }}
                          >
                            Add
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Invite link button */}
                  <motion.button
                    onClick={handleCopyInviteLink}
                    whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                    transition={springs.snappy}
                    aria-label="Copy invite link to clipboard"
                    style={{
                      width: '100%',
                      marginTop: 12,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--muted)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Copy invite link
                  </motion.button>
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
