import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Service role key is STRICTLY SERVER-SIDE ONLY. Never import or bundle into client code.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseServerConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id') &&
  (supabaseServiceKey || supabaseAnonKey)
);

// Server-side client using Service Role key when available for elevated admin/server API tasks,
// or Anon key as fallback
const activeKey = supabaseServiceKey || supabaseAnonKey || 'placeholder-key';

export const supabaseAdmin = isSupabaseServerConfigured
  ? createClient(supabaseUrl, activeKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

/**
 * Diagnostic helper to test the server-side connection to Supabase
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
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('key, value')
      .limit(3);

    if (error) {
      return {
        connected: false,
        configured: true,
        message: `Supabase server query error: ${error.message} (Code: ${error.code})`
      };
    }

    return {
      connected: true,
      configured: true,
      data,
      hasServiceRole: Boolean(supabaseServiceKey),
      message: 'Supabase server client successfully connected to database.'
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      message: `Supabase server connection failed: ${err.message}`
    };
  }
}
