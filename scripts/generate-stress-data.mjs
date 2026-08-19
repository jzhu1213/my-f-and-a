/**
 * generate-stress-data.mjs
 *
 * Generates a large synthetic dataset for stress testing Folio's core utilities:
 * - 2000+ transactions spanning 12 months with varied categories, amounts, notes
 * - 20+ savings goals with different progress levels
 * - 50+ recurring bills (FixedExpense entries)
 *
 * Output: scripts/stress-data.json (loadable into tests or localStorage)
 *
 * Usage: node scripts/generate-stress-data.mjs
 */

import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomId() {
  return Math.random().toString(36).slice(2, 12)
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'food', 'drinks', 'rent', 'transport', 'school',
  'fun', 'health', 'subscriptions', 'other'
]

const CATEGORY_AMOUNTS = {
  food: [5, 8, 12, 15, 20, 25, 35],
  drinks: [3, 4, 5, 6, 8],
  rent: [800, 1000, 1200, 1500],
  transport: [2, 5, 10, 15, 30, 50],
  school: [15, 30, 50, 75, 150],
  fun: [8, 10, 15, 20, 30, 50],
  health: [10, 15, 25, 40, 60],
  subscriptions: [5, 10, 15, 20],
  other: [5, 10, 20, 30, 50],
}

const NOTES = {
  food: ['Chipotle', 'Pizza', 'Dining hall', 'Groceries', 'Starbucks', 'Subway', 'Thai food', 'Ramen'],
  drinks: ['Coffee', 'Boba', 'Smoothie', 'Matcha', 'Energy drink'],
  rent: ['Monthly rent', 'Rent + utilities'],
  transport: ['Uber', 'Bus pass', 'Gas', 'Lyft', 'Parking'],
  school: ['Textbook', 'Lab supplies', 'Printing', 'Course materials'],
  fun: ['Movie ticket', 'Concert', 'Game', 'Bowling', 'Karaoke'],
  health: ['Gym', 'Vitamins', 'Doctor copay', 'Medicine'],
  subscriptions: ['Netflix', 'Spotify', 'iCloud', 'ChatGPT'],
  other: ['Gift', 'Laundry', 'Haircut', 'Phone case', 'Amazon order'],
}

const GOAL_NAMES = [
  'Emergency Fund', 'Summer Trip', 'New Laptop', 'Car Savings', 'Concert Tickets',
  'Winter Coat', 'Textbooks Next Sem', 'Holiday Gifts', 'Spring Break', 'Camera',
  'Gym Equipment', 'Move-in Deposit', 'Birthday Party', 'New Phone', 'Study Abroad',
  'Graduation Trip', 'Professional Clothes', 'Kitchen Supplies', 'Gaming Setup', 'Art Supplies',
  'Wedding Gift', 'Pet Fund', 'Online Course'
]

const GOAL_EMOJIS = ['🎯', '✈️', '💻', '🚗', '🎵', '🧥', '📚', '🎁', '🏖️', '📷', '💪', '🏠', '🎂', '📱', '🌍', '🎓', '👔', '🍳', '🎮', '🎨', '💍', '🐕', '📝']

const BILL_LABELS = [
  'Rent', 'Electricity', 'Water', 'Internet', 'Phone Plan', 'Netflix', 'Spotify',
  'Gym Membership', 'Car Insurance', 'Health Insurance', 'Renter\'s Insurance',
  'iCloud Storage', 'Adobe CC', 'Hulu', 'YouTube Premium', 'Apple Music',
  'Disney+', 'HBO Max', 'Paramount+', 'Amazon Prime', 'Microsoft 365',
  'Notion Pro', 'GitHub Pro', 'Domain Hosting', 'VPN', 'Cloud Storage',
  'Meal Plan', 'Parking Permit', 'Bus Pass', 'Student Loan Payment',
  'Credit Card Min', 'Phone Installment', 'Furniture Rental', 'Storage Unit',
  'Pet Insurance', 'Dental Plan', 'Vision Insurance', 'Therapy Copay',
  'Tutoring Subscription', 'Language App', 'News Subscription', 'Podcast Premium',
  'Gaming Subscription', 'Music Lessons', 'Climbing Gym', 'Coworking Space',
  'Laundry Service', 'Meal Delivery', 'Grocery Delivery', 'Security System',
  'Charity Donation'
]

// ─── Generators ──────────────────────────────────────────────────────────────

function generateTransactions(count, startDate, endDate) {
  const transactions = []
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  const rangeMs = endMs - startMs

  for (let i = 0; i < count; i++) {
    const isIncome = Math.random() < 0.15 // 15% income transactions
    const date = new Date(startMs + Math.random() * rangeMs)
    const category = isIncome ? 'income' : randomItem(EXPENSE_CATEGORIES)
    const amount = isIncome
      ? randomBetween(200, 2000)
      : randomItem(CATEGORY_AMOUNTS[category] || [10])

    const notePool = isIncome
      ? ['Paycheck', 'Side gig', 'Freelance', 'Tutoring', 'Refund', 'Gift money']
      : NOTES[category] || ['Misc']

    const tx = {
      id: `tx-stress-${randomId()}`,
      userId: 'user-stress-test',
      date: formatDate(date),
      amount,
      type: isIncome ? 'income' : 'expense',
      category,
      note: Math.random() < 0.7 ? randomItem(notePool) : undefined,
      isRecurring: !isIncome && category === 'subscriptions' && Math.random() < 0.5,
      accountType: 'personal',
      createdAt: date.toISOString(),
    }

    if (tx.isRecurring) {
      tx.recurringId = `recurring-${category}-${randomId()}`
    }

    transactions.push(tx)
  }

  // Sort by date
  transactions.sort((a, b) => a.date.localeCompare(b.date))
  return transactions
}

function generateGoals(count) {
  const goals = []
  for (let i = 0; i < count; i++) {
    const targetAmount = randomBetween(50, 5000)
    const progress = Math.random() // 0–100% progress
    goals.push({
      id: `goal-stress-${randomId()}`,
      userId: 'user-stress-test',
      name: GOAL_NAMES[i % GOAL_NAMES.length],
      targetAmount,
      currentAmount: Math.round(targetAmount * progress * 100) / 100,
      emoji: GOAL_EMOJIS[i % GOAL_EMOJIS.length],
      createdAt: new Date(2024, 0, 1 + i).toISOString(),
      type: i < 2 ? 'emergency_fund' : 'savings',
      targetDate: i % 3 === 0 ? formatDate(new Date(2025, 6 + (i % 6), 1)) : undefined,
    })
  }
  return goals
}

function generateFixedExpenses(count) {
  const expenses = []
  const categories = ['rent', 'subscriptions', 'health', 'transport', 'school', 'other']

  for (let i = 0; i < count; i++) {
    const label = BILL_LABELS[i % BILL_LABELS.length]
    const category = i === 0 ? 'rent' : randomItem(categories.filter(c => c !== 'rent'))
    const amount = category === 'rent'
      ? randomBetween(800, 1500)
      : randomBetween(5, 100)

    expenses.push({
      id: `bill-stress-${randomId()}`,
      userId: 'user-stress-test',
      category,
      label: `${label}${i >= BILL_LABELS.length ? ` ${Math.floor(i / BILL_LABELS.length) + 1}` : ''}`,
      amount,
      dueDay: (i % 28) + 1,
      recurringId: `recurring-bill-${randomId()}`,
      isActive: Math.random() < 0.9, // 90% active
    })
  }
  return expenses
}

function generateBudgets() {
  const currentDate = new Date()
  const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  return EXPENSE_CATEGORIES.map(category => ({
    id: `budget-stress-${randomId()}`,
    userId: 'user-stress-test',
    category,
    monthlyLimit: category === 'rent' ? 1500 : randomBetween(50, 300),
    spent: randomBetween(0, 200),
    month,
    isFixed: category === 'rent',
  }))
}

// ─── Main ────────────────────────────────────────────────────────────────────

const endDate = new Date()
const startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1) // 12 months ago

const data = {
  transactions: generateTransactions(2200, startDate, endDate),
  goals: generateGoals(23),
  fixedExpenses: generateFixedExpenses(55),
  budgets: generateBudgets(),
  meta: {
    generated: new Date().toISOString(),
    transactionCount: 2200,
    goalCount: 23,
    fixedExpenseCount: 55,
    dateRange: { start: formatDate(startDate), end: formatDate(endDate) },
  },
}

const outputPath = resolve(__dirname, 'stress-data.json')
writeFileSync(outputPath, JSON.stringify(data, null, 2))

console.log(`✅ Stress data generated: ${outputPath}`)
console.log(`   Transactions: ${data.transactions.length}`)
console.log(`   Goals: ${data.goals.length}`)
console.log(`   Fixed Expenses: ${data.fixedExpenses.length}`)
console.log(`   Budgets: ${data.budgets.length}`)
console.log(`   Date range: ${data.meta.dateRange.start} → ${data.meta.dateRange.end}`)
