"use client"
import { useToast } from '@/contexts/ToastContext'
import type { Toast as ToastType } from '@/contexts/ToastContext'

export function Toast() {
  const { toasts, removeToast } = useToast()
  if (toasts.length === 0) return null

  const accentColor = (type: ToastType['type']) => {
    switch (type) {
      case 'success': return 'var(--green)'
      case 'error':   return 'var(--red)'
      case 'info':    return 'var(--blue)'
    }
  }

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 pl-3 pr-3 py-3 animate-slide-in-right"
          style={{
            background: 'var(--raised)',
            border: '1px solid var(--line)',
            borderLeft: `2px solid ${accentColor(toast.type)}`,
            borderRadius: '8px',
            minWidth: '200px',
            maxWidth: '280px',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accentColor(toast.type) }} />
          <p className="text-xs flex-1" style={{ color: 'var(--sub)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>{toast.message}</p>

          {toast.action && (
            <button
              onClick={() => { toast.action!.onClick(); removeToast(toast.id) }}
              className="flex-shrink-0 text-xs transition-colors"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text)',
                padding: '3px 8px',
                border: '1px solid var(--line)',
                borderRadius: '8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sub)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
            >
              {toast.action.label}
            </button>
          )}

          {!toast.action && (
            <button
              onClick={() => removeToast(toast.id)}
              style={{ color: 'var(--border)', padding: '2px 4px', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
