/**
 * Contextual Lesson Content — Trigger → Lesson Mapping
 *
 * Defines 40 contextual lessons covering budgeting basics, saving, debt,
 * investing concepts, spending awareness, credit, and habit formation.
 *
 * Each lesson has:
 *   - trigger condition (via TriggerDefinition id)
 *   - micro-content (1–2 sentences)
 *   - optional deep dive content
 *   - topic classification
 *   - "seen" state (tracked via trigger engine history)
 *
 * Content uses template placeholders (e.g., {{daily_coffee_cost}}) for future
 * personalization via the template renderer (Phase 18 Group 133, task 441.1).
 *
 * Requirements: 26.1
 */

import type { TriggerDefinition, TriggerPriority, TriggerType } from '@/lib/lessonTriggerEngine'
import type { LessonTopic } from '@/types'

// ============================================================================
// Types
// ============================================================================

/**
 * A contextual lesson: micro-content surfaced at the right moment.
 */
export interface ContextualLesson {
  /** Unique lesson ID */
  id: string
  /** The trigger that activates this lesson */
  triggerId: string
  /** Short title (displayed in card header) */
  title: string
  /** Micro-content: 1–2 sentences, warm and encouraging */
  microContent: string
  /** Optional deep dive content (3–4 sentences for "learn more") */
  deepDiveContent?: string
  /** Emoji for visual context */
  emoji: string
  /** Topic category */
  topic: LessonTopic
  /** Link to a full lesson for further reading */
  relatedLessonId?: string
}

// ============================================================================
// Trigger Definitions (the full set of 40 triggers)
// ============================================================================

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  // ── First-Time Actions (8 triggers) ────────────────────────────────────
  {
    id: 'first_expense_over_100',
    type: 'first_time_action',
    priority: 'high',
    lessonId: 'cl-big-expense-awareness',
    description: 'User logs their first expense over $100',
    educationalValue: 8,
  },
  {
    id: 'first_expense_over_50',
    type: 'first_time_action',
    priority: 'medium',
    lessonId: 'cl-spending-awareness',
    description: 'User logs their first expense over $50',
    educationalValue: 6,
  },
  {
    id: 'first_debt_added',
    type: 'first_time_action',
    priority: 'high',
    lessonId: 'cl-debt-intro',
    description: 'User adds their first debt entry',
    educationalValue: 9,
  },
  {
    id: 'first_goal_set',
    type: 'first_time_action',
    priority: 'high',
    lessonId: 'cl-goal-power',
    description: 'User creates their first savings goal',
    educationalValue: 8,
  },
  {
    id: 'first_savings_account',
    type: 'first_time_action',
    priority: 'medium',
    lessonId: 'cl-savings-account-basics',
    description: 'User creates their first savings account',
    educationalValue: 7,
  },
  {
    id: 'first_recurring_expense',
    type: 'first_time_action',
    priority: 'medium',
    lessonId: 'cl-recurring-awareness',
    description: 'User logs their first recurring expense',
    educationalValue: 7,
  },
  {
    id: 'tenth_transaction',
    type: 'first_time_action',
    priority: 'medium',
    lessonId: 'cl-tracking-habit',
    description: 'User logs their 10th transaction',
    educationalValue: 6,
  },
  {
    id: 'first_income_logged',
    type: 'first_time_action',
    priority: 'medium',
    lessonId: 'cl-income-awareness',
    description: 'User logs their first income',
    educationalValue: 6,
  },

  // ── Pattern Detection (6 triggers) ────────────────────────────────────
  {
    id: 'three_consecutive_over_budget',
    type: 'pattern_detection',
    priority: 'high',
    lessonId: 'cl-over-budget-pattern',
    description: '3rd consecutive over-budget day detected',
    educationalValue: 8,
  },
  {
    id: 'five_consecutive_over_budget',
    type: 'pattern_detection',
    priority: 'high',
    lessonId: 'cl-budget-reset-strategy',
    description: '5th consecutive over-budget day detected',
    educationalValue: 9,
  },
  {
    id: 'recurring_merchant_pattern',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-recurring-merchant',
    description: 'Same merchant/note appears 3+ times in 30 days',
    educationalValue: 7,
  },
  {
    id: 'weekend_spending_spike',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-weekend-spending',
    description: 'Weekend spending 1.5× higher than weekday average',
    educationalValue: 6,
  },
  {
    id: 'food_category_dominant',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-food-spending',
    description: 'Food spending exceeds 40% of total monthly expenses',
    educationalValue: 6,
  },
  {
    id: 'subscriptions_growing',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-subscription-creep',
    description: 'Subscription costs grew 20%+ vs previous month',
    educationalValue: 7,
  },

  // ── Tool Access (5 triggers) ──────────────────────────────────────────
  {
    id: 'first_calculator_use',
    type: 'tool_access',
    priority: 'medium',
    lessonId: 'cl-calculator-intro',
    description: 'User opens a calculator tool for the first time',
    educationalValue: 5,
  },
  {
    id: 'first_trajectory_use',
    type: 'tool_access',
    priority: 'medium',
    lessonId: 'cl-trajectory-intro',
    description: 'User opens the trajectory tool for the first time',
    educationalValue: 6,
  },
  {
    id: 'first_cash_flow_use',
    type: 'tool_access',
    priority: 'medium',
    lessonId: 'cl-cash-flow-intro',
    description: 'User opens cash flow view for the first time',
    educationalValue: 6,
  },
  {
    id: 'first_debt_tool_use',
    type: 'tool_access',
    priority: 'medium',
    lessonId: 'cl-debt-tool-intro',
    description: 'User opens the debt management tool for the first time',
    educationalValue: 7,
  },
  {
    id: 'first_learn_tab_use',
    type: 'tool_access',
    priority: 'low',
    lessonId: 'cl-learn-welcome',
    description: 'User opens the Learn tab for the first time',
    educationalValue: 4,
  },

  // ── Milestone Moments (6 triggers) ────────────────────────────────────
  {
    id: 'milestone_tracking_10',
    type: 'milestone',
    priority: 'medium',
    lessonId: 'cl-tracking-milestone',
    description: '10-transaction tracking milestone achieved',
    educationalValue: 5,
  },
  {
    id: 'milestone_tracking_50',
    type: 'milestone',
    priority: 'medium',
    lessonId: 'cl-awareness-power',
    description: '50-transaction tracking milestone achieved',
    educationalValue: 6,
  },
  {
    id: 'milestone_consistency_1',
    type: 'milestone',
    priority: 'high',
    lessonId: 'cl-consistency-reward',
    description: 'First month of consistent use milestone',
    educationalValue: 7,
  },
  {
    id: 'milestone_saving_1',
    type: 'milestone',
    priority: 'high',
    lessonId: 'cl-saving-milestone',
    description: 'First savings goal completed milestone',
    educationalValue: 8,
  },
  {
    id: 'milestone_streaks_7',
    type: 'milestone',
    priority: 'medium',
    lessonId: 'cl-streak-lesson',
    description: '7-day streak milestone achieved',
    educationalValue: 6,
  },
  {
    id: 'milestone_awareness_1k',
    type: 'milestone',
    priority: 'medium',
    lessonId: 'cl-awareness-milestone',
    description: '$1K spending tracked milestone',
    educationalValue: 6,
  },

  // ── Time-Based Fallback (1 trigger) ───────────────────────────────────
  {
    id: 'first_open_of_week',
    type: 'time_based',
    priority: 'low',
    lessonId: 'cl-weekly-tip',
    description: 'First app open of the week (fallback when nothing else triggers)',
    educationalValue: 3,
  },

  // ── Phase 18 Task 442: Additional triggers for key educational content ──
  {
    id: 'income_logged_with_budget',
    type: 'first_time_action',
    priority: 'medium',
    lessonId: 'cl-50-30-20-personalized',
    description: 'User has income and spending data sufficient for 50/30/20 analysis',
    educationalValue: 8,
  },
  {
    id: 'multiple_categories_budgeted',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-envelope-method',
    description: 'User has 3+ category budgets set up',
    educationalValue: 7,
  },
  {
    id: 'tracking_two_weeks',
    type: 'milestone',
    priority: 'medium',
    lessonId: 'cl-tracking-value',
    description: 'User has been tracking for 14+ days',
    educationalValue: 7,
  },
  {
    id: 'savings_growing',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-compound-growth-personal',
    description: 'User savings account balance has increased month over month',
    educationalValue: 8,
  },
  {
    id: 'high_single_purchase',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-opportunity-cost',
    description: 'User logs a single purchase over $75 (opportunity cost teachable moment)',
    educationalValue: 6,
  },
  {
    id: 'emergency_fund_gap',
    type: 'pattern_detection',
    priority: 'high',
    lessonId: 'cl-emergency-fund-sizing',
    description: 'User has expenses tracked but savings less than 1 month of expenses',
    educationalValue: 8,
  },
  {
    id: 'multiple_debts_added',
    type: 'pattern_detection',
    priority: 'high',
    lessonId: 'cl-snowball-vs-avalanche',
    description: 'User has 2+ debt entries (snowball/avalanche teaching moment)',
    educationalValue: 9,
  },
  {
    id: 'debt_minimum_payment_only',
    type: 'pattern_detection',
    priority: 'high',
    lessonId: 'cl-minimum-payment-trap',
    description: 'User has debt with only minimum payments being made',
    educationalValue: 9,
  },
  {
    id: 'debt_vs_savings_decision',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-debt-vs-savings',
    description: 'User has both debt and savings — teach prioritization',
    educationalValue: 8,
  },
  {
    id: 'spending_increasing_monthly',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-lifestyle-inflation',
    description: 'User monthly spending has increased 15%+ vs previous month',
    educationalValue: 7,
  },
  {
    id: 'high_daily_small_purchases',
    type: 'pattern_detection',
    priority: 'medium',
    lessonId: 'cl-small-daily-choices',
    description: 'User has 3+ small purchases ($2-10) in a single day',
    educationalValue: 6,
  },
  {
    id: 'anchoring_sale_purchase',
    type: 'pattern_detection',
    priority: 'low',
    lessonId: 'cl-anchoring-effect',
    description: 'User logs a purchase with "sale" or "deal" in notes (anchoring teachable moment)',
    educationalValue: 6,
  },
]

// ============================================================================
// Contextual Lessons (40 lessons mapped to triggers)
// ============================================================================

export const CONTEXTUAL_LESSONS: ContextualLesson[] = [
  // ── Budgeting Basics ──────────────────────────────────────────────────
  {
    id: 'cl-big-expense-awareness',
    triggerId: 'first_expense_over_100',
    title: 'Big Purchase? No Worries',
    microContent: 'Larger expenses are normal — the key is noticing them. Tracking a $100+ purchase puts you ahead of most people who don\'t even check.',
    deepDiveContent: 'Research shows that simply being aware of large purchases changes spending behavior over time. You don\'t have to restrict yourself — just noticing the pattern helps your brain naturally adjust. Try the 24-hour rule for future big purchases: sleep on it, and if you still want it tomorrow, go for it guilt-free.',
    emoji: '💡',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-spending-awareness',
    triggerId: 'first_expense_over_50',
    title: 'Awareness Is the First Step',
    microContent: 'You logged a bigger expense — that\'s awareness in action. Most people never check what they spend. You\'re already ahead.',
    deepDiveContent: 'Financial literacy starts with visibility. By logging expenses, you build a mental picture of where money goes. Over time, this picture helps you make intentional choices rather than automatic ones. No judgment on any single purchase — it\'s the pattern that matters.',
    emoji: '👀',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-over-budget-pattern',
    triggerId: 'three_consecutive_over_budget',
    title: 'Three Days Running — Totally Normal',
    microContent: 'A few over-budget days in a row happens to everyone. The fact you\'re noticing means your awareness is working perfectly.',
    deepDiveContent: 'Going over budget sometimes doesn\'t mean failure — it means your budget might need adjusting, or that this week had unusual costs. Consider: is this a one-off cluster (event, beginning of month), or a signal that your daily budget could be tweaked up slightly? Either way, tomorrow is always a fresh start.',
    emoji: '📊',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-budget-reset-strategy',
    triggerId: 'five_consecutive_over_budget',
    title: 'Budget Check-In Time',
    microContent: 'Five days over budget might mean your budget needs a small tweak — not that you need to spend less. Budgets should fit your life, not the other way around.',
    deepDiveContent: 'If your daily budget feels consistently tight, it\'s worth revisiting the number. A budget that\'s too strict leads to frustration. Try adjusting up by 10-15% and see if that feels more natural. The goal is a sustainable rhythm, not perfection. You can always tighten later once the habit is solid.',
    emoji: '🔧',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-recurring-awareness',
    triggerId: 'first_recurring_expense',
    title: 'Recurring Expenses — Autopilot Spending',
    microContent: 'Recurring costs are like silent background spending. Knowing exactly what leaves your account every month puts you in control.',
    deepDiveContent: 'Fixed recurring expenses (rent, subscriptions, utilities) are actually the easiest part of your budget because they\'re predictable. The trick is knowing your total fixed costs — then everything left over is your true flexible spending money. That\'s exactly what your daily allowance shows you.',
    emoji: '🔄',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-weekend-spending',
    triggerId: 'weekend_spending_spike',
    title: 'Weekend Vibes Cost More — And That\'s OK',
    microContent: 'Your weekends average {{weekend_average_spend}}/day — more than weekdays. Totally normal — socializing costs money. Knowing the pattern means you can plan for it.',
    deepDiveContent: 'Your weekend spending averages {{weekend_average_spend}}/day compared to your overall {{average_daily_spend}}/day. Many people spend more on weekends due to dining out, activities, and socializing. If you know this about yourself, you can intentionally bank a little extra during the week. Even setting aside a few dollars per weekday for weekend fun makes the whole week feel lighter.',
    emoji: '🎉',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-food-spending',
    triggerId: 'food_category_dominant',
    title: 'Food Is Your Top Category',
    microContent: 'Food is {{food_percentage}} of your spending this month ({{monthly_food_total}}). That\'s common — and knowing it lets you decide if that feels right to you.',
    deepDiveContent: 'Your food spending of {{monthly_food_total}} makes up {{food_percentage}} of your monthly expenses. There\'s no "right" percentage — it depends on your lifestyle. But if it feels higher than you\'d like, small swaps (one meal prep day, water instead of drinks out) can shift things without sacrificing enjoyment. Even saving 10% of that would free up money for other goals.',
    emoji: '🍕',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-subscription-creep',
    triggerId: 'subscriptions_growing',
    title: 'Subscription Creep Alert',
    microContent: 'Your subscriptions hit {{monthly_subscriptions_total}} this month. Worth a quick check — free trials you forgot about love to stick around.',
    deepDiveContent: 'Subscription creep happens when small recurring charges accumulate over time. Each one feels insignificant ($5, $10), but together they quietly reached {{monthly_subscriptions_total}}/month for you. A monthly 5-minute audit keeps things honest: for each subscription, ask "did I use this in the last 2 weeks?" If not, it might be time to pause it.',
    emoji: '📈',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },

  // ── Saving ────────────────────────────────────────────────────────────
  {
    id: 'cl-goal-power',
    triggerId: 'first_goal_set',
    title: 'Goals Change Everything',
    microContent: 'Having a specific target like "{{goal_name}}" makes saving 2x more likely to succeed. Your brain loves working toward something concrete.',
    deepDiveContent: 'Research shows that specific, named goals with target amounts are dramatically more effective than general "save more" intentions. Your "{{goal_name}}" goal (target: {{goal_completion_date}}) gives your brain a clear commitment rather than a wish. Even small contributions add up faster than you\'d expect when the target is clear.',
    emoji: '🎯',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'cl-savings-account-basics',
    triggerId: 'first_savings_account',
    title: 'Savings Accounts Work While You Sleep',
    microContent: 'Your savings account earns interest on its own — money making money without you doing anything. Even small amounts grow over time.',
    deepDiveContent: 'A high-yield savings account (HYSA) can earn 4-5% annually right now. On $1,000, that\'s $40-50/year for doing absolutely nothing. The best strategy is to set up automatic transfers on payday — even $25/week becomes $1,300/year plus interest. Out of sight, out of mind, growing quietly.',
    emoji: '🏦',
    topic: 'saving',
    relatedLessonId: 'savings-accounts',
  },
  {
    id: 'cl-saving-milestone',
    triggerId: 'milestone_saving_1',
    title: 'You Saved a Goal — Wow!',
    microContent: 'Completing a savings goal is a real achievement. You proved to yourself you can do it — that confidence carries over to every future goal.',
    deepDiveContent: 'The first completed goal is the hardest because you\'re building the habit from scratch. Now that you know you can do it, the next goal will feel more natural. Consider setting your next target slightly higher — you\'ve earned that confidence. Many savers find that goals become addictive in the best way.',
    emoji: '🌟',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'cl-income-awareness',
    triggerId: 'first_income_logged',
    title: 'Income + Expenses = The Full Picture',
    microContent: 'Logging income alongside expenses gives you the complete view. Your income of {{monthly_income}} minus spending of {{monthly_spend_total}} shows your savings gap.',
    deepDiveContent: 'Tracking income matters because it shows your savings rate — currently {{savings_rate}} of your income. Even a 5-10% savings rate is a strong foundation. As your income grows, try to keep expenses steady and let the gap widen naturally. That growing gap is your financial freedom building itself.',
    emoji: '💰',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },

  // ── Debt & Credit ─────────────────────────────────────────────────────
  {
    id: 'cl-debt-intro',
    triggerId: 'first_debt_added',
    title: 'Facing Debt Head-On',
    microContent: 'Adding your debt here means you\'re facing it directly — that takes courage. Awareness is literally the first step to paying it down.',
    deepDiveContent: 'Most people avoid looking at their debt, which lets it grow silently. By tracking it, you can see the interest accumulating and make a plan. Two popular strategies: pay the smallest balance first for quick wins (snowball), or pay the highest-interest debt first to save the most money (avalanche). Either works — pick whichever motivates you more.',
    emoji: '💪',
    topic: 'credit',
    relatedLessonId: 'loans-and-bonds',
  },
  {
    id: 'cl-recurring-merchant',
    triggerId: 'recurring_merchant_pattern',
    title: 'Pattern Spotted',
    microContent: 'You\'ve been spending at the same place regularly. If it brings you joy, great — just making sure you\'re choosing it intentionally.',
    deepDiveContent: 'Recurring spending at the same merchant isn\'t bad — it often means you\'ve found something you genuinely enjoy. The only question worth asking: "Am I doing this intentionally, or out of habit?" If it\'s intentional, carry on. If it\'s autopilot, maybe one out of three times you swap in a free alternative and pocket the savings.',
    emoji: '🔍',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },

  // ── Investing Concepts ────────────────────────────────────────────────
  {
    id: 'cl-calculator-intro',
    triggerId: 'first_calculator_use',
    title: 'Calculators: See Your Future',
    microContent: 'Financial calculators turn abstract numbers into concrete futures. Play with the numbers — seeing how small changes compound over years is genuinely eye-opening.',
    deepDiveContent: 'Compound interest calculators reveal the magic of time. Even $20/month invested at 7% average returns becomes over $10,000 in 15 years and $26,000 in 25 years. The calculator isn\'t about getting a "right" answer — it\'s about seeing that starting early, even tiny, has an outsized impact.',
    emoji: '🧮',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },
  {
    id: 'cl-trajectory-intro',
    triggerId: 'first_trajectory_use',
    title: 'Your Money Trajectory',
    microContent: 'The trajectory view shows where your current habits lead over time. It\'s not a prediction — it\'s a "what if I keep doing this" mirror.',
    deepDiveContent: 'Financial trajectory is powerful because it makes the invisible visible. A $5/day habit looks tiny in isolation but costs $1,825/year. Trajectory doesn\'t judge — it just shows you the path your current behavior creates. Small adjustments now can dramatically shift where you end up in 1, 5, or 10 years.',
    emoji: '📈',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },
  {
    id: 'cl-cash-flow-intro',
    triggerId: 'first_cash_flow_use',
    title: 'Cash Flow: Money In vs Money Out',
    microContent: 'Cash flow is simply money in minus money out. Positive means you\'re building wealth; negative means you\'re drawing down. Both are normal at different times.',
    deepDiveContent: 'Understanding your cash flow rhythm helps you plan around lean periods. Most people have predictable cycles: flush at payday, tighter before the next one. Once you see your pattern, you can smooth it — maybe by pre-allocating bill money on payday so the rest is truly yours to spend freely.',
    emoji: '🌊',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },

  // ── Debt Management Tool ──────────────────────────────────────────────
  {
    id: 'cl-debt-tool-intro',
    triggerId: 'first_debt_tool_use',
    title: 'Debt Clarity Is Power',
    microContent: 'Your {{total_debt}} in debt costs about {{debt_interest_monthly}}/month in interest alone. Seeing it clearly is the first step to changing it.',
    deepDiveContent: 'Your total debt of {{total_debt}} generates roughly {{debt_interest_monthly}} in monthly interest. The key insight: even small extra payments on {{highest_interest_debt}} (at {{highest_interest_rate}}) save significant money over time. Paying just $25 extra per month can save you hundreds in interest and cut months off your payoff timeline.',
    emoji: '🗺️',
    topic: 'credit',
    relatedLessonId: 'loans-and-bonds',
  },

  // ── Learning & Habits ─────────────────────────────────────────────────
  {
    id: 'cl-learn-welcome',
    triggerId: 'first_learn_tab_use',
    title: 'Welcome to Learning',
    microContent: 'Financial literacy is a superpower. These bite-sized lessons take 30 seconds each and cover the stuff school should\'ve taught.',
    deepDiveContent: 'Each lesson here is designed to be quick, practical, and judgment-free. Start with whatever topic interests you most — there\'s no required order. The goal isn\'t to memorize terms; it\'s to build enough understanding that financial decisions feel less scary and more like informed choices.',
    emoji: '📚',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-tracking-habit',
    triggerId: 'tenth_transaction',
    title: 'You\'re Building a Habit',
    microContent: '10 transactions logged! Research says it takes about 21 days to form a habit — you\'re well on your way. Keep it up.',
    deepDiveContent: 'Consistency in tracking matters more than perfection. Missing a day or two doesn\'t break the habit — just pick it back up. The real magic happens around 30+ transactions when you start seeing clear patterns in your spending. Those patterns are where the insights live.',
    emoji: '✨',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-tracking-milestone',
    triggerId: 'milestone_tracking_10',
    title: 'Tracking Pro: 10 Entries',
    microContent: 'Ten transactions tracked means you\'re seeing real data now, not guesses. That clarity is worth more than any budgeting tip.',
    emoji: '📝',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-awareness-power',
    triggerId: 'milestone_tracking_50',
    title: '50 Entries — Deep Awareness',
    microContent: 'With 50 transactions tracked, you have a genuine picture of your money life. Patterns are visible that weren\'t before.',
    deepDiveContent: 'At 50 transactions, your data is rich enough to reveal real insights: your highest spending days, your most frequent categories, your average daily spend. This isn\'t abstract anymore — it\'s your actual financial life laid out clearly. Use this clarity to make one small intentional change if you want to.',
    emoji: '🧠',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-consistency-reward',
    triggerId: 'milestone_consistency_1',
    title: 'One Month Strong',
    microContent: 'A full month of tracking! That\'s longer than most people stick with any financial app. You\'re clearly building something real here.',
    deepDiveContent: 'Consistency over time is the single biggest predictor of financial health improvement. After one month, you have enough data to see your monthly cycle: when you spend more, when you naturally save, what your true fixed costs are. This foundation makes every financial decision easier going forward.',
    emoji: '📅',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-streak-lesson',
    triggerId: 'milestone_streaks_7',
    title: 'A Week-Long Streak!',
    microContent: 'Seven days in a row means this is becoming second nature. Habits formed in your 20s tend to stick for life.',
    deepDiveContent: 'Financial habits formed early have outsized impact because of time. A person who starts tracking and saving in their 20s typically has 3-4× more wealth by 40 than someone who starts at 30 — not because they earn more, but because the habits compound just like interest does.',
    emoji: '🔥',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-awareness-milestone',
    triggerId: 'milestone_awareness_1k',
    title: '$1K Tracked — You See the Big Picture',
    microContent: 'You\'ve tracked over $1,000 in spending. That\'s real financial awareness — you know where your money goes, and knowledge is power.',
    deepDiveContent: 'Tracking $1,000+ in spending gives you statistically meaningful data. You can now confidently say things like "I spend about $X on food" or "my weekends cost roughly $Y." This knowledge makes planning effortless because you\'re working with real numbers, not guesses.',
    emoji: '👀',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },

  // ── Investing & Growth ────────────────────────────────────────────────
  {
    id: 'cl-weekly-tip',
    triggerId: 'first_open_of_week',
    title: 'Weekly Money Moment',
    microContent: 'Welcome back! Quick thought: the best financial habit isn\'t saving the most — it\'s staying consistent with whatever amount works for you.',
    deepDiveContent: 'Consistency beats intensity in personal finance. Someone who saves $25 every single week for a year has $1,300 — and more importantly, has built an unbreakable habit. Someone who saves $200 once and then forgets has $200 and no momentum. Pick an amount that\'s so small it feels effortless, and just never stop.',
    emoji: '👋',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },

  // ── Additional Spending Awareness Lessons ─────────────────────────────
  {
    id: 'cl-50-30-20-intro',
    triggerId: 'first_expense_over_100',
    title: 'The 50/30/20 Idea',
    microContent: 'A simple framework: roughly 50% needs, 30% wants, 20% saving. Not a strict rule — a starting point you can adjust.',
    emoji: '📐',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-compound-interest-debt',
    triggerId: 'first_debt_added',
    title: 'Interest Works Against You With Debt',
    microContent: 'With debt, interest compounds against you — your {{total_debt}} balance generates about {{debt_interest_monthly}}/month in interest. Even small extra payments fight this.',
    deepDiveContent: 'Compound interest is a double-edged sword. In savings, it works for you. In debt, it works against you. Your {{highest_interest_debt}} at {{highest_interest_rate}} means a portion of every minimum payment goes to interest, not your balance. Paying even $20 extra nearly doubles your payoff speed.',
    emoji: '⚡',
    topic: 'credit',
    relatedLessonId: 'loans-and-bonds',
  },
  {
    id: 'cl-emergency-fund-why',
    triggerId: 'first_goal_set',
    title: 'Why Emergency Funds Matter',
    microContent: 'A $500–$1,000 cushion turns emergencies into inconveniences instead of crises. It\'s the single most stress-reducing financial step.',
    emoji: '🛟',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'cl-automate-savings',
    triggerId: 'first_savings_account',
    title: 'Automate and Forget',
    microContent: 'The most successful savers automate transfers on payday. You can\'t miss money you never see in your spending account.',
    emoji: '🤖',
    topic: 'saving',
    relatedLessonId: 'savings-accounts',
  },
  {
    id: 'cl-debt-snowball',
    triggerId: 'first_debt_tool_use',
    title: 'Snowball vs Avalanche',
    microContent: 'Two proven debt strategies: pay smallest first for quick wins (snowball) or highest interest first to save money (avalanche). Both work — pick what motivates you.',
    deepDiveContent: 'The debt snowball method pays off the smallest balance first, giving you psychological wins that fuel momentum. The avalanche method targets the highest-interest debt first, saving you the most money mathematically. Studies show both work — the snowball has slightly higher success rates because of the motivation factor, but avalanche saves more on interest. Pick whichever excites you more.',
    emoji: '❄️',
    topic: 'credit',
    relatedLessonId: 'loans-and-bonds',
  },
  {
    id: 'cl-investing-start-small',
    triggerId: 'first_calculator_use',
    title: 'Start Small, Start Now',
    microContent: 'Investing even $20/month from age 20 can grow to more than starting $200/month at 35. Time is the most powerful ingredient.',
    emoji: '🌱',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },
  {
    id: 'cl-pay-yourself-first',
    triggerId: 'first_income_logged',
    title: 'Pay Yourself First',
    microContent: 'Before spending on anything else, move even a small amount to savings. Treating savings like a bill means it happens reliably.',
    emoji: '💰',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'cl-mindful-spending',
    triggerId: 'recurring_merchant_pattern',
    title: 'Intentional vs Autopilot',
    microContent: 'There\'s a big difference between choosing to spend and spending out of habit. Awareness turns autopilot purchases into intentional choices.',
    emoji: '🧘',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-credit-basics',
    triggerId: 'first_debt_added',
    title: 'Credit Score 101',
    microContent: 'Your credit score is built mainly by paying on time (35%) and keeping balances low (30%). Two simple habits, outsized impact.',
    emoji: '📊',
    topic: 'credit',
    relatedLessonId: 'credit-score-basics',
  },
  {
    id: 'cl-time-in-market',
    triggerId: 'first_trajectory_use',
    title: 'Time in Market > Timing the Market',
    microContent: 'Staying invested steadily through ups and downs has historically beaten trying to buy at the "right" time. Consistency wins.',
    emoji: '⏳',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },
  {
    id: 'cl-index-fund-intro',
    triggerId: 'first_cash_flow_use',
    title: 'Index Funds: The Calm Start',
    microContent: 'An index fund gives you a tiny slice of many companies at once. Less exciting than picking stocks, but historically more reliable.',
    emoji: '📦',
    topic: 'investing',
    relatedLessonId: 'investing-basics',
  },

  // ── Phase 18 Task 442: Key Educational Content Areas ──────────────────

  // 442.1 — Budgeting Fundamentals
  {
    id: 'cl-50-30-20-personalized',
    triggerId: 'income_logged_with_budget',
    title: 'Your 50/30/20 Split',
    microContent: 'With {{monthly_income}} coming in and {{monthly_spend_total}} going out, your savings rate is {{savings_rate}}. The 50/30/20 idea suggests aiming for 20% toward savings — you\'re finding your own ratio.',
    deepDiveContent: 'The 50/30/20 framework (50% needs, 30% wants, 20% savings) is a starting point, not a rule. Your income of {{monthly_income}} and spending of {{monthly_spend_total}} show a savings rate of {{savings_rate}}. If that\'s below 20%, even a 1% shift per month adds up. If it\'s above, you\'re already ahead — nice work. The point is having a target that fits your life, then nudging toward it gently.',
    emoji: '📐',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-zero-based-intro',
    triggerId: 'first_income_logged',
    title: 'Give Every Dollar a Job',
    microContent: 'Zero-based budgeting means planning where every dollar goes — not having zero left. It turns vague "I should save more" into a clear plan.',
    deepDiveContent: 'The idea is simple: your income minus all planned spending and saving equals zero. It doesn\'t mean having no money — it means every dollar has a purpose before it arrives. Start with must-pays, then savings, then flexible spending. What\'s left is truly yours to enjoy guilt-free because the important stuff is already handled.',
    emoji: '🎯',
    topic: 'budgeting',
    relatedLessonId: 'zero-based-budgeting',
  },
  {
    id: 'cl-pay-yourself-first-personalized',
    triggerId: 'first_savings_account',
    title: 'You\'re Paying Yourself First',
    microContent: 'Moving {{monthly_savings_contribution}} to savings before spending is the pay-yourself-first method in action. Your savings rate of {{savings_rate}} shows it\'s working.',
    deepDiveContent: 'Pay-yourself-first means treating savings like your most important bill — it gets paid before anything else. With {{monthly_income}} in income and {{monthly_savings_contribution}} going to savings, you\'re building that habit. The magic is that you adjust your spending to what\'s left, not the other way around. Even bumping it up by $10/month compounds over time.',
    emoji: '💰',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },
  {
    id: 'cl-envelope-method',
    triggerId: 'multiple_categories_budgeted',
    title: 'Your Digital Envelopes',
    microContent: 'Your category budgets work like the envelope method — {{top_category}} at {{top_category_amount}} is your biggest "envelope." Knowing the limits means fewer surprises.',
    deepDiveContent: 'The envelope method means splitting your spending into visible buckets. Your top category, {{top_category}}, uses {{top_category_amount}} of your budget — that\'s your biggest envelope. By checking your category balances regularly, you always know where you stand. When one category runs low, you can consciously decide to shift plans rather than discovering overspending after the fact.',
    emoji: '✉️',
    topic: 'budgeting',
    relatedLessonId: 'envelope-method',
  },
  {
    id: 'cl-tracking-value',
    triggerId: 'tracking_two_weeks',
    title: 'The Awareness Effect Is Real',
    microContent: 'With {{total_transactions}} transactions over {{days_tracking}} days, you have something most people don\'t: genuine awareness of where your money goes. Research shows this alone changes behavior.',
    deepDiveContent: 'Studies show that simply tracking spending — without any budgeting or restrictions — reduces overspending by 10-15%. Your {{total_transactions}} entries over {{days_tracking}} days mean you\'ve built real awareness. You now know your patterns, your averages, your triggers. That knowledge is the foundation every other financial skill builds on.',
    emoji: '🔮',
    topic: 'budgeting',
    relatedLessonId: 'budgeting-101',
  },

  // 442.2 — Saving and Compound Growth
  {
    id: 'cl-compound-growth-personal',
    triggerId: 'savings_growing',
    title: 'Your Savings Are Compounding',
    microContent: 'Your {{total_savings}} in savings earns interest on itself — that\'s compound growth working quietly for you. With {{monthly_savings_contribution}}/month going in, time is on your side.',
    deepDiveContent: 'Compound growth means your savings of {{total_savings}} earn interest, and then that interest earns interest too. With {{monthly_savings_contribution}} added monthly, even a 4-5% rate means your money is working for you around the clock. The earlier you start, the more time does the heavy lifting. You\'re already ahead of most people your age just by having this habit.',
    emoji: '📈',
    topic: 'saving',
    relatedLessonId: 'compound-growth',
  },
  {
    id: 'cl-opportunity-cost',
    triggerId: 'high_single_purchase',
    title: 'The Other Side of Spending',
    microContent: 'Every purchase has an opportunity cost — that {{average_daily_spend}} per day could also be {{average_daily_spend}} per day toward a goal. Neither choice is wrong, just worth noticing.',
    deepDiveContent: 'Opportunity cost is simply what you give up when you choose one thing over another. Your daily spending of {{average_daily_spend}} isn\'t "bad" — but it\'s worth occasionally asking: "What else could this money do for me?" Even redirecting 10% of daily spending toward a goal adds up fast. The goal isn\'t restriction — it\'s making sure your spending reflects what actually matters to you.',
    emoji: '⚖️',
    topic: 'saving',
    relatedLessonId: 'compound-growth',
  },
  {
    id: 'cl-emergency-fund-sizing',
    triggerId: 'emergency_fund_gap',
    title: 'Your Emergency Fund Target',
    microContent: 'Financial experts suggest 3-6 months of expenses as a safety net. Based on your spending of {{monthly_spend_total}}/month, that\'s a target between {{monthly_spend_total}} and a few months\' worth. Start with just one month.',
    deepDiveContent: 'Your monthly expenses of {{monthly_spend_total}} make your emergency fund target clear: one month\'s buffer ({{monthly_spend_total}}) is a strong first milestone. That single month of cushion turns a job loss or car repair from a crisis into a manageable situation. You don\'t need to get there fast — even $50/week builds that buffer over time. The peace of mind alone is worth it.',
    emoji: '🛡️',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'cl-automate-savings-personal',
    triggerId: 'first_goal_set',
    title: 'Automate It and Relax',
    microContent: 'The most successful savers set up automatic transfers — {{monthly_savings_contribution}}/month moves without thinking about it. Automation turns good intentions into results.',
    deepDiveContent: 'Your monthly contribution of {{monthly_savings_contribution}} is perfect for automation. Set it to transfer on payday and you\'ll never miss it — you adjust to spending what\'s left rather than saving what\'s left over. This "set and forget" approach has the highest success rate of any savings strategy because it removes willpower from the equation entirely.',
    emoji: '🤖',
    topic: 'saving',
    relatedLessonId: 'emergency-fund',
  },
  {
    id: 'cl-latte-effect-personal',
    triggerId: 'recurring_merchant_pattern',
    title: 'Your Daily Ritual, in Numbers',
    microContent: 'Your daily coffee/drinks habit costs about {{daily_coffee_cost}}/day. Over a month, that\'s real money. Not saying stop — just worth knowing the number.',
    deepDiveContent: 'At {{daily_coffee_cost}} per day, your coffee and drinks habit adds up to a meaningful monthly amount. This isn\'t about giving up things you enjoy — it\'s about awareness. If your daily ritual brings you genuine joy, keep it. If some of those purchases are autopilot, maybe one or two substitutions per week could redirect funds toward something you care more about.',
    emoji: '☕',
    topic: 'saving',
    relatedLessonId: 'budgeting-101',
  },

  // 442.3 — Debt Awareness
  {
    id: 'cl-credit-card-interest-personal',
    triggerId: 'first_debt_added',
    title: 'Your Interest, in Real Numbers',
    microContent: 'Your {{total_debt}} in debt costs roughly {{debt_interest_monthly}}/month in interest at {{highest_interest_rate}}. That\'s money going to the bank, not your balance. Even $20 extra fights it.',
    deepDiveContent: 'Credit card interest compounds monthly — your {{total_debt}} balance at {{highest_interest_rate}} means approximately {{debt_interest_monthly}} goes to interest every month. That\'s money that doesn\'t reduce what you owe. The minimum payment trap keeps you paying mostly interest for years. Any extra payment above the minimum goes directly toward your balance, shrinking future interest charges.',
    emoji: '⚡',
    topic: 'credit',
    relatedLessonId: 'credit-card-interest',
  },
  {
    id: 'cl-minimum-payment-trap',
    triggerId: 'debt_minimum_payment_only',
    title: 'The Minimum Payment Trap',
    microContent: 'Paying only minimums on {{total_debt}} can stretch payoff to 10+ years. Even {{highest_interest_debt}} at {{highest_interest_rate}} moves faster with just $25 extra per month.',
    deepDiveContent: 'Minimum payments are designed to keep you paying as long as possible — that\'s how credit card companies profit. On {{total_debt}}, minimum payments mean most of your money goes to interest, barely touching the balance. Adding just $25-50 above the minimum on {{highest_interest_debt}} can cut your payoff time in half and save you hundreds or even thousands in interest.',
    emoji: '🪤',
    topic: 'credit',
    relatedLessonId: 'credit-card-interest',
  },
  {
    id: 'cl-snowball-vs-avalanche',
    triggerId: 'multiple_debts_added',
    title: 'Two Paths, Both Work',
    microContent: 'With multiple debts totaling {{total_debt}}, you\'ve got options: snowball (smallest first for quick wins) or avalanche ({{highest_interest_debt}} at {{highest_interest_rate}} first to save money). Pick whichever motivates you.',
    deepDiveContent: 'The debt snowball targets your smallest balance first — you get a quick win that fuels momentum. The avalanche targets {{highest_interest_debt}} at {{highest_interest_rate}} first — mathematically saves the most money. With {{total_debt}} total, either strategy beats paying minimums across the board. Studies show snowball has slightly higher success rates due to motivation, but avalanche saves more on interest. The best one is whichever keeps you going.',
    emoji: '🏔️',
    topic: 'loans',
    relatedLessonId: 'debt-payoff-strategies',
  },
  {
    id: 'cl-good-vs-bad-debt',
    triggerId: 'first_debt_tool_use',
    title: 'Not All Debt Is Equal',
    microContent: 'Some debt builds your future (student loans, mortgage) while other debt costs you (credit cards, payday loans). The interest rate often tells the story.',
    deepDiveContent: '"Good debt" typically has low interest rates and builds an asset — student loans invest in your earning power, mortgages build equity. "Bad debt" has high rates and buys things that lose value — credit cards for daily spending, payday loans. The distinction isn\'t perfect, but a useful rule: if the interest rate is above 8-10% and it\'s not building something lasting, prioritize paying it down.',
    emoji: '🔀',
    topic: 'loans',
    relatedLessonId: 'debt-payoff-strategies',
  },
  {
    id: 'cl-debt-vs-savings',
    triggerId: 'debt_vs_savings_decision',
    title: 'Debt vs Savings: A Balancing Act',
    microContent: 'With {{debt_interest_monthly}}/month going to interest and {{total_savings}} in savings, it\'s worth asking: should extra money go to debt or savings? Often the answer is "a little of both."',
    deepDiveContent: 'The math says: if your debt interest rate is higher than your savings interest rate (it almost always is), paying off debt gives a better "return." But having zero savings means the next emergency goes on a credit card, starting the cycle over. A balanced approach: keep a small emergency buffer ($500-1,000), then throw everything extra at high-interest debt. Once high-rate debt is gone, shift aggressively to savings.',
    emoji: '⚖️',
    topic: 'credit',
    relatedLessonId: 'credit-card-interest',
  },

  // 442.4 — Spending Psychology
  {
    id: 'cl-anchoring-effect',
    triggerId: 'anchoring_sale_purchase',
    title: 'The Anchoring Trick',
    microContent: 'Seeing a high "original" price makes the sale price feel like a steal — that\'s anchoring. Ask yourself: would you buy it at this price without the comparison?',
    deepDiveContent: 'Anchoring is one of the most powerful pricing tricks. When you see "$200 marked down to $80," your brain focuses on the $120 "saved" rather than whether $80 is worth it to you. Retailers exploit this constantly. A simple fix: before any "deal," ask "Would I buy this at full price? Would I seek this out if I hadn\'t seen the sale?" If no, the deal might be spending money you wouldn\'t have otherwise.',
    emoji: '⚓',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'cl-subscription-creep-deep',
    triggerId: 'subscriptions_growing',
    title: 'Subscriptions: Death by a Thousand Cuts',
    microContent: 'Your subscriptions total {{monthly_subscriptions_total}}/month. Each one felt small when you signed up, but together they\'re a real line item. A 5-minute monthly audit keeps things honest.',
    deepDiveContent: 'Subscription creep happens because each individual charge feels insignificant — $5 here, $12 there. But at {{monthly_subscriptions_total}}/month, they\'ve quietly become a significant expense. Try this monthly audit: for each subscription, ask "Did I use this in the last 2 weeks?" If not, pause it. Most services let you rejoin anytime. You\'re not losing anything — you\'re choosing what deserves your money this month.',
    emoji: '📋',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'cl-lifestyle-inflation',
    triggerId: 'spending_increasing_monthly',
    title: 'Lifestyle Inflation Check',
    microContent: 'Your spending has been growing — {{monthly_spend_total}} this month on {{monthly_income}} income. When spending rises with income, savings stay flat. Worth a quick check-in.',
    deepDiveContent: 'Lifestyle inflation is when your spending automatically rises to match your income — you earn more, you spend more, and your savings rate stays stuck. With {{monthly_spend_total}} in spending on {{monthly_income}} income, it\'s worth asking: did my needs change, or did my wants expand? The fix isn\'t cutting joy — it\'s noticing the creep and intentionally choosing what gets the extra money.',
    emoji: '🎈',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'cl-impulse-vs-intentional',
    triggerId: 'three_consecutive_over_budget',
    title: 'Impulse vs Intentional',
    microContent: 'Before your next non-essential purchase, try the 10-second pause: "Do I want this, or do I want what this money could become?" Both answers are valid.',
    deepDiveContent: 'Impulse purchases bypass your rational brain — they\'re driven by emotion, environment, and habit. Intentional spending is a conscious choice. You don\'t need to eliminate impulse buys entirely; just catch a few of them. The 24-hour rule works wonders: if you still want it tomorrow, buy it guilt-free. If you forgot about it, you just saved money without missing anything.',
    emoji: '🧘',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
  {
    id: 'cl-small-daily-choices',
    triggerId: 'high_daily_small_purchases',
    title: 'Small Choices, Big Impact',
    microContent: 'Your daily average of {{average_daily_spend}} is made of many small decisions. Even {{daily_coffee_cost}} less per day frees up meaningful money over a month — and tomorrow always resets.',
    deepDiveContent: 'Your average daily spend of {{average_daily_spend}} is built from dozens of small choices — each one feels insignificant alone. But redirecting even {{daily_coffee_cost}} per day adds up to real money monthly. This isn\'t about deprivation; it\'s about awareness. When you notice the small stuff, you can choose which small purchases bring real joy and which are pure autopilot. Keep the joy, redirect the autopilot.',
    emoji: '🌊',
    topic: 'budgeting',
    relatedLessonId: 'spending-psychology',
  },
]

/**
 * Returns the contextual lesson for a given trigger ID.
 * If multiple lessons share a trigger, returns the first match.
 */
export function getLessonForTrigger(triggerId: string): ContextualLesson | undefined {
  return CONTEXTUAL_LESSONS.find(l => l.triggerId === triggerId)
}

/**
 * Returns all contextual lessons for a given topic.
 */
export function getLessonsByTopic(topic: LessonTopic): ContextualLesson[] {
  return CONTEXTUAL_LESSONS.filter(l => l.topic === topic)
}

/**
 * Returns the trigger definition for a given trigger ID.
 */
export function getTriggerDefinition(triggerId: string): TriggerDefinition | undefined {
  return TRIGGER_DEFINITIONS.find(t => t.id === triggerId)
}
