# MyF&A

A modern finance and accounting web application built with Next.js, designed for personal, small business, and gig worker financial management.

## Features

- **Dashboard**: Real-time financial overview with monthly income, expenses, and net calculations
- **Transaction Management**: Add, categorize, and track income/expenses with smart categorization
- **Invoice Generation**: Create professional invoices with PDF export functionality
- **Community Feed**: Share financial tips and insights with other users
- **User Profiles**: Support for different user types (personal, small business, gig worker)
- **Badge System**: Gamified experience with achievement badges

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation
- **Database**: Supabase
- **PDF Generation**: jsPDF
- **Date Handling**: date-fns

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── ai/             # AI-powered features
│   ├── community/      # Community feed
│   ├── invoices/       # Invoice management
│   ├── profile/        # User profile
│   └── transactions/   # Transaction management
├── components/         # Reusable UI components
├── lib/               # Utilities and configurations
└── types/             # TypeScript type definitions
```

## Key Features

### Smart Categorization
Transactions are automatically categorized based on notes (e.g., "groceries", "uber").

### PDF Invoice Generation
Create professional invoices with automatic PDF download and client management.

### Real-time Dashboard
Track monthly financial performance with visual statistics and community insights.

### User Types
- **Personal**: Individual expense tracking
- **Small Business**: Business financial management
- **Gig Worker**: Freelance income and expense tracking
