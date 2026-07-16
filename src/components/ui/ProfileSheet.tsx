"use client"
import { signOut } from '@/lib/supabaseData'

interface ProfileSheetProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
  onSignOut: () => void
}

export function ProfileSheet({ isOpen, onClose, userEmail, onSignOut }: ProfileSheetProps) {
  const handleSignOut = async () => {
    await signOut()
    onSignOut()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.80)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet ${isOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>
            Account
          </span>
          <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-8 space-y-6">
          {/* User info */}
          <div
            className="flex items-center gap-4 py-5 px-5"
            style={{ background: 'var(--raised)', borderRadius: '6px', border: '1px solid var(--border)' }}
          >
            {/* Avatar placeholder */}
            <div
              className="w-11 h-11 flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--dim)', borderRadius: '50%' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--sub)' }}>
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
              </svg>
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: '15px', color: 'var(--text)' }} className="truncate">
                {userEmail ?? 'Guest'}
              </p>
              <p className="label mt-1">{userEmail ? 'signed in' : 'not signed in'}</p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border)' }} />

          {/* Sign out */}
          {userEmail ? (
            <button
              onClick={handleSignOut}
              className="w-full btn-ghost"
              style={{ color: 'var(--red)', borderColor: 'var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              Sign Out
            </button>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
              Sign in to sync data across devices
            </p>
          )}

          {/* App info */}
          <p className="label" style={{ textAlign: 'center', color: 'var(--dim)', paddingTop: '8px' }}>
            folio · personal finance
          </p>
        </div>
      </div>
    </>
  )
}
