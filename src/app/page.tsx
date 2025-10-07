"use client"
import { Nav } from '@/components/Nav'
import { StatCard, Panel } from '@/components/Cards'
import { useAppStore, currentMonthString } from '@/lib/storage'

export default function DashboardPage() {
  const { currentUser, transactions, posts } = useAppStore()
  const month = currentMonthString()
  const userTx = currentUser ? transactions.filter(t => t.userId === currentUser.id) : []
  const monthTx = userTx.filter(t => t.date.startsWith(month))
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome{currentUser ? `, ${currentUser.name}` : ''}</h1>
          {!currentUser && <a href="/profile" className="btn btn-primary">Sign up / Login</a>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="This Month Income" value={`$${income.toFixed(2)}`} />
          <StatCard title="This Month Expenses" value={`$${expense.toFixed(2)}`} />
          <StatCard title="Net" value={`$${(income - expense).toFixed(2)}`} />
        </div>

        <Panel title="Community Feed">
          <div className="space-y-3">
            {posts.length === 0 && <div className="text-slate-400 text-sm">No posts yet.</div>}
            {posts.slice(0, 5).map(p => (
              <div key={p.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                <div className="text-sm text-slate-400">{new Date(p.createdAt).toLocaleString()}</div>
                <div className="mt-1">{p.content}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Tips">
          <ul className="list-disc pl-6 text-slate-300 text-sm space-y-1">
            <li>Enter 10 expenses to earn the <span className="text-brand">Expense Apprentice</span> badge.</li>
            <li>Use notes like "groceries" or "uber" for auto-categorization.</li>
            <li>Send an invoice to track client income.</li>
          </ul>
        </Panel>
      </main>
    </div>
  )
}

