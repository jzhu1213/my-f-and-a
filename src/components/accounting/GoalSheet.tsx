"use client"
import { useState, useEffect } from 'react'

interface GoalSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; targetAmount: number; emoji: string }) => void
  editGoal?: { id: string; name: string; targetAmount: number; emoji: string }
}

const EMOJI_OPTIONS = ['🎯', '🏠', '🚗', '✈️', '💰', '📱', '💻', '🎓', '💍', '🎉', '🏖️', '🎮']

export function GoalSheet({ isOpen, onClose, onSubmit, editGoal }: GoalSheetProps) {
  const [name,          setName]          = useState('')
  const [targetAmount,  setTargetAmount]  = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('🎯')

  useEffect(() => {
    if (isOpen) {
      if (editGoal) {
        setName(editGoal.name)
        setTargetAmount(editGoal.targetAmount.toString())
        setSelectedEmoji(editGoal.emoji)
      } else {
        setName(''); setTargetAmount(''); setSelectedEmoji('🎯')
      }
    }
  }, [isOpen, editGoal])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2 || (parts[1]?.length ?? 0) > 2) return
    setTargetAmount(v)
  }

  const handleSubmit = () => {
    if (!name || !targetAmount) return
    onSubmit({ name, targetAmount: parseFloat(targetAmount), emoji: selectedEmoji })
    setName(''); setTargetAmount(''); setSelectedEmoji('🎯')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.80)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`sheet ${isOpen ? 'open' : ''}`} style={{ maxHeight: '88vh' }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>
            {editGoal ? 'Edit Goal' : 'New Goal'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--muted)', padding: '4px' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Emoji */}
          <div>
            <p className="label mb-4">Icon</p>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className="flex items-center justify-center py-3 text-2xl transition-all"
                  style={{
                    border: '1px solid',
                    borderColor: selectedEmoji === emoji ? 'var(--sub)' : 'var(--border)',
                    background:  selectedEmoji === emoji ? 'var(--raised)' : 'transparent',
                    borderRadius: '4px',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <p className="label mb-4">Goal Name</p>
            <input
              type="text"
              placeholder="Emergency Fund, New Laptop..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="t-input"
              maxLength={30}
            />
          </div>

          {/* Target amount */}
          <div>
            <p className="label mb-4">Target Amount</p>
            <div className="flex items-baseline gap-3">
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '24px', color: 'var(--muted)' }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={targetAmount}
                onChange={handleAmountChange}
                className="flex-1 bg-transparent outline-none"
                style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '32px',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '6px',
                  caretColor: 'var(--text)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
          <button onClick={handleSubmit} disabled={!name || !targetAmount} className="flex-1 btn-primary">
            {editGoal ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </>
  )
}
