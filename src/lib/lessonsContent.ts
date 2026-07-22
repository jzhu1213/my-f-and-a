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
    order: 5,
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
    order: 6,
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
    order: 7,
  },
]
