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
  // Home screen — additional extracted strings
  // --------------------------------------------------------------------------
  'home.noLimit': 'no limit',
  'home.overThisWeek': '${amount} over this week',
  'home.leftThisWeek': '${amount} left',
  'home.spentAmount': '${amount} spent',
  'home.syncing': 'syncing\u2026',
  'home.overBudgetShort': 'A little over \u2014 tomorrow resets',
  'home.daySpent': '${amount} spent',

  // --------------------------------------------------------------------------
  // Tools screen — section headers, descriptions, actions
  // --------------------------------------------------------------------------
  'tools.title': 'Tools',
  'tools.subtitle': 'Advanced features, calculators, and tracking tools.',
  'tools.recentlyUsed': 'Recently Used',
  'tools.startHere': 'Start Here',
  'tools.startHereDescription': 'These three tools will help you get started with budgeting.',
  'tools.seeAllTools': 'See all tools \u2192',
  'tools.savingsAutomation': 'Savings Automation',
  'tools.setAsideThisMonth': 'Set aside this month',
  'tools.showHowYouCompare': 'Show \u201cHow You Compare\u201d',
  'tools.peerContextDescription': 'Encouraging, anonymized peer context',
  'tools.peerContextAriaLabel': 'Enable peer context comparisons',
  'tools.sectionMoneyMap': 'Money Map',
  'tools.sectionBillsSubscriptions': 'Bills & Subscriptions',
  'tools.sectionSavingPlanning': 'Saving & Planning',
  'tools.sectionPeopleSplits': 'People & Splits',
  'tools.sectionDebt': 'Debt',
  'tools.sectionInsightsReviews': 'Insights & Reviews',
  'tools.sectionLearnGrow': 'Learn & Grow',
  'tools.sectionCalculators': 'Calculators',
  'tools.toolTrajectory': 'Financial Trajectory',
  'tools.toolTrajectoryDesc': 'See how your money habits are trending.',
  'tools.toolDebt': 'Debt Tracking',
  'tools.toolDebtDesc': 'Track balances, APRs, and payoff timelines.',
  'tools.toolRecurring': 'Recurring',
  'tools.toolRecurringDesc': 'Bills and auto-detected patterns in one place.',
  'tools.toolReimbursements': 'IOUs & Reimbursements',
  'tools.toolReimbursementsDesc': 'Track money friends owe you \u2014 or that you owe them.',
  'tools.toolSinkingFunds': 'Sinking Funds',
  'tools.toolSinkingFundsDesc': 'Save gradually for predictable large expenses.',
  'tools.toolSubscriptions': 'Subscriptions',
  'tools.toolSubscriptionsDesc': 'Review and manage recurring charges.',
  'tools.toolShared': 'Shared',
  'tools.toolSharedDesc': 'Pools, budgets, and invites \u2014 all shared money.',
  'tools.toolSavings': 'Savings',
  'tools.toolSavingsDesc': 'Projections, accounts, and allocation in one view.',
  'tools.toolWishList': 'Wish List',
  'tools.toolWishListDesc': 'Track what you want and see when you can afford it.',
  'tools.toolCashFlowForecast': 'Cash Flow Forecast',
  'tools.toolCashFlowForecastDesc': 'See projected balance through next payday.',
  'tools.toolCompoundGrowth': 'Compound Growth',
  'tools.toolCompoundGrowthDesc': 'See how savings grow with compound interest.',
  'tools.toolCreditPayoff': 'Credit Payoff',
  'tools.toolCreditPayoffDesc': 'Plan how to pay off credit card debt faster.',
  'tools.toolTermReview': 'Term / Year in Review',
  'tools.toolTermReviewDesc': 'A warm recap of your wins \u2014 by term or year.',
  'tools.toolYearInReview': 'Year in Review',
  'tools.toolYearInReviewDesc': 'A once-a-year look back at your streaks and savings.',
  'tools.toolPeerContext': 'How You Compare',
  'tools.toolPeerContextDesc': 'Optional anonymized context against student ranges.',
  'tools.toolLearn': 'Lessons',
  'tools.toolLearnDesc': 'Short lessons on budgeting, saving, and investing.',
  'tools.toolIncomeTrends': 'Income Trends',
  'tools.toolIncomeTrendsDesc': 'See how your earnings grow over time.',
  'tools.toolStatementImport': 'Import Statement',
  'tools.toolStatementImportDesc': 'Import transactions from a bank CSV.',
  'tools.toolConfidence': 'Money Confidence',
  'tools.toolConfidenceDesc': 'A gentle journal of your financial habits.',
  'tools.toolWeeklyInsights': 'Weekly Insights',
  'tools.toolWeeklyInsightsDesc': 'Bite-sized spending patterns and tips each week.',
  'tools.toolProgressMilestones': 'Progress & Milestones',
  'tools.toolProgressMilestonesDesc': 'Achievements, heatmap, and garden in one view.',
  'tools.toolChallenges': 'Challenges',
  'tools.toolChallengesDesc': 'Fun weekly challenges to build better habits.',

  // --------------------------------------------------------------------------
  // Settings screen
  // --------------------------------------------------------------------------
  'settings.title': 'Settings',
  'settings.searchPlaceholder': 'Search settings...',
  'settings.searchAriaLabel': 'Search settings',
  'settings.noResults': 'No settings match \u201c{query}\u201d',
  'settings.helpInfo': 'Help & Info',
  'settings.whatsNew': "What\u2019s New",
  'settings.catchUpMissedDays': 'Catch up on missed days',
  'settings.travelMode': 'Travel mode',
  'settings.resumeSetup': 'Resume setup',
  'settings.language': 'Language',
  'settings.languageHelp': 'Choose the language for labels and messages.',
  'settings.languageEnglish': 'English',
  'settings.languageSpanish': 'Español',
  'settings.nav.profile': 'Profile',
  'settings.nav.spending': 'Spending',
  'settings.nav.budget': 'Budget',
  'settings.nav.heroNumber': 'Hero number',
  'settings.nav.home': 'Home',
  'settings.nav.appearance': 'Appearance',
  'settings.nav.motivation': 'Motivation',
  'settings.nav.learning': 'Learning',
  'settings.nav.notifications': 'Notifications',
  'settings.nav.features': 'Features',
  'settings.nav.automation': 'Automation',
  'settings.nav.privacy': 'Privacy',
  'settings.nav.export': 'Export',
  'settings.badge.guided': 'Guided',
  'settings.badge.warm': 'Warm',
  'settings.badge.dark': 'Dark',
  'settings.badge.system': 'System',
  'settings.badge.on': 'On',
  'settings.badge.subtle': 'Subtle',
  'settings.badge.off': 'Off',
  'settings.badge.active': '{count} active',
  'settings.badge.shared': '{count} shared',

  // --------------------------------------------------------------------------
  // Edit transaction sheet
  // --------------------------------------------------------------------------
  'editTransaction.title': 'Edit transaction',
  'editTransaction.addNote': 'Add a note',
  'editTransaction.notePlaceholder': "What\u2019s this for?",
  'editTransaction.save': 'Save',
  'editTransaction.saving': 'Saving...',
  'editTransaction.refund': '\u21a9 Refund this',
  'editTransaction.updated': 'Transaction updated \u2713',
  'editTransaction.undoLabel': 'Undo',
  'editTransaction.reverted': 'Change reverted',
  'editTransaction.failed': 'Failed to save \u2014 try again',
  'editTransaction.errorPositive': 'Amount must be more than $0',
  'editTransaction.errorMax': "Amount can\u2019t exceed $99,999",

  // --------------------------------------------------------------------------
  // Expense sheet
  // --------------------------------------------------------------------------
  'expense.howMuchEarn': 'How much did you earn?',
  'expense.logExpense': 'Log expense',
  'expense.logButton': 'Log',
  'expense.notePlaceholder': 'What was it for? (optional)',
  'expense.addNote': '+ Note',
  'expense.splitWith': 'Split with',
  'expense.logged': 'Logged {amount} for {category} \u2713',
  'expense.loggedSplitSingle': 'Logged {amount} (your share) \u2014 {name} owes you {owed} \ud83d\udcb8',
  'expense.loggedSplitMultiple': 'Logged {amount} (your share) \u2014 friends owe you {owed} \ud83d\udcb8',

  // --------------------------------------------------------------------------
  // Income sheet
  // --------------------------------------------------------------------------
  'income.howMuchEarn': 'How much did you earn?',
  'income.logIncome': 'Log income',
  'income.incomeLogged': 'Income logged \u2713',
  'income.contributePrompt': 'Want to move a little toward future you?',
  'income.contributeButton': 'Contribute {amount} to {name}?',
  'income.contributeSubtitle': 'Your usual monthly contribution',
  'income.notNow': 'Not now',
  'income.loggedSuccess': 'Logged +{amount} income{suffix} \u2713',
  'income.contributed': 'Nice \u2014 {amount} on its way to {name} \ud83c\udf31',
  'income.paymentMethod': 'Payment method',
  'income.spreadSuffix': ' (spread over {months}mo)',

  // --------------------------------------------------------------------------
  // Refund sheet
  // --------------------------------------------------------------------------
  'refund.title': 'Log a refund',
  'refund.originalExpense': 'Original expense',
  'refund.amount': 'Refund amount',
  'refund.logRefund': 'Log Refund',
  'refund.logged': 'Refund of {amount} logged \u2713',
  'refund.errorExceedsOriginal': 'Refund amount can\u2019t exceed the original (${max})',

  // --------------------------------------------------------------------------
  // Plurals — ICU-style plural expressions for count-dependent copy
  // --------------------------------------------------------------------------
  'plural.days': '{count, plural, one {# day} other {# days}}',
  'plural.transactions': '{count, plural, one {# transaction} other {# transactions}}',
  'plural.items': '{count, plural, one {# item} other {# items}}',
  'plural.months': '{count, plural, one {# month} other {# months}}',
  'plural.weeks': '{count, plural, one {# week} other {# weeks}}',
  'plural.bills': '{count, plural, one {# bill} other {# bills}}',
  'plural.goals': '{count, plural, one {# goal} other {# goals}}',
  'plural.friends': '{count, plural, one {# friend} other {# friends}}',
  'plural.lessons': '{count, plural, one {# lesson} other {# lessons}}',
} as const
