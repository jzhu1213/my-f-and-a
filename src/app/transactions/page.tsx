"use client"
import { Nav } from '@/components/Nav'
import { Panel } from '@/components/Cards'
import { useAppStore } from '@/lib/storage'
import { useForm } from 'react-hook-form'

type TxForm = {
  date: string
  amount: number
  type: 'income' | 'expense'
  note: string
}

export default function TransactionsPage() {
  const { currentUser, transactions, addTransaction, deleteTransaction } = useAppStore()
  const { register, handleSubmit, reset } = useForm<TxForm>({
    defaultValues: { date: new Date().toISOString().slice(0,10), type: 'expense' }
  })

  const onSubmit = (data: TxForm) => {
    addTransaction({ date: data.date, amount: Number(data.amount), type: data.type, note: data.note })
    reset({ date: new Date().toISOString().slice(0,10), type: 'expense', amount: 0, note: '' })
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <Panel title="Add Transaction">
          {!currentUser && <div className="text-sm text-slate-400">Please sign in on Profile page.</div>}
          {currentUser && (
            <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-5 gap-3">
              <input className="card px-3 py-2 bg-slate-900/60" type="date" {...register('date', { required: true })} />
              <input className="card px-3 py-2" type="number" step="0.01" placeholder="Amount" {...register('amount', { required: true, valueAsNumber: true })} />
              <select className="card px-3 py-2" {...register('type', { required: true })}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <input className="card px-3 py-2 sm:col-span-2" placeholder="Note (e.g., groceries, uber)" {...register('note')} />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
          )}
        </Panel>

        <Panel title="History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left font-medium py-2">Date</th>
                  <th className="text-left font-medium py-2">Type</th>
                  <th className="text-left font-medium py-2">Category</th>
                  <th className="text-left font-medium py-2">Note</th>
                  <th className="text-right font-medium py-2">Amount</th>
                  <th className="text-right font-medium py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(currentUser ? transactions.filter(t => t.userId === currentUser.id) : []).map(t => (
                  <tr key={t.id} className="border-t border-slate-800">
                    <td className="py-2">{t.date}</td>
                    <td className="py-2 capitalize">{t.type}</td>
                    <td className="py-2">{t.category}</td>
                    <td className="py-2">{t.note}</td>
                    <td className="py-2 text-right">${t.amount.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        className="btn btn-secondary"
                        onClick={() => deleteTransaction(t.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  )
}

