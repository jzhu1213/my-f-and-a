// Folio - Local Storage Utilities

export function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7)
}

export function getOnboardingData() {
  if (typeof window === 'undefined') return null
  
  return {
    hasOnboarded: localStorage.getItem('folio-onboarded') === 'true',
    userType: localStorage.getItem('folio-user-type') || 'student',
    priority: localStorage.getItem('folio-user-priority') || 'save',
  }
}

export function setOnboardingComplete(userType: string, priority: string) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem('folio-onboarded', 'true')
  localStorage.setItem('folio-user-type', userType)
  localStorage.setItem('folio-user-priority', priority)
}

export function clearOnboarding() {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem('folio-onboarded')
  localStorage.removeItem('folio-user-type')
  localStorage.removeItem('folio-user-priority')
}

// Theme storage is handled in ThemeContext
