import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import {
  requireAdminAuth,
  signAdminToken,
  generateCsrfToken,
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogin
} from '../auth.js';
import { checkVehicleConflict } from './public.js';
import { supabaseAdmin, isSupabaseServerConfigured, testSupabaseServerConnection } from '../supabase.js';

const router = express.Router();

// 1. POST /api/admin/login
router.post('/login', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { username, password } = req.body;

  // Rate limiting check
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', String(rateLimitStatus.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed login attempts. Please wait ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  const trimmedUsername = username.trim();
  const trimmedPassword = password;

  const admin = db.prepare(`
    SELECT id, username, email, password_hash, role
    FROM admins
    WHERE lower(username) = lower(?) OR lower(email) = lower(?)
  `).get(trimmedUsername, trimmedUsername);

  // Timing attack mitigation: perform dummy bcrypt check if user does not exist
  const dummyHash = '$2a$10$e8w8G7mZ2Y2C9bQxQ0wMbe7V.c1x9w1s6aB6t9sL5w3r9xY4zF1u2';
  if (!admin) {
    bcrypt.compareSync(trimmedPassword, dummyHash);
    recordFailedLogin(clientIp);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const validPassword = bcrypt.compareSync(trimmedPassword, admin.password_hash);
  if (!validPassword) {
    recordFailedLogin(clientIp);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Enforce explicit admin role
  if (admin.role !== 'admin' && admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied: User does not have administrative privileges' });
  }

  // Clear failed login records
  clearFailedLogin(clientIp);

  const token = signAdminToken(admin);
  const csrfToken = generateCsrfToken();

  // Set secure, HttpOnly session cookie
  const isProd = process.env.NODE_ENV === 'production';
  const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();

  res.cookie('scar_admin_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: cookieSameSite,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: '/'
  });

  // Set readable CSRF cookie for client header verification
  res.cookie('scar_csrf_token', csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: cookieSameSite,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });

  res.json({
    success: true,
    token,
    csrfToken,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    }
  });
});

// 2. POST /api/admin/logout
router.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  res.clearCookie('scar_admin_token', {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: cookieSameSite
  });
  res.clearCookie('scar_csrf_token', {
    path: '/',
    httpOnly: false,
    secure: isProd,
    sameSite: cookieSameSite
  });
  res.json({ success: true, message: 'Admin session terminated successfully' });
});

// All routes below require admin authentication and explicit admin role
router.use(requireAdminAuth);

// 3. GET /api/admin/me
router.get('/me', (req, res) => {
  let isDefaultPassword = false;
  try {
    const adminRecord = db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(req.admin.id)
      || db.prepare('SELECT password_hash FROM admins WHERE username = ?').get(req.admin.username);
    if (adminRecord?.password_hash) {
      isDefaultPassword = bcrypt.compareSync('Srinu@2026', adminRecord.password_hash);
    }
  } catch (e) {}

  res.json({
    admin: {
      ...req.admin,
      usingDefaultPassword: isDefaultPassword
    }
  });
});

// 4. POST /api/admin/change-password
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required' });
  }

  if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  try {
    const adminRecord = db.prepare('SELECT id, username, email, password_hash FROM admins WHERE id = ?').get(req.admin?.id)
      || db.prepare('SELECT id, username, email, password_hash FROM admins WHERE username = ?').get(req.admin?.username);

    if (!adminRecord) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const isValid = bcrypt.compareSync(currentPassword, adminRecord.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password cannot be identical to current password' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword.trim(), salt);

    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, adminRecord.id);

    // If Supabase server sync is active, update Supabase auth user as well
    if (isSupabaseServerConfigured && supabaseAdmin && adminRecord.email) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const sbUser = usersData?.users?.find(u => u.email?.toLowerCase() === adminRecord.email.toLowerCase());
        if (sbUser) {
          await supabaseAdmin.auth.admin.updateUserById(sbUser.id, { password: newPassword.trim() });
        }
      } catch (sbErr) {
        console.warn('Notice: Supabase admin password sync:', sbErr.message);
      }
    }

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// 3. GET /api/admin/metrics
router.get('/metrics', async (req, res) => {
  try {
    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status IN ('confirmed', 'completed') THEN COALESCE(final_agreed_price, estimated_min_price, 0) ELSE 0 END) as total_confirmed_revenue,
        SUM(CASE WHEN status = 'pending' THEN COALESCE(estimated_min_price, 0) ELSE 0 END) as pending_potential_revenue
      FROM bookings
    `).get();

    const blockedCount = db.prepare("SELECT COUNT(*) as count FROM blocked_dates WHERE end_date >= date('now')").get().count;

    // Upcoming 7 confirmed trips
    const upcomingTrips = db.prepare(`
      SELECT id, reference_no, customer_name, customer_phone, destination,
             pickup_datetime, return_datetime, status, final_agreed_price, estimated_min_price
      FROM bookings
      WHERE status IN ('confirmed', 'pending')
      ORDER BY pickup_datetime ASC
      LIMIT 7
    `).all();

    // Check Supabase connection state for admin dashboard
    let supabaseStatus = {
      configured: isSupabaseServerConfigured,
      connected: false,
      message: isSupabaseServerConfigured ? 'Connecting...' : 'Awaiting Supabase credentials in .env'
    };

    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        const diag = await testSupabaseServerConnection();
        supabaseStatus = diag;
      } catch (sbErr) {
        supabaseStatus = {
          configured: true,
          connected: false,
          message: sbErr.message
        };
      }
    }

    res.json({
      metrics: {
        total: counts.total || 0,
        pending: counts.pending || 0,
        confirmed: counts.confirmed || 0,
        completed: counts.completed || 0,
        cancelled: counts.cancelled || 0,
        total_confirmed_revenue: counts.total_confirmed_revenue || 0,
        pending_potential_revenue: counts.pending_potential_revenue || 0,
        blocked_dates_count: blockedCount
      },
      upcomingTrips,
      supabaseStatus
    });
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.status(500).json({ error: 'Failed to load metrics' });
  }
});


// 4. GET /api/admin/bookings
router.get('/bookings', (req, res) => {
  try {
    const { status, trip_type, search, from_date, to_date } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (trip_type && trip_type !== 'all') {
      query += ' AND trip_type = ?';
      params.push(trip_type);
    }

    if (search) {
      query += ' AND (reference_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR destination LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (from_date) {
      query += ' AND pickup_datetime >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND pickup_datetime <= ?';
      params.push(to_date);
    }

    query += ' ORDER BY pickup_datetime DESC';

    const bookings = db.prepare(query).all(...params);
    res.json({ bookings });
  } catch (error) {
    console.error('Error querying bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// 5. GET /api/admin/bookings/:id
router.get('/bookings/:id', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const auditLogs = db.prepare(`
    SELECT id, old_status, new_status, changed_by, remarks, created_at
    FROM booking_audit_logs
    WHERE booking_id = ?
    ORDER BY id DESC
  `).all(req.params.id);

  res.json({ booking, auditLogs });
});

// 6. PATCH /api/admin/bookings/:id/status
router.patch('/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, remarks, final_agreed_price } = req.body;

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // SINGLE VEHICLE OVERLAP CHECK:
  // If moving to 'confirmed', check if the Ertiga already has another confirmed booking on these dates!
  if (status === 'confirmed') {
    const conflict = checkVehicleConflict(existing.pickup_datetime, existing.return_datetime, existing.id);
    if (conflict.hasConflict) {
      return res.status(409).json({
        error: `Cannot confirm booking! Overlap detected for the Ertiga: ${conflict.message}`,
        conflict
      });
    }
  }

  try {
    const updateStmt = db.prepare(`
      UPDATE bookings
      SET status = ?,
          final_agreed_price = COALESCE(?, final_agreed_price),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(status, final_agreed_price !== undefined ? final_agreed_price : null, id);

    // Insert audit log in local DB
    db.prepare(`
      INSERT INTO booking_audit_logs (booking_id, old_status, new_status, changed_by, remarks)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, existing.status, status, req.admin?.username || 'admin', remarks || `Status updated from ${existing.status} to ${status}`);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

    // Synchronize to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        const updatePayload = {
          status: status,
          updated_at: new Date().toISOString()
        };
        if (final_agreed_price !== undefined && final_agreed_price !== null) {
          updatePayload.final_quoted_fare = Number(final_agreed_price);
        }

        const { data: sbBooking } = await supabaseAdmin
          .from('bookings')
          .update(updatePayload)
          .eq('reference_no', existing.reference_no)
          .select('id')
          .maybeSingle();

        if (sbBooking?.id) {
          await supabaseAdmin.from('booking_status_history').insert({
            booking_id: sbBooking.id,
            previous_status: existing.status,
            new_status: status,
            changed_by: req.admin?.username || 'Owner Srinu',
            remarks: remarks || `Status updated from ${existing.status} to ${status}`
          });
        }
      } catch (sbErr) {
        console.warn('Notice: Supabase admin booking status sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// 7. PATCH /api/admin/bookings/:id/details
router.patch('/bookings/:id/details', async (req, res) => {
  const { id } = req.params;
  const { admin_notes, final_agreed_price } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    db.prepare(`
      UPDATE bookings
      SET admin_notes = COALESCE(?, admin_notes),
          final_agreed_price = COALESCE(?, final_agreed_price),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(admin_notes, final_agreed_price, id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        const payload = { updated_at: new Date().toISOString() };
        if (admin_notes !== undefined) payload.admin_notes = admin_notes;
        if (final_agreed_price !== undefined && final_agreed_price !== null) payload.final_quoted_fare = Number(final_agreed_price);

        await supabaseAdmin
          .from('bookings')
          .update(payload)
          .eq('reference_no', existing.reference_no);
      } catch (sbErr) {
        console.warn('Notice: Supabase booking details sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, booking: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update booking details' });
  }
});

// 8. DELETE /api/admin/bookings/:id (Data retention policy)
router.delete('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id, reference_no FROM bookings WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  try {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);

    // Sync deletion if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('bookings').delete().eq('reference_no', existing.reference_no);
      } catch (sbErr) {
        console.warn('Notice: Supabase delete booking sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, message: `Booking ${existing.reference_no} removed per retention policy` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// 9. GET /api/admin/bookings/export/csv
router.get('/export/csv', (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT reference_no, customer_name, customer_phone, service_type, trip_type,
             pickup_location, destination, pickup_datetime, return_datetime,
             passengers, luggage_count, estimated_min_price, estimated_max_price,
             final_agreed_price, status, admin_notes, created_at
      FROM bookings
      ORDER BY pickup_datetime DESC
    `).all();

    const headers = [
      'Reference No', 'Customer Name', 'Phone', 'Service Type', 'Trip Type',
      'Pickup Location', 'Destination', 'Pickup Date Time', 'Return Date Time',
      'Passengers', 'Luggage', 'Min Estimate (INR)', 'Max Estimate (INR)',
      'Final Agreed Price (INR)', 'Status', 'Admin Notes', 'Booked On'
    ];

    const rows = bookings.map(b => [
      `"${b.reference_no}"`,
      `"${(b.customer_name || '').replace(/"/g, '""')}"`,
      `"${b.customer_phone}"`,
      `"${b.service_type}"`,
      `"${b.trip_type}"`,
      `"${(b.pickup_location || '').replace(/"/g, '""')}"`,
      `"${(b.destination || '').replace(/"/g, '""')}"`,
      `"${b.pickup_datetime}"`,
      `"${b.return_datetime || ''}"`,
      b.passengers,
      b.luggage_count,
      b.estimated_min_price || '',
      b.estimated_max_price || '',
      b.final_agreed_price || '',
      `"${b.status}"`,
      `"${(b.admin_notes || '').replace(/"/g, '""')}"`,
      `"${b.created_at}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="SCAR_Travels_Bookings_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({ error: 'Failed to export bookings' });
  }
});

// 10. Pricing Rules Endpoints
router.get('/pricing', (req, res) => {
  const rules = db.prepare('SELECT * FROM pricing_rules ORDER BY sort_order ASC').all();
  res.json({ rules });
});

router.put('/pricing/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title_en, title_te, min_price, max_price, duration_hours,
    distance_limit_km, fuel_included, tolls_included, driver_bata_included,
    description_en, description_te, active
  } = req.body;

  try {
    db.prepare(`
      UPDATE pricing_rules
      SET title_en = ?, title_te = ?, min_price = ?, max_price = ?,
          duration_hours = ?, distance_limit_km = ?, fuel_included = ?,
          tolls_included = ?, driver_bata_included = ?, description_en = ?,
          description_te = ?, active = ?
      WHERE id = ?
    `).run(
      title_en, title_te, min_price, max_price, duration_hours,
      distance_limit_km, fuel_included ? 1 : 0, tolls_included ? 1 : 0,
      driver_bata_included ? 1 : 0, description_en, description_te,
      active ? 1 : 0, id
    );

    const updated = db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(id);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin && updated?.rule_code) {
      try {
        await supabaseAdmin
          .from('pricing_rules')
          .update({
            title_en,
            title_te,
            min_price: Number(min_price),
            max_price: Number(max_price),
            duration_hours: Number(duration_hours || 0),
            distance_limit_km: Number(distance_limit_km || 0),
            fuel_included: Boolean(fuel_included),
            tolls_included: Boolean(tolls_included),
            driver_bata_included: Boolean(driver_bata_included),
            description_en,
            description_te,
            active: Boolean(active),
            updated_at: new Date().toISOString()
          })
          .eq('rule_code', updated.rule_code);
      } catch (sbErr) {
        console.warn('Notice: Supabase pricing rule sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, rule: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing rule' });
  }
});

// 11. Destinations Endpoints
router.get('/destinations', (req, res) => {
  const destinations = db.prepare('SELECT * FROM destinations ORDER BY sort_order ASC, distance_km ASC').all();
  res.json({ destinations });
});

router.post('/destinations', async (req, res) => {
  const {
    key_slug, name_en, name_te, distance_km, duration_hours,
    one_way_price_min, round_trip_price_min, round_trip_price_max,
    popular, category, description_en, description_te, sort_order
  } = req.body;

  try {
    const slug = (key_slug || name_en).toLowerCase().replace(/[^a-z0-9]/g, '-');
    const result = db.prepare(`
      INSERT INTO destinations (
        key_slug, name_en, name_te, distance_km, duration_hours,
        one_way_price_min, round_trip_price_min, round_trip_price_max,
        popular, category, description_en, description_te, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slug, name_en, name_te, distance_km, duration_hours,
      one_way_price_min, round_trip_price_min, round_trip_price_max,
      popular ? 1 : 0, category || 'outstation', description_en, description_te, sort_order || 0
    );

    const created = db.prepare('SELECT * FROM destinations WHERE id = ?').get(result.lastInsertRowid);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('destinations').insert({
          key_slug: slug,
          name_en,
          name_te,
          distance_km: Number(distance_km),
          duration_hours: String(duration_hours),
          one_way_price_min: Number(one_way_price_min),
          round_trip_price_min: Number(round_trip_price_min),
          round_trip_price_max: Number(round_trip_price_max),
          popular: Boolean(popular),
          category: category || 'outstation',
          description_en,
          description_te,
          display_order: Number(sort_order || 0),
          active: true
        });
      } catch (sbErr) {
        console.warn('Notice: Supabase destination create sync warning:', sbErr.message);
      }
    }

    res.status(201).json({ success: true, destination: created });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

router.put('/destinations/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name_en, name_te, distance_km, duration_hours,
    one_way_price_min, round_trip_price_min, round_trip_price_max,
    popular, category, description_en, description_te, active, sort_order
  } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM destinations WHERE id = ?').get(id);

    db.prepare(`
      UPDATE destinations
      SET name_en = ?, name_te = ?, distance_km = ?, duration_hours = ?,
          one_way_price_min = ?, round_trip_price_min = ?, round_trip_price_max = ?,
          popular = ?, category = ?, description_en = ?, description_te = ?,
          active = ?, sort_order = ?
      WHERE id = ?
    `).run(
      name_en, name_te, distance_km, duration_hours,
      one_way_price_min, round_trip_price_min, round_trip_price_max,
      popular ? 1 : 0, category, description_en, description_te,
      active ? 1 : 0, sort_order || 0, id
    );

    const updated = db.prepare('SELECT * FROM destinations WHERE id = ?').get(id);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin && existing?.key_slug) {
      try {
        await supabaseAdmin
          .from('destinations')
          .update({
            name_en,
            name_te,
            distance_km: Number(distance_km),
            duration_hours: String(duration_hours),
            one_way_price_min: Number(one_way_price_min),
            round_trip_price_min: Number(round_trip_price_min),
            round_trip_price_max: Number(round_trip_price_max),
            popular: Boolean(popular),
            category,
            description_en,
            description_te,
            active: Boolean(active),
            display_order: Number(sort_order || 0),
            updated_at: new Date().toISOString()
          })
          .eq('key_slug', existing.key_slug);
      } catch (sbErr) {
        console.warn('Notice: Supabase destination update sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, destination: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

router.delete('/destinations/:id', async (req, res) => {
  try {
    const existing = db.prepare('SELECT key_slug FROM destinations WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM destinations WHERE id = ?').run(req.params.id);

    if (isSupabaseServerConfigured && supabaseAdmin && existing?.key_slug) {
      try {
        await supabaseAdmin.from('destinations').delete().eq('key_slug', existing.key_slug);
      } catch (sbErr) {
        console.warn('Notice: Supabase destination delete sync warning:', sbErr.message);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

// 12. Vehicle Management (Single Ertiga)
router.get('/vehicle', (req, res) => {
  const vehicle = db.prepare('SELECT * FROM vehicle LIMIT 1').get();
  if (vehicle) {
    try {
      vehicle.features = JSON.parse(vehicle.features_json);
    } catch (e) {
      vehicle.features = [];
    }
  }
  res.json({ vehicle });
});

router.put('/vehicle', async (req, res) => {
  const {
    model_name, color, registration_number, seating_capacity,
    fuel_type, transmission, air_conditioning, luggage_capacity,
    features, status, last_sanitized_at, insurance_valid_until, fitness_valid_until
  } = req.body;

  try {
    db.prepare(`
      UPDATE vehicle
      SET model_name = ?, color = ?, registration_number = ?, seating_capacity = ?,
          fuel_type = ?, transmission = ?, air_conditioning = ?, luggage_capacity = ?,
          features_json = ?, status = ?, last_sanitized_at = ?,
          insurance_valid_until = ?, fitness_valid_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      model_name, color, registration_number, seating_capacity,
      fuel_type, transmission, air_conditioning, luggage_capacity,
      JSON.stringify(features || []), status, last_sanitized_at,
      insurance_valid_until, fitness_valid_until
    );

    const updated = db.prepare('SELECT * FROM vehicle LIMIT 1').get();
    if (updated) updated.features = JSON.parse(updated.features_json);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('vehicles')
          .update({
            model_name,
            color,
            registration_number,
            seating_capacity: Number(seating_capacity),
            fuel_type,
            transmission,
            air_conditioning: Boolean(air_conditioning),
            luggage_capacity: Number(luggage_capacity),
            features: JSON.stringify(features || []),
            status,
            last_sanitized_at,
            insurance_valid_until,
            fitness_valid_until,
            updated_at: new Date().toISOString()
          })
          .eq('is_sole_fleet_vehicle', true);
      } catch (sbErr) {
        console.warn('Notice: Supabase vehicle update sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, vehicle: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle details' });
  }
});

// 13. Blocked Dates Endpoints
router.get('/blocked-dates', (req, res) => {
  const blockedDates = db.prepare('SELECT * FROM blocked_dates ORDER BY start_date ASC').all();
  res.json({ blockedDates });
});

router.post('/blocked-dates', async (req, res) => {
  const { start_date, end_date, reason } = req.body;
  if (!start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'Start date, end date, and reason are required' });
  }

  // Conflict check with existing confirmed bookings
  const conflict = checkVehicleConflict(start_date + 'T00:00:00', end_date + 'T23:59:59');
  if (conflict.hasConflict && conflict.type === 'booking') {
    return res.status(409).json({
      error: `Cannot block dates: Overlaps with an already confirmed customer trip (${conflict.message})`
    });
  }

  try {
    const result = db.prepare(`
      INSERT INTO blocked_dates (start_date, end_date, reason)
      VALUES (?, ?, ?)
    `).run(start_date, end_date, reason.trim());

    const created = db.prepare('SELECT * FROM blocked_dates WHERE id = ?').get(result.lastInsertRowid);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('blocked_dates').insert({
          start_date,
          end_date,
          reason: reason.trim(),
          created_by: req.admin?.username || 'Owner Srinu'
        });
      } catch (sbErr) {
        console.warn('Notice: Supabase blocked dates insert sync warning:', sbErr.message);
      }
    }

    res.status(201).json({ success: true, blockedDate: created });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add blocked date' });
  }
});

router.delete('/blocked-dates/:id', async (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM blocked_dates WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM blocked_dates WHERE id = ?').run(req.params.id);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin && existing) {
      try {
        await supabaseAdmin
          .from('blocked_dates')
          .delete()
          .match({ start_date: existing.start_date, end_date: existing.end_date });
      } catch (sbErr) {
        console.warn('Notice: Supabase delete blocked date sync warning:', sbErr.message);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete blocked date' });
  }
});

// 14. Settings Endpoints
router.get('/settings', (req, res) => {
  const raw = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  for (const s of raw) {
    settings[s.key] = s.value;
  }
  res.json({ settings });
});

router.put('/settings', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings object' });
  }

  const updateStmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  try {
    const transaction = db.transaction((items) => {
      for (const [key, val] of Object.entries(items)) {
        updateStmt.run(key, String(val));
      }
    });

    transaction(settings);

    // Sync to Supabase if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        const rows = Object.entries(settings).map(([key, value]) => ({
          key,
          value: String(value),
          updated_at: new Date().toISOString()
        }));
        await supabaseAdmin.from('site_settings').upsert(rows);
      } catch (sbErr) {
        console.warn('Notice: Supabase settings upsert sync warning:', sbErr.message);
      }
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;

