/**
 * Settings structure definition for the simplified hub-and-spoke settings architecture.
 *
 * Defines the 10 top-level settings categories, their metadata (for rendering
 * the main settings list), and a mapping from old sections → new categories
 * so nothing is lost during the restructure.
 *
 * Requirements: 20.1, 20.2
 */

// ============================================================================
// Types
// ============================================================================

/**
 * What kind of current-value badge to display on the main settings row.
 *
 * - 'label'  — show a text label (e.g. "Guided", "Warm")
 * - 'count'  — show a numeric count (e.g. "3 active")
 * - 'status' — show an on/off status indicator
 * - 'none'   — no value badge shown
 */
export type ValueHintType = 'label' | 'count' | 'status' | 'none'

/**
 * A top-level settings category in the hub-and-spoke navigation.
 */
export interface SettingsCategory {
  /** Unique kebab-case identifier for routing and key props. */
  id: string
  /** Display label shown in the main settings list (≤4 words). */
  label: string
  /** Emoji icon rendered at the leading edge of the row. */
  icon: string
  /** One-line subtitle describing what this category controls. */
  description: string
  /** Search keywords for filtering — includes synonyms and related terms. */
  keywords: string[]
  /** Type of current-value badge to render on the right side of the row. */
  valueHint: ValueHintType
  /** Description of what the value badge shows (for developer reference). */
  valueHintDescription: string
}

// ============================================================================
// Categories (10 items + danger zone)
// ============================================================================

/**
 * The 10 top-level settings categories.
 *
 * Target: 8–10 rows that fit in one viewport on standard phones.
 * Order reflects user mental model and frequency of access.
 */
export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: '👤',
    description: 'Account, handle, avatar',
    keywords: ['profile', 'account', 'handle', 'avatar', 'email', 'sign out', 'logout'],
    valueHint: 'none',
    valueHintDescription: '',
  },
  {
    id: 'spending-style',
    label: 'Spending style',
    icon: '🎯',
    description: 'How Folio tracks your spending',
    keywords: ['spending', 'mode', 'tracker', 'guided', 'structured', 'over-limit', 'limit', 'response', 'goal', 'focus'],
    valueHint: 'label',
    valueHintDescription: 'Current spending mode label (e.g. "Guided")',
  },
  {
    id: 'budget-income',
    label: 'Budget & income',
    icon: '💰',
    description: 'Limits, income method, categories',
    keywords: ['budget', 'limits', 'income', 'category', 'smoothing', 'term', 'semester', 'spend-down', 'categorization', 'rules', 'categories'],
    valueHint: 'none',
    valueHintDescription: '',
  },
  {
    id: 'hero-display',
    label: 'What the number shows',
    icon: '🔢',
    description: 'Hero meaning and period context',
    keywords: ['hero', 'big number', 'display', 'allowance', 'spent', 'balance', 'meaning', 'number'],
    valueHint: 'label',
    valueHintDescription: 'Current hero meaning label (e.g. "Today\'s budget")',
  },
  {
    id: 'home-screen',
    label: 'Home screen',
    icon: '🏠',
    description: 'Extras, pace indicator, badges',
    keywords: ['home', 'extras', 'pace', 'indicator', 'savings', 'badge', 'insight', 'cards', 'widgets'],
    valueHint: 'none',
    valueHintDescription: '',
  },
  {
    id: 'look-feel',
    label: 'Look & feel',
    icon: '🎨',
    description: 'Theme, region, currency',
    keywords: ['appearance', 'theme', 'warm', 'dark', 'system', 'region', 'currency', 'look', 'feel'],
    valueHint: 'label',
    valueHintDescription: 'Current theme name (e.g. "Warm")',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: '🔔',
    description: 'Nudges, alerts, balance buffer',
    keywords: ['notification', 'nudge', 'buffer', 'balance', 'minimum', 'alert', 'remind'],
    valueHint: 'status',
    valueHintDescription: 'Whether notifications are on or off',
  },
  {
    id: 'tools-features',
    label: 'Tools & features',
    icon: '🧰',
    description: 'Feature toggles, categorization',
    keywords: ['tools', 'features', 'visibility', 'toggle', 'credit', 'peer', 'categorization', 'rules'],
    valueHint: 'none',
    valueHintDescription: '',
  },
  {
    id: 'privacy-security',
    label: 'Privacy & security',
    icon: '🔒',
    description: 'App lock, sessions, data dashboard',
    keywords: ['privacy', 'security', 'lock', 'pin', 'biometric', 'session', 'data', 'dashboard'],
    valueHint: 'none',
    valueHintDescription: '',
  },
  {
    id: 'data-export',
    label: 'Data & export',
    icon: '📦',
    description: 'Export, sharing, reports',
    keywords: ['data', 'export', 'csv', 'pdf', 'sharing', 'reports', 'download'],
    valueHint: 'count',
    valueHintDescription: 'Active share count (e.g. "2 shared")',
  },
] as const

/** Category ID union type for type-safe routing. */
export type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]['id']

// ============================================================================
// Mapping: old sections → new categories
// ============================================================================

/**
 * Documents what moved from the old collapsible sections to the new categories.
 * This ensures nothing is lost during the restructure (Req 20.2).
 *
 * Old section IDs: 'spending-style', 'hero-display', 'home-cards',
 * 'budget-income', 'payment-methods', 'appearance', 'notifications',
 * 'privacy-security', 'data-account'
 */
export const SETTINGS_MAPPING: Record<string, { newCategory: SettingsCategoryId; items: string[] }> = {
  // Old "Spending Style" section
  'spending-style': {
    newCategory: 'spending-style',
    items: [
      'Spending mode segmented control (tracker/guided/structured)',
      'Over-limit response selector (quiet/gentle/headsup)',
      'Focus/goal picker (6 radio options)',
    ],
  },

  // Old "Hero & Display" section
  'hero-display': {
    newCategory: 'hero-display',
    items: [
      'Hero meaning selector (4 radio options) → hero-display',
    ],
  },
  'hero-display:feature-visibility': {
    newCategory: 'tools-features',
    items: [
      'Feature visibility toggles (11 toggles) → tools-features',
    ],
  },
  'hero-display:home-extras': {
    newCategory: 'home-screen',
    items: [
      'Home screen extras toggles (savings badge, pace indicator) → home-screen',
    ],
  },

  // Old "Home Cards" section
  'home-cards': {
    newCategory: 'home-screen',
    items: [
      'Pinned cards configuration',
      'Widget toggles',
    ],
  },

  // Old "Budget & Income" section
  'budget-income': {
    newCategory: 'budget-income',
    items: [
      'Budget limits summary + manage link',
      'Category hub link',
      'Income smoothing selector',
      'Academic term schedule (inline form → own sub-flow)',
      'Spend-down plans (inline CRUD → own sub-flow)',
      'Smart categorization rules (inline form → tools-features sub-screen)',
    ],
  },

  // Old "Payment Methods" section
  'payment-methods': {
    newCategory: 'budget-income',
    items: [
      'Funding sources link → budget-income (as a row)',
      'Linked accounts link → budget-income (as a row)',
    ],
  },

  // Old "Appearance" section
  'appearance:theme': {
    newCategory: 'look-feel',
    items: [
      'Theme segmented control (warm/dark/system)',
      'Region settings component',
    ],
  },
  'appearance:preferences': {
    newCategory: 'tools-features',
    items: [
      'Show credit score toggle → tools-features',
      'Show peer context toggle → tools-features',
    ],
  },
  'appearance:home-prefs': {
    newCategory: 'home-screen',
    items: [
      'Show daily insight toggle → home-screen',
    ],
  },
  'appearance:budget-prefs': {
    newCategory: 'budget-income',
    items: [
      'Count credit immediately toggle → budget-income',
    ],
  },
  'appearance:actions': {
    newCategory: 'profile',
    items: [
      'Reset tutorial → profile (help & onboarding)',
      'Replay demos → profile (help & onboarding)',
      'Backfill → profile (help & onboarding)',
    ],
  },

  // Old "Notifications" section
  'notifications': {
    newCategory: 'notifications',
    items: [
      'NotificationCenter component',
      'Min-balance buffer setting',
    ],
  },

  // Old "Privacy & Security" section
  'privacy-security': {
    newCategory: 'privacy-security',
    items: [
      'App lock setting (PIN/biometric)',
      'Sessions management',
      'Privacy dashboard link',
    ],
  },

  // Old "Data & Account" section
  'data-account:profile': {
    newCategory: 'profile',
    items: [
      'Account/profile link → profile',
      'Sign out → profile',
    ],
  },
  'data-account:data': {
    newCategory: 'data-export',
    items: [
      'Export PDF',
      'Export CSV',
      'Reports link',
      'Sharing management link',
    ],
  },
  'data-account:goals': {
    newCategory: 'budget-income',
    items: [
      'Goals summary + manage link → budget-income',
    ],
  },
} as const
