"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { signInWithEmail, signUpWithEmail } from '@/lib/supabaseData'
import { clearOnboarding } from '@/lib/storage'
import Link from 'next/link'

// Dynamic import to avoid SSR issues
function useThemeSafe() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('folio-theme') as 'light' | 'dark' | null
    if (stored) {
      setTheme(stored)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
  }, [])
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('folio-theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }
  
  return { theme, toggleTheme, mounted }
}

function ThemeToggleButton({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) {
  return (
    <button
      onClick={toggleTheme}
      className="tap-target rounded-xl hover:bg-sage/20 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  )
}

export default function ProfilePage() {
  const { user, loading, signOut, refreshUser } = useAuth()
  const { theme, toggleTheme, mounted } = useThemeSafe()
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    
    try {
      if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password, name)
        if (error) {
          setError(error.message)
        } else {
          setMessage('Check your email to confirm your account!')
        }
      } else {
        const { error } = await signInWithEmail(email, password)
        if (error) {
          setError(error.message)
        } else {
          await refreshUser()
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleSignOut = async () => {
    await signOut()
  }
  
  const handleResetOnboarding = () => {
    clearOnboarding()
    window.location.href = '/'
  }
  
  if (loading || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-folio-bg-light dark:bg-folio-bg-dark">
        <div className="w-12 h-12 border-4 border-sage border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  
  // Logged in view
  if (user) {
    return (
      <div className="min-h-screen bg-folio-bg-light dark:bg-folio-bg-dark p-6">
        <div className="max-w-md mx-auto pt-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <h1 className="text-xl font-heading font-bold">Profile</h1>
            <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
          </div>
          
          {/* Profile Card */}
          <div className="glass-card-solid p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-sage flex items-center justify-center text-2xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <p className="text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark">{user.email}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span>Account Type</span>
                <span className="capitalize text-sage-dark dark:text-sage font-medium">
                  {user.userType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span>Priority</span>
                <span className="capitalize text-peach-dark dark:text-peach font-medium">
                  {user.priority.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          
          {/* Settings */}
          <div className="glass-card-solid p-6 mb-6">
            <h3 className="font-semibold mb-4">Settings</h3>
            
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                <span>Dark Mode</span>
              </div>
              <button
                onClick={toggleTheme}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ${
                  theme === 'dark' ? 'bg-sage' : 'bg-gray-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
          
          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleResetOnboarding}
              className="w-full btn-ghost border border-gray-200 dark:border-gray-700"
            >
              Reset Onboarding
            </button>
            <button
              onClick={handleSignOut}
              className="w-full btn-folio bg-red-500 text-white hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Auth form (not logged in)
  return (
    <div className="min-h-screen bg-folio-bg-light dark:bg-folio-bg-dark p-6">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-xl font-heading font-bold">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h1>
          <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
        </div>
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-24 bg-sage rounded-lg shadow-xl relative transform rotate-3 mx-auto mb-4">
            <div className="absolute top-0 right-0 w-6 h-6 bg-sage-dark rounded-bl-lg rounded-tr-lg" />
            <div className="absolute bottom-3 left-3 right-3 h-1 bg-peach rounded-full" />
          </div>
          <h2 className="text-2xl font-heading font-bold">Folio</h2>
          <p className="text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
            Your F&A Assistant
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-card-solid p-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === 'signup'}
                className="input-folio"
                placeholder="Your name"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-folio"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input-folio"
              placeholder="••••••••"
            />
          </div>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="p-3 rounded-lg bg-sage-light dark:bg-sage-dark/30 text-sage-dark dark:text-sage text-sm">
              {message}
            </div>
          )}
          
          <button
            type="submit"
            disabled={submitting}
            className={`w-full btn-sage ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {submitting ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        
        {/* Toggle mode */}
        <p className="text-center mt-6 text-folio-text-secondary-light dark:text-folio-text-secondary-dark">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError('')
              setMessage('')
            }}
            className="ml-2 text-sage-dark dark:text-sage font-medium"
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
        
        {/* Continue without account */}
        <Link
          href="/"
          className="block text-center mt-4 text-sm text-folio-text-secondary-light dark:text-folio-text-secondary-dark hover:text-sage-dark dark:hover:text-sage"
        >
          Continue without an account →
        </Link>
      </div>
    </div>
  )
}
