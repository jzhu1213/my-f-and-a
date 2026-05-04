"use client"
import Link from 'next/link'

type Tab = 'accounting' | 'finance'

interface TabNavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

function BudgetIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 1.75 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ color: active ? 'var(--text)' : 'var(--muted)', transition: 'color 0.15s' }}
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h2M10 15h4" />
    </svg>
  )
}

function LearnIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 1.75 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ color: active ? 'var(--text)' : 'var(--muted)', transition: 'color 0.15s' }}
    >
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--muted)', transition: 'color 0.15s' }}
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="t-tab-nav">
      <button
        onClick={() => onTabChange('accounting')}
        className={`t-tab-item ${activeTab === 'accounting' ? 'active' : ''}`}
      >
        <BudgetIcon active={activeTab === 'accounting'} />
        <span
          className="tab-label"
          style={{ color: activeTab === 'accounting' ? 'var(--text)' : 'var(--muted)' }}
        >
          budget
        </span>
      </button>

      <button
        onClick={() => onTabChange('finance')}
        className={`t-tab-item ${activeTab === 'finance' ? 'active' : ''}`}
      >
        <LearnIcon active={activeTab === 'finance'} />
        <span
          className="tab-label"
          style={{ color: activeTab === 'finance' ? 'var(--text)' : 'var(--muted)' }}
        >
          learn
        </span>
      </button>

      <Link href="/profile" className="t-tab-item">
        <AccountIcon />
        <span className="tab-label" style={{ color: 'var(--muted)' }}>
          account
        </span>
      </Link>
    </nav>
  )
}
