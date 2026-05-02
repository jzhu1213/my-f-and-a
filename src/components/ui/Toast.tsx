"use client"
import { useToast } from '@/contexts/ToastContext'
import type { Toast as ToastType } from '@/contexts/ToastContext'

export function Toast() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  const dotColor = (type: ToastType['type']) => {
    switch (type) {
      case 'success': return 'var(--green)'
      case 'error':   return 'var(--red)'
      case 'info':    return 'var(--blue)'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 animate-slide-in-right cursor-pointer"
          style={{ background: 'var(--raised)', border: '1px solid var(--line)' }}
          onClick={() => removeToast(toast.id)}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: dotColor(toast.type) }}
          />
          <p className="text-xs font-mono text-t-text">{toast.message}</p>
        </div>
      ))}
    </div>
  )
}
