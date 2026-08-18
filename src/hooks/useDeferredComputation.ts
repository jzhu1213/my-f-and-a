import { useState, useEffect, useRef } from 'react'

/**
 * useDeferredComputation — schedules a non-critical computation via
 * requestIdleCallback so it doesn't block the initial render frame.
 *
 * Returns null on the first render, then the computed value once the browser
 * has idle time. Re-runs the computation when dependencies change (via the
 * `deps` key). When deps change, the previous value is kept until the new
 * computation completes (avoids flickering to null on every transaction).
 *
 * Falls back to setTimeout(0) on browsers without requestIdleCallback.
 *
 * @param compute - Pure function that returns the computed value (or null)
 * @param deps - Dependency array (same semantics as useMemo deps)
 * @param options.timeout - Max time (ms) to wait before forcing computation (default: 2000)
 * @param options.keepStale - Whether to keep the previous value while recomputing (default: true)
 *
 * **Validates: Requirements 28.5** — offloads >16ms computations from the render path
 */
export function useDeferredComputation<T>(
  compute: () => T | null,
  deps: React.DependencyList,
  options?: { timeout?: number; keepStale?: boolean }
): T | null {
  const { timeout = 2000, keepStale = true } = options ?? {}
  const [value, setValue] = useState<T | null>(null)
  const computeRef = useRef(compute)
  computeRef.current = compute

  useEffect(() => {
    let cancelled = false

    const run = () => {
      if (cancelled) return
      const result = computeRef.current()
      if (!cancelled) {
        setValue(result)
      }
    }

    if (!keepStale) {
      // Clear immediately when deps change (shows null during computation)
      setValue(null)
    }

    // Schedule via requestIdleCallback where available
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    } else {
      // Fallback: setTimeout with 0 delay to yield to the event loop
      const timer = setTimeout(run, 0)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value
}
