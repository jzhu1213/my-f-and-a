'use client'

/**
 * App-root React error boundary.
 *
 * Catches render errors anywhere in the tree, reports them to the monitoring
 * service (PII-scrubbed), and shows a warm, non-judgmental fallback with a
 * one-tap reload. Uses the warm purple theme tokens with hardcoded fallbacks so
 * the fallback still looks right even if a provider or stylesheet failed to
 * load. No pure black.
 *
 * Requirements: 33.4
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '../lib/errorMonitoring'
import { FONT_FAMILY, pxToRem } from '../styles/typography'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Report the render error. componentStack is scrubbed inside the monitor.
    captureException(error, {
      source: 'react-error-boundary',
      componentStack: info.componentStack ?? undefined,
    })
  }

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: FONT_FAMILY,
          // Warm purple tokens with safe fallbacks (never pure black).
          background: 'var(--bg, #12121f)',
          color: 'var(--text, #f4f4ff)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: pxToRem(28),
            background: 'var(--surface, #1a1a2e)',
          }}
        >
          🌱
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: pxToRem(20),
            fontWeight: 600,
            lineHeight: 1.3,
            color: 'var(--text, #f4f4ff)',
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 320,
            fontSize: pxToRem(15),
            lineHeight: 1.5,
            color: 'var(--sub, #d4d4f0)',
          }}
        >
          No worries — a quick reload usually sorts it out. Your data is safe.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            minHeight: 48,
            padding: '12px 28px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            fontSize: pxToRem(15),
            fontWeight: 600,
            color: '#ffffff',
            background: 'var(--accent, #818cf8)',
          }}
        >
          Tap to reload
        </button>
      </div>
    )
  }
}
