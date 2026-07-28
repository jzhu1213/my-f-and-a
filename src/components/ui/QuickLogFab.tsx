"use client"

interface QuickLogFabProps {
  onLogExpense: () => void
  onLogIncome: () => void
}

/** Floating log buttons — sits above bottom nav on History / Learn tabs */
export function QuickLogFab({ onLogExpense, onLogIncome }: QuickLogFabProps) {
  return (
    <div
      className="fixed z-30 flex flex-col gap-2 items-end"
      style={{ bottom: '80px', right: '20px' }}
    >
      <button
        onClick={onLogIncome}
        style={{
          padding: '8px 12px',
          background: 'var(--raised)', border: '1px solid var(--border)',
          borderRadius: '8px', color: 'var(--green)',
          fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.04em',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        + income
      </button>
      <button
        onClick={onLogExpense}
        aria-label="Log expense"
        style={{
          width: '52px', height: '52px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--text)', color: '#000',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(255,255,255,0.08)',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--text)')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
