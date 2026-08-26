import type { Metadata } from 'next'
import Link from 'next/link'
import { typography, spacing, FONT_FAMILY } from '@/styles/typography'
import { CONTENT_MAX_WIDTH, HORIZONTAL_PADDING, sectionHeader } from '@/styles/shared'

/**
 * Privacy policy (Phase 25, task 542.3).
 *
 * A plain-language, public page explaining exactly what Folio stores, where it
 * lives, how the anonymous analytics work, and how anyone can export or delete
 * their data. It doubles as the public privacy URL required by app-store
 * listings, and is linked from Settings → Privacy.
 *
 * Warm, non-judgmental tone; warm-purple tokens; Inter throughout. Static
 * content, so this renders as a server component with no client JS.
 */

export const metadata: Metadata = {
  title: 'Privacy — Folio',
  description:
    'How Folio handles your data: what we store, where it lives, how anonymous analytics work, and how to export or delete everything.',
}

// Last meaningful review of this policy. Update when data practices change.
const LAST_UPDATED = 'February 2025'

function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: spacing.xl }}>
      <h2
        style={{
          ...typography.headline,
          color: 'var(--text)',
          marginBottom: spacing.sm,
        }}
      >
        {heading}
      </h2>
      {children}
    </section>
  )
}

const paragraphStyle = {
  ...typography.body,
  color: 'var(--sub)',
  lineHeight: 1.6,
  marginBottom: spacing.sm,
} as const

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: '0 auto',
        padding: `${spacing.xl}px ${HORIZONTAL_PADDING}px ${spacing.xxxl}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 44,
          ...typography['body-sm'],
          color: 'var(--sub)',
          textDecoration: 'none',
          marginBottom: spacing.md,
        }}
      >
        <span aria-hidden="true">←</span> Back to Folio
      </Link>

      <p style={{ ...sectionHeader, marginBottom: spacing.xs }}>Privacy</p>
      <h1
        style={{
          ...typography.title,
          color: 'var(--text)',
          marginBottom: spacing.xs,
        }}
      >
        Your data, your call
      </h1>
      <p
        style={{
          ...typography['body-sm'],
          color: 'var(--muted)',
          marginBottom: spacing.xl,
        }}
      >
        Last updated {LAST_UPDATED}
      </p>

      <p style={paragraphStyle}>
        Folio helps you answer one question: can I afford this today? To do that
        we keep a little bit of data — and nothing more than we need. Here&apos;s
        the plain-language version of what happens to it.
      </p>

      <Section heading="What we store">
        <p style={paragraphStyle}>
          The things you add to Folio: your transactions (amount, category, date,
          and any note you write), your budgets and goals, and your preferences
          like theme and currency. If you create an account, we also store your
          email address so you can sign back in.
        </p>
        <p style={paragraphStyle}>
          Some settings never leave your device at all — things like an optional
          app lock PIN are stored only in your browser&apos;s local storage, as a
          salted hash, never in plain text.
        </p>
      </Section>

      <Section heading="Where it lives">
        <p style={paragraphStyle}>
          Your account data is stored with Supabase, a hosted PostgreSQL
          database. Every row is protected by Row Level Security, which means you
          can only ever read or change your own data — never anyone else&apos;s.
        </p>
        <p style={paragraphStyle}>
          Connections are encrypted in transit (HTTPS), and the app itself is
          served only over HTTPS.
        </p>
      </Section>

      <Section heading="How analytics work">
        <p style={paragraphStyle}>
          We collect anonymous, aggregate usage data to understand which features
          help and where people get stuck. No cookies, no third-party trackers,
          and no personal information — we never send amounts, notes, names, or
          email addresses to analytics. Events are tied to a random session ID,
          not to you.
        </p>
        <p style={paragraphStyle}>
          You can turn analytics off anytime in Settings → Privacy. When
          it&apos;s off, nothing is collected. Analytics are also disabled during
          development.
        </p>
      </Section>

      <Section heading="Error reporting">
        <p style={paragraphStyle}>
          If something crashes, we may send a diagnostic report so we can fix it.
          Personal details like your email and user ID are stripped out before
          anything is sent. If error reporting isn&apos;t configured, nothing is
          sent at all.
        </p>
      </Section>

      <Section heading="What we never do">
        <p style={paragraphStyle}>
          We don&apos;t sell your data. We don&apos;t share it with advertisers.
          We don&apos;t use it to profile you. Folio is a budgeting tool, not a
          data business.
        </p>
      </Section>

      <Section heading="Exporting and deleting your data">
        <p style={paragraphStyle}>
          Your data belongs to you. In Settings → Privacy → Privacy dashboard you
          can export everything Folio holds about you, or delete it. Deleting is
          permanent and removes your transactions, budgets, goals, and profile
          across all of Folio&apos;s tables — no leftovers.
        </p>
        <p style={paragraphStyle}>
          You can also clear just part of your data (say, to start fresh for a new
          semester) without deleting your whole account.
        </p>
      </Section>

      <Section heading="Questions">
        <p style={paragraphStyle}>
          If anything here is unclear, or you&apos;d like help with your data,
          reach out through Settings → Send feedback. We&apos;re happy to help.
        </p>
      </Section>
    </main>
  )
}
