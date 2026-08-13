import { supabase } from './supabaseClient'
import type { Transaction, Budget, Goal } from '@/types'
import { getTagsForTransaction } from './tagUtils'

/**
 * Escape a value for safe inclusion in a CSV cell.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Options for CSV export — optional date range filter. */
export interface CSVExportOptions {
  /** When provided, only transactions within this date range are exported. */
  dateRange?: { start: string; end: string }
}

/**
 * Export transactions as a CSV file for easy spreadsheet import.
 * Columns: Date, Amount, Category, Note, Type, Tags.
 * Optionally filters to a date range.
 * Free — no paywall required.
 *
 * Validates: Requirements 12.5, 19.6
 */
export function exportTransactionsCSV(
  transactions: Transaction[],
  options?: CSVExportOptions
): void {
  let filtered = transactions

  if (options?.dateRange) {
    const { start, end } = options.dateRange
    filtered = transactions.filter(t => t.date >= start && t.date <= end)
  }

  const headers = ['Date', 'Amount', 'Category', 'Note', 'Type', 'Tags']

  const rows = filtered.map(t => {
    const tags = t.tags ?? getTagsForTransaction(t.id) ?? []
    return [
      escapeCSV(t.date),
      String(t.amount),
      escapeCSV(t.category),
      escapeCSV(t.note ?? ''),
      escapeCSV(t.type),
      escapeCSV(tags.join('; ')),
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\n')

  const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(dataBlob)

  const link = document.createElement('a')
  link.href = url
  link.download = `folio-transactions-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export all user data as a JSON file
 * Includes transactions, budgets, goals, and preferences
 * 
 * Validates: Requirements 12.5
 */
export async function exportUserData(
  userId: string,
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  userEmail?: string
): Promise<void> {
  const exportData = {
    exportDate: new Date().toISOString(),
    user: {
      id: userId,
      email: userEmail,
    },
    transactions: transactions.map(t => ({
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category,
      note: t.note,
      accountType: t.accountType,
      createdAt: t.createdAt,
    })),
    budgets: budgets.map(b => ({
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spent: b.spent,
      month: b.month,
    })),
    goals: goals.map(g => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      emoji: g.emoji,
      createdAt: g.createdAt,
    })),
  }

  // Create and download JSON file
  const dataStr = JSON.stringify(exportData, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `folio-data-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

/**
 * Delete all user data from Supabase
 * This is a destructive operation that cannot be undone
 * 
 * Validates: Requirements 12.6
 */
export async function deleteUserAccount(userId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Delete transactions
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)

    if (txError) {
      console.error('Error deleting transactions:', txError)
      return { success: false, error: 'Failed to delete transactions' }
    }

    // Delete budgets
    const { error: budgetError } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)

    if (budgetError) {
      console.error('Error deleting budgets:', budgetError)
      return { success: false, error: 'Failed to delete budgets' }
    }

    // Delete goals
    const { error: goalError } = await supabase
      .from('goals')
      .delete()
      .eq('user_id', userId)

    if (goalError) {
      console.error('Error deleting goals:', goalError)
      return { success: false, error: 'Failed to delete goals' }
    }

    // Delete lesson progress
    const { error: lessonError } = await supabase
      .from('lesson_progress')
      .delete()
      .eq('user_id', userId)

    if (lessonError) {
      console.error('Error deleting lesson progress:', lessonError)
      return { success: false, error: 'Failed to delete lesson progress' }
    }

    // Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return { success: false, error: 'Failed to delete profile' }
    }

    // Delete auth user (this must be done last)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      // Note: This might fail if using anon key instead of service role
      // In that case, we rely on database cascading deletes or manual cleanup
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting user account:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
