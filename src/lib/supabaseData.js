import { supabase, isSupabaseConfigured } from './supabase';
import { apiUrl } from './api';

/**
 * Fetch public configuration: vehicle specs, destinations, pricing rules, blocked dates, site settings
 * Queries sanitized public views when direct Supabase is enabled, or falls back to Express API.
 */
export async function getPublicConfig() {
  if (isSupabaseConfigured) {
    try {
      const [settingsRes, vehicleRes, destsRes, rulesRes, blockedRes] = await Promise.all([
        supabase.from('public_site_settings').select('key, value'),
        supabase.from('vehicles').select('*').limit(1).single(),
        supabase.from('destinations').select('*').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('pricing_rules').select('*').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('public_blocked_dates').select('start_date, end_date, display_status').gte('end_date', new Date().toISOString().slice(0, 10))
      ]);

      if (!settingsRes.error && !vehicleRes.error && !destsRes.error) {
        const settings = {};
        (settingsRes.data || []).forEach(item => {
          settings[item.key] = item.value;
        });

        const vehicle = vehicleRes.data || null;
        if (vehicle && typeof vehicle.features === 'string') {
          try {
            vehicle.features = JSON.parse(vehicle.features);
          } catch (e) {
            vehicle.features = [];
          }
        }

        return {
          source: 'supabase',
          settings,
          vehicle,
          destinations: destsRes.data || [],
          pricingRules: rulesRes.data || [],
          blockedDates: blockedRes.data || []
        };
      }
    } catch (err) {
      console.warn('Supabase public config query failed, falling back to local API:', err);
    }
  }

  // Graceful fallback to server API
  const res = await fetch(apiUrl('/api/public/config'));
  if (!res.ok) throw new Error('Failed to load configuration');
  const data = await res.json();
  return { ...data, source: 'api' };
}

/**
 * Submit a customer booking inquiry
 * Always submit through server endpoint /api/public/bookings to ensure rate limiting,
 * single-vehicle schedule validation, and phone verification.
 */
export async function submitBooking(bookingData) {
  const res = await fetch(apiUrl('/api/public/bookings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit booking inquiry');
  }

  return data;
}

/**
 * Track an existing booking by human-readable reference number and phone.
 * Routes through the trusted server API to ensure rate limiting, lockout, and dual-matching verification.
 */
export async function trackBooking(referenceNo, phone) {
  const params = new URLSearchParams();
  if (referenceNo) params.set('reference_no', referenceNo.trim());
  if (phone) params.set('phone', phone.trim());

  const res = await fetch(apiUrl(`/api/public/bookings/track?${params.toString()}`));
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No booking found matching provided details');
  }

  return { source: 'api', booking: data.booking };
}

/**
 * Admin: Fetch KPIs and metrics
 */
export async function getAdminMetrics(token) {
  const res = await fetch(apiUrl('/api/admin/metrics'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch admin metrics');
  return res.json();
}

/**
 * Admin: Fetch bookings with search and filter
 */
export async function getAdminBookings(token, filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(apiUrl(`/api/admin/bookings?${params.toString()}`), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch bookings list');
  return res.json();
}

/**
 * Admin: Update booking status with owner notes
 */
export async function updateBookingStatus(token, bookingId, status, remarks) {
  const res = await fetch(apiUrl(`/api/admin/bookings/${bookingId}/status`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status, remarks })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update booking status');
  return data;
}

/**
 * Admin: Update booking fare details and admin notes
 */
export async function updateBookingDetails(token, bookingId, payload) {
  const res = await fetch(apiUrl(`/api/admin/bookings/${bookingId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update booking details');
  return data;
}
