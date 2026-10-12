/**
 * ARCHITECTURAL MIGRATION RECORD:
 * S CAR TRAVELS PREMIUM — SQLite Decommissioned
 *
 * SQLite has been completely removed from this application.
 * Supabase PostgreSQL is the sole runtime database for development and production.
 * Existing local database files (server/data/scar_travels.db and backups) are preserved on disk.
 */

export const db = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'prepare' || prop === 'exec' || prop === 'transaction' || prop === 'pragma') {
      return () => {
        throw new Error('DEPRECATED: SQLite is no longer used. Supabase PostgreSQL is the sole database.');
      };
    }
    return undefined;
  }
});

export function initDatabase() {
  // No-op: SQLite initialization is disabled. Supabase PostgreSQL is used.
  return null;
}

export { recordAdminAuditLog } from './supabase.js';
