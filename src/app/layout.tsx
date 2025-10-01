import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MyF&A',
  description: 'Personal, Small Business, and Gig Finance Hub',
}

export default function RootLayout(
  { children }: { children: React.ReactNode }
) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}

