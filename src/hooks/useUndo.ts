import { useCallback } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { pushUndo, executeUndo, clearUndo } from '@/lib/undoStack'
import type { UndoActionType } from '@/lib/undoStack'

/**
 * useUndo — Hook that integrates the undo stack with the toast system.
 *
 * Provides `performWithUndo` which:
 * 1. Performs the destructive action immediately
 * 2. Shows a toast with an "Undo" button
 * 3. If user taps "Undo" within 5s → executes the undo function
 * 4. After 5s → the action is committed permanently (toast auto-dismisses)
 *
 * Only one undo action is pending at a time. New actions replace previous ones.
 */
export function useUndo() {
  const { showToast, removeToast } = useToast()

  /**
   * Perform a destructive action with undo support.
   *
   * @param actionType - Category of action (for analytics/debugging)
   * @param action - The destructive action to perform immediately
   * @param undoFn - Function to reverse the action if user taps "Undo"
   * @param toastMessage - Message shown in the toast (e.g., "Expense deleted")
   */
  const performWithUndo = useCallback(async (
    actionType: UndoActionType,
    action: () => Promise<unknown> | void,
    undoFn: () => Promise<unknown> | void,
    toastMessage: string,
  ): Promise<void> => {
    // 1. Perform the destructive action immediately
    await action()

    // 2. Show toast with Undo button and store the undo entry
    let toastId: string | undefined

    pushUndo(
      actionType,
      async () => {
        await undoFn()
        // Remove the toast when undo is executed
        if (toastId) removeToast(toastId)
      },
      () => {
        // onExpire — toast auto-dismisses via ToastContext timer, nothing extra needed
      },
    )

    toastId = showToast(toastMessage, 'success', {
      label: 'Undo',
      onClick: async () => {
        await executeUndo()
      },
    })
  }, [showToast, removeToast])

  return { performWithUndo, clearUndo }
}
