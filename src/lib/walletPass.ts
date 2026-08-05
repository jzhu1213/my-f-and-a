/**
 * Wallet Pass — Daily Allowance
 *
 * Builds an Apple Wallet (PassKit) `pass.json` document for Folio's daily
 * "can I afford this today?" number, so the value is glanceable from the Lock
 * Screen / Wallet (and, on paired watches, from the Wallet watch app).
 *
 * This module ONLY produces the `pass.json` payload. Producing a fully
 * installable `.pkpass` additionally requires:
 *   1. A `manifest.json` (SHA-1 of each file in the bundle)
 *   2. A PKCS#7 detached `signature` produced with an Apple-issued Pass Type ID
 *      certificate + the Apple WWDR intermediate certificate
 *   3. Image assets (icon.png, logo.png, etc.)
 *   4. Zipping the bundle
 *
 * Signing requires certificates that only exist in the deployment environment,
 * so it is intentionally left as a deployment prerequisite (see
 * docs/WALLET-PASS-AND-WATCH.md). The route serves the unsigned `pass.json`
 * when signing material is absent, which is still useful for previewing and
 * for the client to consume, and degrades gracefully offline.
 *
 * The data contract mirrors WidgetDailyAllowanceData so the pass reflects the
 * same live daily-allowance value as the home-screen widget (see
 * src/lib/widgetSync.ts and src/app/api/widget/daily-allowance/route.ts).
 *
 * Task 181.1 — Wallet & watch glance (stretch)
 */

import type { WidgetDailyAllowanceData } from '@/app/api/widget/daily-allowance/route'

/** Warm purple theme tokens, expressed as PassKit rgb() strings. */
const THEME = {
  /** --bg: #12121f */
  background: 'rgb(18, 18, 31)',
  /** near-white foreground for high contrast on the dark surface */
  foreground: 'rgb(245, 244, 255)',
  /** muted purple label */
  label: 'rgb(178, 172, 214)',
} as const

/**
 * Maps the Adaptive Card status token (already computed by widgetSync) to a
 * warm, non-alarming rgb() color for the headline allowance number.
 * Kept intentionally soft — no shame-based red-alert coloring.
 */
function statusToColor(status: string): string {
  switch (status) {
    case 'Good':
      return 'rgb(126, 231, 179)' // soft green
    case 'Warning':
      return 'rgb(245, 208, 128)' // warm amber
    case 'Attention':
      return 'rgb(240, 160, 170)' // soft rose (not a harsh red)
    default:
      return THEME.foreground
  }
}

/**
 * The subset of PassKit fields we generate. This is a structural type — it is
 * serialized directly to `pass.json`. Not exhaustive of the PassKit spec.
 */
export interface WalletPassJson {
  formatVersion: 1
  passTypeIdentifier: string
  serialNumber: string
  teamIdentifier: string
  organizationName: string
  description: string
  logoText: string
  foregroundColor: string
  backgroundColor: string
  labelColor: string
  /** Generic pass style — flexible layout suited to a single glanceable number */
  generic: {
    primaryFields: PassField[]
    secondaryFields: PassField[]
    auxiliaryFields: PassField[]
    backFields: PassField[]
  }
  /** Relevance / freshness hint shown to the user */
  relevantDate?: string
}

export interface PassField {
  key: string
  label: string
  value: string
  textAlignment?: 'PKTextAlignmentLeft' | 'PKTextAlignmentCenter' | 'PKTextAlignmentRight'
}

/**
 * Configuration for the pass identifiers. These come from the Apple Developer
 * account and are supplied via environment variables at deploy time. Sensible
 * placeholders are used when unset so the JSON is still well-formed for preview.
 */
export interface WalletPassConfig {
  passTypeIdentifier: string
  teamIdentifier: string
  organizationName: string
  serialNumber: string
}

export function resolvePassConfig(): WalletPassConfig {
  return {
    passTypeIdentifier: process.env.WALLET_PASS_TYPE_ID || 'pass.app.folio.dailyallowance',
    teamIdentifier: process.env.WALLET_TEAM_ID || 'FOLIOTEAMID',
    organizationName: 'Folio',
    // Non-user-identifying serial; stable per-day so re-issues coalesce.
    serialNumber: `folio-daily-${new Date().toISOString().slice(0, 10)}`,
  }
}

/**
 * Builds the `pass.json` document from live (or placeholder) daily-allowance data.
 * Warm, encouraging, no shame-based copy — mirrors the widget/home experience.
 */
export function buildDailyAllowancePass(
  data: WidgetDailyAllowanceData,
  config: WalletPassConfig = resolvePassConfig(),
): WalletPassJson {
  const staleNote = data.offlineStale
    ? 'Showing your last saved number. Open Folio when you\u2019re back online to refresh.'
    : 'Updates when you open Folio.'

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    serialNumber: config.serialNumber,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    description: 'Folio daily allowance',
    logoText: 'Folio',
    foregroundColor: THEME.foreground,
    backgroundColor: THEME.background,
    labelColor: THEME.label,
    relevantDate: data.lastUpdated,
    generic: {
      primaryFields: [
        {
          key: 'allowance',
          label: 'Today',
          value: data.amount,
          textAlignment: 'PKTextAlignmentLeft',
        },
      ],
      secondaryFields: [
        {
          key: 'spentToday',
          label: 'Spent today',
          value: data.spentToday,
          textAlignment: 'PKTextAlignmentLeft',
        },
        {
          key: 'remaining',
          label: 'Budget left',
          value: `${data.progressPercent}%`,
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      auxiliaryFields: [
        {
          key: 'message',
          label: 'Can I afford this?',
          value: data.message,
        },
      ],
      backFields: [
        {
          key: 'about',
          label: 'About',
          value: 'Your daily spending room, at a glance. Tap to open Folio for the full picture.',
        },
        {
          key: 'freshness',
          label: 'Freshness',
          value: staleNote,
        },
        {
          key: 'updated',
          label: 'Last updated',
          value: data.lastUpdated,
        },
      ],
    },
  }
}

// Re-export the status color mapper so the route (or future signer) can reuse it.
export { statusToColor as passStatusColor }
