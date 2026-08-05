/**
 * Wallet Pass API — Daily Allowance
 *
 * GET /api/wallet/daily-allowance
 *
 * Serves the Apple Wallet (PassKit) pass for Folio's daily allowance number.
 * Reuses the same live daily-allowance data source as the home-screen widget
 * (see src/lib/widgetSync.ts + /api/widget/daily-allowance) so the pass reflects
 * the same "can I afford this today?" value.
 *
 * Data source, in priority order (graceful degradation):
 *   1. Query params supplied by the client, which holds the live allowance
 *      (mirrors WidgetDailyAllowanceData). This is how the app hands off the
 *      current number when the user taps "Add to Wallet".
 *   2. A safe placeholder (identical to the widget route default) when no live
 *      data is available — e.g. offline, or the endpoint hit directly. The pass
 *      is flagged offlineStale so the copy explains it's a last-saved value.
 *
 * Signing (producing an installable, signed .pkpass) requires an Apple Pass
 * Type ID certificate + the WWDR intermediate cert, which only exist in the
 * deploy environment. When that material is absent we serve the unsigned
 * pass.json (still useful for preview and client consumption). See
 * docs/WALLET-PASS-AND-WATCH.md for the signing prerequisite and the
 * watch-complication feasibility notes.
 *
 * Task 181.1 — Wallet & watch glance (stretch)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { WidgetDailyAllowanceData } from '@/app/api/widget/daily-allowance/route'
import { buildDailyAllowancePass } from '@/lib/walletPass'

/** Valid Adaptive Card status tokens produced by widgetSync. */
const VALID_STATUSES = new Set(['Good', 'Warning', 'Attention', 'Default'])

/**
 * Reads live allowance data from query params, falling back to a safe
 * placeholder for any missing/invalid field so the pass is always well-formed.
 */
function readAllowanceData(searchParams: URLSearchParams): WidgetDailyAllowanceData {
  const amount = searchParams.get('amount')
  const spentToday = searchParams.get('spentToday')
  const statusParam = searchParams.get('status')
  const message = searchParams.get('message')
  const progressParam = searchParams.get('progressPercent')

  // If no live params were supplied at all, treat as offline/placeholder.
  const hasLiveData = amount !== null || spentToday !== null || message !== null

  const progressPercent = (() => {
    const n = Number(progressParam)
    if (!Number.isFinite(n)) return 100
    return Math.min(100, Math.max(0, Math.round(n)))
  })()

  const status = statusParam && VALID_STATUSES.has(statusParam) ? statusParam : 'Default'

  return {
    amount: amount || '--',
    spentToday: spentToday || '$0',
    status,
    message: message || 'Open Folio to see your allowance',
    lastUpdated: new Date().toISOString(),
    progressPercent,
    offlineStale: !hasLiveData,
  }
}

export async function GET(request: NextRequest) {
  const data = readAllowanceData(request.nextUrl.searchParams)
  const pass = buildDailyAllowancePass(data)

  // We serve the unsigned pass.json. When signing certificates are provisioned
  // in the deploy environment (see docs), a signing step would wrap this into a
  // .pkpass bundle with the correct content type below.
  const isSigningConfigured = Boolean(
    process.env.WALLET_PASS_CERT_PEM && process.env.WALLET_PASS_CERT_KEY,
  )

  return NextResponse.json(pass, {
    headers: {
      // Kept short-lived: the number changes as the user spends through the day.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      // Signals to the client whether a signed .pkpass is available for install.
      'X-Folio-Pass-Signed': isSigningConfigured ? 'true' : 'false',
    },
  })
}
