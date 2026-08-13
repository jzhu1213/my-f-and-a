/**
 * Bank statement CSV import parser.
 *
 * Accepts CSV text, auto-detects common bank statement formats (Chase, Bank of
 * America, Wells Fargo, Capital One, generic), maps columns to date/amount/
 * description, and returns candidate transactions with auto-categorization.
 *
 * All parsing is client-side — data never leaves the device until the user
 * confirms and saves to Supabase.
 *
 * Task 362.1
 */

import type { TransactionCategory, TransactionType, Transaction } from '@/types'
import { autoCategorize } from './autoCategorize'
import { lookupMerchant } from './merchantMemory'

// ============================================================================
// Types
// ============================================================================

/** A single parsed candidate transaction from a bank statement. */
export interface ImportCandidate {
  /** Unique key for the row (index-based) */
  id: string
  /** Parsed date in YYYY-MM-DD format */
  date: string
  /** Absolute amount (always positive) */
  amount: number
  /** Inferred type based on sign */
  type: TransactionType
  /** Auto-categorized category */
  category: TransactionCategory
  /** Original description/memo from the statement */
  description: string
  /** Confidence of the auto-categorization (0–1) */
  confidence: number
  /** Whether this row looks like a potential duplicate */
  isDuplicate: boolean
  /** Whether the user wants to include this in the import */
  included: boolean
  /** Optional user-edited note (defaults to description) */
  note: string
}

/** Result of parsing a CSV statement. */
export type ParseResult =
  | { success: true; candidates: ImportCandidate[]; detectedFormat: string; totalRows: number }
  | { success: false; error: string }

/** Column mapping for a detected bank format. */
interface ColumnMapping {
  dateCol: number
  amountCol: number
  descriptionCol: number
  /** Some banks split debit/credit into separate columns */
  debitCol?: number
  creditCol?: number
  /** Whether negative amounts = expenses (most common) */
  negativeIsExpense: boolean
}

// ============================================================================
// CSV Parsing Utilities
// ============================================================================

/**
 * Parse a CSV string into rows of string arrays.
 * Handles quoted fields with commas and newlines inside them.
 */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        // Escaped quote
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(current.trim())
        current = ''
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current.trim())
        current = ''
        if (row.some(cell => cell.length > 0)) {
          rows.push(row)
        }
        row = []
        if (char === '\r') i++ // Skip \n after \r
      } else {
        current += char
      }
    }
  }

  // Push last field and row
  row.push(current.trim())
  if (row.some(cell => cell.length > 0)) {
    rows.push(row)
  }

  return rows
}

// ============================================================================
// Format Detection
// ============================================================================

/** Known header patterns for common bank statement formats. */
const FORMAT_PATTERNS: { name: string; headerMatch: (headers: string[]) => ColumnMapping | null }[] = [
  {
    name: 'Chase',
    headerMatch: (headers) => {
      const lower = headers.map(h => h.toLowerCase())
      const dateIdx = lower.findIndex(h => h === 'transaction date' || h === 'posting date')
      const amountIdx = lower.findIndex(h => h === 'amount')
      const descIdx = lower.findIndex(h => h === 'description')
      if (dateIdx >= 0 && amountIdx >= 0 && descIdx >= 0) {
        return { dateCol: dateIdx, amountCol: amountIdx, descriptionCol: descIdx, negativeIsExpense: true }
      }
      return null
    },
  },
  {
    name: 'Bank of America',
    headerMatch: (headers) => {
      const lower = headers.map(h => h.toLowerCase())
      const dateIdx = lower.findIndex(h => h === 'date' || h === 'posted date')
      const amountIdx = lower.findIndex(h => h === 'amount')
      const descIdx = lower.findIndex(h => h.includes('payee') || h.includes('description'))
      if (dateIdx >= 0 && amountIdx >= 0 && descIdx >= 0) {
        return { dateCol: dateIdx, amountCol: amountIdx, descriptionCol: descIdx, negativeIsExpense: true }
      }
      return null
    },
  },
  {
    name: 'Wells Fargo',
    headerMatch: (headers) => {
      const lower = headers.map(h => h.toLowerCase())
      const dateIdx = lower.findIndex(h => h === 'date')
      const amountIdx = lower.findIndex(h => h === 'amount')
      const descIdx = lower.findIndex(h => h === 'description')
      if (dateIdx >= 0 && amountIdx >= 0 && descIdx >= 0) {
        return { dateCol: dateIdx, amountCol: amountIdx, descriptionCol: descIdx, negativeIsExpense: true }
      }
      return null
    },
  },
  {
    name: 'Capital One',
    headerMatch: (headers) => {
      const lower = headers.map(h => h.toLowerCase())
      const dateIdx = lower.findIndex(h => h === 'transaction date' || h === 'posted date')
      const debitIdx = lower.findIndex(h => h === 'debit')
      const creditIdx = lower.findIndex(h => h === 'credit')
      const descIdx = lower.findIndex(h => h === 'description' || h === 'payee')
      if (dateIdx >= 0 && (debitIdx >= 0 || creditIdx >= 0) && descIdx >= 0) {
        return {
          dateCol: dateIdx,
          amountCol: debitIdx >= 0 ? debitIdx : creditIdx,
          descriptionCol: descIdx,
          debitCol: debitIdx >= 0 ? debitIdx : undefined,
          creditCol: creditIdx >= 0 ? creditIdx : undefined,
          negativeIsExpense: true,
        }
      }
      return null
    },
  },
]

/**
 * Auto-detect column mapping from headers. Falls back to a generic heuristic.
 */
function detectFormat(headers: string[]): { name: string; mapping: ColumnMapping } {
  // Try known formats first
  for (const pattern of FORMAT_PATTERNS) {
    const mapping = pattern.headerMatch(headers)
    if (mapping) {
      return { name: pattern.name, mapping }
    }
  }

  // Generic fallback: look for date-like, amount-like, description-like columns
  const lower = headers.map(h => h.toLowerCase())

  const dateCol = lower.findIndex(h =>
    h.includes('date') || h.includes('posted') || h.includes('transaction')
  )
  const amountCol = lower.findIndex(h =>
    h.includes('amount') || h.includes('sum') || h.includes('value')
  )
  const descCol = lower.findIndex(h =>
    h.includes('desc') || h.includes('memo') || h.includes('payee') ||
    h.includes('merchant') || h.includes('name') || h.includes('narrative')
  )

  // If we can't find labeled columns, try positional heuristic
  // Many CSVs are: date, description, amount
  if (dateCol < 0 && amountCol < 0 && descCol < 0 && headers.length >= 3) {
    return {
      name: 'Generic (positional)',
      mapping: { dateCol: 0, descriptionCol: 1, amountCol: 2, negativeIsExpense: true },
    }
  }

  return {
    name: 'Generic',
    mapping: {
      dateCol: dateCol >= 0 ? dateCol : 0,
      amountCol: amountCol >= 0 ? amountCol : headers.length - 1,
      descriptionCol: descCol >= 0 ? descCol : 1,
      negativeIsExpense: true,
    },
  }
}

// ============================================================================
// Date Parsing
// ============================================================================

/**
 * Parse various date formats into YYYY-MM-DD.
 * Handles: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, DD/MM/YYYY (heuristic),
 * and Month DD, YYYY.
 */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    const month = m.padStart(2, '0')
    const day = d.padStart(2, '0')
    return `${y}-${month}-${day}`
  }

  // MM/DD/YY
  const shortYearMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/)
  if (shortYearMatch) {
    const [, m, d, y] = shortYearMatch
    const month = m.padStart(2, '0')
    const day = d.padStart(2, '0')
    const year = parseInt(y, 10) > 50 ? `19${y}` : `20${y}`
    return `${year}-${month}-${day}`
  }

  // Month DD, YYYY (e.g., "Jan 15, 2024")
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const namedMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s*(\d{4})$/)
  if (namedMatch) {
    const [, monthStr, d, y] = namedMatch
    const monthIdx = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m))
    if (monthIdx >= 0) {
      const month = String(monthIdx + 1).padStart(2, '0')
      const day = d.padStart(2, '0')
      return `${y}-${month}-${day}`
    }
  }

  return null
}

// ============================================================================
// Amount Parsing
// ============================================================================

/**
 * Parse an amount string, handling currency symbols, commas, parentheses (negative).
 */
function parseAmount(raw: string): number | null {
  let cleaned = raw.trim()
  if (!cleaned) return null

  // Handle parentheses as negative: (123.45) → -123.45
  const parenMatch = cleaned.match(/^\((.+)\)$/)
  if (parenMatch) {
    cleaned = '-' + parenMatch[1]
  }

  // Remove currency symbols and commas
  cleaned = cleaned.replace(/[$€£¥,]/g, '')

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// ============================================================================
// Auto-categorization
// ============================================================================

/**
 * Categorize a description using merchant memory (priority) then autoCategorize.
 */
function categorizeDescription(description: string): { category: TransactionCategory; confidence: number } {
  // Merchant memory has highest priority
  const merchant = lookupMerchant(description)
  if (merchant) {
    return { category: merchant.category, confidence: 0.95 }
  }

  // Built-in keyword categorization
  const autoResult = autoCategorize(description)
  if (autoResult) {
    return { category: autoResult.category, confidence: autoResult.confidence }
  }

  // Fallback
  return { category: 'other', confidence: 0 }
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Check if a candidate transaction is a potential duplicate of an existing one.
 * Matches on same date + similar amount (within $0.01).
 */
export function detectDuplicates(
  candidates: ImportCandidate[],
  existingTransactions: Transaction[]
): ImportCandidate[] {
  return candidates.map(candidate => {
    const isDuplicate = existingTransactions.some(existing =>
      existing.date === candidate.date &&
      Math.abs(existing.amount - candidate.amount) < 0.01
    )
    return { ...candidate, isDuplicate }
  })
}

// ============================================================================
// Main Parse Function
// ============================================================================

/**
 * Parse a CSV bank statement into candidate transactions.
 *
 * @param csvText - Raw CSV file content
 * @param existingTransactions - Existing transactions for duplicate detection
 * @returns ParseResult with candidates or error
 */
export function parseStatement(
  csvText: string,
  existingTransactions: Transaction[] = []
): ParseResult {
  if (!csvText || csvText.trim().length === 0) {
    return { success: false, error: 'The file appears to be empty.' }
  }

  const rows = parseCSVRows(csvText)
  if (rows.length < 2) {
    return { success: false, error: 'Could not find enough rows. Make sure the file has headers and at least one transaction.' }
  }

  const headers = rows[0]
  const { name: formatName, mapping } = detectFormat(headers)

  const candidates: ImportCandidate[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length <= Math.max(mapping.dateCol, mapping.amountCol, mapping.descriptionCol)) {
      continue // Skip rows that don't have enough columns
    }

    // Parse date
    const dateRaw = row[mapping.dateCol]
    const date = parseDate(dateRaw)
    if (!date) continue // Skip rows with unparseable dates

    // Parse amount
    let amount: number | null = null
    let type: TransactionType = 'expense'

    if (mapping.debitCol !== undefined && mapping.creditCol !== undefined) {
      // Separate debit/credit columns (Capital One style)
      const debit = mapping.debitCol !== undefined ? parseAmount(row[mapping.debitCol]) : null
      const credit = mapping.creditCol !== undefined ? parseAmount(row[mapping.creditCol]) : null
      if (debit && debit !== 0) {
        amount = Math.abs(debit)
        type = 'expense'
      } else if (credit && credit !== 0) {
        amount = Math.abs(credit)
        type = 'income'
      }
    } else {
      // Single amount column
      amount = parseAmount(row[mapping.amountCol])
      if (amount !== null) {
        if (mapping.negativeIsExpense) {
          type = amount < 0 ? 'expense' : 'income'
        } else {
          type = amount > 0 ? 'expense' : 'income'
        }
        amount = Math.abs(amount)
      }
    }

    if (amount === null || amount === 0) continue // Skip zero or unparseable amounts

    // Parse description
    const description = row[mapping.descriptionCol] || ''

    // Auto-categorize
    const { category, confidence } = categorizeDescription(description)

    // Override category for income
    const finalCategory: TransactionCategory = type === 'income' ? 'income' : category

    candidates.push({
      id: `import-${i}`,
      date,
      amount: Math.round(amount * 100) / 100,
      type,
      category: finalCategory,
      description,
      confidence: type === 'income' ? 1 : confidence,
      isDuplicate: false,
      included: true,
      note: description,
    })
  }

  if (candidates.length === 0) {
    return { success: false, error: 'No valid transactions found. Check the file format and try again.' }
  }

  // Run duplicate detection
  const withDuplicates = detectDuplicates(candidates, existingTransactions)

  // Auto-exclude duplicates
  const finalCandidates = withDuplicates.map(c => ({
    ...c,
    included: !c.isDuplicate,
  }))

  return {
    success: true,
    candidates: finalCandidates,
    detectedFormat: formatName,
    totalRows: rows.length - 1,
  }
}
