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
          className="pointer-events-auto flex items-center gap-3 pl-3 pr-4 py-3 cursor-pointer animate-slide-in-right"
          style={{
            background: 'var(--raised)',
            border: '1px solid var(--line)',
            borderLeft: `2px solid ${accentColor(toast.type)}`,
            borderRadius: '3px',
            minWidth: '200px',
          }}
          onClick={() => removeToast(toast.id)}
        >
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accentColor(toast.type) }} />
          <p className="text-xs font-mono" style={{ color: 'var(--sub)' }}>{toast.message}</p>
        </div>
      ))}
    </div>
  )
}
