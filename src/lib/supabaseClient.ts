import { createClient } from '@supabase/supabase-js'

/**
 * Important for Next.js builds (Vercel prerendering):
 * don't throw at module import time if env vars aren't present yet.
 * We'll only create a real client when the env vars exist.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as unknown as ReturnType<typeof createClient>)