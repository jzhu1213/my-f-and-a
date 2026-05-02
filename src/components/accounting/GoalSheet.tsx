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

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40 animate-fade-in" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[88vh] animate-slide-up" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[10px] font-mono tracking-[0.2em] text-t-muted uppercase">
            {editGoal ? 'Edit Goal' : 'New Goal'}
          </span>
          <button onClick={onClose} className="text-t-muted hover:text-t-text transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Emoji */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Icon</p>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className="py-2 text-2xl transition-all flex items-center justify-center"
                  style={{
                    border: '1px solid',
                    borderColor: selectedEmoji === emoji ? 'var(--text)' : 'var(--border)',
                    background:  selectedEmoji === emoji ? 'var(--raised)' : 'transparent',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Name</p>
            <input
              type="text"
              placeholder="Emergency Fund, New Laptop..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="t-input"
              maxLength={30}
            />
          </div>

          {/* Target */}
          <div>
            <p className="text-[10px] font-mono tracking-widest text-t-muted uppercase mb-3">Target</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono text-t-muted">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={targetAmount}
                onChange={handleAmountChange}
                className="flex-1 bg-transparent text-3xl font-mono text-t-text outline-none border-b"
                style={{ borderColor: 'var(--line)' }}
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 btn-ghost">CANCEL</button>
          <button
            onClick={handleSubmit}
            disabled={!name || !targetAmount}
            className="flex-1 btn-primary"
          >
            {editGoal ? 'UPDATE' : 'CREATE'}
          </button>
        </div>
      </div>
    </>
  )
}
