/**
 * Widget Data Sync — Keeps the PWA home-screen widget in sync with the
 * latest daily allowance calculation.
 *
 * Sends updated allowance data to the service worker whenever it changes.
 * The SW caches this data and serves it to the widget via the
 * /api/widget/daily-allowance endpoint intercept.
 *
 * Task 114.1 — Glanceable widgets and notifications
 */

import type { DailyAllowance, AllowanceStatus } from '@/types/folio'
import { formatCurrency as formatCurrencyCentral } from '@/lib/currencyUtils'

/**
 * Maps the internal AllowanceStatus to an Adaptive Card color token.
 * These are the only valid color values for TextBlock.color in Adaptive Cards.
 */
function statusToAdaptiveCardColor(status: AllowanceStatus): string {
  switch (status) {
    case 'healthy':
      return 'Good'
    case 'caution':
      return 'Warning'
    case 'warning':
    case 'over':
      return 'Attention'
    default:
      return 'Default'
  }
}

/**
 * Format a number as a dollar amount for widget display.
 */
function formatCurrency(amount: number): string {
  return formatCurrencyCentral(Math.round(amount), 'USD', { fractionDigits: 0 })
}

/**
 * Computes the percentage of daily budget remaining (0–100).
 * Returns 100 when nothing has been spent, 0 when the full budget is consumed.
 */
function computeProgressPercent(allowance: DailyAllowance): number {
  const budget = allowance.dailyBudget
  if (budget <= 0) return 0
  const remaining = Math.max(0, allowance.amount)
  return Math.min(100, Math.round((remaining / budget) * 100))
}

/**
 * Detects whether the user prefers reduced motion.
 * Safe to call in any environment — returns false on the server or
 * when matchMedia is unavailable.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Sends the latest daily allowance data to the service worker for widget caching.
 *
 * Call this whenever the daily allowance recalculates (from useHomeData).
 * Fails silently if the service worker is not available (non-PWA context,
 * unsupported browser, etc.)
 */
export function syncWidgetData(allowance: DailyAllowance): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
    return
  }

  const payload = {
    amount: formatCurrency(allowance.amount),
    spentToday: formatCurrency(allowance.spentToday),
    status: statusToAdaptiveCardColor(allowance.status),
    message: allowance.message,
    lastUpdated: new Date().toISOString(),
    progressPercent: computeProgressPercent(allowance),
    reducedMotion: prefersReducedMotion(),
    offlineStale: false,
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'widgetDataUpdate',
    payload,
  })
}

/**
 * Registers for periodic background sync (if supported) so the widget
 * can refresh data even when the app isn't open. Call once on app startup.
 *
 * This is a progressive enhancement — most browsers don't support it yet,
 * so it silently no-ops when unavailable.
 */
export async function registerWidgetPeriodicSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Check if periodicSync is supported
    if ('periodicSync' in registration) {
      // Request permission for background sync (requires user gesture in some browsers)
      const status = await navigator.permissions.query({
        // @ts-expect-error - periodic-background-sync not in standard Permission type yet
        name: 'periodic-background-sync',
      })

      if (status.state === 'granted') {
        // @ts-expect-error - periodicSync not in standard ServiceWorkerRegistration type yet
        await registration.periodicSync.register('widget-daily-allowance-refresh', {
          minInterval: 60 * 60 * 1000, // 1 hour minimum
        })
      }
    }
  } catch {
    // Periodic sync not available — fail silently (progressive enhancement)
  }
}
