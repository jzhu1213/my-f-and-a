/**
 * Versioned localStorage wrapper — ensures all persisted client data
 * uses a versioned envelope format with automatic migration support.
 *
 * Envelope: { version: number, data: T, updatedAt: string }
 *
 * On read:
 *   1. If raw data has no `version` field (legacy), wrap as version 1.
 *   2. Look up registered migrations and apply sequentially to reach current version.
 *   3. Validate the final shape against the provided Zod schema.
 *   4. Return validated data or null.
 *
 * On write:
 *   1. Validate data against schema.
 *   2. Wrap in versioned envelope with current timestamp.
 *   3. Write to localStorage.
 *
 * Task 522.1, 522.2
 * Requirements: 32.2
 */

import type { ZodSchema } from 'zod'

// ============================================================================
// Types
// ============================================================================

/** The versioned envelope stored in localStorage. */
export interface VersionedEnvelope<T = unknown> {
  version: number
  data: T
  updatedAt: string
}

/** A migration function that transforms data from one version to the next. */
export type MigrationFn = (oldData: unknown) => unknown

/**
 * Registry entry for a single key's migrations.
 * Keys are the "from" version number, values are the migration function.
 * e.g. { 1: (v1Data) => v2Data, 2: (v2Data) => v3Data }
 */
export type MigrationMap = Record<number, MigrationFn>

// ============================================================================
// Migration Registry (Task 522.2)
// ============================================================================

/**
 * Global migration registry: key → version migrations.
 * Register migrations with `registerMigrations()`.
 */
const migrationRegistry = new Map<string, MigrationMap>()

/**
 * Register migrations for a localStorage key.
 * Each entry maps a "from" version to a function that produces the next version's data.
 *
 * @example
 * registerMigrations('folio_automation_prefs', {
 *   1: (v1) => ({ ...v1, newField: 'default' }), // v1 → v2
 *   2: (v2) => ({ ...v2, renamedField: v2.oldField }), // v2 → v3
 * })
 */
export function registerMigrations(key: string, migrations: MigrationMap): void {
  migrationRegistry.set(key, migrations)
}

/**
 * Get registered migrations for a key.
 * Returns an empty object if no migrations are registered.
 */
export function getMigrations(key: string): MigrationMap {
  return migrationRegistry.get(key) ?? {}
}

/**
 * Clear all registered migrations (useful for testing).
 */
export function clearMigrations(): void {
  migrationRegistry.clear()
}

// ============================================================================
// Current version registry
// ============================================================================

/**
 * Tracks the current (latest) version for each key.
 * When reading, data is migrated up to this version.
 */
const currentVersions = new Map<string, number>()

/**
 * Set the current version for a key. This determines what version
 * the data should be migrated to on read.
 */
export function setCurrentVersion(key: string, version: number): void {
  currentVersions.set(key, version)
}

/**
 * Get the current version for a key. Defaults to 1 if not set.
 */
export function getCurrentVersion(key: string): number {
  return currentVersions.get(key) ?? 1
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Read a value from localStorage with versioning, migration, and validation.
 *
 * - If the stored data has no `version` field (legacy unversioned), wraps as v1.
 * - Applies migrations sequentially to reach the current version.
 * - Validates the final data against the Zod schema.
 * - Returns null if no data exists, validation fails, or an error occurs.
 */
export function get<T>(key: string, schema: ZodSchema<T>): T | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    let envelope: VersionedEnvelope
    const parsed = JSON.parse(raw)

    // Detect legacy unversioned data (no version field in the envelope)
    if (parsed !== null && typeof parsed === 'object' && 'version' in parsed && 'data' in parsed) {
      envelope = parsed as VersionedEnvelope
    } else {
      // Legacy data — wrap as version 1
      envelope = {
        version: 1,
        data: parsed,
        updatedAt: new Date().toISOString(),
      }
    }

    // Apply migrations to reach current version
    const targetVersion = getCurrentVersion(key)
    const migrations = getMigrations(key)
    let { data } = envelope
    let { version } = envelope

    while (version < targetVersion) {
      const migrateFn = migrations[version]
      if (!migrateFn) {
        // No migration registered for this step — skip (data stays as-is)
        version++
        continue
      }
      data = migrateFn(data)
      version++
    }

    // Validate against schema
    const result = schema.safeParse(data)
    if (!result.success) {
      console.warn(`[VersionedStorage] Validation failed for "${key}":`, result.error.issues)
      return null
    }

    // If we migrated, persist the upgraded envelope so we don't re-migrate next time
    if (version > envelope.version) {
      const upgraded: VersionedEnvelope = {
        version,
        data: result.data,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(key, JSON.stringify(upgraded))
    }

    return result.data
  } catch {
    return null
  }
}

/**
 * Write a value to localStorage with versioning and validation.
 *
 * - Validates data against the schema before writing.
 * - Wraps in a versioned envelope with the current version and timestamp.
 * - Fails silently if validation fails or localStorage is unavailable.
 *
 * @returns true if written successfully, false otherwise.
 */
export function set<T>(key: string, value: T, schema: ZodSchema<T>): boolean {
  if (typeof window === 'undefined') return false

  try {
    // Validate before writing
    const result = schema.safeParse(value)
    if (!result.success) {
      console.warn(`[VersionedStorage] Write validation failed for "${key}":`, result.error.issues)
      return false
    }

    const envelope: VersionedEnvelope = {
      version: getCurrentVersion(key),
      data: result.data,
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem(key, JSON.stringify(envelope))
    return true
  } catch {
    return false
  }
}

/**
 * Remove a versioned key from localStorage.
 */
export function remove(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // fail silently
  }
}

// ============================================================================
// Convenience: raw read/write for simple string values
// ============================================================================

/**
 * Read a simple string value from localStorage (no versioning).
 * Used for keys that store primitive strings like 'true'/'false'.
 * These don't benefit from the versioned envelope pattern.
 */
export function getString(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Write a simple string value to localStorage (no versioning).
 */
export function setString(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // fail silently
  }
}
