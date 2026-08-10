/**
 * Destination Map — Documents all app surfaces and their owning destinations.
 *
 * Every surface in the app is assigned to one of 4 primary destinations
 * (home, history, tools, settings) and is reachable in ≤3 taps from Home.
 * The dock order defines adjacency for horizontal swipe navigation:
 *   home(0) → history(1) → tools(2) → settings(3)
 *
 * Validates: Requirements 10.1, 10.2, 10.4
 */

// ============================================================================
// Types
// ============================================================================

/** The 4 primary destinations matching the dock order. */
export type PrimaryDestination = 'home' | 'history' | 'tools' | 'settings'

/** A single surface/screen entry in the destination map. */
export interface DestinationEntry {
  /** Unique identifier for this surface. */
  id: string
  /** Human-readable name for the surface. */
  name: string
  /** Which primary destination owns this surface. */
  owningDestination: PrimaryDestination
  /** Ordered path of controls/gestures from Home to reach this surface. */
  path: string[]
  /** Number of taps from Home to reach this surface. Must be ≤3. */
  tapCount: number
  /** Component filename that renders this surface. */
  surface: string
}

/** A named section grouping depth surfaces (≤7 entries per section). */
export interface DestinationSection {
  name: string
  entries: string[]
}

// ============================================================================
// Destination Map
// ============================================================================

/**
 * Complete map of all surfaces in the app. Every entry has tapCount ≤ 3,
 * ensuring all surfaces are reachable within 3 taps from Home.
 */
export const destinationMap: DestinationEntry[] = [
  // ── Home destination ────────────────────────────────────────────────────────
  { id: 'home', name: 'Home', owningDestination: 'home', path: [], tapCount: 0, surface: 'HomeScreen.tsx' },
  { id: 'expense-sheet', name: 'Expense Logging', owningDestination: 'home', path: ['Quick Log'], tapCount: 1, surface: 'ExpenseSheet.tsx' },
  { id: 'income-sheet', name: 'Income Logging', owningDestination: 'home', path: ['Quick Log', 'Income tab'], tapCount: 2, surface: 'IncomeSheet.tsx' },
  { id: 'paycheck-sheet', name: 'Paycheck Allocation', owningDestination: 'home', path: ['Quick Log', 'Paycheck tab'], tapCount: 2, surface: 'PaycheckSheet.tsx' },
  { id: 'edit-sheet', name: 'Edit Transaction', owningDestination: 'home', path: ['Transaction row', 'Edit'], tapCount: 2, surface: 'EditTransactionSheet.tsx' },
  { id: 'refund-sheet', name: 'Refund', owningDestination: 'home', path: ['Transaction row', 'Refund'], tapCount: 2, surface: 'RefundSheet.tsx' },

  // ── History destination ─────────────────────────────────────────────────────
  { id: 'history', name: 'History', owningDestination: 'history', path: ['History tab'], tapCount: 1, surface: 'HistoryScreen.tsx' },

  // ── Tools destination ───────────────────────────────────────────────────────
  { id: 'tools', name: 'Tools', owningDestination: 'tools', path: ['Tools tab'], tapCount: 1, surface: 'ToolsScreen.tsx' },
  { id: 'budgets', name: 'Budget Settings', owningDestination: 'tools', path: ['Tools tab', 'Budgets'], tapCount: 2, surface: 'BudgetSettings.tsx' },
  { id: 'goals', name: 'Goals', owningDestination: 'tools', path: ['Tools tab', 'Goals'], tapCount: 2, surface: 'GoalsScreen.tsx' },
  { id: 'sinking-funds', name: 'Sinking Funds', owningDestination: 'tools', path: ['Tools tab', 'Sinking Funds'], tapCount: 2, surface: 'SinkingFundsScreen.tsx' },
  { id: 'subscriptions', name: 'Subscription Audit', owningDestination: 'tools', path: ['Tools tab', 'Subscriptions'], tapCount: 2, surface: 'SubscriptionAuditScreen.tsx' },
  { id: 'recurring-bills', name: 'Recurring Bills', owningDestination: 'tools', path: ['Tools tab', 'Bills'], tapCount: 2, surface: 'RecurringBillsScreen.tsx' },
  { id: 'debt', name: 'Debt Tracker', owningDestination: 'tools', path: ['Tools tab', 'Debt'], tapCount: 2, surface: 'DebtScreen.tsx' },
  { id: 'reimbursements', name: 'Reimbursements', owningDestination: 'tools', path: ['Tools tab', 'Reimbursements'], tapCount: 2, surface: 'ReimbursementLedger.tsx' },
  { id: 'lessons', name: 'Financial Lessons', owningDestination: 'tools', path: ['Tools tab', 'Learn'], tapCount: 2, surface: 'LessonsScreen.tsx' },
  { id: 'compound-calc', name: 'Compound Growth Calc', owningDestination: 'tools', path: ['Tools tab', 'Calculators'], tapCount: 2, surface: 'CompoundGrowthCalculator.tsx' },
  { id: 'credit-calc', name: 'Credit Payoff Calc', owningDestination: 'tools', path: ['Tools tab', 'Calculators'], tapCount: 2, surface: 'CreditPayoffCalculator.tsx' },

  // ── Settings destination ────────────────────────────────────────────────────
  { id: 'settings', name: 'Settings', owningDestination: 'settings', path: ['Settings tab'], tapCount: 1, surface: 'SettingsScreen.tsx' },
  { id: 'profile', name: 'Profile', owningDestination: 'settings', path: ['Settings tab', 'Profile'], tapCount: 2, surface: 'ProfileSheet.tsx' },
  { id: 'funding-sources', name: 'Funding Sources', owningDestination: 'settings', path: ['Settings tab', 'Funding'], tapCount: 2, surface: 'FundingSourcesScreen.tsx' },
  { id: 'linked-accounts', name: 'Linked Accounts', owningDestination: 'settings', path: ['Settings tab', 'Accounts'], tapCount: 2, surface: 'LinkedAccountsScreen.tsx' },
  { id: 'categorization-rules', name: 'Categorization Rules', owningDestination: 'settings', path: ['Settings tab', 'Rules'], tapCount: 2, surface: 'CategorizationRulesScreen.tsx' },
]

// ============================================================================
// Section Groupings (≤7 entries per section for cognitive load)
// ============================================================================

/**
 * Organizes depth surfaces within each destination into logical sections.
 * Each section contains ≤7 entries per Miller's Law (cognitive chunking).
 */
export const destinationSections: Record<PrimaryDestination, DestinationSection[]> = {
  home: [
    { name: 'Quick Actions', entries: ['expense-sheet', 'income-sheet', 'paycheck-sheet', 'edit-sheet', 'refund-sheet'] },
  ],
  history: [
    { name: 'Timeline', entries: ['history'] },
  ],
  tools: [
    { name: 'Budgeting', entries: ['budgets', 'goals', 'sinking-funds'] },
    { name: 'Bills & Debt', entries: ['subscriptions', 'recurring-bills', 'debt', 'reimbursements'] },
    { name: 'Learn & Calculate', entries: ['lessons', 'compound-calc', 'credit-calc'] },
  ],
  settings: [
    { name: 'Account', entries: ['profile', 'funding-sources', 'linked-accounts', 'categorization-rules'] },
  ],
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that every surface in the destination map is reachable
 * within ≤3 taps from Home.
 */
export function validateReachability(): boolean {
  return destinationMap.every(entry => entry.tapCount <= 3)
}

/**
 * Validates that all section groupings contain ≤7 entries
 * (cognitive chunking constraint).
 */
export function validateSectionSizes(): boolean {
  return Object.values(destinationSections).every(
    sections => sections.every(section => section.entries.length <= 7)
  )
}
