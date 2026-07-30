import type { TransactionCategory } from '@/types'
import type { CategorizationRule } from './categorizationRules'
import { applyUserRules } from './categorizationRules'

/**
 * Keyword-to-category mapping.
 * Each entry is [keyword, category, specificity] where specificity
 * indicates how precise the match is (higher = more confident).
 * Brand names get higher specificity than generic words.
 */
const KEYWORD_MAP: [string, TransactionCategory, number][] = [
  // Food — brands (high specificity)
  ['starbucks', 'food', 3],
  ['chipotle', 'food', 3],
  ['mcdonald', 'food', 3],
  ['chick-fil-a', 'food', 3],
  ['dunkin', 'food', 3],
  ['subway', 'food', 3],
  ['dominos', 'food', 3],
  ['pizza hut', 'food', 3],
  ['panda express', 'food', 3],
  ['taco bell', 'food', 3],
  ['wendys', 'food', 3],
  ['panera', 'food', 3],
  ['doordash', 'food', 3],
  ['grubhub', 'food', 3],
  ['ubereats', 'food', 3],
  // Food — generic (medium specificity)
  ['coffee', 'food', 2],
  ['lunch', 'food', 2],
  ['dinner', 'food', 2],
  ['breakfast', 'food', 2],
  ['groceries', 'food', 2],
  ['grocery', 'food', 2],
  ['snack', 'food', 2],
  ['pizza', 'food', 2],
  ['burger', 'food', 2],
  ['sushi', 'food', 2],
  ['boba', 'food', 2],
  ['food', 'food', 1],
  ['eat', 'food', 1],

  // Transport — brands (high specificity)
  ['uber', 'transport', 3],
  ['lyft', 'transport', 3],
  ['lime', 'transport', 2],
  // Transport — generic
  ['gas', 'transport', 2],
  ['parking', 'transport', 2],
  ['bus', 'transport', 2],
  ['metro', 'transport', 2],
  ['train', 'transport', 2],
  ['taxi', 'transport', 2],
  ['fuel', 'transport', 2],
  ['toll', 'transport', 2],

  // Fun — brands (high specificity)
  ['netflix', 'fun', 3],
  ['spotify', 'fun', 3],
  ['hulu', 'fun', 3],
  ['disney+', 'fun', 3],
  ['disney plus', 'fun', 3],
  ['hbo', 'fun', 3],
  ['playstation', 'fun', 3],
  ['xbox', 'fun', 3],
  ['steam', 'fun', 2],
  ['twitch', 'fun', 3],
  ['apple music', 'fun', 3],
  ['youtube premium', 'fun', 3],
  // Fun — generic
  ['movie', 'fun', 2],
  ['concert', 'fun', 2],
  ['game', 'fun', 2],
  ['bar', 'fun', 1],
  ['drinks', 'fun', 2],
  ['party', 'fun', 2],
  ['club', 'fun', 1],
  ['bowling', 'fun', 2],
  ['arcade', 'fun', 2],

  // School
  ['textbook', 'school', 3],
  ['tuition', 'school', 3],
  ['canvas', 'school', 2],
  ['school', 'school', 2],
  ['class', 'school', 1],
  ['lab', 'school', 1],
  ['supplies', 'school', 1],
  ['bookstore', 'school', 2],
  ['printing', 'school', 2],

  // Rent
  ['rent', 'rent', 3],
  ['lease', 'rent', 2],
  ['apartment', 'rent', 2],
  ['utilities', 'rent', 2],
  ['electric', 'rent', 2],
  ['water bill', 'rent', 2],
  ['internet', 'rent', 2],
  ['wifi', 'rent', 2],
  ['phone bill', 'rent', 2],

  // Gig / work-related
  ['gig', 'gig', 2],
  ['freelance', 'gig', 2],
  ['client', 'gig', 2],
  ['project', 'gig', 1],
  ['invoice', 'gig', 2],

  // Income
  ['paycheck', 'income', 3],
  ['salary', 'income', 3],
  ['direct deposit', 'income', 3],
  ['refund', 'income', 2],
  ['reimbursement', 'income', 2],
  ['venmo', 'income', 1],
  ['zelle', 'income', 1],
]

export interface AutoCategorizeResult {
  category: TransactionCategory
  confidence: number
}

/**
 * Infers a transaction category from note/merchant keywords.
 *
 * Pure function — no side effects.
 * Returns null when no keywords match.
 * Confidence is based on match specificity:
 *   - specificity 3 (brand/exact): confidence 0.9
 *   - specificity 2 (generic keyword): confidence 0.7
 *   - specificity 1 (vague match): confidence 0.5
 */
export function autoCategorize(note: string): AutoCategorizeResult | null {
  if (!note || note.trim().length === 0) return null

  const lower = note.toLowerCase().trim()

  let bestMatch: { category: TransactionCategory; specificity: number; keyword: string } | null = null

  for (const [keyword, category, specificity] of KEYWORD_MAP) {
    if (lower.includes(keyword)) {
      // Prefer the match with highest specificity, or longest keyword for ties
      if (
        !bestMatch ||
        specificity > bestMatch.specificity ||
        (specificity === bestMatch.specificity && keyword.length > bestMatch.keyword.length)
      ) {
        bestMatch = { category, specificity, keyword }
      }
    }
  }

  if (!bestMatch) return null

  // Map specificity to confidence
  const confidenceMap: Record<number, number> = { 3: 0.9, 2: 0.7, 1: 0.5 }
  const confidence = confidenceMap[bestMatch.specificity] ?? 0.5

  return { category: bestMatch.category, confidence }
}


/**
 * Enhanced auto-categorize that checks user-defined rules first,
 * then falls back to the built-in keyword map.
 *
 * User rules always have priority (confidence 1.0).
 * The original `autoCategorize` function is preserved for backward compatibility.
 *
 * Task 113.3
 */
export function autoCategorizeWithRules(
  note: string,
  rules: CategorizationRule[]
): AutoCategorizeResult | null {
  // User rules take priority
  const userResult = applyUserRules(note, rules)
  if (userResult) return userResult

  // Fall back to built-in keyword map
  return autoCategorize(note)
}
