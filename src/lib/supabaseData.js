import { supabase, isSupabaseConfigured } from './supabase';
import { apiUrl } from './api';

/**
 * Fetch public configuration: vehicle specs, destinations, pricing rules, blocked dates, site settings
 */
export async function getPublicConfig() {
  // If Supabase is configured in the environment, fetch directly from Supabase
  if (isSupabaseConfigured) {
    try {
      const [settingsRes, vehicleRes, destsRes, rulesRes, blockedRes] = await Promise.all([
        supabase.from('site_settings').select('key, value'),
        supabase.from('vehicles').select('*').limit(1).single(),
        supabase.from('destinations').select('*').eq('active', true).order('display_order', { ascending: true }),
        supabase.from('pricing_rules').select('*').eq('active', true).order('display_order', { ascending: true }),
        supabase.from('blocked_dates').select('start_date, end_date, reason').gte('end_date', new Date().toISOString().slice(0, 10))
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
 * Uses server endpoint to guarantee rate limiting, conflict check, and phone formatting
 */
export async function submitBooking(bookingData) {
  // Always submit through server endpoint /api/public/bookings
  // The server validates, calculates fares, enforces single vehicle constraints, logs audit, and generates WhatsApp URL
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
 * Track an existing booking by human-readable reference number or phone
 * Returns phone number safely masked (e.g. 95******08)
 */
export async function trackBooking(referenceNo, phone) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('track_booking_public', {
        p_reference_no: referenceNo ? referenceNo.trim() : null,
        p_phone: phone ? phone.trim() : null
      });

      if (!error && data && data.length > 0) {
        return {
          source: 'supabase',
          booking: {
            ...data[0],
            customer_phone: data[0].customer_phone_masked
          }
        };
      }
    } catch (err) {
      console.warn('Supabase track_booking_public RPC failed, falling back to server API:', err);
    }
  }

  // Fallback to server API
  const query = referenceNo
    ? `reference_no=${encodeURIComponent(referenceNo.trim())}`
    : `phone=${encodeURIComponent(phone.trim())}`;

  const res = await fetch(apiUrl(`/api/public/bookings/track?${query}`));
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No booking found');
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
