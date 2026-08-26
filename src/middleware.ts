/**
 * Content-Security-Policy middleware (Phase 25, task 542.2).
 *
 * A static CSP can't both block inline scripts *and* let Next.js run its own
 * hydration bootstrap. The fix is a per-request nonce: we mint a fresh nonce,
 * attach it to the request so Next.js stamps it onto every script it emits, and
 * publish it in the CSP response header. Because the policy also uses
 * `strict-dynamic`, CSP3 browsers ignore the `'unsafe-inline'`/`https:`
 * fallbacks entirely — meaning any attacker-injected inline <script> without the
 * (unguessable) nonce is refused. The fallbacks exist only so pre-CSP3 browsers
 * still get a reasonable allow-list rather than a broken app.
 *
 * External origins are read from public env vars (never hardcoded secrets):
 *  - Supabase (REST + realtime websocket) from NEXT_PUBLIC_SUPABASE_URL
 *  - Error monitoring from NEXT_PUBLIC_SENTRY_DSN
 *  - Web-vitals reporting from NEXT_PUBLIC_WEB_VITALS_ENDPOINT
 *  - Google Fonts (stylesheet + font files) used by the root layout
 *  - Frankfurter FX rates API used by src/lib/exchangeRates.ts
 */

import { NextRequest, NextResponse } from 'next/server'

/** Safely extract the `https://host:port` origin from a URL-ish string. */
function toOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Resolve dynamic origins from the environment so the policy stays tight
  // without hardcoding any project-specific URL or secret.
  const supabaseOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^https:/, 'wss:') : null
  const sentryOrigin = toOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN)
  const webVitalsOrigin = toOrigin(process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT)

  const connectSrc = [
    "'self'",
    supabaseOrigin,
    supabaseWs,
    // Hosted-Supabase wildcard fallback (covers *.supabase.co REST + realtime)
    'https://*.supabase.co',
    'wss://*.supabase.co',
    // Currency rates (src/lib/exchangeRates.ts)
    'https://api.frankfurter.app',
    // Error monitoring ingest
    sentryOrigin,
    'https://*.ingest.sentry.io',
    'https://*.sentry.io',
    // Web-vitals reporting endpoint (optional)
    webVitalsOrigin,
  ]
    .filter(Boolean)
    .join(' ')

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' + nonce is the real guard; the trailing fallbacks are
    // ignored by modern browsers, so inline scripts remain blocked there.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // Inline styles are required (React inline style objects + Google Fonts CSS).
    // Styles can't execute JS, so this is a low-risk allowance.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https:`,
    `connect-src ${connectSrc}`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ')

  // Next.js reads the nonce from the CSP on the *request* headers and applies it
  // to the scripts it renders, so it must be set on both request and response.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Run on document/page requests only. Skip static assets and image
  // optimization, which don't need (and shouldn't pay for) a CSP round-trip.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|json|txt|xml|map|woff2?)$).*)',
  ],
}
