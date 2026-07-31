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
  ['raising cane', 'food', 3],
  ['wingstop', 'food', 3],
  ['five guys', 'food', 3],
  ['popeyes', 'food', 3],
  ['sweetgreen', 'food', 3],
  ['cava', 'food', 3],
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
  ['dining hall', 'food', 2],
  ['meal plan', 'food', 2],
  ['ramen', 'food', 2],
  ['smoothie', 'food', 2],
  ['bubble tea', 'food', 2],
  ['campus cafe', 'food', 2],
  ['late night', 'food', 2],
  ['vending', 'food', 2],
  ['food', 'food', 1],
  ['eat', 'food', 1],

  // Transport — brands (high specificity)
  ['uber', 'transport', 3],
  ['lyft', 'transport', 3],
  ['lime', 'transport', 2],
  ['bird scooter', 'transport', 3],
  ['bird', 'transport', 2],
  // Transport — generic
  ['gas', 'transport', 2],
  ['parking', 'transport', 2],
  ['bus', 'transport', 2],
  ['metro', 'transport', 2],
  ['train', 'transport', 2],
  ['taxi', 'transport', 2],
  ['fuel', 'transport', 2],
  ['toll', 'transport', 2],
  ['campus shuttle', 'transport', 3],
  ['bike share', 'transport', 3],
  ['scooter', 'transport', 2],
  ['e-scooter', 'transport', 2],
  ['campus bus', 'transport', 2],
  ['student transit', 'transport', 2],
  ['semester pass', 'transport', 3],

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
  ['tailgate', 'fun', 2],
  ['frat', 'fun', 2],
  ['sorority', 'fun', 2],
  ['formal', 'fun', 2],
  ['date night', 'fun', 2],
  ['escape room', 'fun', 2],
  ['mini golf', 'fun', 2],
  ['karaoke', 'fun', 2],
  ['thrift', 'fun', 2],
  ['thrifting', 'fun', 2],

  // Subscriptions — brands (high specificity)
  ['netflix', 'subscriptions', 3],
  ['spotify', 'subscriptions', 3],
  ['hulu', 'subscriptions', 3],
  ['disney+', 'subscriptions', 3],
  ['disney plus', 'subscriptions', 3],
  ['hbo', 'subscriptions', 3],
  ['apple music', 'subscriptions', 3],
  ['youtube premium', 'subscriptions', 3],
  ['chatgpt', 'subscriptions', 3],
  ['openai', 'subscriptions', 3],
  ['adobe', 'subscriptions', 3],
  ['icloud', 'subscriptions', 3],
  ['microsoft 365', 'subscriptions', 3],
  ['chegg', 'subscriptions', 3],
  ['crunchyroll', 'subscriptions', 3],
  ['paramount+', 'subscriptions', 3],
  ['twitch', 'subscriptions', 3],
  ['canva', 'subscriptions', 3],
  ['notion', 'subscriptions', 3],
  ['github student', 'subscriptions', 3],
  ['amazon prime student', 'subscriptions', 3],
  // Subscriptions — generic
  ['subscription', 'subscriptions', 2],
  ['streaming', 'subscriptions', 2],
  ['monthly plan', 'subscriptions', 2],

  // Health — brands (high specificity)
  ['cvs', 'health', 3],
  ['walgreens', 'health', 3],
  ['campus rec', 'health', 3],
  ['planet fitness', 'health', 3],
  // Health — generic
  ['gym', 'health', 2],
  ['therapy', 'health', 2],
  ['copay', 'health', 2],
  ['prescription', 'health', 2],
  ['doctor', 'health', 2],
  ['dentist', 'health', 2],
  ['pharmacy', 'health', 2],
  ['wellness', 'health', 2],
  ['campus health', 'health', 3],
  ['student health', 'health', 3],
  ['counseling', 'health', 2],
  ['mental health', 'health', 2],
  ['health', 'health', 1],

  // School
  ['textbook', 'school', 3],
  ['tuition', 'school', 3],
  ['canvas', 'school', 2],
  ['pearson', 'school', 3],
  ['mcgraw hill', 'school', 3],
  ['cengage', 'school', 3],
  ['school', 'school', 2],
  ['class', 'school', 1],
  ['lab fee', 'school', 3],
  ['course fee', 'school', 3],
  ['lab', 'school', 1],
  ['supplies', 'school', 1],
  ['bookstore', 'school', 2],
  ['printing', 'school', 2],
  ['study guide', 'school', 2],
  ['tutoring', 'school', 2],
  ['quizlet', 'school', 3],
  ['coursera', 'school', 3],
  ['study abroad', 'school', 3],
  ['iclicker', 'school', 3],
  ['calculator', 'school', 2],
  ['notebook', 'school', 2],

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
  ['roommate', 'rent', 2],
  ['dorm', 'rent', 2],
  ['housing deposit', 'rent', 3],
  ['laundry', 'rent', 2],

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
