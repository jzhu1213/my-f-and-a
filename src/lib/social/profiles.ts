/**
 * Public profile query helpers (task 277.3).
 *
 * The `public_profiles` view is defined in `supabase/migrations/0002_social.sql`
 * and exposes only id, handle, display_name, and avatar_url for discoverable users.
 *
 * PRIVACY: Non-discoverable users are completely invisible to search. The view
 * filters on `discoverable = true AND handle IS NOT NULL`, so a user who has not
 * opted in (or has removed their handle) cannot be found via any search query.
 * There is NO mechanism that reveals a private user's existence — not even a
 * "user not found" vs "user exists but private" distinction. The view simply
 * returns nothing for non-discoverable users.
 */

import { supabase } from '../supabaseClient'

/** Shape returned by the public_profiles view */
export interface PublicProfile {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Search discoverable profiles by handle substring (case-insensitive).
 * Returns up to 20 results ordered by handle.
 */
export async function searchPublicProfiles(query: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, handle, display_name, avatar_url')
    .ilike('handle', `%${query}%`)
    .order('handle')
    .limit(20)

  if (error) {
    console.error('[searchPublicProfiles]', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    handle: row.handle as string,
    displayName: (row.display_name as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
  }))
}
