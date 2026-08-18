"use client"

/**
 * useRovingTabindex — shared roving tabindex hook for grids and toolbars.
 *
 * Makes a group of focusable items a single tab stop. Arrow keys move focus
 * between items within the group; Home/End jump to first/last.
 *
 * Supports:
 * - 1D navigation (horizontal or vertical)
 * - 2D grid navigation (requires `columns` option)
 * - Wrap-around at boundaries
 * - Active item tracking: only the active item has tabIndex=0
 *
 * Usage:
 *   const { getItemProps, activeIndex, setActiveIndex } = useRovingTabindex({
 *     itemCount: items.length,
 *     orientation: 'horizontal',
 *   })
 *
 *   items.map((item, i) => (
 *     <button key={item.id} {...getItemProps(i)}>
 *       {item.label}
 *     </button>
 *   ))
 *
 * Requirements: 27.2
 */

import { useRef, useState, useCallback } from "react"
import type React from "react"

export interface UseRovingTabindexOptions {
  /** Total number of items in the group. */
  itemCount: number
  /** Navigation direction. Default: 'horizontal'. */
  orientation?: "horizontal" | "vertical" | "both"
  /** Number of columns for 2D grid navigation. If set, enables grid mode. */
  columns?: number
  /** Whether navigation wraps around at boundaries. Default: true. */
  wrap?: boolean
  /** Initial active index. Default: 0. */
  initialIndex?: number
}

export interface RovingTabindexItemProps {
  tabIndex: number
  ref: (el: HTMLElement | null) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export interface UseRovingTabindexReturn {
  /** The currently active (tabbable) index. */
  activeIndex: number
  /** Manually set the active index (e.g., on selection change). */
  setActiveIndex: (index: number) => void
  /** Returns props to spread on each item element. */
  getItemProps: (index: number) => RovingTabindexItemProps
}

export function useRovingTabindex(options: UseRovingTabindexOptions): UseRovingTabindexReturn {
  const {
    itemCount,
    orientation = "horizontal",
    columns,
    wrap = true,
    initialIndex = 0,
  } = options

  const [activeIndex, setActiveIndex] = useState(
    initialIndex >= 0 && initialIndex < itemCount ? initialIndex : 0
  )
  const itemsRef = useRef<(HTMLElement | null)[]>([])

  const moveTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex >= 0 && nextIndex < itemCount) {
        setActiveIndex(nextIndex)
        itemsRef.current[nextIndex]?.focus()
      }
    },
    [itemCount]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null
      const isGrid = columns != null && columns > 0
      const isHorizontal = orientation === "horizontal" || orientation === "both"
      const isVertical = orientation === "vertical" || orientation === "both"

      switch (e.key) {
        case "ArrowRight": {
          if (!isHorizontal && !isGrid) break
          e.preventDefault()
          const next = index + 1
          if (next < itemCount) {
            nextIndex = next
          } else if (wrap) {
            nextIndex = 0
          }
          break
        }
        case "ArrowLeft": {
          if (!isHorizontal && !isGrid) break
          e.preventDefault()
          const prev = index - 1
          if (prev >= 0) {
            nextIndex = prev
          } else if (wrap) {
            nextIndex = itemCount - 1
          }
          break
        }
        case "ArrowDown": {
          if (!isVertical && !isGrid) break
          e.preventDefault()
          if (isGrid && columns) {
            const next = index + columns
            if (next < itemCount) {
              nextIndex = next
            } else if (wrap) {
              // Wrap to the same column in the first row
              nextIndex = index % columns
            }
          } else {
            const next = index + 1
            if (next < itemCount) {
              nextIndex = next
            } else if (wrap) {
              nextIndex = 0
            }
          }
          break
        }
        case "ArrowUp": {
          if (!isVertical && !isGrid) break
          e.preventDefault()
          if (isGrid && columns) {
            const prev = index - columns
            if (prev >= 0) {
              nextIndex = prev
            } else if (wrap) {
              // Wrap to the same column in the last row
              const lastRowStart = Math.floor((itemCount - 1) / columns) * columns
              const target = lastRowStart + (index % columns)
              nextIndex = target < itemCount ? target : target - columns
            }
          } else {
            const prev = index - 1
            if (prev >= 0) {
              nextIndex = prev
            } else if (wrap) {
              nextIndex = itemCount - 1
            }
          }
          break
        }
        case "Home":
          e.preventDefault()
          nextIndex = 0
          break
        case "End":
          e.preventDefault()
          nextIndex = itemCount - 1
          break
      }

      if (nextIndex !== null) {
        moveTo(nextIndex)
      }
    },
    [itemCount, orientation, columns, wrap, moveTo]
  )

  const getItemProps = useCallback(
    (index: number): RovingTabindexItemProps => ({
      tabIndex: index === activeIndex ? 0 : -1,
      ref: (el: HTMLElement | null) => {
        itemsRef.current[index] = el
      },
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, index),
    }),
    [activeIndex, handleKeyDown]
  )

  return {
    activeIndex,
    setActiveIndex,
    getItemProps,
  }
}
