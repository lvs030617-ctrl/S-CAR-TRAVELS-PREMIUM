import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabaseAdmin, isSupabaseServerConfigured, testSupabaseServerConnection, recordAdminAuditLog } from '../supabase.js';
import { sendBookingNotificationEmail } from '../email.js';

const router = express.Router();

// 0. GET /api/public/supabase-status (Connection diagnostic)
router.get('/supabase-status', async (req, res) => {
  const result = await testSupabaseServerConnection();
  res.json({
    ...result,
    clientConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    serverConfigured: isSupabaseServerConfigured
  });
});

// Simple in-memory rate limiter for public booking submission
const submissionTracker = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SUBMISSIONS_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const records = submissionTracker.get(ip) || [];
  const validRecords = records.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (validRecords.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    return false;
  }
  validRecords.push(now);
  submissionTracker.set(ip, validRecords);
  return true;
}

// 1. GET /api/public/config
router.get('/config', async (req, res) => {
  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return res.status(503).json({ error: 'Database service unavailable. Supabase PostgreSQL is required.' });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [settingsRes, vehicleRes, destsRes, rulesRes, blockedRes] = await Promise.all([
      supabaseAdmin.from('site_settings').select('key, value'),
      supabaseAdmin.from('vehicles').select('*').limit(1).maybeSingle(),
      supabaseAdmin.from('destinations').select('*').eq('active', true).order('sort_order', { ascending: true }).order('distance_km', { ascending: true }),
      supabaseAdmin.from('pricing_rules').select('*').eq('active', true).order('sort_order', { ascending: true }),
      supabaseAdmin.from('blocked_dates').select('start_date, end_date, reason').gte('end_date', today).order('start_date', { ascending: true })
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (vehicleRes.error) throw vehicleRes.error;
    if (destsRes.error) throw destsRes.error;
    if (rulesRes.error) throw rulesRes.error;
    if (blockedRes.error) throw blockedRes.error;

    const settings = {};
    for (const item of (settingsRes.data || [])) {
      settings[item.key] = item.value;
    }

    const vehicle = vehicleRes.data || null;
    if (vehicle) {
      if (typeof vehicle.features === 'string') {
        try {
          vehicle.features = JSON.parse(vehicle.features);
        } catch (_e) {
          vehicle.features = [];
        }
      }
      vehicle.features_json = JSON.stringify(vehicle.features || []);
    }

    const destinations = (destsRes.data || []).map(d => ({
      ...d,
      popular: d.popular ? 1 : 0
    }));

    const pricingRules = (rulesRes.data || []).map(r => ({
      ...r,
      active: r.active ? 1 : 0
    }));

    const blockedDates = blockedRes.data || [];

    res.json({
      settings,
      vehicle,
      destinations,
      pricingRules,
      blockedDates
    });
  } catch (error) {
    console.error('Error fetching public config from Supabase:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Helper to check for overlapping confirmed bookings or blocked dates
export async function checkVehicleConflict(startDateTimeStr, endDateTimeStr, excludeBookingId = null) {
  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return { hasConflict: false };
  }

  const reqStart = new Date(startDateTimeStr);
  const reqEnd = endDateTimeStr ? new Date(endDateTimeStr) : new Date(reqStart.getTime() + 10 * 3600 * 1000); // default 10h if single day

  let bookingsQuery = supabaseAdmin
    .from('bookings')
    .select('id, reference_no, customer_name, pickup_datetime, return_datetime, destination')
    .eq('status', 'confirmed');

  if (excludeBookingId) {
    bookingsQuery = bookingsQuery.neq('id', excludeBookingId);
  }

  const [bookingsRes, blockedRes] = await Promise.all([
    bookingsQuery,
    supabaseAdmin.from('blocked_dates').select('start_date, end_date, reason')
  ]);

  if (!bookingsRes.error && bookingsRes.data) {
    for (const b of bookingsRes.data) {
      const bStart = new Date(b.pickup_datetime);
      const bEnd = b.return_datetime ? new Date(b.return_datetime) : new Date(bStart.getTime() + 10 * 3600 * 1000);

      // Overlap condition: startA < endB and endA > startB
      if (reqStart < bEnd && reqEnd > bStart) {
        return {
          hasConflict: true,
          type: 'booking',
          reference: b.reference_no,
          message: `Overlaps with confirmed booking ${b.reference_no} (${b.pickup_datetime.replace('T', ' ')} to ${b.return_datetime ? b.return_datetime.replace('T', ' ') : 'same day'})`
        };
      }
    }
  }

  if (!blockedRes.error && blockedRes.data) {
    for (const blk of blockedRes.data) {
      const blkStart = new Date(blk.start_date + 'T00:00:00');
      const blkEnd = new Date(blk.end_date + 'T23:59:59');

      if (reqStart < blkEnd && reqEnd > blkStart) {
        return {
          hasConflict: true,
          type: 'blocked',
          reason: blk.reason,
          message: `Date is marked unavailable by owner: ${blk.reason} (${blk.start_date} to ${blk.end_date})`
        };
      }
    }
  }

  return { hasConflict: false };
}

// 2. GET /api/public/check-availability
router.get('/check-availability', async (req, res) => {
  const { pickup_datetime, return_datetime } = req.query;
  if (!pickup_datetime) {
    return res.status(400).json({ error: 'pickup_datetime is required' });
  }

  const conflict = await checkVehicleConflict(pickup_datetime, return_datetime);
  res.json({
    available: !conflict.hasConflict,
    details: conflict
  });
});

// 3. POST /api/public/bookings
router.post('/bookings', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many booking inquiries submitted in a short time. Please wait a moment or call Srinu directly.' });
  }

  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return res.status(503).json({ error: 'Database service unavailable. Supabase PostgreSQL is required.' });
  }

  const {
    customer_name,
    customer_phone,
    customer_email,
    service_type, // 'with_driver' | 'self_drive'
    trip_type, // 'round_trip' | 'one_way' | 'local_8h' | 'full_day' | 'temple_tour' | 'outstation'
    pickup_location,
    destination,
    pickup_datetime,
    return_datetime,
    passengers,
    luggage_count,
    special_notes
  } = req.body;

  // Validation
  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide a valid customer name (at least 2 characters)' });
  }

  // Clean and validate Indian phone number
  const cleanPhone = (customer_phone || '').replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
  }
  const formattedPhone = cleanPhone.slice(-10);

  if (!pickup_location || pickup_location.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide a pickup location' });
  }

  if (!destination || destination.trim().length < 2) {
    return res.status(400).json({ error: 'Please specify the destination' });
  }

  if (!pickup_datetime) {
    return res.status(400).json({ error: 'Pickup date and time are required' });
  }

  // Past date validation
  const pickupDate = new Date(pickup_datetime);
  const now = new Date();
  // Buffer 10 minutes for minor clock drift
  if (pickupDate.getTime() < now.getTime() - 10 * 60 * 1000) {
    return res.status(400).json({ error: 'Pickup date & time cannot be in the past' });
  }

  // Return date validation if provided
  let validReturnDatetime = null;
  if (return_datetime) {
    const returnDate = new Date(return_datetime);
    if (returnDate.getTime() <= pickupDate.getTime()) {
      return res.status(400).json({ error: 'Return date & time must be after pickup date & time' });
    }
    validReturnDatetime = return_datetime;
  }

  // Ertiga capacity validation (max 6 passengers + driver)
  const passengerCount = parseInt(passengers, 10) || 1;
  if (passengerCount < 1 || passengerCount > 6) {
    return res.status(400).json({
      error: 'Our Ertiga accommodates up to 6 passengers comfortably. For larger groups, please contact Srinu.'
    });
  }

  // Calculate indicative estimate
  let estMin = null;
  let estMax = null;

  if (trip_type === 'local_8h' || trip_type === 'full_day' || service_type === 'self_drive') {
    let ruleCode = 'LOCAL_8H_80KM';
    if (trip_type === 'full_day') ruleCode = 'FULL_DAY_12H';
    if (service_type === 'self_drive') ruleCode = 'SELF_DRIVE_24H';

    const { data: rule } = await supabaseAdmin
      .from('pricing_rules')
      .select('min_price, max_price')
      .eq('rule_code', ruleCode)
      .maybeSingle();

    if (rule) {
      estMin = rule.min_price;
      estMax = rule.max_price;
    }
  } else {
    const { data: matchedDest } = await supabaseAdmin
      .from('destinations')
      .select('one_way_price_min, round_trip_price_min, round_trip_price_max')
      .or(`name_en.ilike.${destination.trim()},name_te.ilike.${destination.trim()},key_slug.ilike.${destination.toLowerCase().trim()}`)
      .limit(1)
      .maybeSingle();

    if (matchedDest) {
      if (trip_type === 'one_way') {
        estMin = matchedDest.one_way_price_min;
        estMax = Math.round(matchedDest.one_way_price_min * 1.25);
      } else {
        estMin = matchedDest.round_trip_price_min;
        estMax = matchedDest.round_trip_price_max;
      }
    }
  }

  // Check vehicle schedule conflict for notice
  const conflict = await checkVehicleConflict(pickup_datetime, validReturnDatetime);

  try {
    // Generate unique booking reference candidate SCT-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const candidateRef = `SCT-${currentYear}-${randomSuffix}`;

    const { data: insertedBooking, error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert({
        reference_no: candidateRef,
        customer_name: customer_name.trim(),
        customer_phone: formattedPhone,
        customer_email: customer_email ? customer_email.trim() : null,
        service_type: service_type || 'with_driver',
        trip_type: trip_type || 'round_trip',
        pickup_location: pickup_location.trim(),
        destination: destination.trim(),
        pickup_datetime: new Date(pickup_datetime).toISOString(),
        return_datetime: validReturnDatetime ? new Date(validReturnDatetime).toISOString() : null,
        passengers: passengerCount,
        luggage_count: parseInt(luggage_count, 10) || 1,
        estimated_min_price: estMin,
        estimated_max_price: estMax,
        special_notes: special_notes ? special_notes.trim() : null,
        status: 'pending',
        client_ip: clientIp
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const referenceNo = insertedBooking.reference_no;

    // Send email notification to admin via Resend only after booking has been successfully saved
    sendBookingNotificationEmail({
      reference_no: referenceNo,
      customer_name: customer_name.trim(),
      customer_phone: formattedPhone,
      customer_email: customer_email ? customer_email.trim() : null,
      service_type: service_type || 'with_driver',
      trip_type: trip_type || 'round_trip',
      pickup_location: pickup_location.trim(),
      destination: destination.trim(),
      pickup_datetime,
      return_datetime: validReturnDatetime,
      passengers: passengerCount,
      luggage_count: parseInt(luggage_count, 10) || 1,
      estimated_min_price: estMin,
      estimated_max_price: estMax,
      special_notes: special_notes ? special_notes.trim() : null,
      hasConflict: Boolean(conflict.hasConflict)
    }).catch(emailErr => {
      console.warn('[Notification] Non-blocking admin email dispatch notice:', emailErr.message);
    });

    // Format prefilled WhatsApp message
    const formattedPickupDate = new Date(pickup_datetime).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const formattedReturnDate = validReturnDatetime
      ? new Date(validReturnDatetime).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Single day / Drop';

    const serviceLabel = service_type === 'self_drive' ? 'Self Drive Rental' : 'Rental with Driver';
    const estimateLabel = estMin && estMax ? `₹${estMin.toLocaleString('en-IN')} - ₹${estMax.toLocaleString('en-IN')} (Estimated)` : 'Custom Quote Needed';

    const whatsappText =
`*Namaste Srinu Garu, I want to book S CAR TRAVELS Ertiga!*
• *Booking Ref:* ${referenceNo}
• *Customer Name:* ${customer_name.trim()}
• *Phone:* ${formattedPhone}
• *Service:* ${serviceLabel}
• *Trip Type:* ${trip_type.replace('_', ' ').toUpperCase()}
• *Pickup Location:* ${pickup_location.trim()}
• *Destination:* ${destination.trim()}
• *Pickup Time:* ${formattedPickupDate}
• *Return Time:* ${formattedReturnDate}
• *Passengers:* ${passengerCount} (${service_type === 'self_drive' ? 'Self Drive' : 'With Driver'})
• *Luggage Bags:* ${parseInt(luggage_count, 10) || 1}
• *Indicative Estimate:* ${estimateLabel}
${special_notes ? `• *Special Notes:* ${special_notes.trim()}` : ''}

Please confirm availability and final fare for our Ertiga journey. Thank you!`;

    const encodedWhatsappUrl = `https://wa.me/919550641408?text=${encodeURIComponent(whatsappText)}`;

    res.status(201).json({
      success: true,
      reference_no: referenceNo,
      status: 'pending',
      booking: {
        id: insertedBooking.id,
        reference_no: referenceNo,
        customer_name: customer_name.trim(),
        customer_phone: formattedPhone,
        service_type,
        trip_type,
        pickup_location: pickup_location.trim(),
        destination: destination.trim(),
        pickup_datetime,
        return_datetime: validReturnDatetime,
        passengers: passengerCount,
        estimated_min_price: estMin,
        estimated_max_price: estMax,
        status: 'pending'
      },
      whatsappUrl: encodedWhatsappUrl,
      whatsapp_url: encodedWhatsappUrl,
      advisory: conflict.hasConflict
        ? 'Notice: Vehicle has another scheduled trip around this date. Srinu will check exact timings and reach out promptly.'
        : 'Vehicle slot is tentatively open. Srinu will review and confirm availability within 15–30 minutes.'
    });
  } catch (err) {
    console.error('Error inserting booking in Supabase:', err);
    res.status(500).json({ error: 'Failed to record booking inquiry. Please call Srinu at 9550641408.' });
  }
});

// In-memory brute-force rate limiter for public booking tracking
const trackingRateLimiter = new Map();
const TRACKING_MAX_REQUESTS = 10;
const TRACKING_WINDOW_MS = 15 * 60 * 1000; // 15-minute window
const TRACKING_LOCKOUT_MS = 15 * 60 * 1000; // 15-minute temporary lockout

function checkTrackingRateLimit(ip) {
  const now = Date.now();
  const record = trackingRateLimiter.get(ip) || { requests: 0, failures: 0, firstRequestAt: now, lockedUntil: 0 };

  if (record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfter, reason: 'Tracking inquiry temporarily locked due to multiple failed attempts. Please try again later.' };
  }

  if (now - record.firstRequestAt > TRACKING_WINDOW_MS) {
    record.requests = 0;
    record.failures = 0;
    record.firstRequestAt = now;
  }

  if (record.requests >= TRACKING_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.firstRequestAt + TRACKING_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter, reason: 'Tracking rate limit exceeded. Please wait a few minutes before trying again.' };
  }

  record.requests += 1;
  trackingRateLimiter.set(ip, record);
  return { allowed: true };
}

function recordTrackingFailure(ip) {
  const record = trackingRateLimiter.get(ip);
  if (record) {
    record.failures += 1;
    if (record.failures >= 5) {
      record.lockedUntil = Date.now() + TRACKING_LOCKOUT_MS;
    }
    trackingRateLimiter.set(ip, record);
  }
}

// 4. GET /api/public/bookings/track
router.get('/bookings/track', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const rateLimit = checkTrackingRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.reason, retryAfter: rateLimit.retryAfter });
  }

  const { reference_no, phone } = req.query;

  if (!reference_no || !phone) {
    return res.status(400).json({ error: 'Please provide both your Booking Reference and registered Mobile Number to track your inquiry.' });
  }

  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return res.status(503).json({ error: 'Database service unavailable. Supabase PostgreSQL is required.' });
  }

  const cleanRef = reference_no.trim().toUpperCase();
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  try {
    const { data, error } = await supabaseAdmin.rpc('track_booking_public', {
      p_reference_no: cleanRef,
      p_phone: cleanPhone
    });

    if (!error && data && data.success && data.booking) {
      return res.json({ booking: data.booking });
    }

    recordTrackingFailure(clientIp);
    return res.status(404).json({ error: 'No booking inquiry found with provided details. Please check the reference number and phone.' });
  } catch (sbErr) {
    console.error('Error tracking booking:', sbErr);
    return res.status(500).json({ error: 'Failed to query booking tracking information.' });
  }
});

// 5. GET /api/public/admin/verify-invite-token
router.get('/admin/verify-invite-token', async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invitation token is required.' });
  }

  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return res.status(503).json({ error: 'Database service unavailable. Supabase PostgreSQL is required.' });
  }

  const cleanToken = token.trim();
  const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

  try {
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('admin_invitations')
      .select(`
        id, email, role, expires_at, used_at, admin_id,
        admins:admin_id (id, username, is_active, status)
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteErr || !invite) {
      return res.status(404).json({ error: 'Invalid invitation link. Please request a new invitation from your Super Administrator.' });
    }

    if (invite.used_at) {
      return res.status(400).json({ error: 'This invitation has already been accepted. Please sign in with your email and password.' });
    }

    if (new Date() > new Date(invite.expires_at)) {
      return res.status(400).json({ error: 'This invitation has expired. Please ask your Super Administrator to send a new invitation.' });
    }

    if (invite.admins?.status === 'disabled' || invite.admins?.is_active === 0) {
      return res.status(403).json({ error: 'This administrator account has been disabled.' });
    }

    res.json({
      valid: true,
      email: invite.email,
      username: invite.admins?.username || invite.email.split('@')[0],
      role: invite.role
    });
  } catch (err) {
    console.error('Error verifying invite token in Supabase:', err);
    res.status(500).json({ error: 'Failed to verify invitation token.' });
  }
});

// 6. POST /api/public/admin/accept-invite
router.post('/admin/accept-invite', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { token, password } = req.body;

  if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invitation token and password are required.' });
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return res.status(503).json({ error: 'Database service unavailable. Supabase PostgreSQL is required.' });
  }

  const cleanToken = token.trim();
  const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

  try {
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('admin_invitations')
      .select(`
        id, email, role, expires_at, used_at, admin_id,
        admins:admin_id (id, username, is_active, status)
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteErr || !invite) {
      return res.status(404).json({ error: 'Invalid invitation link.' });
    }

    if (invite.used_at) {
      return res.status(400).json({ error: 'This invitation has already been accepted. Please sign in with your email and password.' });
    }

    if (new Date() > new Date(invite.expires_at)) {
      return res.status(400).json({ error: 'This invitation has expired. Please ask your Super Administrator to send a new invitation.' });
    }

    if (invite.admins?.status === 'disabled' || invite.admins?.is_active === 0) {
      return res.status(403).json({ error: 'This administrator account has been disabled.' });
    }

    // Atomically mark invitation as used
    const { data: updatedInvite, error: updateErr } = await supabaseAdmin
      .from('admin_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('used_at', null)
      .select()
      .maybeSingle();

    if (updateErr || !updatedInvite) {
      return res.status(400).json({ error: 'This invitation has already been accepted or expired.' });
    }

    // Hash password and activate admin account
    const passwordHash = bcrypt.hashSync(trimmedPassword, 10);
    const { error: activateErr } = await supabaseAdmin
      .from('admins')
      .update({
        password_hash: passwordHash,
        is_active: 1,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', invite.admin_id);

    if (activateErr) {
      console.error('Failed to activate admin:', activateErr);
      return res.status(500).json({ error: 'Failed to activate administrator account.' });
    }

    // Record in audit log
    await recordAdminAuditLog({
      action: 'ADMIN_ACTIVATED',
      actorId: invite.admin_id,
      actorUsername: invite.admins?.username || invite.email,
      targetAdminId: invite.admin_id,
      targetEmail: invite.email,
      targetUsername: invite.admins?.username || invite.email,
      details: { role: invite.role },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: 'Account activated successfully! You may now sign in using your registered email and password.'
    });
  } catch (err) {
    console.error('Error accepting invitation in Supabase:', err);
    res.status(500).json({ error: 'Failed to complete invitation acceptance.' });
  }
});

export default router;
