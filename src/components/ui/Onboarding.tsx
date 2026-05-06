"use client"
import type { OnboardingData } from '@/types'

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-slide-up">

        {/* Logo */}
        <div className="mb-14">
          <span style={{ fontSize: '52px', fontFamily: 'Space Mono, monospace', fontWeight: 300, color: 'var(--text)', letterSpacing: '-0.03em', display: 'block', lineHeight: 1 }}>
            folio
          </span>
          <div className="flex items-center gap-2.5 mt-3">
            <div style={{ height: '1px', width: '32px', background: 'var(--line)' }} />
            <span className="label">personal finance</span>
          </div>
        </div>

        {/* Value props */}
        <div className="mb-12" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { icon: '↗', text: 'Track spending weekly and monthly' },
            { icon: '◼', text: 'Set budgets per category'          },
            { icon: '◎', text: 'Save toward your goals'            },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-4 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', color: 'var(--muted)', flexShrink: 0, width: '20px', textAlign: 'center' }}>
                {icon}
              </span>
              <span style={{ fontSize: '15px', color: 'var(--sub)' }}>{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => onComplete({ userType: null, priority: null })}
          className="w-full btn-primary"
        >
          Get Started
        </button>
      </div>
    </div>
  )
}
