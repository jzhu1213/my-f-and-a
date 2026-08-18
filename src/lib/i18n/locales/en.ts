// ============================================================================
// English (en) — canonical translation bundle & source of truth
// ============================================================================
//
// Task 197.1 — i18n scaffolding (Group 28: Internationalization).
//
// English is the authoritative resource: its keys define `TranslationKey`, and
// every other language is a partial map checked against these keys. Adding a
// new user-facing string means adding it here first.
//
// Keys are namespaced with dot notation ("common.save") for readability and to
// keep related copy grouped. Placeholders use `{name}` syntax and are filled in
// by the `t()` helper at render time.
//
// Tone (Task 124 — warm, shame-free): copy is short, human, and encouraging.
// No jargon, no blame. "Tomorrow resets" over "You overspent." Keep it kind.
//
// This is a representative, high-value starter set (onboarding, daily allowance
// messages, tips, and common UI labels) — enough to establish the pattern, with
// the structure ready to extend across the rest of the app.

export const en = {
  // --------------------------------------------------------------------------
  // Common UI labels — buttons, nav, and shared actions
  // --------------------------------------------------------------------------
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.undo': 'Undo',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.skip': 'Skip',
  'common.gotIt': 'Got it',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',

  'nav.home': 'Home',
  'nav.history': 'History',
  'nav.tools': 'Tools',
  'nav.settings': 'Settings',

  // --------------------------------------------------------------------------
  // Onboarding — warm, no forced setup, lands on value immediately
  // --------------------------------------------------------------------------
  'onboarding.welcomeTitle': 'Welcome to Folio',
  'onboarding.welcomeSubtitle': "Let's figure out what you can spend today — no stress, no setup required.",
  'onboarding.coreQuestion': 'Can I afford this today?',
  'onboarding.getStarted': 'Get started',
  'onboarding.skipForNow': "I'll set this up later",
  'onboarding.incomePrompt': 'Roughly how much money do you have to work with?',
  'onboarding.incomeHelp': 'A rough number is perfect. You can always change it later.',
  'onboarding.allSet': "You're all set!",
  'onboarding.allSetSubtitle': "Here's your spending room for today. Log as you go.",

  // --------------------------------------------------------------------------
  // Daily allowance hero — the core "can I afford this today?" number
  // --------------------------------------------------------------------------
  'allowance.leftToday': 'left to spend today',
  'allowance.spentToday': 'spent today',
  'allowance.statusHealthy': 'Looking good',
  'allowance.statusCaution': 'Heads up',
  'allowance.statusWarning': 'Almost there',
  'allowance.statusOver': 'A little tight today',

  // Encouraging hero messages. `{amount}` is a preformatted, localized amount.
  'allowance.msgHealthyHigh': "Nice! You've got {amount} left today.",
  'allowance.msgHealthyMid': "You're doing great — {amount} to go.",
  'allowance.msgHealthyLow': 'Still {amount} left. You\u2019re on track!',
  'allowance.msgCaution': 'Heads up — {amount} left today.',
  'allowance.msgCautionLow': "Getting close — {amount} left. You've got this.",
  'allowance.msgWarning': 'Almost there — just {amount} left today.',
  'allowance.msgAtLimit': 'Right at your limit. Nice job staying on track.',
  'allowance.msgOverSmall': 'A little tight today — tomorrow resets.',
  'allowance.msgOverMid': "Over today, but no stress. Tomorrow's a fresh start.",
  'allowance.msgOverLarge': 'Big day for spending — tomorrow gives you a clean start.',
  'allowance.usuallyBand': 'usually {low}–{high}',

  // --------------------------------------------------------------------------
  // Quick log — one-tap logging
  // --------------------------------------------------------------------------
  'quicklog.addExpense': 'Add expense',
  'quicklog.addIncome': 'Add income',
  'quicklog.amount': 'Amount',
  'quicklog.category': 'Category',
  'quicklog.note': 'Note',
  'quicklog.notePlaceholder': 'What was it for? (optional)',
  'quicklog.saved': 'Logged {amount}',
  'quicklog.savedUndoHint': 'Logged — tap to undo',

  // --------------------------------------------------------------------------
  // Contextual tips — one calm, helpful line at a time
  // --------------------------------------------------------------------------
  'tip.titleCelebration': "You're on fire!",
  'tip.titleGentleNudge': 'Heads up',
  'tip.titleDidYouKnow': 'Quick tip',
  'tip.titleSmartSuggestion': 'Try this',
  'tip.pacingOnTrack': "You're pacing nicely for the week.",
  'tip.pacingEasy': 'Plenty of room left this week — spend easy.',
  'tip.anomalyGentle': "That's a bit more than your usual — all good if it was intentional.",
  'tip.billReminder': '{name} is coming up soon.',
  'tip.dismiss': 'Dismiss',

  // --------------------------------------------------------------------------
  // Categories — friendly names
  // --------------------------------------------------------------------------
  'category.food': 'Food',
  'category.rent': 'Rent',
  'category.transport': 'Transport',
  'category.school': 'School',
  'category.fun': 'Fun',
  'category.health': 'Health',
  'category.subscriptions': 'Subscriptions',
  'category.other': 'Other',
  'category.gig': 'Gig',
  'category.income': 'Income',

  // --------------------------------------------------------------------------
  // Home screen — section headers, actions, empty states
  // --------------------------------------------------------------------------
  'home.logExpense': 'Log expense',
  'home.logIncome': 'Log income',
  'home.logFirstExpense': 'Log your first expense',
  'home.sectionRecent': 'Recent',
  'home.sectionCategories': 'Categories',
  'home.seeAll': 'See all →',
  'home.split': '🤝 Split',
  'home.canIAfford': '🤔 Can I afford this?',
  'home.addWish': '⭐ + Wish',
  'home.logIncomeArrow': 'Log income →',
  'home.overBudgetGentle': 'Spent a bit more today — tomorrow resets ✨',
  'home.overBudgetStrip': 'Tomorrow\u2019s budget resets — or log income to top up today.',
  'home.estimateNudge': '✨ Estimated — tap to log income for accuracy →',
  'home.zeroSpendMark': '🎯 Nothing spent? Mark as $0 day',
  'home.zeroSpendConfirm': '✓ Day logged — streak continues',
  'home.spendDownOnTrack': 'On track ✓',
  'home.spendDownAhead': 'A bit ahead of pace',
  'home.emptyFirstRunTitle': 'Your spending will show up here.',
  'home.emptyFirstRunSubtitle': 'Log your first expense and watch your day take shape.',
  'home.emptyTitle': 'Ready when you are',
  'home.emptySubtitle': 'Log your first expense and Folio starts learning your habits',
  'home.emptyAction': 'Log expense →',
  'home.categoryEmptyTitle': 'You\u2019re all set to start — limits are optional',
  'home.categoryEmptySubtitle': 'Add category limits anytime for a more accurate daily number',
  'home.categoryEmptyAction': 'Set up limits →',
  'home.viewAllSplits': 'View all ({count}) →',

  // --------------------------------------------------------------------------
  // History screen
  // --------------------------------------------------------------------------
  'history.title': 'History',
  'history.showing': 'Showing {count} {noun} of {total} total',
  'history.transaction': 'transaction',
  'history.transactions': 'transactions',

  // --------------------------------------------------------------------------
  // Quick log — validation & actions
  // --------------------------------------------------------------------------
  'quicklog.logExpense': 'Log expense',
  'quicklog.cancel': 'Cancel',
  'quicklog.validationInvalid': 'Enter a valid amount',
  'quicklog.validationPositive': 'Amount must be greater than $0',
  'quicklog.validationMax': 'Amount cannot exceed ${max}',
  'quicklog.notePlaceholderShort': 'Note (optional)',

  // --------------------------------------------------------------------------
  // Settings — language selection lives here
  // --------------------------------------------------------------------------
  'settings.language': 'Language',
  'settings.languageHelp': 'Choose the language for labels and messages.',
  'settings.languageEnglish': 'English',
  'settings.languageSpanish': 'Español',
} as const
