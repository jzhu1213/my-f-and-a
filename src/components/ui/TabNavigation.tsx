"use client"
import Link from 'next/link'

type Tab = 'accounting' | 'finance'

interface TabNavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const inactive = { color: 'var(--muted)' }
  const active   = { color: 'var(--text)' }

  return (
    <nav className="t-tab-nav">
      {/* Accounting */}
      <button
        onClick={() => onTabChange('accounting')}
        className="t-tab-item"
        style={activeTab === 'accounting' ? {} : {}}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={activeTab === 'accounting' ? active : inactive}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M7 6h.01M12 6h.01M17 6h.01M7 18h.01M12 18h.01M17 18h.01" />
        </svg>
        <span style={activeTab === 'accounting' ? active : inactive}>
          budget
        </span>
      </button>

      {/* Finance */}
      <button
        onClick={() => onTabChange('finance')}
        className="t-tab-item"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={activeTab === 'finance' ? active : inactive}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span style={activeTab === 'finance' ? active : inactive}>
          learn
        </span>
      </button>

      {/* Profile */}
      <Link href="/profile" className="t-tab-item">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={inactive}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span style={inactive}>account</span>
      </Link>
    </nav>
  )
}
