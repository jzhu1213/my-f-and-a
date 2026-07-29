// Folio - Local Storage Utilities

export function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7)
}

export function clearOnboarding() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('folio-onboarded')
}

// Theme storage is handled in ThemeContext
