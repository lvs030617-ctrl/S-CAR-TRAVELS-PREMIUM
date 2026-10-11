import express from 'express';
import { db } from '../db.js';
import { supabaseAdmin, isSupabaseServerConfigured, testSupabaseServerConnection } from '../supabase.js';
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
router.get('/config', (req, res) => {
  try {
    const rawSettings = db.prepare('SELECT key, value FROM site_settings').all();
    const settings = {};
    for (const item of rawSettings) {
      settings[item.key] = item.value;
    }

    const vehicle = db.prepare(`
      SELECT model_name, color, registration_number, seating_capacity,
             fuel_type, transmission, air_conditioning, luggage_capacity,
             features_json, status, last_sanitized_at
      FROM vehicle LIMIT 1
    `).get();

    if (vehicle) {
      try {
        vehicle.features = JSON.parse(vehicle.features_json);
      } catch (e) {
        vehicle.features = [];
      }
    }

    const destinations = db.prepare(`
      SELECT id, key_slug, name_en, name_te, distance_km, duration_hours,
             one_way_price_min, round_trip_price_min, round_trip_price_max,
             popular, category, description_en, description_te
      FROM destinations
      WHERE active = 1
      ORDER BY sort_order ASC, distance_km ASC
    `).all();

    const pricingRules = db.prepare(`
      SELECT id, rule_code, title_en, title_te, rate_type, min_price, max_price,
             duration_hours, distance_limit_km, fuel_included, tolls_included,
             driver_bata_included, description_en, description_te
      FROM pricing_rules
      WHERE active = 1
      ORDER BY sort_order ASC
    `).all();

    const blockedDates = db.prepare(`
      SELECT start_date, end_date, reason
      FROM blocked_dates
      WHERE end_date >= date('now')
      ORDER BY start_date ASC
    `).all();

    res.json({
      settings,
      vehicle,
      destinations,
      pricingRules,
      blockedDates
    });
  } catch (error) {
    console.error('Error fetching public config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Helper to check for overlapping confirmed bookings or blocked dates
export function checkVehicleConflict(startDateTimeStr, endDateTimeStr, excludeBookingId = null) {
  const reqStart = new Date(startDateTimeStr);
  const reqEnd = endDateTimeStr ? new Date(endDateTimeStr) : new Date(reqStart.getTime() + 10 * 3600 * 1000); // default 10h if single day

  // Check confirmed bookings
  let query = `
    SELECT id, reference_no, customer_name, pickup_datetime, return_datetime, destination
    FROM bookings
    WHERE status = 'confirmed'
  `;
  const params = [];
  if (excludeBookingId) {
    query += ' AND id != ?';
    params.push(excludeBookingId);
  }

  const confirmedBookings = db.prepare(query).all(...params);

  for (const b of confirmedBookings) {
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

  // Check blocked dates
  const blocked = db.prepare('SELECT start_date, end_date, reason FROM blocked_dates').all();
  for (const blk of blocked) {
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

  return { hasConflict: false };
}

// 2. GET /api/public/check-availability
router.get('/check-availability', (req, res) => {
  const { pickup_datetime, return_datetime } = req.query;
  if (!pickup_datetime) {
    return res.status(400).json({ error: 'pickup_datetime is required' });
  }

  const conflict = checkVehicleConflict(pickup_datetime, return_datetime);
  res.json({
    available: !conflict.hasConflict,
    details: conflict
  });
});

// 3. POST /api/public/bookings
router.post('/bookings', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many booking inquiries submitted in a short time. Please wait a moment or call Srinu directly.' });
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

  // Check known destination for pricing
  const matchedDest = db.prepare(`
    SELECT one_way_price_min, round_trip_price_min, round_trip_price_max
    FROM destinations
    WHERE lower(name_en) = lower(?) OR lower(name_te) = lower(?) OR key_slug = lower(?)
    LIMIT 1
  `).get(destination.trim(), destination.trim(), destination.toLowerCase().trim());

  if (trip_type === 'local_8h') {
    const rule = db.prepare("SELECT min_price, max_price FROM pricing_rules WHERE rule_code = 'LOCAL_8H_80KM'").get();
    if (rule) {
      estMin = rule.min_price;
      estMax = rule.max_price;
    }
  } else if (trip_type === 'full_day') {
    const rule = db.prepare("SELECT min_price, max_price FROM pricing_rules WHERE rule_code = 'FULL_DAY_12H'").get();
    if (rule) {
      estMin = rule.min_price;
      estMax = rule.max_price;
    }
  } else if (service_type === 'self_drive') {
    const rule = db.prepare("SELECT min_price, max_price FROM pricing_rules WHERE rule_code = 'SELF_DRIVE_24H'").get();
    if (rule) {
      estMin = rule.min_price;
      estMax = rule.max_price;
    }
  } else if (matchedDest) {
    if (trip_type === 'one_way') {
      estMin = matchedDest.one_way_price_min;
      estMax = Math.round(matchedDest.one_way_price_min * 1.25);
    } else {
      estMin = matchedDest.round_trip_price_min;
      estMax = matchedDest.round_trip_price_max;
    }
  }

  // Generate unique booking reference SCT-YYYY-XXXX
  const currentYear = new Date().getFullYear();
  let referenceNo = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    referenceNo = `SCT-${currentYear}-${randomSuffix}`;
    const existing = db.prepare('SELECT id FROM bookings WHERE reference_no = ?').get(referenceNo);
    if (!existing) {
      isUnique = true;
    }
  }

  // Check vehicle schedule conflict for notice
  const conflict = checkVehicleConflict(pickup_datetime, validReturnDatetime);

  try {
    const stmt = db.prepare(`
      INSERT INTO bookings (
        reference_no, customer_name, customer_phone, customer_email,
        service_type, trip_type, pickup_location, destination,
        pickup_datetime, return_datetime, passengers, luggage_count,
        estimated_min_price, estimated_max_price, special_notes,
        status, client_ip, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      referenceNo,
      customer_name.trim(),
      formattedPhone,
      customer_email ? customer_email.trim() : null,
      service_type || 'with_driver',
      trip_type || 'round_trip',
      pickup_location.trim(),
      destination.trim(),
      pickup_datetime,
      validReturnDatetime,
      passengerCount,
      parseInt(luggage_count, 10) || 1,
      estMin,
      estMax,
      special_notes ? special_notes.trim() : null,
      clientIp
    );

    // Audit log
    db.prepare(`
      INSERT INTO booking_audit_logs (booking_id, old_status, new_status, changed_by, remarks)
      VALUES (?, NULL, 'pending', 'Customer Web Form', 'New online booking inquiry submitted')
    `).run(result.lastInsertRowid);

    // Synchronize to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('bookings').insert({
          reference_no: referenceNo,
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
          estimated_fare_min: estMin,
          estimated_fare_max: estMax,
          special_notes: special_notes ? special_notes.trim() : null,
          status: 'pending',
          client_ip: clientIp
        });
      } catch (sbErr) {
        console.warn('Notice: Supabase booking sync failed (check schema/keys):', sbErr.message);
      }
    }

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
        id: result.lastInsertRowid,
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
    console.error('Error inserting booking:', err);
    res.status(500).json({ error: 'Failed to record booking inquiry. Please call Srinu at 9550641408.' });
  }
});

// 4. GET /api/public/bookings/track
router.get('/bookings/track', (req, res) => {
  const { reference_no, phone } = req.query;

  if (!reference_no && !phone) {
    return res.status(400).json({ error: 'Please provide either a Booking Reference or Mobile Number' });
  }

  let booking = null;
  if (reference_no) {
    booking = db.prepare(`
      SELECT reference_no, customer_name, customer_phone, service_type, trip_type,
             pickup_location, destination, pickup_datetime, return_datetime,
             passengers, luggage_count, estimated_min_price, estimated_max_price,
             final_agreed_price, status, created_at
      FROM bookings
      WHERE reference_no = ?
    `).get(reference_no.trim().toUpperCase());
  } else if (phone) {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    booking = db.prepare(`
      SELECT reference_no, customer_name, customer_phone, service_type, trip_type,
             pickup_location, destination, pickup_datetime, return_datetime,
             passengers, luggage_count, estimated_min_price, estimated_max_price,
             final_agreed_price, status, created_at
      FROM bookings
      WHERE customer_phone = ?
      ORDER BY id DESC LIMIT 1
    `).get(cleanPhone);
  }

  if (!booking) {
    return res.status(404).json({ error: 'No booking inquiry found with provided details. Please check the reference number or phone.' });
  }

  // Mask phone for privacy in public tracking response
  const maskedPhone = booking.customer_phone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2');

  res.json({
    booking: {
      ...booking,
      customer_phone: maskedPhone
    }
  });
});

export default router;
