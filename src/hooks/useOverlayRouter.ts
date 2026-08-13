import { useReducer, useCallback, useMemo } from 'react'
import type { TransactionCategory, Transaction } from '@/types'
import type { DetectedSubscription } from '@/lib/subscriptionDetector'

// ── Overlay IDs (full-screen, exclusive — only one at a time) ────────────────

export type OverlayId =
  | 'budgetSettings'
  | 'goals'
  | 'sinkingFunds'
  | 'subscriptionAudit'
  | 'cancelNegotiate'
  | 'recurringBills'
  | 'debt'
  | 'reimbursements'
  | 'learn'
  | 'compoundGrowth'
  | 'creditPayoff'
  | 'fundingSources'
  | 'linkedAccounts'
  | 'trajectory'
  | 'cashFlowForecast'
  | 'sharing'
  | 'categoryHub'
  | 'savingsProjections'
  | 'manageSavings'
  | 'portfolioAllocation'
  | 'investmentExplorer'
  | 'yearInReview'
  | 'termReview'
  | 'reports'
  | 'peerContext'
  | 'categorizationRules'
  | 'privacyData'
  | 'inviteRoommate'
  | 'wishList'
  | 'incomeTrends'

// ── Sheet IDs (bottom sheets — can be open alongside main content) ───────────

export type SheetId =
  | 'expense'
  | 'income'
  | 'paycheck'
  | 'edit'
  | 'refund'
  | 'backfill'
  | 'bulkRepeat'
  | 'profile'
  | 'quickLog'

// ── Payloads — some overlays/sheets carry associated data ────────────────────

export interface OverlayPayloads {
  budgetSettings: undefined
  goals: undefined
  sinkingFunds: undefined
  subscriptionAudit: undefined
  cancelNegotiate: { target: DetectedSubscription | null }
  recurringBills: undefined
  debt: undefined
  reimbursements: undefined
  learn: { initialLessonId: string | null }
  compoundGrowth: undefined
  creditPayoff: undefined
  fundingSources: undefined
  linkedAccounts: undefined
  trajectory: undefined
  cashFlowForecast: undefined
  sharing: undefined
  categoryHub: undefined
  savingsProjections: undefined
  manageSavings: undefined
  portfolioAllocation: undefined
  investmentExplorer: undefined
  yearInReview: undefined
  termReview: undefined
  reports: undefined
  peerContext: undefined
  categorizationRules: undefined
  privacyData: undefined
  inviteRoommate: undefined
  wishList: undefined
  incomeTrends: undefined
}

export interface SheetPayloads {
  expense: { defaultCategory?: TransactionCategory; splitPreEnabled?: boolean; originFromFab?: boolean }
  income: undefined
  paycheck: { amount: number; isGigIncome: boolean }
  edit: { transaction: Transaction }
  refund: { transaction: Transaction }
  backfill: undefined
  bulkRepeat: { transaction: { amount: number; category: TransactionCategory; note?: string } }
  profile: undefined
  /** Quick-log confirm sheet for captures from the OS share sheet / assistant (task 180.1) */
  quickLog: { rawText: string; source: 'share' | 'assistant' }
}

// ── State ────────────────────────────────────────────────────────────────────

export interface OverlayRouterState {
  /** Currently active full-screen overlay (null = none) */
  activeOverlay: OverlayId | null
  /** Payload for the active overlay */
  overlayPayload: Record<string, unknown> | undefined
  /** Currently open sheets (keyed by SheetId) */
  openSheets: Partial<Record<SheetId, true>>
  /** Payloads for open sheets */
  sheetPayloads: Partial<Record<SheetId, Record<string, unknown>>>
}

// ── Actions ──────────────────────────────────────────────────────────────────

type OverlayAction =
  | { type: 'OPEN_OVERLAY'; id: OverlayId; payload?: Record<string, unknown> }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'OPEN_SHEET'; id: SheetId; payload?: Record<string, unknown> }
  | { type: 'CLOSE_SHEET'; id: SheetId }

// ── Reducer ──────────────────────────────────────────────────────────────────

const initialState: OverlayRouterState = {
  activeOverlay: null,
  overlayPayload: undefined,
  openSheets: {},
  sheetPayloads: {},
}

function overlayReducer(state: OverlayRouterState, action: OverlayAction): OverlayRouterState {
  switch (action.type) {
    case 'OPEN_OVERLAY':
      return {
        ...state,
        activeOverlay: action.id,
        overlayPayload: action.payload,
      }
    case 'CLOSE_OVERLAY':
      return {
        ...state,
        activeOverlay: null,
        overlayPayload: undefined,
      }
    case 'OPEN_SHEET':
      return {
        ...state,
        openSheets: { ...state.openSheets, [action.id]: true },
        sheetPayloads: action.payload
          ? { ...state.sheetPayloads, [action.id]: action.payload }
          : state.sheetPayloads,
      }
    case 'CLOSE_SHEET': {
      const { [action.id]: _, ...remainingSheets } = state.openSheets
      const { [action.id]: __, ...remainingPayloads } = state.sheetPayloads
      return {
        ...state,
        openSheets: remainingSheets,
        sheetPayloads: remainingPayloads,
      }
    }
    default:
      return state
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseOverlayRouterReturn {
  /** Currently active full-screen overlay ID (null = none) */
  activeOverlay: OverlayId | null
  /** Payload for the currently active overlay */
  overlayPayload: Record<string, unknown> | undefined
  /** Whether a specific sheet is open */
  isSheetOpen: (id: SheetId) => boolean
  /** Get the payload for a specific sheet */
  getSheetPayload: <K extends SheetId>(id: K) => SheetPayloads[K] | undefined
  /** Get the overlay payload typed for a specific overlay */
  getOverlayPayload: <K extends OverlayId>(id: K) => OverlayPayloads[K] | undefined
  /** Open a full-screen overlay (closes any existing overlay) */
  openOverlay: <K extends OverlayId>(
    id: K,
    ...args: OverlayPayloads[K] extends undefined ? [] : [OverlayPayloads[K]]
  ) => void
  /** Close the active overlay */
  closeOverlay: () => void
  /** Open a bottom sheet */
  openSheet: <K extends SheetId>(
    id: K,
    ...args: SheetPayloads[K] extends undefined ? [] : [SheetPayloads[K]]
  ) => void
  /** Close a specific bottom sheet */
  closeSheet: (id: SheetId) => void
  /** Whether any bottom sheet is open (for hiding FAB + dock) */
  anySheetOpen: boolean
}

export function useOverlayRouter(): UseOverlayRouterReturn {
  const [state, dispatch] = useReducer(overlayReducer, initialState)

  const openOverlay = useCallback(<K extends OverlayId>(
    id: K,
    ...args: OverlayPayloads[K] extends undefined ? [] : [OverlayPayloads[K]]
  ) => {
    const payload = args[0] as Record<string, unknown> | undefined
    dispatch({ type: 'OPEN_OVERLAY', id, payload })
  }, [])

  const closeOverlay = useCallback(() => {
    dispatch({ type: 'CLOSE_OVERLAY' })
  }, [])

  const openSheet = useCallback(<K extends SheetId>(
    id: K,
    ...args: SheetPayloads[K] extends undefined ? [] : [SheetPayloads[K]]
  ) => {
    const payload = args[0] as Record<string, unknown> | undefined
    dispatch({ type: 'OPEN_SHEET', id, payload })
  }, [])

  const closeSheet = useCallback((id: SheetId) => {
    dispatch({ type: 'CLOSE_SHEET', id })
  }, [])

  const isSheetOpen = useCallback((id: SheetId) => {
    return !!state.openSheets[id]
  }, [state.openSheets])

  const getSheetPayload = useCallback(<K extends SheetId>(id: K): SheetPayloads[K] | undefined => {
    return state.sheetPayloads[id] as SheetPayloads[K] | undefined
  }, [state.sheetPayloads])

  const getOverlayPayload = useCallback(<K extends OverlayId>(id: K): OverlayPayloads[K] | undefined => {
    if (state.activeOverlay !== id) return undefined
    return state.overlayPayload as OverlayPayloads[K] | undefined
  }, [state.activeOverlay, state.overlayPayload])

  const anySheetOpen = useMemo(() => {
    return Object.keys(state.openSheets).length > 0
  }, [state.openSheets])

  return {
    activeOverlay: state.activeOverlay,
    overlayPayload: state.overlayPayload,
    isSheetOpen,
    getSheetPayload,
    getOverlayPayload,
    openOverlay,
    closeOverlay,
    openSheet,
    closeSheet,
    anySheetOpen,
  }
}
