/**
 * Infrastructure Domain — Supabase clients, offline sync, caching, storage,
 * feature flags, haptics, animations, widget sync, undo, and sharing.
 *
 * Re-exports from the parent-level utility files so consumers can import from
 * `@/lib/infra` as a cohesive module.
 */

export * from '../supabaseClient'
export * from '../supabaseData'
export * from '../offlineQueue'
export * from '../homeCache'
export * from '../storage'
export * from '../featureFlags'
export * from '../haptics'
export * from '../animations'
export * from '../widgetSync'
export * from '../undoStack'
export * from '../sharingUtils'
