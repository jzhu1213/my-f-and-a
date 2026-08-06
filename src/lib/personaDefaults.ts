// ============================================================================
// Persona Defaults — tailor first-run starting values to the user's situation
// ============================================================================
//
// Task 200.1 — Persona-based onboarding branches (Group 86).
// Extends the warm onboarding flow (Phase 1 tasks 20, 39; Phase 2 task 95.1)
// and pairs with region-aware defaults (198.1) and multi-currency (195.1).
//
// A brand-new user can optionally say which situation sounds most like them —
// an on-campus student, a freelancer/gig worker, or an international student.
// That single tap adjusts the *starting* budget preset and rough monthly income
// so the first daily number lands closer to reality without any real setup.
//
// Everything here is ADDITIVE and BACKWARD-COMPATIBLE:
//   • Choosing a persona is entirely optional — the onboarding step is skippable
//     and the user always lands on Home immediately (never force setup).
//   • With no persona chosen, the flow keeps its existing neutral defaults, so
//     the standard experience is unchanged.
//   • Personas only supply *starting* hints; every value stays fully editable
//     later and no already-entered data is ever rewritten.

import type { BudgetPreset, OnboardingPersona } from '@/types/folio'

// ============================================================================
// Persona catalog
// ============================================================================

/** Display metadata for a single persona option (label, emoji, one-liner). */
export interface PersonaOption {
  value: OnboardingPersona
  label: string
  emoji: string
  description: string
}

/**
 * The personas offered on the first onboarding screen. Deliberately small and
 * warm — each maps to a recognizable student/young-adult money situation.
 */
export const ONBOARDING_PERSONAS: PersonaOption[] = [
  {
    value: 'on_campus',
    label: 'On-campus student',
    emoji: '🎓',
    description: 'Dorm, meal plan, every dollar counts',
  },
  {
    value: 'freelancer',
    label: 'Freelancer or gig work',
    emoji: '💼',
    description: 'Income comes and goes across gigs',
  },
  {
    value: 'international',
    label: 'Studying abroad',
    emoji: '🌏',
    description: 'New country, pick your home currency',
  },
]

// ============================================================================
// Persona-tailored starting defaults
// ============================================================================

/** The starting hints a persona contributes to the onboarding form. */
export interface PersonaDefaults {
  /** A rough starting monthly income to pre-fill the income slider. */
  monthlyIncome: number
  /** The budget style that best fits this persona out of the box. */
  budgetPreset: BudgetPreset
}

/**
 * Sensible starting values for each persona. These only seed the onboarding
 * form — the user can freely change income and budget style on the next screens.
 */
export function getPersonaDefaults(persona: OnboardingPersona): PersonaDefaults {
  switch (persona) {
    case 'on_campus':
      // Limited pocket money; lean toward saving what little there is.
      return { monthlyIncome: 1000, budgetPreset: 'student_tight' }
    case 'freelancer':
      // Variable, generally higher gross; leave a little breathing room.
      return { monthlyIncome: 3000, budgetPreset: 'student_moderate' }
    case 'international':
      // Modest allowance from home; a little room while settling in.
      return { monthlyIncome: 1500, budgetPreset: 'student_moderate' }
  }
}
