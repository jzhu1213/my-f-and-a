import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const tabs = [
  { href: '/', label: 'Dashboard' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/ai', label: 'AI Assistant' },
  { href: '/community', label: 'Community' },
  { href: '/profile', label: 'Profile' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 border-b border-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <div className="text-lg font-semibold">MyF&A</div>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(t => (
            <Link key={t.href} href={t.href} className={clsx('px-3 py-1.5 rounded-md text-sm',
              pathname === t.href ? 'bg-brand text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800')}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

