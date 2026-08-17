import type { Lesson } from '@/types'

/**
 * Bite-sized financial literacy lessons for college students and young adults.
 *
 * Each lesson keeps content to ~3 short paragraphs, uses a warm and
 * non-judgmental tone, and includes a college-oriented example plus a short
 * quiz. Lessons are grouped by `topic` so the Finance tab can organize them
 * by subject area (budgeting, saving, credit, investing, stocks, loans/bonds).
 *
 * Keep copy encouraging and jargon-light. The goal is confidence, not pressure.
 */
export const LESSONS: Lesson[] = [
  {
    id: 'budgeting-101',
    title: 'Budgeting 101',
    description: 'A simple method that actually sticks',
    topic: 'budgeting',
    content: `Budgeting isn't about restriction, it's about knowing where your money goes so you can spend on what matters to you. The 50/30/20 idea is a friendly starting point: roughly 50% needs, 30% wants, 20% saving.

Try tracking your spending for just one week first. Small purchases add up faster than you'd think. That $5 coffee every day is about $150 a month, and noticing it is half the battle.

Keep your categories simple, six or fewer, so checking in feels easy instead of like homework. Rent, food, transport, school, fun, and saving is plenty to start.`,
    example: "Aisha tracked her spending for a week and noticed $200 a month going to food delivery. She started meal prepping twice a week and moved $100 toward her savings goal, no guilt required.",
    quizQuestions: [
      { id: 'budgeting-101-q1', question: 'In the 50/30/20 idea, what does the 20% go toward?', options: ['Entertainment', 'Rent', 'Saving', 'Food'], correctIndex: 2 },
      { id: 'budgeting-101-q2', question: 'How many budget categories are a good starting point?', options: ['As many as possible', 'Six or fewer', 'Exactly ten', 'Just one'], correctIndex: 1 },
      { id: 'budgeting-101-q3', question: 'What is a helpful first step to budgeting?', options: ['Buy expensive software', 'Track your current spending', 'Cut all fun spending', 'Get a higher-paying job'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 1,
  },
  {
    id: 'emergency-fund',
    title: 'Emergency Fund Basics',
    description: 'A small cushion for life\'s surprises',
    topic: 'saving',
    content: `An emergency fund is money set aside for the unexpected, like a car repair, a medical bill, or a gap between paychecks. Having one means a surprise stays a surprise instead of turning into debt.

Start small and be kind to yourself about it. A first goal of $500 to $1,000 is great, and even $25 a week adds up to $1,300 in a year. Keep it in a high-yield savings account so it's easy to reach but a little out of sight.

The trick is treating this money as off-limits for non-emergencies. New shoes aren't an emergency, but a flat tire is. That gentle line in your head is what makes the fund work.`,
    example: 'Marcus, a gig worker, tucked $50 away from each delivery payout. When his phone broke, which he needs for work, he had $800 ready and skipped a payday loan entirely.',
    quizQuestions: [
      { id: 'emergency-fund-q1', question: 'What is an emergency fund meant to cover?', options: ['Concert tickets', 'Unexpected expenses like car repairs', 'A vacation', 'New clothes'], correctIndex: 1 },
      { id: 'emergency-fund-q2', question: 'Where is a good place to keep an emergency fund?', options: ['Under your mattress', 'Invested in stocks', 'A high-yield savings account', 'Crypto'], correctIndex: 2 },
      { id: 'emergency-fund-q3', question: 'What is a realistic starting goal?', options: ['$50', '$500 to $1,000', '$50,000', '$1 million'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=goals',
    order: 2,
  },
  {
    id: 'savings-accounts',
    title: 'Savings, Roth, and IRA Accounts',
    description: 'Where to keep money you don\'t need today',
    topic: 'saving',
    content: `Not all savings live in the same place. A high-yield savings account is perfect for short-term goals and your emergency fund because the money stays easy to reach and earns a little interest.

For money you won't need for a long time, a Roth IRA is a friendly first retirement account. You contribute money you've already paid taxes on, and qualified withdrawals in retirement come out tax-free. A traditional IRA works the other way, giving you a possible tax break now and taxes later.

You don't need much to begin. Many providers let you open a Roth IRA with a small amount, and starting early gives your money decades to grow, even if you only add a little at a time.`,
    example: "Priya, a junior with a part-time job, opened a Roth IRA and set up a $25 monthly transfer. It's small, but because she started at 20, those early dollars have the most time to grow.",
    quizQuestions: [
      { id: 'savings-accounts-q1', question: 'What is a high-yield savings account best for?', options: ['Retirement decades away', 'Short-term goals and an emergency fund', 'Day trading', 'Paying rent directly'], correctIndex: 1 },
      { id: 'savings-accounts-q2', question: 'What is a key feature of a Roth IRA?', options: ['You can never withdraw money', 'Qualified retirement withdrawals are tax-free', 'It requires $10,000 to open', 'It replaces a checking account'], correctIndex: 1 },
      { id: 'savings-accounts-q3', question: 'Why does starting a retirement account early help?', options: ['It doesn\'t matter when you start', 'Your money has more time to grow', 'Interest only counts after age 50', 'Banks give free money to anyone under 21'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=goals',
    order: 3,
  },
  {
    id: 'credit-cards',
    title: 'Credit Cards Explained',
    description: 'How they work and how to use them well',
    topic: 'credit',
    content: `A credit card lets you borrow money up to a limit for purchases. The single most important habit is paying your full balance each month, which lets you skip interest charges that often run 15 to 25% a year.

Your credit utilization, meaning how much of your limit you're using, affects your credit score. Keeping it under about 30% helps. On a $1,000 limit, that means trying to stay under $300 at any time.

Used gently, a card builds the credit history you'll want later for apartments and car loans. Start with a student card, turn on autopay for the full balance, and treat it a lot like a debit card.`,
    example: 'Sarah, a sophomore, got a $500 student card and used it only for groceries, about $150 a month, paying it off weekly. Her credit score climbed steadily over her first six months.',
    quizQuestions: [
      { id: 'credit-cards-q1', question: 'What happens if you only pay the minimum each month?', options: ['Nothing happens', 'You pay interest on the remaining balance', 'Your card is canceled', 'You earn bonus points'], correctIndex: 1 },
      { id: 'credit-cards-q2', question: 'What credit utilization is a good target?', options: ['Under 30%', 'Exactly 50%', 'Over 75%', 'Use the whole limit'], correctIndex: 0 },
      { id: 'credit-cards-q3', question: 'Why can building credit history help students?', options: ['It has no benefit', 'It helps with future apartments and loans', 'It unlocks free products', 'It boosts social media'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 4,
  },
  {
    id: 'credit-score-basics',
    title: 'Credit Score Basics',
    description: 'What your score means and how it is built',
    topic: 'credit',
    content: `Your credit score is a three-digit number (usually 300–850) that tells lenders how reliable you are with borrowed money. Think of it like a trust rating — a higher score means better loan terms, lower interest rates, and easier apartment approvals down the road.

Five factors shape your FICO score: payment history (35%), how much of your available credit you use (30%), the length of your credit history (15%), your mix of account types (10%), and recent credit inquiries (10%). Payment history is the biggest slice, so paying on time matters more than anything else.

Even if you don't plan to borrow soon, your score quietly affects things like security deposits and insurance rates. Building it early and gently gives future-you a real advantage — no rush, just steady habits.`,
    example: 'Jaylen checked his score through his bank app and saw 680. He realized one late phone-bill payment from freshman year was dragging it down. After six months of on-time payments, it climbed to 720 — enough for a better rate on his first car loan.',
    quizQuestions: [
      { id: 'credit-score-basics-q1', question: 'What is the biggest factor in your FICO score?', options: ['Length of credit history', 'Payment history', 'Types of accounts', 'Number of credit cards'], correctIndex: 1 },
      { id: 'credit-score-basics-q2', question: 'What range do most credit scores fall within?', options: ['0 to 100', '100 to 500', '300 to 850', '500 to 1000'], correctIndex: 2 },
      { id: 'credit-score-basics-q3', question: 'Besides loans, what else can your credit score affect?', options: ['Your GPA', 'Apartment approvals and insurance rates', 'Your social media reach', 'Your class schedule'], correctIndex: 1 },
    ],
    order: 5,
  },
  {
    id: 'building-credit-student',
    title: 'Building Credit as a Student',
    description: 'Simple first steps toward a strong history',
    topic: 'credit',
    content: `You don't need a high income or a fancy card to start building credit. A student credit card with a small limit is one of the easiest entry points — use it for one recurring purchase like a streaming subscription, pay it off each month, and you're building history.

If you can't get approved on your own yet, two other paths work well. You can become an authorized user on a parent or guardian's card (their good history helps yours), or look into a secured card where you put down a small deposit that becomes your limit.

The key is starting small and staying consistent. One card used responsibly for six to twelve months is all it takes to establish a foundation. You're not trying to impress anyone — you're just proving to the system that you pay your bills.`,
    example: `Mia couldn't get approved for a regular card, so she opened a secured card with a $200 deposit. She used it only for her $15 Spotify and gym membership each month. After eight months of perfect payments, her bank upgraded her to an unsecured card automatically.`,
    quizQuestions: [
      { id: 'building-credit-student-q1', question: 'What is a secured credit card?', options: ['A card with extra fraud protection', 'A card backed by a deposit you provide', 'A card only available to people with high scores', 'A debit card with a credit label'], correctIndex: 1 },
      { id: 'building-credit-student-q2', question: 'How can being an authorized user help you?', options: ['It gives you the other person\'s money', 'Their good payment history can help your score', 'It counts as a job reference', 'It lets you skip payments'], correctIndex: 1 },
      { id: 'building-credit-student-q3', question: 'How long does it typically take to establish a credit foundation?', options: ['One week', 'Six to twelve months of consistent use', 'Five years minimum', 'It happens instantly when you open a card'], correctIndex: 1 },
    ],
    order: 6,
  },
  {
    id: 'credit-score-monitoring',
    title: 'Credit Score Monitoring',
    description: 'How to check your score and what to watch for',
    topic: 'credit',
    content: `Checking your own credit score is free and doesn't hurt it — that's a common myth worth busting right away. Many bank apps show your score for free, and services like Credit Karma give you updates weekly at no cost.

You're also entitled to a free full credit report from each bureau once a year at annualcreditreport.com. It's worth glancing at once or twice a year to make sure everything listed is actually yours — errors happen more often than you'd think, and catching them early is much easier than fixing them later.

Watch for sudden drops (which might signal a missed payment or fraud) and celebrate steady climbs. You don't need to obsess over every five-point swing — monthly check-ins are plenty to stay informed without adding stress.`,
    example: 'Tomas set a calendar reminder to check his score on the first of each month through his bank app. One month he noticed a 40-point drop and found an account he never opened — someone had used his info. He reported it early and got it removed within weeks.',
    quizQuestions: [
      { id: 'credit-score-monitoring-q1', question: 'Does checking your own credit score hurt it?', options: ['Yes, every check lowers it', 'No, checking your own score is a soft inquiry', 'Only if you check more than once a year', 'Only if you use a free service'], correctIndex: 1 },
      { id: 'credit-score-monitoring-q2', question: 'Where can you get a free full credit report annually?', options: ['Your employer', 'annualcreditreport.com', 'The IRS website', 'Social media'], correctIndex: 1 },
      { id: 'credit-score-monitoring-q3', question: 'What should you do if you see a sudden score drop?', options: ['Ignore it — scores always bounce back', 'Investigate for missed payments or potential fraud', 'Close all your accounts immediately', 'Apply for more credit to offset it'], correctIndex: 1 },
    ],
    order: 7,
  },
  {
    id: 'common-credit-mistakes',
    title: 'Common Credit Mistakes',
    description: 'Pitfalls to know about so you can sidestep them',
    topic: 'credit',
    content: `Everyone makes financial missteps — the goal isn't perfection, it's awareness. The most impactful mistake for students is missing payments. Even one payment 30+ days late can stay on your report for years, so setting up autopay (even just for the minimum) is a simple safety net.

Maxing out your cards is another common trap. High utilization tells lenders you might be stretched thin, even if you pay it all off eventually. Keeping balances under 30% of your limit — ideally under 10% — sends a much healthier signal.

Two more to watch: applying for several cards in a short window (each application creates a hard inquiry that temporarily dings your score) and closing your oldest card (which shortens your credit history). If you have an old card with no annual fee, keep it open and use it for a small purchase now and then.`,
    example: 'Andre applied for three store cards during holiday sales because each offered a 15% discount. His score dropped 25 points from the hard inquiries alone. He learned to be selective — one thoughtful application is worth more than a handful of impulse ones.',
    quizQuestions: [
      { id: 'common-credit-mistakes-q1', question: 'Why is missing a payment so damaging?', options: ['It closes your account immediately', 'A late payment can stay on your report for years', 'Banks charge a $1,000 penalty', 'It only matters if you miss more than five'], correctIndex: 1 },
      { id: 'common-credit-mistakes-q2', question: 'Why should you avoid closing your oldest credit card?', options: ['You lose all your rewards points', 'It shortens your credit history length', 'The bank will charge a closing fee', 'It triggers an automatic audit'], correctIndex: 1 },
      { id: 'common-credit-mistakes-q3', question: 'What happens when you apply for many cards in a short time?', options: ['Your limit increases automatically', 'Each application creates a hard inquiry that can lower your score', 'Nothing — applications have no effect', 'You get bonus points for each application'], correctIndex: 1 },
    ],
    order: 8,
  },
  {
    id: 'investing-basics',
    title: 'Investing Basics',
    description: 'Letting your money grow over time',
    topic: 'investing',
    content: `Investing means putting money into things like funds or stocks with the goal of growing it over years, not days. The magic ingredient is time, thanks to compound growth, where your earnings start earning too.

For most beginners, a low-cost index fund is a calm place to start. Instead of picking single companies, you own a tiny slice of many at once, which spreads out your risk automatically.

The two habits that matter most are starting early and staying consistent. Investing a small amount regularly, and leaving it alone through ups and downs, usually beats trying to time the market perfectly.`,
    example: 'Devon set up an automatic $30 investment into an index fund every month from his campus job. He mostly forgets about it, and that hands-off consistency is exactly the point.',
    quizQuestions: [
      { id: 'investing-basics-q1', question: 'What makes compound growth powerful?', options: ['Your earnings begin earning too', 'It guarantees no losses', 'It only works for the wealthy', 'It doubles your money weekly'], correctIndex: 0 },
      { id: 'investing-basics-q2', question: 'Why are index funds popular for beginners?', options: ['They guarantee profit', 'They spread risk across many companies', 'They require daily trading', 'They avoid all fees'], correctIndex: 1 },
      { id: 'investing-basics-q3', question: 'What habit tends to help investors most?', options: ['Timing the market perfectly', 'Starting early and staying consistent', 'Checking prices hourly', 'Only investing large sums'], correctIndex: 1 },
    ],
    actionLink: undefined,
    order: 9,
  },
  {
    id: 'stocks',
    title: 'Understanding Stocks',
    description: 'What owning a share really means',
    topic: 'stocks',
    content: `A stock is a small piece of ownership in a company. When you buy a share, you own a tiny slice of that business, and its price moves up and down as people's views of the company change.

Prices can swing a lot in the short term, which is normal and not a reason to panic. Historically, broad ownership held over many years has tended to grow, even though no single day, month, or year is guaranteed.

Because any one company can struggle, spreading your money across many, often through a fund, lowers the risk that one bad pick hurts you. Think of stocks as a long-term part of the picture, not a way to get rich quick.`,
    example: "Lena bought a single share of a company she loved and watched it dip 10% in a week. Instead of selling in a panic, she remembered she's investing for years, not days, and held steady.",
    quizQuestions: [
      { id: 'stocks-q1', question: 'What does owning a stock represent?', options: ['A loan to the government', 'A small piece of ownership in a company', 'A guaranteed monthly payment', 'A type of savings account'], correctIndex: 1 },
      { id: 'stocks-q2', question: 'How should you view short-term price swings?', options: ['As a reason to panic sell', 'As a normal part of investing', 'As proof the stock is broken', 'As a guarantee of loss'], correctIndex: 1 },
      { id: 'stocks-q3', question: 'How can you lower the risk of one bad pick?', options: ['Buy only one company', 'Spread money across many, often via a fund', 'Sell everything each week', 'Avoid stocks entirely forever'], correctIndex: 1 },
    ],
    actionLink: undefined,
    order: 10,
  },
  {
    id: 'loans-and-bonds',
    title: 'Loans and Bonds',
    description: 'Borrowing, lending, and interest',
    topic: 'loans',
    content: `A loan is money you borrow and pay back over time with interest. Understanding the interest rate and term helps you see the real cost. A lower rate and a shorter term usually mean you pay less overall.

Student loans are common, so it helps to know the basics. Federal loans often have friendlier terms and repayment options than private ones, and paying even a little toward interest while in school can save you money later.

A bond flips the roles: you lend money to a government or company, and they pay you interest, then return your amount at the end. Bonds are generally steadier than stocks, which is why people often use them to balance out risk.`,
    example: "Jordan compared a private loan at 11% to a federal loan at 5% for the same amount. Choosing the lower-rate federal option saved hundreds in interest over the life of the loan.",
    quizQuestions: [
      { id: 'loans-and-bonds-q1', question: 'What usually makes a loan cost less overall?', options: ['A higher interest rate', 'A lower rate and shorter term', 'Skipping payments', 'A longer term always'], correctIndex: 1 },
      { id: 'loans-and-bonds-q2', question: 'What is a bond?', options: ['A share of company ownership', 'A loan you make to a government or company', 'A type of credit card', 'A savings account bonus'], correctIndex: 1 },
      { id: 'loans-and-bonds-q3', question: 'How are bonds generally seen compared to stocks?', options: ['Much riskier', 'Generally steadier', 'Identical in every way', 'Impossible to buy'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 11,
  },

  // ── Phase 18: Key Educational Content (Task 442) ────────────────────────

  // 442.1 — Budgeting Fundamentals
  {
    id: 'zero-based-budgeting',
    title: 'Zero-Based Budgeting',
    description: 'Give every dollar a job before the month starts',
    topic: 'budgeting',
    content: `Zero-based budgeting means assigning every dollar of income a purpose — spending, saving, or debt — until your plan hits zero. It's not about having zero money; it's about having zero unplanned money.

The idea is simple: income minus all planned expenses and savings equals zero. Every dollar knows where it's going before it arrives. This doesn't mean you can't be flexible — it means you're intentional about where flexibility lives.

Start by listing your income, then your must-pays (rent, bills), then your goals (savings, debt), and finally your flexible spending. If the total doesn't zero out, adjust until it does. You're the boss of the plan.`,
    example: 'Kayla earns $2,400/month. She assigns $900 to rent, $400 to bills, $200 to savings, $200 to debt, and $700 to flexible spending. Total: $2,400. Zero left unplanned, but plenty left to enjoy.',
    quizQuestions: [
      { id: 'zero-based-q1', question: 'What does "zero" mean in zero-based budgeting?', options: ['You have no money left', 'Every dollar is assigned a purpose', 'You spend nothing', 'Your savings are zero'], correctIndex: 1 },
      { id: 'zero-based-q2', question: 'What is the first step in zero-based budgeting?', options: ['Cut all fun spending', 'List your total income', 'Open a new bank account', 'Cancel subscriptions'], correctIndex: 1 },
      { id: 'zero-based-q3', question: 'Can you adjust a zero-based budget mid-month?', options: ['Never — it\'s set in stone', 'Yes — life happens and plans flex', 'Only if you overspend', 'Only with permission'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 12,
  },
  {
    id: 'envelope-method',
    title: 'The Envelope Method',
    description: 'Category budgets that keep spending visible',
    topic: 'budgeting',
    content: `The envelope method splits your spending money into categories — like putting cash in labeled envelopes. When a category runs out, you pause spending there until next month. Digital category budgets work the same way.

The power is visibility: you always know exactly how much is left for food, fun, or transport. No mental math, no guessing. When your "dining out" budget shows $30 remaining, you make different choices than when it's an invisible number.

You don't need physical envelopes — your category budgets here serve the same purpose. The key is checking in regularly so you're making informed choices rather than discovering overages after the fact.`,
    example: 'Ravi set a $300 food budget and $100 entertainment budget. Halfway through the month he checked in and saw $180 left for food but only $20 for entertainment. He shifted plans from a concert to a free campus event — no sacrifice, just awareness.',
    quizQuestions: [
      { id: 'envelope-q1', question: 'What is the core idea of the envelope method?', options: ['Save everything', 'Split spending into visible category limits', 'Never spend on wants', 'Only use cash'], correctIndex: 1 },
      { id: 'envelope-q2', question: 'What happens when a category "envelope" runs out?', options: ['You borrow from savings', 'You pause that category or reallocate', 'You go into debt', 'The month is ruined'], correctIndex: 1 },
      { id: 'envelope-q3', question: 'Do you need physical cash envelopes?', options: ['Yes, always', 'No — digital category budgets work the same way', 'Only for food', 'Only for entertainment'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 13,
  },

  // 442.2 — Saving and Compound Growth
  {
    id: 'compound-growth',
    title: 'Compound Growth',
    description: 'How your money earns money on its own',
    topic: 'saving',
    content: `Compound growth means your earnings start earning too. If you save $100 and earn 5% interest, next year you earn interest on $105 — not just the original $100. Over time, this snowball effect gets surprisingly powerful.

The key ingredient is time. Starting with even a small amount in your 20s gives compound growth decades to work. Someone who saves $50/month starting at 20 often ends up with more than someone who saves $150/month starting at 30 — just because of the head start.

You don't need to be an investor to benefit. A high-yield savings account gives you compound growth on autopilot. The important thing is starting now, even tiny, and letting time do the heavy lifting.`,
    example: 'Zara put $1,000 in a savings account earning 5% at age 20. Without adding another cent, it grows to about $3,400 by age 45 — purely from compounding. With monthly contributions, the growth is even more dramatic.',
    quizQuestions: [
      { id: 'compound-q1', question: 'What makes compound growth powerful?', options: ['You earn interest on your interest', 'Banks give extra bonuses', 'Stocks never lose value', 'It requires large sums'], correctIndex: 0 },
      { id: 'compound-q2', question: 'What is the most important ingredient for compound growth?', options: ['A large starting amount', 'Time', 'A finance degree', 'Daily trading'], correctIndex: 1 },
      { id: 'compound-q3', question: 'Can compound growth work in a regular savings account?', options: ['No — only stocks compound', 'Yes — any interest-bearing account compounds', 'Only with $10,000+', 'Only in retirement accounts'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=goals',
    order: 14,
  },

  // 442.3 — Debt Awareness
  {
    id: 'credit-card-interest',
    title: 'How Credit Card Interest Works',
    description: 'Understanding what carrying a balance really costs',
    topic: 'credit',
    content: `When you carry a balance on a credit card, you're charged interest on that balance — often 15–25% per year. That's not a one-time fee; it compounds monthly. A $1,000 balance at 22% generates about $18 in interest every single month, even if you're not spending more.

The minimum payment trap is real: paying only the minimum mostly covers interest, barely touching your actual balance. A $3,000 balance with minimum payments can take 10+ years to pay off and cost thousands extra in interest.

The good news? Even small extra payments make a huge difference. Paying just $25 above the minimum can cut your payoff time in half. Every extra dollar goes directly toward your balance, saving you future interest.`,
    example: 'Malik had $2,500 on a card at 21% APR. Minimum payments of $50/month meant he\'d pay for 9 years and spend $2,800 in interest alone. By paying $100/month instead, he\'d be done in 2.5 years and pay only $600 in interest.',
    quizQuestions: [
      { id: 'cc-interest-q1', question: 'How often does credit card interest compound?', options: ['Yearly', 'Monthly', 'Only when you miss a payment', 'Never if you have autopay'], correctIndex: 1 },
      { id: 'cc-interest-q2', question: 'What happens when you pay only the minimum?', options: ['Your balance drops quickly', 'Most of your payment goes to interest, not your balance', 'Interest stops', 'You earn rewards faster'], correctIndex: 1 },
      { id: 'cc-interest-q3', question: 'What is the most effective way to reduce interest costs?', options: ['Close the card', 'Pay more than the minimum each month', 'Only use the card on weekends', 'Ignore the balance'], correctIndex: 1 },
    ],
    order: 15,
  },
  {
    id: 'debt-payoff-strategies',
    title: 'Snowball vs Avalanche',
    description: 'Two proven paths out of debt',
    topic: 'loans',
    content: `When you have multiple debts, two strategies dominate: snowball and avalanche. Both work — the best one is whichever keeps you motivated.

Snowball: pay minimums on everything, then throw extra money at your smallest balance. When it's gone, roll that payment into the next smallest. The wins come fast and feel amazing, which keeps you going.

Avalanche: pay minimums on everything, then throw extra money at your highest-interest debt. Mathematically saves the most money over time, though the first win takes longer. If you're motivated by efficiency, this is your path.`,
    example: 'Taylor had 3 debts: $400 store card (15%), $2,000 student loan (6%), and $3,500 credit card (22%). Snowball would target the $400 first for a quick win. Avalanche would target the $3,500 card first to stop the 22% interest from growing.',
    quizQuestions: [
      { id: 'debt-strategy-q1', question: 'What does the snowball method prioritize?', options: ['Highest interest rate', 'Smallest balance first', 'Newest debt', 'Oldest debt'], correctIndex: 1 },
      { id: 'debt-strategy-q2', question: 'What does the avalanche method prioritize?', options: ['Smallest balance', 'Highest interest rate first', 'Equal payments on all debts', 'The debt you like least'], correctIndex: 1 },
      { id: 'debt-strategy-q3', question: 'Which strategy is "better"?', options: ['Snowball always', 'Avalanche always', 'Whichever keeps you motivated', 'Neither — just pay minimums'], correctIndex: 2 },
    ],
    order: 16,
  },

  // 442.4 — Spending Psychology
  {
    id: 'spending-psychology',
    title: 'Spending Psychology',
    description: 'How your brain tricks you into spending more',
    topic: 'budgeting',
    content: `Your brain is wired with shortcuts that marketers exploit daily. Anchoring makes a $50 shirt feel cheap after you see a $200 one. Lifestyle inflation makes you spend more as you earn more, keeping your savings flat. Impulse buys bypass your rational brain entirely.

The good news: awareness is most of the fix. Once you notice these patterns, they lose their power. The 24-hour rule for non-essentials, checking your daily allowance before purchases, and asking "would I buy this if it weren't on sale?" are all simple pattern-breakers.

Small daily choices compound like interest — in both directions. Spending $3 less per day frees up $90/month. That's not deprivation; it's redirecting money from autopilot purchases toward things you actually care about.`,
    example: 'Nadia realized she spent $8/day on impulse buys (snacks, extra coffee, random Amazon adds). She didn\'t cut them all — just became intentional about half. That $4/day savings became $120/month toward her travel goal.',
    quizQuestions: [
      { id: 'psych-q1', question: 'What is the "anchoring effect" in spending?', options: ['A ship reference', 'A high price makes a lower one feel like a deal', 'Spending only at anchor stores', 'Saving money in a safe'], correctIndex: 1 },
      { id: 'psych-q2', question: 'What is lifestyle inflation?', options: ['Prices going up everywhere', 'Spending more as you earn more, keeping savings flat', 'Inflating your budget on purpose', 'A type of debt'], correctIndex: 1 },
      { id: 'psych-q3', question: 'What is the simplest way to combat impulse buying?', options: ['Never shop again', 'Wait 24 hours before non-essential purchases', 'Only buy expensive things', 'Close all credit cards'], correctIndex: 1 },
    ],
    actionLink: '/accounting?tab=budgets',
    order: 17,
  },
]
