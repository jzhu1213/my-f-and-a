import { createClient } from '@supabase/supabase-js'

// ── Security Audit (Task 528.1) ────────────────────────────────────────────────
// Verified: Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are
// exposed to the client bundle. All other secrets (SUPABASE_SERVICE_ROLE_KEY,
// PLAID_CLIENT_ID, PLAID_SECRET, WALLET_PASS_CERT_PEM) use server-only env vars
// without the NEXT_PUBLIC_ prefix. The anon key is safe to expose — it's scoped
// by Row Level Security policies on the Supabase project.
// ────────────────────────────────────────────────────────────────────────────────

// Provide fallback values for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)