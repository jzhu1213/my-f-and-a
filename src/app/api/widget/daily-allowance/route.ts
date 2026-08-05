/**
 * Widget Data API — Daily Allowance
 *
 * GET /api/widget/daily-allowance
 *
 * Returns the current daily allowance data for PWA widget consumption.
 * In this PWA architecture, the service worker intercepts this request and
 * responds with locally-cached data (synced from the main app thread via
 * widgetSync). If no cached data is available in the SW, this route returns
 * a default placeholder response.
 *
 * The response format matches the Adaptive Card data binding contract
 * defined in public/widgets/daily-allowance-card.json.
 */

import { NextResponse } from 'next/server'

export interface WidgetDailyAllowanceData {
  /** Formatted allowance string, e.g. "$42" */
  amount: string
  /** Formatted spent-today string, e.g. "$7.50" */
  spentToday: string
  /** Adaptive Card color token: "Good" | "Warning" | "Attention" | "Default" */
  status: string
  /** Encouraging status message */
  message: string
  /** ISO 8601 timestamp of last computation */
  lastUpdated: string
  /** Percentage of daily budget remaining (0–100) */
  progressPercent: number
  /** Whether the data is stale/offline (for widget degradation display) */
  offlineStale: boolean
}

export async function GET() {
  // Default placeholder — the service worker will typically intercept this
  // and respond with fresh cached data before it reaches the network.
  const data: WidgetDailyAllowanceData = {
    amount: '--',
    spentToday: '$0',
    status: 'Default',
    message: 'Open Folio to see your allowance',
    lastUpdated: new Date().toISOString(),
    progressPercent: 100,
    offlineStale: false,
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
