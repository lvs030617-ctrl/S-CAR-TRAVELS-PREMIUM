import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Read server-side credentials only. Never expose to client bundles.
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/**
 * Returns true if Supabase server-side credentials are present and well-formed.
 */
export const isSupabaseServerConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseServiceKey &&
  !supabaseServiceKey.includes('your-service-role')
);

/**
 * Server-side client using Service Role key for elevated admin and transactional RPC execution.
 * Fails safely with null if unconfigured.
 */
export const supabaseAdmin = isSupabaseServerConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

/**
 * Asserts and returns the active supabaseAdmin client.
 * Throws a clean error if configuration is missing.
 */
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('DATABASE_CONFIGURATION_ERROR: Supabase server environment is not configured.');
  }
  return supabaseAdmin;
}

/**
 * Diagnostic helper to test the server-side connection to Supabase.
 * Checks the public_site_settings view to ensure schema and privileges are active.
 */
export async function testSupabaseServerConnection() {
  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return {
      connected: false,
      configured: false,
      message: 'Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not configured.'
    };
  }

  try {
    let { data, error } = await supabaseAdmin
      .from('public_site_settings')
      .select('key, value')
      .limit(3);

    // If public_site_settings view is not yet created, verify base site_settings table
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) {
      const fallback = await supabaseAdmin
        .from('site_settings')
        .select('key, value')
        .limit(3);
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) {
      return {
        connected: false,
        configured: true,
        message: `Database connection error: ${error.message} (Code: ${error.code})`
      };
    }

    return {
      connected: true,
      configured: true,
      data,
      hasServiceRole: true,
      message: 'Supabase server client connected and verified.'
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      message: `Database connection failed: ${err.message}`
    };
  }
}

/**
 * Formats database errors into safe client-facing messages without leaking
 * SQL syntax, schemas, table structures, credentials, or internal stack traces.
 */
export function formatSafeDbError(err) {
  if (!err) return 'An unexpected database error occurred.';

  const message = typeof err === 'string' ? err : err.message || '';

  if (message.includes('CONFLICT_OVERLAPPING_CONFIRMED') || message.includes('CONFLICT_BLOCKED_DATE')) {
    return message.replace(/^.*?: /, '');
  }

  if (message.includes('INVALID_STATUS_TRANSITION')) {
    return message.replace(/^.*?: /, '');
  }

  if (message.includes('CANNOT_MUTATE_LAST_SUPERADMIN')) {
    return 'Operation forbidden: At least one active Super Administrator must remain.';
  }

  if (message.includes('BOOKING_NOT_FOUND')) {
    return 'The requested booking could not be found.';
  }

  if (message.includes('FLEET_LOCK_ERROR')) {
    return 'Fleet scheduling lock error. Please try again in a few moments.';
  }

  // Generic fallback for unexpected errors
  return 'A database operation could not be completed. Please try again.';
}

/**
 * Records an administrative audit log event in Supabase admin_audit_logs table asynchronously
 */
export async function recordAdminAuditLog({
  action,
  actorId = null,
  actorUsername = 'system',
  targetAdminId = null,
  targetEmail = null,
  targetUsername = null,
  details = null,
  ipAddress = '127.0.0.1'
}) {
  if (!isSupabaseServerConfigured || !supabaseAdmin) return;
  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      action,
      actor_id: actorId,
      actor_username: actorUsername,
      target_admin_id: targetAdminId,
      target_email: targetEmail,
      target_username: targetUsername,
      details_json: details ? details : null,
      ip_address: ipAddress
    });
  } catch (err) {
    console.warn('[Admin Audit] Failed to record audit log in Supabase:', err.message);
  }
}

