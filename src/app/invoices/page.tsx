"use client"
import { Nav } from '@/components/Nav'
import { Panel } from '@/components/Cards'
import { useAppStore } from '@/lib/storage'
import { useForm, useFieldArray } from 'react-hook-form'
import jsPDF from 'jspdf'

type InvoiceForm = {
  clientName: string
  clientEmail?: string
  date: string
  dueDate?: string
  notes?: string
  items: { description: string, quantity: number, unitPrice: number }[]
}

function downloadPDF(inv: InvoiceForm & { id: string }) {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Invoice', 14, 20)
  doc.setFontSize(12)
  doc.text(`Invoice ID: ${inv.id}`, 14, 30)
  doc.text(`Client: ${inv.clientName}${inv.clientEmail ? ' <'+inv.clientEmail+'>' : ''}`, 14, 38)
  doc.text(`Date: ${inv.date}`, 14, 46)
  if (inv.dueDate) doc.text(`Due: ${inv.dueDate}`, 14, 54)

  let y = 66
  doc.text('Items:', 14, y)
  y += 6
  inv.items.forEach(i => {
    doc.text(`${i.description} x${i.quantity} @ $${i.unitPrice.toFixed(2)}`, 16, y)
    doc.text(`$${(i.quantity * i.unitPrice).toFixed(2)}`, 170, y, { align: 'right' })
    y += 6
  })
  y += 4
  const total = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  doc.setFontSize(14)
  doc.text(`Total: $${total.toFixed(2)}`, 14, y)
  if (inv.notes) {
    y += 10
    doc.setFontSize(12)
    doc.text('Notes:', 14, y)
    y += 6
    doc.text(inv.notes, 14, y)
  }
  doc.save(`invoice_${inv.id}.pdf`)
}

export default function InvoicesPage() {
  const { currentUser, invoices, addInvoice } = useAppStore()
  const { control, register, handleSubmit, reset } = useForm<InvoiceForm>({
    defaultValues: { date: new Date().toISOString().slice(0,10), items: [{ description: '', quantity: 1, unitPrice: 0 }] }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const onSubmit = (data: InvoiceForm) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    addInvoice({ id, ...data })
    downloadPDF({ id, ...data })
    reset({ date: new Date().toISOString().slice(0,10), items: [{ description: '', quantity: 1, unitPrice: 0 }] })
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <Panel title="Create Invoice">
          {!currentUser && <div className="text-sm text-slate-400">Please sign in on Profile page.</div>}
          {currentUser && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="card px-3 py-2" placeholder="Client name" {...register('clientName', { required: true })} />
                <input className="card px-3 py-2" placeholder="Client email" {...register('clientEmail')} />
                <input className="card px-3 py-2" type="date" {...register('date', { required: true })} />
                <input className="card px-3 py-2" type="date" {...register('dueDate')} />
              </div>
              <div className="space-y-2">
                {fields.map((f, idx) => (
                  <div key={f.id} className="grid sm:grid-cols-4 gap-2 items-center">
                    <input className="card px-3 py-2 sm:col-span-2" placeholder="Description" {...register(`items.${idx}.description` as const, { required: true })} />
                    <input className="card px-3 py-2" type="number" min={1} {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })} />
                    <input className="card px-3 py-2" type="number" step="0.01" {...register(`items.${idx}.unitPrice` as const, { valueAsNumber: true })} />
                    <button type="button" className="btn btn-secondary" onClick={() => remove(idx)}>Remove</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}>Add item</button>
              </div>
              <textarea className="card w-full px-3 py-2" placeholder="Notes" {...register('notes')} />
              <button className="btn btn-primary" type="submit">Create & Download PDF</button>
            </form>
          )}
        </Panel>

        <Panel title="Invoices">
          <div className="space-y-2">
            {invoices.map(i => (
              <div key={i.id} className="flex items-center justify-between border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                <div>
                  <div className="font-medium">{i.clientName}</div>
                  <div className="text-xs text-slate-400">{i.date}</div>
                </div>
                <div className="text-sm">{i.items.reduce((s, x) => s + x.quantity * x.unitPrice, 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </main>
    </div>
  )
}

