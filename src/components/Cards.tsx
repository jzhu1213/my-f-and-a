export function StatCard({ title, value, sub }: { title: string, value: string | number, sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-slate-300 text-sm">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export function Panel({ title, children, actions }: { title: string, children: React.ReactNode, actions?: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {actions}
      </div>
      <div className="mt-3">
        {children}
      </div>
    </section>
  )
}

