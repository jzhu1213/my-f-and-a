/**
 * Natural-language quick log parser.
 *
 * Parses free-text input like "5 coffee", "20 groceries venmo", "$12.50 lunch",
 * "uber 8" into structured transaction components: amount + category + optional
 * funding source.
 *
 * Pure, deterministic, no external API calls.
 *
 * Task 166.1
 */

import type { TransactionCategory } from '@/types'
import type { FundingSource } from '@/lib/fundingSources'
import type { CategorizationRule } from '@/lib/categorizationRules'
import { autoCategorize, autoCategorizeWithRules } from '@/lib/autoCategorize'
import type { AutoCategorizeResult } from '@/lib/autoCategorize'

// ============================================================================
// Types
// ============================================================================

export interface ParsedTransaction {
  amount: number
  category: TransactionCategory
  categoryConfidence: number
  fundingSourceId?: string
  fundingSourceConfidence?: number
  /** The remaining text after extracting amount and source — used as the note */
  note: string
}

export type ParseResult =
  | { status: 'success'; parsed: ParsedTransaction }
  | { status: 'ambiguous'; reason: string; partial?: Partial<ParsedTransaction> }

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Regex to match amounts: optional $ sign, digits with optional decimal.
 * Captures: optional $, whole number, optional .decimal
 * Examples: "5", "$12.50", "20.5", "$8"
 */
const AMOUNT_REGEX = /\$?\d+(?:\.\d{1,2})?/g

/**
 * Extract all number-like amounts from the input string.
 * Returns them with their position info for later removal.
 */
function extractAmounts(input: string): { value: number; start: number; end: number }[] {
  const results: { value: number; start: number; end: number }[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  AMOUNT_REGEX.lastIndex = 0

  while ((match = AMOUNT_REGEX.exec(input)) !== null) {
    const raw = match[0].replace('$', '')
    const value = parseFloat(raw)
    if (isFinite(value) && value > 0) {
      results.push({ value, start: match.index, end: match.index + match[0].length })
    }
  }

  return results
}

/**
 * Try to match a funding source from the input tokens.
 * Case-insensitive match against funding source labels.
 * Returns the matched source and the token(s) that matched.
 */
function matchFundingSource(
  tokens: string[],
  fundingSources: FundingSource[]
): { source: FundingSource; matchedTokens: string[] } | null {
  if (!fundingSources || fundingSources.length === 0) return null

  const inputLower = tokens.join(' ').toLowerCase()

  // Try multi-word labels first (e.g. "apple cash", "parents' card", "campus card")
  // Sort by label length descending so longer matches win
  const sortedSources = [...fundingSources].sort(
    (a, b) => b.label.length - a.label.length
  )

  for (const source of sortedSources) {
    const labelLower = source.label.toLowerCase()

    // Check if the full label appears in the joined tokens
    if (inputLower.includes(labelLower)) {
      // Find which tokens were part of this match
      const labelWords = labelLower.split(/\s+/)
      const matched = tokens.filter(t => labelWords.includes(t.toLowerCase()))
      return { source, matchedTokens: matched.length > 0 ? matched : [labelLower] }
    }

    // Also try matching just the first word of the label (e.g. "venmo" matches "Venmo")
    const firstWord = labelLower.split(/\s+/)[0]
    if (firstWord.length >= 3) {
      for (const token of tokens) {
        if (token.toLowerCase() === firstWord) {
          return { source, matchedTokens: [token] }
        }
      }
    }

    // Match by kind shorthand (e.g. "debit", "credit", "cash")
    const kindLower = source.kind.toLowerCase().replace('_', ' ')
    for (const token of tokens) {
      if (token.toLowerCase() === kindLower || token.toLowerCase() === kindLower.replace(' ', '')) {
        return { source, matchedTokens: [token] }
      }
    }
  }

  return null
}

/**
 * Remove matched tokens from a token array (case-insensitive).
 */
function removeTokens(tokens: string[], toRemove: string[]): string[] {
  const removeLower = new Set(toRemove.map(t => t.toLowerCase()))
  return tokens.filter(t => !removeLower.has(t.toLowerCase()))
}

// ============================================================================
// Main parser
// ============================================================================

/**
 * Parse a free-text input string into a structured transaction.
 *
 * Supported patterns:
 * - Amount first: "5 coffee", "$12 lunch", "20.50 groceries"
 * - Amount last: "coffee 5", "uber 8"
 * - With source: "20 groceries venmo", "15 lunch debit"
 * - With dollar sign: "$8 boba"
 * - With notes: "5 coffee starbucks"
 *
 * @param input - The raw free-text input
 * @param fundingSources - Available funding sources for matching
 * @param categorizationRules - User-defined categorization rules
 * @returns ParseResult indicating success or ambiguity
 */
export function parseNaturalLog(
  input: string,
  fundingSources?: FundingSource[],
  categorizationRules?: CategorizationRule[]
): ParseResult {
  // ── Edge case: empty or whitespace-only input
  if (!input || input.trim().length === 0) {
    return { status: 'ambiguous', reason: 'Empty input' }
  }

  const trimmed = input.trim()

  // ── Extract amounts from the input
  const amounts = extractAmounts(trimmed)

  // ── Edge case: no amount found
  if (amounts.length === 0) {
    return {
      status: 'ambiguous',
      reason: 'No amount found — try something like "5 coffee"',
    }
  }

  // ── Edge case: multiple different amounts — ambiguous
  if (amounts.length > 1) {
    // If all amounts are the same value, just use the first one
    const uniqueValues = new Set(amounts.map(a => a.value))
    if (uniqueValues.size > 1) {
      return {
        status: 'ambiguous',
        reason: 'Multiple amounts found — which one did you mean?',
        partial: { amount: amounts[0].value },
      }
    }
  }

  const amount = amounts[0].value

  // ── Validate amount range
  if (amount > 99_999) {
    return {
      status: 'ambiguous',
      reason: 'Amount seems too large — double-check?',
      partial: { amount },
    }
  }

  // ── Remove the amount from the string to get the remaining text
  // Replace the first matched amount with empty, then clean up whitespace
  let remaining = trimmed.slice(0, amounts[0].start) + trimmed.slice(amounts[0].end)
  remaining = remaining.replace(/\s+/g, ' ').trim()

  // ── Edge case: only a number, no text
  if (remaining.length === 0) {
    return {
      status: 'ambiguous',
      reason: 'Got the amount — what was it for?',
      partial: { amount },
    }
  }

  // ── Tokenize the remaining text
  const tokens = remaining.split(/\s+/).filter(t => t.length > 0)

  // ── Try to match a funding source
  let fundingSourceId: string | undefined
  let fundingSourceConfidence: number | undefined
  let tokensAfterSource = tokens

  if (fundingSources && fundingSources.length > 0) {
    const sourceMatch = matchFundingSource(tokens, fundingSources)
    if (sourceMatch) {
      fundingSourceId = sourceMatch.source.id
      fundingSourceConfidence = 0.9
      tokensAfterSource = removeTokens(tokens, sourceMatch.matchedTokens)
    }
  }

  // ── Build the note text (remaining tokens after source extraction)
  const noteText = tokensAfterSource.join(' ')

  // ── Try to categorize from the full remaining text (before source removal)
  // This gives the best chance of matching keywords like "uber" even if it's also a source
  let categorizeResult: AutoCategorizeResult | null = null

  if (categorizationRules && categorizationRules.length > 0) {
    categorizeResult = autoCategorizeWithRules(remaining, categorizationRules)
  } else {
    categorizeResult = autoCategorize(remaining)
  }

  // If no match on full remaining, try just the note portion
  if (!categorizeResult && noteText !== remaining) {
    if (categorizationRules && categorizationRules.length > 0) {
      categorizeResult = autoCategorizeWithRules(noteText, categorizationRules)
    } else {
      categorizeResult = autoCategorize(noteText)
    }
  }

  // ── If we still can't categorize, mark as ambiguous
  if (!categorizeResult) {
    return {
      status: 'ambiguous',
      reason: 'Not sure what category this falls into',
      partial: {
        amount,
        note: noteText || remaining,
        fundingSourceId,
        fundingSourceConfidence,
      },
    }
  }

  // ── Success — we have amount + category (+ optional source)
  return {
    status: 'success',
    parsed: {
      amount,
      category: categorizeResult.category,
      categoryConfidence: categorizeResult.confidence,
      fundingSourceId,
      fundingSourceConfidence,
      note: noteText || remaining,
    },
  }
}
