# Folio

**Your F&A Assistant** — Simple budgeting + financial literacy for college students and young adults.

## Features

- 📊 **Accounting**: Budget tracking, goals, transactions, smart insights
- 📚 **Finance**: Bite-sized lessons, quizzes, calculators

## Quick Start

```bash
npm install
npm run dev
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Tech Stack

Next.js 14 • Tailwind CSS • Supabase • Vercel

## Project Structure

```
src/
├── app/                  # Pages
├── components/
│   ├── accounting/       # Budget, goals, transactions
│   ├── finance/          # Lessons, calculators
│   └── ui/               # Shared components
├── contexts/             # Auth & theme
├── lib/                  # Supabase & utilities
└── types/                # TypeScript types
```

## Database Setup

Run in Supabase SQL Editor → see full schema in `/docs` or ask for it.

**Tables**: `profiles`, `transactions`, `budgets`, `goals`, `lesson_progress`

## License

MIT
