// ============================================================================
// Region-aware Defaults — sensible starting points for new users, by region
// ============================================================================
//
// Task 198.1 — Region-aware defaults (Group 28: Internationalization).
// Extends the multi-currency (195.1), locale-formatting (196.1) and i18n (197.1)
// work, and the student-category refinement from Phase 2 task 125.1.
//
// A new user's *region* bundles together three sensible defaults so onboarding
// feels local from the first tap without any setup:
//   • home currency + its symbol (feeds `currencyPreferences`)
//   • display locale (feeds `localePreferences`)
//   • category vocabulary + per-category quick-amount presets tuned to the
//     region's currency and cost of living
//
// Everything here is ADDITIVE and BACKWARD-COMPATIBLE:
//   • The default region is the US, whose defaults are byte-for-byte the
//     existing experience (USD, en-US, the current category labels/presets).
//   • With no stored region, `getRegion()` falls back to a best-effort guess
//     from the browser locale — which for an en-US user resolves to the US,
//     so nothing changes. A study-abroad or international student instead gets
//     defaults that match where they are.
//   • Region only supplies *starting* values. It is fully overridable in
//     Settings, and choosing a region never rewrites already-logged data.
//
// Like the sibling preference modules, the choice lives in localStorage until a
// dedicated preferences column exists, so no schema migration is required.

import type { TransactionCategory } from '@/types'
import {
  DEFAULT_HOME_CURRENCY,
  getCurrencySymbol,
  normalizeCode,
} from './currencyUtils'
import { setHomeCurrency } from './currencyPreferences'
import { setLocale, isValidLocale } from './localePreferences'
import { getCategoryPresets } from './suggestionUtils'

// ============================================================================
// Region identity
// ============================================================================

/**
 * The curated set of regions Folio ships tuned defaults for. Deliberately
 * small and explicit — chosen for the largest student populations and the most
 * common study-abroad destinations. Any locale outside this set falls back to
 * the default region, so the app still works everywhere.
 */
export type RegionCode =
  | 'US'
  | 'GB'
  | 'EU'
  | 'CA'
  | 'AU'
  | 'IN'
  | 'JP'
  | 'SG'

/** The default region when none is chosen or detected — the standard US setup. */
export const DEFAULT_REGION: RegionCode = 'US'

// ============================================================================
// Types
// ============================================================================

/**
 * The full bundle of sensible starting values for a region. Category maps are
 * PARTIAL: any category omitted falls back to the shared, currency-agnostic
 * defaults, so a region only needs to override what genuinely differs.
 */
export interface RegionDefaults {
  /** ISO 3166-ish region code, e.g. "GB". */
  code: RegionCode
  /** Friendly region name, e.g. "United Kingdom". */
  name: string
  /** A flag emoji for warm, glanceable display. */
  flag: string
  /** Default home currency (ISO 4217) for this region. */
  currency: string
  /** Default BCP-47 display locale for this region. */
  locale: string
  /**
   * Region-specific category label overrides. Vocabulary differs by region
   * (e.g. "Rent & Bills" vs "Rent & Utilities"); only overridden keys are set.
   */
  categoryLabels: Partial<Record<TransactionCategory, string>>
  /**
   * Per-category quick-amount presets in the region's currency, tuned to local
   * cost of living. Partial — omitted categories fall back to the shared USD
   * presets from `suggestionUtils.getCategoryPresets`.
   */
  amountPresets: Partial<Record<TransactionCategory, number[]>>
  /**
   * Gentle starting suggestions for a first daily allowance / monthly pool, in
   * the region's currency. Used only as onboarding hints — never enforced.
   */
  budgetPresets: {
    /** Suggested starting daily allowance. */
    dailyAllowance: number
    /** Suggested starting monthly spending pool. */
    monthlyPool: number
  }
}

// ============================================================================
// Region table
// ============================================================================

/**
 * The curated defaults. US is first and mirrors the pre-i18n experience exactly
 * (USD, en-US, the existing labels/presets left to fall back), so the standard
 * path is unchanged.
 */
export const REGIONS: Record<RegionCode, RegionDefaults> = {
  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    locale: 'en-US',
    // No overrides — the shared labels/presets already ARE the US defaults.
    categoryLabels: {},
    amountPresets: {},
    budgetPresets: { dailyAllowance: 25, monthlyPool: 750 },
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
    locale: 'en-GB',
    categoryLabels: {
      rent: 'Rent & Bills',
      transport: 'Transportation',
      school: 'Uni',
      fun: 'Fun',
    },
    amountPresets: {
      food: [4, 8, 12, 6],
      transport: [2, 3, 6, 15],
      fun: [8, 15, 25, 6],
      rent: [400, 500, 650, 350],
    },
    budgetPresets: { dailyAllowance: 20, monthlyPool: 600 },
  },
  EU: {
    code: 'EU',
    name: 'Eurozone',
    flag: '🇪🇺',
    currency: 'EUR',
    locale: 'de-DE',
    categoryLabels: {
      school: 'Uni',
      transport: 'Transportation',
    },
    amountPresets: {
      food: [4, 8, 12, 6],
      transport: [2, 3, 8, 20],
      fun: [8, 15, 25, 6],
      rent: [400, 550, 700, 350],
    },
    budgetPresets: { dailyAllowance: 20, monthlyPool: 600 },
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    currency: 'CAD',
    locale: 'en-CA',
    categoryLabels: {
      school: 'School',
    },
    amountPresets: {
      food: [10, 15, 20, 6],
      transport: [3, 6, 20, 40],
      fun: [12, 25, 40, 10],
      rent: [600, 800, 1000, 500],
    },
    budgetPresets: { dailyAllowance: 30, monthlyPool: 900 },
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    currency: 'AUD',
    locale: 'en-AU',
    categoryLabels: {
      school: 'Uni',
    },
    amountPresets: {
      food: [10, 16, 22, 6],
      transport: [4, 8, 20, 45],
      fun: [15, 25, 45, 10],
      rent: [500, 700, 900, 400],
    },
    budgetPresets: { dailyAllowance: 35, monthlyPool: 1000 },
  },
  IN: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    currency: 'INR',
    locale: 'en-IN',
    categoryLabels: {
      school: 'College',
      transport: 'Transportation',
    },
    amountPresets: {
      food: [100, 200, 350, 50],
      transport: [20, 50, 150, 300],
      fun: [200, 500, 1000, 150],
      rent: [8000, 12000, 18000, 6000],
    },
    budgetPresets: { dailyAllowance: 500, monthlyPool: 15000 },
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    currency: 'JPY',
    locale: 'ja-JP',
    categoryLabels: {
      school: 'School',
    },
    // JPY has no minor units — presets are whole-yen amounts.
    amountPresets: {
      food: [500, 800, 1200, 300],
      transport: [200, 400, 1000, 2000],
      fun: [1000, 2000, 4000, 800],
      rent: [50000, 70000, 90000, 40000],
    },
    budgetPresets: { dailyAllowance: 2500, monthlyPool: 75000 },
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    currency: 'SGD',
    locale: 'en-SG',
    categoryLabels: {
      school: 'Uni',
    },
    amountPresets: {
      food: [5, 8, 12, 4],
      transport: [2, 4, 10, 25],
      fun: [12, 20, 35, 8],
      rent: [700, 1000, 1400, 600],
    },
    budgetPresets: { dailyAllowance: 25, monthlyPool: 750 },
  },
}

/** All supported regions as an ordered array (default first) for pickers. */
export const REGION_LIST: RegionDefaults[] = [
  REGIONS.US,
  REGIONS.GB,
  REGIONS.EU,
  REGIONS.CA,
  REGIONS.AU,
  REGIONS.IN,
  REGIONS.JP,
  REGIONS.SG,
]

// ============================================================================
// Storage key
// ============================================================================

const REGION_KEY = 'folio-region'

// ============================================================================
// Validation & lookup
// ============================================================================

/** True when `value` is one of the curated region codes. */
export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REGIONS, value)
}

/** Resolve a region code to its defaults, falling back to the default region. */
export function getRegionDefaults(code: string | undefined | null): RegionDefaults {
  return isRegionCode(code) ? REGIONS[code] : REGIONS[DEFAULT_REGION]
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Map the region subtag of a BCP-47 locale to a supported region. Handles the
 * common cases directly (e.g. "en-GB" → GB) and folds the many euro-area
 * locales onto the shared "EU" bundle. Unknown or malformed input resolves to
 * the default region, so this never throws.
 *
 * e.g. "en-US" → "US", "en-GB" → "GB", "fr-FR" → "EU", "hi-IN" → "IN".
 */
export function detectRegionFromLocale(locale: string | undefined | null): RegionCode {
  if (typeof locale !== 'string' || locale.trim() === '') return DEFAULT_REGION

  const parts = locale.split('-')
  const language = (parts[0] ?? '').toLowerCase()
  const regionSubtag = (parts[1] ?? '').toUpperCase()

  // 1) Direct region-subtag match to a curated region.
  if (isRegionCode(regionSubtag)) return regionSubtag

  // 2) Euro-area countries fold onto the shared EU bundle.
  const EURO_COUNTRIES = new Set([
    'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'IE', 'IT', 'LT',
    'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'HR',
  ])
  if (EURO_COUNTRIES.has(regionSubtag)) return 'EU'

  // 3) No region subtag — infer from a language commonly tied to one region.
  if (!regionSubtag) {
    switch (language) {
      case 'ja':
        return 'JP'
      case 'hi':
        return 'IN'
      case 'de':
      case 'fr':
      case 'es':
      case 'it':
      case 'nl':
      case 'pt':
        return 'EU'
      default:
        return DEFAULT_REGION
    }
  }

  return DEFAULT_REGION
}

/**
 * Best-effort guess of the user's region from the browser's locale. SSR-safe:
 * returns the default region when no `navigator` is available.
 */
export function detectRegion(): RegionCode {
  if (typeof navigator === 'undefined') return DEFAULT_REGION
  const nav = navigator as Navigator & { languages?: readonly string[] }
  const locale = nav.languages?.[0] ?? nav.language
  return detectRegionFromLocale(locale)
}

// ============================================================================
// Region preference
// ============================================================================

/**
 * The user's effective region. Precedence:
 *   1. an explicitly stored choice (set in Settings), else
 *   2. a best-effort guess from the browser locale (for brand-new users), else
 *   3. the default region.
 *
 * For an en-US user with no stored choice this resolves to the US, keeping the
 * standard experience unchanged. Never throws.
 */
export function getRegion(): RegionCode {
  if (typeof window === 'undefined') return DEFAULT_REGION
  try {
    const stored = localStorage.getItem(REGION_KEY)
    if (isRegionCode(stored)) return stored
  } catch {
    // localStorage unavailable — fall through to detection.
  }
  return detectRegion()
}

/**
 * Persist the user's region choice and cascade its currency + locale defaults
 * into the sibling preference layers (currency, locale) so a single choice
 * localizes formatting everywhere. Passing a falsy/unknown code clears the
 * stored choice, restoring detection-based behavior.
 *
 * Note: this only updates DEFAULT preferences — it never rewrites transactions
 * or budgets the user has already entered.
 */
export function setRegion(code: string | undefined | null): void {
  if (typeof window === 'undefined') return
  const normalized = typeof code === 'string' ? code.toUpperCase() : ''

  try {
    if (!isRegionCode(normalized)) {
      localStorage.removeItem(REGION_KEY)
      return
    }
    localStorage.setItem(REGION_KEY, normalized)
  } catch {
    // localStorage unavailable — still apply the cascade below when possible.
  }

  if (isRegionCode(normalized)) {
    applyRegionDefaults(REGIONS[normalized])
  }
}

/**
 * Cascade a region's currency + locale into the sibling preference layers.
 * Kept separate so onboarding can apply detected defaults without persisting a
 * region choice, and so Settings can re-apply on demand.
 */
export function applyRegionDefaults(region: RegionDefaults): void {
  setHomeCurrency(region.currency)
  if (isValidLocale(region.locale)) {
    setLocale(region.locale)
  }
}

// ============================================================================
// Region-aware accessors (consumed by onboarding, Settings & quick-log)
// ============================================================================

/** The display currency symbol for a region, e.g. "£" for GB. */
export function getRegionCurrencySymbol(code: string | undefined | null): string {
  return getCurrencySymbol(getRegionDefaults(code).currency)
}

/** The default home currency (ISO code) for a region, normalized. */
export function getRegionCurrencyCode(code: string | undefined | null): string {
  return normalizeCode(getRegionDefaults(code).currency) || DEFAULT_HOME_CURRENCY
}

/**
 * The region-aware label for a category. Falls back to `fallbackLabel` (the
 * shared default label) when the region has no override, so callers can pass
 * the existing `BUDGET_CATEGORIES` label and get a region-tuned result.
 */
export function getRegionCategoryLabel(
  category: TransactionCategory,
  fallbackLabel: string,
  code: string | undefined | null = getRegion()
): string {
  return getRegionDefaults(code).categoryLabels[category] ?? fallbackLabel
}

/**
 * Region-aware quick-amount presets for a category. Uses the region's tuned
 * presets when present, otherwise falls back to the shared, currency-agnostic
 * presets from `suggestionUtils.getCategoryPresets` — so behavior is identical
 * to before for the US/default region.
 */
export function getRegionCategoryPresets(
  category: TransactionCategory,
  code: string | undefined | null = getRegion()
): number[] {
  const override = getRegionDefaults(code).amountPresets[category]
  return override && override.length > 0 ? override : getCategoryPresets(category)
}

/** The suggested starting daily allowance / monthly pool for a region. */
export function getRegionBudgetPresets(
  code: string | undefined | null = getRegion()
): RegionDefaults['budgetPresets'] {
  return getRegionDefaults(code).budgetPresets
}
