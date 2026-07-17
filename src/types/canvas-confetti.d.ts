/**
 * Minimal ambient type declarations for `canvas-confetti`.
 *
 * The published package ships without bundled types and `@types/canvas-confetti`
 * is not installed, so this declares just the small surface the app relies on:
 * firing confetti bursts and creating an instance bound to a specific canvas
 * (used for the layered foreground/background celebration effect).
 */
declare module "canvas-confetti" {
  interface Origin {
    x?: number
    y?: number
  }

  interface Options {
    particleCount?: number
    angle?: number
    spread?: number
    startVelocity?: number
    decay?: number
    gravity?: number
    drift?: number
    ticks?: number
    origin?: Origin
    colors?: string[]
    shapes?: string[]
    scalar?: number
    zIndex?: number
    disableForReducedMotion?: boolean
  }

  interface GlobalOptions {
    resize?: boolean
    useWorker?: boolean
    disableForReducedMotion?: boolean
  }

  /** A confetti "cannon" — call it to fire a burst, `.reset()` to clear. */
  interface CreateTypes {
    (options?: Options): Promise<null> | null
    reset: () => void
  }

  interface ConfettiFn {
    (options?: Options): Promise<null> | null
    /** Create a confetti instance bound to a specific canvas element. */
    create: (
      canvas: HTMLCanvasElement,
      options?: GlobalOptions,
    ) => CreateTypes
    reset: () => void
  }

  const confetti: ConfettiFn
  export default confetti
}
