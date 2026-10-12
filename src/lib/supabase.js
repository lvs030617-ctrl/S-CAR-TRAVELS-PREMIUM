import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables with Vite import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// Support both standard VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_ANON_KEY
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseKey.includes('your-anon-or-publishable-key')
);

// Create reusable Supabase client instance
// If environment variables are missing, provide a dummy fallback client so the app doesn't crash on boot
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'scar_supabase_auth_token'
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { persistSession: false }
    });

/**
 * Diagnostic helper to test the client-side Supabase connection
 */
export async function testSupabaseClientConnection() {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      message: 'Supabase client environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) are not set.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('public_site_settings')
      .select('key, value')
      .limit(1);

    if (error) {
      return {
        connected: false,
        message: `Supabase query error: ${error.message} (Code: ${error.code})`
      };
    }

    return {
      connected: true,
      data,
      message: 'Supabase client connected successfully to S CAR TRAVELS database.'
    };
  } catch (err) {
    return {
      connected: false,
      message: `Supabase network/client error: ${err.message}`
    };
  }
}
