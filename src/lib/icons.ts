/**
 * Central Icon Registry
 *
 * Single source of truth mapping Folio's *semantic* icon names (e.g.
 * `category:food`, `tool:debt`, `status:healthy`, `nav:home`) to concrete
 * Lucide glyphs. Nothing in the app should import a Lucide icon directly —
 * everything goes through the {@link Icon} wrapper + this registry so that
 * swapping the underlying icon set later is a single-file change.
 *
 * Why Lucide? Its stroke-based style matches the hand-rolled SVGs that used to
 * live inline in `AppShell`, it is fully theme-colorable via `currentColor`,
 * and it tree-shakes per-glyph (only the icons referenced below ship).
 *
 * Guidelines:
 * - Keys are namespaced `<domain>:<name>` so the registry reads as a taxonomy.
 * - Categories mirror {@link TransactionCategory}; statuses mirror
 *   {@link AllowanceStatus}; tools mirror the `ToolsScreen` tool ids.
 * - The registry replaces the emoji lookups in `vocabulary.ts` for structural
 *   UI. Expressive/celebratory emoji (celebrationEngine) intentionally stay.
 */

import type { LucideIcon } from 'lucide-react'
import {
  // Categories
  Utensils,
  Coffee,
  Home,
  Bike,
  GraduationCap,
  Music,
  Dumbbell,
  Repeat,
  Package,
  Zap,
  Banknote,
  Wallet,
  // Statuses
  Sparkles,
  Lightbulb,
  TriangleAlert,
  Heart,
  BarChart3,
  WifiOff,
  AlertCircle,
  RefreshCw,
  // Tips
  Brain,
  Bell,
  Clock,
  Sprout,
  Eye,
  // Tools
  TrendingUp,
  CreditCard,
  Calendar,
  Handshake,
  Target,
  MessageCircle,
  Users,
  UserPlus,
  Landmark,
  Pencil,
  PieChart,
  Telescope,
  TrendingDown,
  LineChart,
  Coins,
  BookOpen,
  PartyPopper,
  UsersRound,
  PiggyBank,
  Percent,
  Star,
  // Breakdown
  CalendarDays,
  RefreshCcw,
  ShieldCheck,
  CalendarClock,
  Lock,
  // Navigation / chrome / actions
  History,
  Settings,
  Wrench,
  User,
  Plus,
  ChevronRight,
  Trash2,
  // Toast
  CircleCheck,
  CircleX,
  Info,
  // Shared pages
  Link2Off,
  HeartHandshake,
} from 'lucide-react'

import type { TransactionCategory } from '@/types'
import type { AllowanceStatus, TipType } from '@/types/folio'

/**
 * The full set of semantic icon names Folio knows about. Add new entries here
 * (and to {@link ICON_REGISTRY}) when a new surface needs an icon.
 */
export type IconName =
  // ── Categories (mirror TransactionCategory) ──────────────────────────────
  | 'category:food'
  | 'category:drinks'
  | 'category:rent'
  | 'category:transport'
  | 'category:school'
  | 'category:fun'
  | 'category:health'
  | 'category:subscriptions'
  | 'category:other'
  | 'category:gig'
  | 'category:income'
  | 'category:fallback'
  // ── Allowance statuses (mirror AllowanceStatus) + tracker ────────────────
  | 'status:healthy'
  | 'status:caution'
  | 'status:warning'
  | 'status:over'
  | 'status:tracking'
  | 'status:elevated'
  | 'status:offline'
  | 'status:error'
  | 'status:retry'
  // ── Contextual tip indicators (mirror TipType + TIP_EMOJI vocabulary) ─────
  | 'tip:celebration'
  | 'tip:nudge'
  | 'tip:info'
  | 'tip:suggestion'
  | 'tip:bill'
  | 'tip:pacing'
  | 'tip:subscription'
  | 'tip:renewal'
  | 'tip:trial-ending'
  | 'tip:low-balance'
  | 'tip:spending-up'
  | 'tip:credit'
  | 'tip:lesson'
  | 'tip:goal'
  | 'tip:encourage'
  | 'tip:savings'
  | 'tip:confidence'
  | 'tip:anomaly'
  // ── Tools (mirror ToolsScreen tool ids) ──────────────────────────────────
  | 'tool:trajectory'
  | 'tool:debt'
  | 'tool:recurring-bills'
  | 'tool:reimbursements'
  | 'tool:sinking-funds'
  | 'tool:subscriptions'
  | 'tool:cancel-negotiate'
  | 'tool:household-pool'
  | 'tool:invite-roommate'
  | 'tool:savings-projections'
  | 'tool:manage-savings'
  | 'tool:portfolio-allocation'
  | 'tool:investment-explorer'
  | 'tool:cash-flow-forecast'
  | 'tool:compound-growth'
  | 'tool:credit-payoff'
  | 'tool:term-review'
  | 'tool:year-in-review'
  | 'tool:peer-context'
  | 'tool:learn'
  | 'tool:wish-list'
  | 'tool:income-trends'
  // ── Tools screen stat cards ──────────────────────────────────────────────
  | 'stat:set-aside'
  | 'stat:savings-rate'
  // ── Breakdown rows (DailyAllowanceHero detail panel) ──────────────────────
  | 'breakdown:daily-budget'
  | 'breakdown:rollover'
  | 'breakdown:spent'
  | 'breakdown:reserved'
  | 'breakdown:scheduled'
  | 'breakdown:total-locked'
  // ── Navigation / chrome / actions ────────────────────────────────────────
  | 'nav:home'
  | 'nav:history'
  | 'nav:settings'
  | 'nav:tools'
  | 'chrome:person'
  | 'action:add'
  | 'action:forward'
  | 'action:edit'
  | 'action:delete'
  // ── Toast status icons ───────────────────────────────────────────────────
  | 'toast:success'
  | 'toast:error'
  | 'toast:info'
  // ── Shared / public pages ────────────────────────────────────────────────
  | 'shared:link-expired'
  | 'shared:group'
  | 'shared:support'

/**
 * The registry itself. `satisfies` guarantees every {@link IconName} has a
 * concrete Lucide glyph and that no stray keys sneak in.
 */
export const ICON_REGISTRY = {
  // ── Categories ────────────────────────────────────────────────────────────
  'category:food': Utensils,
  'category:drinks': Coffee,
  'category:rent': Home,
  'category:transport': Bike,
  'category:school': GraduationCap,
  'category:fun': Music,
  'category:health': Dumbbell,
  'category:subscriptions': Repeat,
  'category:other': Package,
  'category:gig': Zap,
  'category:income': Banknote,
  'category:fallback': Wallet,
  // ── Statuses ────────────────────────────────────────────────────────────
  'status:healthy': Sparkles,
  'status:caution': Lightbulb,
  'status:warning': TriangleAlert,
  'status:over': Heart,
  'status:tracking': BarChart3,
  // Tracker-mode "higher than usual" — neutral, informational (never a warning).
  'status:elevated': TrendingUp,
  // Network/sync status icons (Phase 6 task 265)
  'status:offline': WifiOff,
  'status:error': AlertCircle,
  'status:retry': RefreshCw,
  // ── Contextual tip indicators ─────────────────────────────────────────────
  'tip:celebration': PartyPopper,
  'tip:nudge': Lightbulb,
  'tip:info': Sparkles,
  'tip:suggestion': Brain,
  'tip:bill': Bell,
  'tip:pacing': BarChart3,
  'tip:subscription': Repeat,
  'tip:renewal': Calendar,
  'tip:trial-ending': Clock,
  'tip:low-balance': Heart,
  'tip:spending-up': TrendingUp,
  'tip:credit': CreditCard,
  'tip:lesson': BookOpen,
  'tip:goal': Target,
  'tip:encourage': Heart,
  'tip:savings': Sprout,
  'tip:confidence': Heart,
  'tip:anomaly': Eye,
  // ── Tools ─────────────────────────────────────────────────────────────────
  'tool:trajectory': TrendingUp,
  'tool:debt': CreditCard,
  'tool:recurring-bills': Calendar,
  'tool:reimbursements': Handshake,
  'tool:sinking-funds': Target,
  'tool:subscriptions': Repeat,
  'tool:cancel-negotiate': MessageCircle,
  'tool:household-pool': Users,
  'tool:invite-roommate': UserPlus,
  'tool:savings-projections': Landmark,
  'tool:manage-savings': Pencil,
  'tool:portfolio-allocation': PieChart,
  'tool:investment-explorer': Telescope,
  'tool:cash-flow-forecast': TrendingDown,
  'tool:compound-growth': LineChart,
  'tool:credit-payoff': Coins,
  'tool:term-review': BookOpen,
  'tool:year-in-review': PartyPopper,
  'tool:peer-context': UsersRound,
  'tool:learn': BookOpen,
  'tool:wish-list': Star,
  'tool:income-trends': TrendingUp,
  // ── Tools screen stat cards ───────────────────────────────────────────────
  'stat:set-aside': PiggyBank,
  'stat:savings-rate': Percent,
  // ── Breakdown rows ─────────────────────────────────────────────────────────
  'breakdown:daily-budget': CalendarDays,
  'breakdown:rollover': RefreshCcw,
  'breakdown:spent': Wallet,
  'breakdown:reserved': ShieldCheck,
  'breakdown:scheduled': CalendarClock,
  'breakdown:total-locked': Lock,
  // ── Navigation / chrome / actions ─────────────────────────────────────────
  'nav:home': Home,
  'nav:history': History,
  'nav:settings': Settings,
  'nav:tools': Wrench,
  'chrome:person': User,
  'action:add': Plus,
  'action:forward': ChevronRight,
  'action:edit': Pencil,
  'action:delete': Trash2,
  // ── Toast status icons ────────────────────────────────────────────────────
  'toast:success': CircleCheck,
  'toast:error': CircleX,
  'toast:info': Info,
  // ── Shared / public pages ────────────────────────────────────────────────
  'shared:link-expired': Link2Off,
  'shared:group': UsersRound,
  'shared:support': HeartHandshake,
} satisfies Record<IconName, LucideIcon>

/**
 * Curated set of icons a user can pick from when creating a *custom* category
 * (Phase 6, task 234.2). Deliberately broader than the built-in categories so
 * user-created categories have variety, while every entry still resolves to a
 * concrete registry glyph. `category:fallback` is the sensible default.
 */
export const CUSTOM_CATEGORY_ICON_CHOICES: IconName[] = [
  'category:fallback', // Wallet — neutral default
  'category:food',
  'category:transport',
  'category:fun',
  'category:school',
  'category:rent',
  'category:health',
  'category:subscriptions',
  'category:gig',
  'tip:goal', // Target
  'tip:savings', // Sprout
  'tool:debt', // CreditCard
  'tool:learn', // BookOpen
  'category:other', // Package
]

/**
 * Resolve a {@link TransactionCategory} (or arbitrary custom-category string)
 * to a registry icon name, falling back to `category:fallback` for unknown or
 * user-created categories. Mirrors `getCategoryEmoji` in `vocabulary.ts`.
 */
export function getCategoryIconName(category: TransactionCategory | string): IconName {
  const key = `category:${category}` as IconName
  return key in ICON_REGISTRY ? key : 'category:fallback'
}

/**
 * Resolve an {@link AllowanceStatus} to its registry icon name. Mirrors
 * `getStatusEmoji` in `vocabulary.ts`.
 */
export function getStatusIconName(status: AllowanceStatus): IconName {
  return `status:${status}` as IconName
}

/**
 * Resolve a {@link TipType} to its default registry icon name. Individual tips
 * may override this with a more specific `iconName` (e.g. a bill reminder or a
 * subscription check-in) — this is the structural fallback per tip *type*.
 * Mirrors the `TIP_EMOJI`/`TIP_TITLES` vocabulary in `vocabulary.ts`.
 */
export function getTipIconName(type: TipType): IconName {
  switch (type) {
    case 'celebration':
      return 'tip:celebration'
    case 'gentle_nudge':
      return 'tip:nudge'
    case 'smart_suggestion':
      return 'tip:suggestion'
    case 'did_you_know':
    default:
      return 'tip:info'
  }
}
