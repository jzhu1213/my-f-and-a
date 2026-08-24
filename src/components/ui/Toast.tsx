"use client"

import { useToast } from '@/contexts/ToastContext'
import type { Toast as ToastType } from '@/contexts/ToastContext'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { Icon } from '@/components/ui/Icon'
import { GlassCard } from '@/components/ui/GlassCard'
import type { IconName } from '@/lib/icons'
import { FONT_FAMILY, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

/** Map toast type to its semantic icon name. */
function getToastIcon(type: ToastType['type']): IconName {
  switch (type) {
    case 'success': return 'toast:success'
    case 'error':   return 'toast:error'
    case 'info':    return 'toast:info'
  }
}

/** Map toast type to its accent color token. */
function getAccentColor(type: ToastType['type']): string {
  switch (type) {
    case 'success': return 'var(--green)'
    case 'error':   return 'var(--red)'
    case 'info':    return 'var(--blue)'
  }
}

/** Framer Motion variants for toast entrance/exit with spring slide-up. */
const toastVariants = {
  initial: { opacity: 0, y: 16, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.97 },
}

/** Reduced-motion variants: opacity only, no translation or scale. */
const toastVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export function Toast() {
  const { toasts, removeToast, pauseToast, resumeToast } = useToast()
  const { prefersReducedMotion } = useReducedMotion()

  const variants = prefersReducedMotion ? toastVariantsReduced : toastVariants
  const transition = prefersReducedMotion ? timings.fast : springs.snappy

  return (
    <div
      className="fixed left-0 right-0 z-[100] flex flex-col-reverse items-center gap-2 pointer-events-none px-4"
      style={{ bottom: 'calc(90px + var(--safe-bottom, 0px))' }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
            role="status"
            aria-live="polite"
            // Pause auto-dismiss on hover/focus for motor accessibility (Req 27.3)
            onMouseEnter={() => pauseToast(toast.id)}
            onMouseLeave={() => resumeToast(toast.id)}
            onFocus={() => pauseToast(toast.id)}
            onBlur={() => resumeToast(toast.id)}
            className="pointer-events-auto w-full max-w-sm"
          >
            <GlassCard
              elevation="high"
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* Status icon */}
              <span
                className="flex-shrink-0"
                style={{ color: getAccentColor(toast.type) }}
              >
                <Icon name={getToastIcon(toast.type)} size={16} strokeWidth={2} />
              </span>

              {/* Message */}
              <p
                className="text-xs flex-1 leading-snug"
                style={{
                  color: 'var(--text)',
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.regular,
                }}
              >
                {toast.message}
              </p>

              {/* Action/Undo button */}
              {toast.action && (
                <button
                  onClick={() => { toast.action!.onClick(); removeToast(toast.id) }}
                  className="flex-shrink-0 text-xs transition-all duration-150"
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: typography.caption.fontSize,
                    fontWeight: fontWeights.semibold,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text)',
                    padding: '4px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: radius.full,
                    background: 'transparent',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = getAccentColor(toast.type)
                    e.currentTarget.style.background = 'var(--fill-04)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--line)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {toast.action.label}
                </button>
              )}

              {/* Dismiss button — always visible so toasts can be manually dismissed (Req 27.3) */}
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 transition-colors duration-150"
                style={{ color: 'var(--sub)', padding: '2px' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--sub)')}
                aria-label="Dismiss notification"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </GlassCard>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
