"use client"
import { Nav } from '@/components/Nav'
import { Panel } from '@/components/Cards'
import { useAppStore } from '@/lib/storage'
import { useState } from 'react'

const FAQ = [
  { q: 'How do I add an expense?', a: 'Go to Transactions, select Expense, add amount and note.' },
  { q: 'How to create invoices?', a: 'Open Invoices tab, fill client and items, then download PDF.' },
  { q: 'How are categories chosen?', a: 'We use simple keyword rules from your note and type.' },
]

export default function AIPage() {
  const { categorize } = useAppStore()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user'|'assistant', content: string }[]>([
    { role: 'assistant', content: 'Hi! Ask me about transactions, budgeting, or invoicing.' }
  ])

  const send = () => {
    if (!input.trim()) return
    const question = input.trim()
    setMessages(m => [...m, { role: 'user', content: question }])
    setInput('')
    // very basic rule based responses
    let answer = 'I\'m here to help. Try asking about adding expenses or invoices.'
    if (/add (an )?expense/i.test(question)) answer = 'Go to Transactions, choose Expense, enter amount and a note.'
    if (/add (an )?income/i.test(question)) answer = 'Go to Transactions, choose Income, enter amount and a note.'
    if (/invoice/i.test(question)) answer = 'Use Invoices tab to create client and items, then download the PDF.'
    if (/categor(y|ies)|categorize/i.test(question)) answer = 'We auto-categorize via keywords in your note, e.g., "uber" -> Transport.'
    if (/category suggestion.*(grocer|uber|rent|salary)/i.test(question)) {
      const note = question.match(/(grocer|uber|rent|salary)/i)?.[0] ?? ''
      answer = `Suggestion: ${categorize(note, /income/.test(question) ? 'income' : 'expense')}`
    }
    setTimeout(() => setMessages(m => [...m, { role: 'assistant', content: answer }]), 200)
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Panel title="AI Assistant">
          <div className="h-80 card p-3 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'assistant' ? 'text-slate-200' : 'text-brand'}>
                <span className="text-xs uppercase mr-2 text-slate-400">{m.role}</span>
                {m.content}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="card flex-1 px-3 py-2" placeholder="Ask a question" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} />
            <button className="btn btn-primary" onClick={send}>Send</button>
          </div>
        </Panel>

        <Panel title="FAQ">
          <ul className="text-sm text-slate-300 space-y-2">
            {FAQ.map((f, i) => (
              <li key={i} className="border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                <div className="font-medium">{f.q}</div>
                <div className="text-slate-400">{f.a}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </div>
  )
}

