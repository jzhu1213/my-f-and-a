"use client"

import { useState, useEffect, useCallback } from "react"
import type { FixedExpense } from "@/lib/fixedExpenses"

const STORAGE_KEY = "folio-recurring-bills"

/**
 * useRecurringBills — simple localStorage-backed hook for recurring bills.
 *
 * Persists bills locally so a student can set up their rent, phone, and
 * subscription once and forget about them. The daily allowance calculation
 * already accepts FixedExpense[] so these bills integrate naturally.
 */
export function useRecurringBills(userId: string | null | undefined) {
  const [bills, setBills] = useState<FixedExpense[]>([])
  const [loaded, setLoaded] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FixedExpense[]
        setBills(parsed.filter((b) => !userId || b.userId === userId || b.userId === ""))
      }
    } catch {
      // Corrupted data — start fresh
    }
    setLoaded(true)
  }, [userId])

  // Persist to localStorage on changes
  const persist = useCallback((next: FixedExpense[]) => {
    setBills(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage full — best-effort
    }
  }, [])

  const addBill = useCallback(
    async (bill: Omit<FixedExpense, "id" | "userId">) => {
      const newBill: FixedExpense = {
        ...bill,
        id: crypto.randomUUID(),
        userId: userId ?? "",
      }
      persist([...bills, newBill])
    },
    [bills, persist, userId]
  )

  const updateBill = useCallback(
    async (id: string, updates: Partial<FixedExpense>) => {
      const next = bills.map((b) => (b.id === id ? { ...b, ...updates } : b))
      persist(next)
    },
    [bills, persist]
  )

  const deleteBill = useCallback(
    async (id: string) => {
      persist(bills.filter((b) => b.id !== id))
    },
    [bills, persist]
  )

  return { bills, loaded, addBill, updateBill, deleteBill }
}
