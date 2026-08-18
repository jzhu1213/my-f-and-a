"use client"
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  action?: { label: string; onClick: () => void }
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType, action?: Toast['action']) => string
  removeToast: (id: string) => void
  pauseToast: (id: string) => void
  resumeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

/**
 * Internal tracker for a toast's auto-dismiss timer. Supports pause/resume
 * so that hovering or focusing a toast freezes its countdown (Req 27.3).
 */
interface TimerEntry {
  timer: ReturnType<typeof setTimeout>
  /** Timestamp when the timer was last started/resumed. */
  startedAt: number
  /** Remaining ms when paused (null if running). */
  remaining: number
  /** Total duration assigned to this toast. */
  duration: number
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, TimerEntry>>(new Map())

  const removeToast = useCallback((id: string) => {
    const entry = timers.current.get(id)
    if (entry) clearTimeout(entry.timer)
    timers.current.delete(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  /**
   * Pause the auto-dismiss timer for a toast (e.g. on hover/focus).
   * Requirement 27.3 — toasts with actions must not auto-hide while interacted with.
   */
  const pauseToast = useCallback((id: string) => {
    const entry = timers.current.get(id)
    if (!entry) return
    clearTimeout(entry.timer)
    const elapsed = Date.now() - entry.startedAt
    entry.remaining = Math.max(0, entry.remaining - elapsed)
  }, [])

  /**
   * Resume the auto-dismiss timer for a toast (e.g. on mouse leave/blur).
   */
  const resumeToast = useCallback((id: string) => {
    const entry = timers.current.get(id)
    if (!entry || entry.remaining <= 0) return
    entry.startedAt = Date.now()
    entry.timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, entry.remaining)
  }, [])

  const showToast = useCallback((
    message: string,
    type: ToastType = 'success',
    action?: Toast['action'],
  ): string => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type, action }])

    // Action toasts: minimum 10s for undo accessibility (Req 27.3, 27.4)
    // Non-action toasts: 2.5s (informational, no interaction needed)
    const duration = action ? 10000 : 2500
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, duration)
    timers.current.set(id, { timer, startedAt: Date.now(), remaining: duration, duration })

    return id
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, pauseToast, resumeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
