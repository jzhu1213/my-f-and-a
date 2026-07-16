"use client"
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'warm' | 'dark' | 'system'
type ResolvedTheme = 'warm' | 'dark'

interface ThemeContextType {
  /** Current theme setting (includes 'system' option) */
  theme: Theme
  /** Set the theme preference */
  setTheme: (theme: Theme) => void
  /** The actual resolved theme being applied ('warm' or 'dark') */
  resolvedTheme: ResolvedTheme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'folio-theme'

/**
 * Gets the system's preferred color scheme
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'warm'
  
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'warm'
}

/**
 * Loads theme preference from localStorage
 */
function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'warm' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error)
  }
  
  return null
}

/**
 * Saves theme preference to localStorage
 */
function storeTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error)
  }
}

/**
 * Resolves the actual theme to apply based on theme setting
 */
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

/**
 * Applies the resolved theme to the document
 */
function applyTheme(resolvedTheme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  
  // Remove both theme classes
  root.classList.remove('warm', 'dark')
  
  // Add the resolved theme class
  root.classList.add(resolvedTheme)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with stored theme or default to 'warm'
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? 'warm'
  })
  
  const [mounted, setMounted] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    return resolveTheme(theme)
  })

  // Handle theme changes
  useEffect(() => {
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
    storeTheme(theme)
  }, [theme])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      const systemTheme = e.matches ? 'dark' : 'warm'
      setResolvedTheme(systemTheme)
      applyTheme(systemTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Mark as mounted after initial render
  useEffect(() => {
    setMounted(true)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        {children}
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

