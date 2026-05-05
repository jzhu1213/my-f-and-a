"use client"
import Link from 'next/link'

type Tab = 'accounting' | 'finance'

interface TabNavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { key: 'accounting' as Tab, label: 'Budget' },
    { key: 'finance'    as Tab, label: 'Learn'  },
  ]

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex items-stretch"
      style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}
    >
      {tabs.map(({ key, label }) => {
        const isActive = activeTab === key
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className="flex-1 flex items-center justify-center transition-all duration-150 relative"
            style={{ minHeight: '64px', padding: '12px 8px' }}
          >
            {/* Active indicator line */}
            {isActive && (
              <div
                className="absolute top-0 left-1/4 right-1/4"
                style={{ height: '1px', background: 'var(--text)' }}
              />
            )}
            <span style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '12px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isActive ? 'var(--text)' : 'var(--muted)',
              transition: 'color 0.15s',
            }}>
              {label}
            </span>
          </button>
        )
      })}

      {/* Account — smaller, right edge */}
      <Link
        href="/profile"
        className="flex items-center justify-center px-5 transition-colors"
        style={{ minHeight: '64px', color: 'var(--muted)', borderLeft: '1px solid var(--border)', minWidth: '60px' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
        </svg>
      </Link>
    </nav>
  )
}
