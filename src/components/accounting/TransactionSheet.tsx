"use client"
import { useState } from 'react'
import { TRANSACTION_CATEGORIES } from '@/types'
import type { TransactionCategory, TransactionType } from '@/types'

interface TransactionSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    amount: number
    category: TransactionCategory
    type: TransactionType
    note?: string
    isRecurring?: boolean
  }) => void
}

export function TransactionSheet({ isOpen, onClose, onSubmit }: TransactionSheetProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [note, setNote] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  
  const handleSubmit = () => {
    if (!amount || !category) return
    
    const selectedCat = TRANSACTION_CATEGORIES.find(c => c.category === category)
    
    onSubmit({
      amount: parseFloat(amount),
      category,
      type: selectedCat?.type || 'expense',
      note: note || undefined,
      isRecurring,
    })
    
    // Reset form
    setAmount('')
    setCategory(null)
    setNote('')
    setIsRecurring(false)
    onClose()
  }
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '')
    // Only allow one decimal point
    const parts = value.split('.')
    if (parts.length > 2) return
    if (parts[1]?.length > 2) return
    setAmount(value)
  }
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className={`bottom-sheet ${isOpen ? 'open' : ''}`}>
        <div className="bottom-sheet-handle" />
        
        <h2 className="text-xl font-heading font-bold mb-6 text-center">
          Add Transaction
        </h2>
        
        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-mono text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              className="input-folio input-amount pl-12"
              autoFocus
            />
          </div>
        </div>
        
        {/* Category Selection */}
        <div className="mb-6">
          <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-3">
            Category
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TRANSACTION_CATEGORIES.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setCategory(cat.category)}
                className={`category-pill flex-col gap-1 py-3 ${
                  category === cat.category 
                    ? cat.type === 'income'
                      ? 'bg-sage ring-sage'
                      : 'bg-peach/30 ring-peach'
                    : 'bg-gray-100 dark:bg-gray-800'
                } ${category === cat.category ? 'selected' : ''}`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-xs">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Note Input */}
        <div className="mb-6">
          <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
            Note (optional)
          </label>
          <input
            type="text"
            placeholder="What was this for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input-folio"
          />
        </div>
        
        {/* Recurring Toggle */}
        <div className="flex items-center justify-between mb-8 p-4 rounded-xl bg-gray-100 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-folio-text-secondary-light dark:text-folio-text-secondary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-medium">Make recurring?</span>
          </div>
          <button
            onClick={() => setIsRecurring(!isRecurring)}
            className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${
              isRecurring ? 'bg-sage' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isRecurring ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 btn-ghost border border-gray-200 dark:border-gray-700"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!amount || !category}
            className={`flex-1 btn-peach ${
              (!amount || !category) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Add
          </button>
        </div>
      </div>
    </>
  )
}

