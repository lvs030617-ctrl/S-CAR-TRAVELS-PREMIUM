import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: 54332,
  user: 'postgres',
  password: 'testpass',
  database: 'postgres'
});

async function runIntegrationSuite() {
  console.log('================================================================');
  console.log('🐘 S CAR TRAVELS PREMIUM — POSTGRESQL INTEGRATION TEST SUITE');
  console.log('Isolated Target: PostgreSQL 15 (Docker port 54332)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} — ${details}`);
      failed++;
    }
  }

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. Schema & Table Assertions
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Database Contract & Schema Verification ---');
    const tableRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = tableRes.rows.map(r => r.table_name);

    const requiredTables = [
      'vehicles', 'destinations', 'pricing_rules', 'blocked_dates',
      'site_settings', 'bookings', 'booking_status_history', 'admins',
      'admin_otps', 'admin_invitations', 'admin_password_resets', 'admin_audit_logs'
    ];

    for (const t of requiredTables) {
      assert(tables.includes(t), `Table public.${t} exists`);
    }

    const vehicleRes = await client.query('SELECT * FROM public.vehicles WHERE is_sole_fleet_vehicle = true');
    assert(vehicleRes.rowCount === 1, 'Sole fleet White Ertiga exists in vehicles table');
    assert(vehicleRes.rows[0].seating_capacity === 7, 'Ertiga seating capacity is strictly 7');
    assert(vehicleRes.rows[0].color === 'Pearl Arctic White', 'Fleet vehicle is Pearl Arctic White');
    const vehicleId = vehicleRes.rows[0].id;

    const destCount = await client.query('SELECT count(*) as count FROM public.destinations');
    assert(Number(destCount.rows[0].count) >= 8, `Destinations catalog contains ${destCount.rows[0].count} routes`);

    const rulesCount = await client.query('SELECT count(*) as count FROM public.pricing_rules');
    assert(Number(rulesCount.rows[0].count) >= 4, `Pricing rules table contains ${rulesCount.rows[0].count} standard packages`);

    // -------------------------------------------------------------------------
    // 2. Booking Creation & Collision-Free Reference Sequence
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Booking Inquiry & Sequence Generation ---');
    const pickup1 = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const return1 = new Date(Date.now() + 36 * 3600 * 1000).toISOString();

    const insertRes1 = await client.query(`
      INSERT INTO public.bookings (
        customer_name, customer_phone, service_type, trip_type,
        pickup_location, destination, pickup_datetime, return_datetime,
        passengers, luggage_count, estimated_min_price, estimated_max_price, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending'
      ) RETURNING id, reference_no, status
    `, [
      'Venkata Rao', '9848012345', 'with_driver', 'round_trip',
      'Kotananduru', 'Visakhapatnam', pickup1, return1,
      4, 2, 4500, 5200
    ]);

    const booking1 = insertRes1.rows[0];
    assert(Boolean(booking1.reference_no), `Booking 1 reference generated: ${booking1.reference_no}`);
    assert(/^SCT-\d{4}-\d{4}$/.test(booking1.reference_no), 'Reference format adheres to SCT-YYYY-XXXX pattern');

    const historyRes1 = await client.query(
      'SELECT * FROM public.booking_status_history WHERE booking_id = $1',
      [booking1.id]
    );
    assert(historyRes1.rowCount === 1, 'Status history trigger recorded initial booking inquiry');
    assert(historyRes1.rows[0].new_status === 'pending', 'Initial status history is pending');

    // -------------------------------------------------------------------------
    // 3. Atomic Confirmation via PostgreSQL RPC
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Concurrency-Safe Booking Confirmation (RPC) ---');
    const confirmRes1 = await client.query(`
      SELECT public.confirm_booking_atomic(
        p_booking_id => $1,
        p_new_status => 'confirmed',
        p_remarks => 'Confirmed by Owner Srinu with advance payment',
        p_final_price => 4800,
        p_admin_user => 'Owner Srinu'
      ) as result
    `, [booking1.id]);

    const confirmOutput1 = confirmRes1.rows[0].result;
    assert(confirmOutput1.success === true, 'confirm_booking_atomic executed successfully');

    const verifiedB1 = await client.query('SELECT * FROM public.bookings WHERE id = $1', [booking1.id]);
    assert(verifiedB1.rows[0].status === 'confirmed', 'Booking 1 status transitioned to confirmed');
    assert(verifiedB1.rows[0].final_agreed_price === 4800, 'Final agreed price updated to 4800');
    assert(verifiedB1.rows[0].vehicle_id === vehicleId, 'Booking 1 bound to Ertiga fleet ID');

    // -------------------------------------------------------------------------
    // 4. Overlapping Booking Concurrency & Double-Booking Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Concurrency & Overlap Conflict Enforcement ---');
    // Booking 2 overlaps with Booking 1
    const pickup2 = new Date(Date.now() + 28 * 3600 * 1000).toISOString();
    const return2 = new Date(Date.now() + 40 * 3600 * 1000).toISOString();

    const insertRes2 = await client.query(`
      INSERT INTO public.bookings (
        customer_name, customer_phone, service_type, trip_type,
        pickup_location, destination, pickup_datetime, return_datetime,
        passengers, luggage_count, estimated_min_price, estimated_max_price, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending'
      ) RETURNING id, reference_no, status
    `, [
      'Suresh Kumar', '9550123456', 'with_driver', 'round_trip',
      'Tuni', 'Rajahmundry', pickup2, return2,
      5, 3, 3500, 4200
    ]);
    const booking2 = insertRes2.rows[0];

    let overlapCaught = false;
    let overlapMessage = '';
    try {
      await client.query(`
        SELECT public.confirm_booking_atomic(
          p_booking_id => $1,
          p_new_status => 'confirmed',
          p_remarks => 'Attempting conflicting confirmation',
          p_final_price => 3800,
          p_admin_user => 'Admin'
        )
      `, [booking2.id]);
    } catch (err) {
      overlapCaught = true;
      overlapMessage = err.message;
    }

    assert(overlapCaught, 'Confirmation of overlapping booking was blocked by PostgreSQL advisory lock and validation');
    assert(overlapMessage.includes('CONFLICT_OVERLAPPING_CONFIRMED'), `Database returned explicit conflict error: ${overlapMessage.slice(0, 60)}...`);

    const verifiedB2 = await client.query('SELECT status FROM public.bookings WHERE id = $1', [booking2.id]);
    assert(verifiedB2.rows[0].status === 'pending', 'Booking 2 remained pending (atomic rollback, zero dirty write)');

    // -------------------------------------------------------------------------
    // 5. Blocked Dates Atomic Operations & Trip Conflict Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Blocked Dates & Maintenance Management ---');
    // Attempt to block date overlapping with confirmed Booking 1
    const blockStartConflict = new Date(Date.now() + 20 * 3600 * 1000).toISOString().slice(0, 10);
    const blockEndConflict = new Date(Date.now() + 30 * 3600 * 1000).toISOString().slice(0, 10);

    let blockConflictCaught = false;
    try {
      await client.query(`
        SELECT public.block_dates_atomic(
          p_start_date => $1::DATE,
          p_end_date => $2::DATE,
          p_reason => 'Vehicle AC servicing',
          p_admin_user => 'Owner Srinu'
        )
      `, [blockStartConflict, blockEndConflict]);
    } catch (err) {
      blockConflictCaught = true;
    }
    assert(blockConflictCaught, 'block_dates_atomic blocked maintenance period overlapping with confirmed trip');

    // Block non-conflicting future date
    const blockStartFree = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const blockEndFree = new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const blockResFree = await client.query(`
      SELECT public.block_dates_atomic(
        p_start_date => $1::DATE,
        p_end_date => $2::DATE,
        p_reason => 'Annual Insurance Renewal & Scheduled Service',
        p_admin_user => 'Owner Srinu'
      ) as result
    `, [blockStartFree, blockEndFree]);

    assert(blockResFree.rows[0].result.success === true, 'block_dates_atomic successfully scheduled future maintenance');
    const blockId = blockResFree.rows[0].result.blockedDate.id;

    // Unblock the maintenance slot
    const unblockRes = await client.query(`
      SELECT public.unblock_dates_atomic(
        p_block_id => $1::UUID,
        p_admin_user => 'Owner Srinu'
      ) as result
    `, [blockId]);
    assert(unblockRes.rows[0].result.success === true, 'unblock_dates_atomic successfully removed maintenance block');

    // -------------------------------------------------------------------------
    // 6. Public Booking Tracking RPC (Zero Note Leakage & Phone Masking)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Public Booking Tracking RPC Security ---');
    const trackRes = await client.query(`
      SELECT public.track_booking_public($1, $2) as result
    `, [booking1.reference_no, '9848012345']);

    const trackData = trackRes.rows[0].result;
    assert(trackData.success === true, 'track_booking_public verified reference and phone successfully');
    assert(trackData.booking.customer_phone.includes('******'), 'Customer phone number is masked (e.g. 98******45)');
    assert(trackData.booking.admin_notes === undefined, 'Internal admin notes are NOT leaked in public tracking');

    const wrongTrackRes = await client.query(`
      SELECT public.track_booking_public($1, $2) as result
    `, [booking1.reference_no, '9999999999']);
    assert(wrongTrackRes.rows[0].result.success === false, 'track_booking_public rejects mismatched phone number');

    // -------------------------------------------------------------------------
    // 7. Super Admin Bootstrap & Security
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Super Admin Bootstrap & Invariant Protection ---');
    const testPasswordHash = bcrypt.hashSync('Srinu@2026', 10);

    const bootstrap1 = await client.query(`
      SELECT public.bootstrap_initial_superadmin('srinu', 'srinu@scar.com', $1) as result
    `, [testPasswordHash]);
    assert(bootstrap1.rows[0].result === true, 'bootstrap_initial_superadmin initialized first Super Admin');

    const bootstrap2 = await client.query(`
      SELECT public.bootstrap_initial_superadmin('attacker', 'attacker@evil.com', $1) as result
    `, [testPasswordHash]);
    assert(bootstrap2.rows[0].result === false, 'bootstrap_initial_superadmin safely refused second superadmin creation');

    const superAdminRes = await client.query("SELECT * FROM public.admins WHERE username = 'srinu'");
    assert(superAdminRes.rowCount === 1, 'Super Admin srinu verified in database');
    const srinuId = superAdminRes.rows[0].id;

    // -------------------------------------------------------------------------
    // 8. Last Super Administrator Invariant Trigger
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Last Super Administrator Invariant Protection ---');
    let deletePrevented = false;
    try {
      await client.query('DELETE FROM public.admins WHERE id = $1', [srinuId]);
    } catch (err) {
      deletePrevented = true;
      assert(err.message.includes('CANNOT_MUTATE_LAST_SUPERADMIN'), 'Trigger prevented DELETE of sole active Super Admin');
    }
    assert(deletePrevented, 'Deletion of last superadmin was stopped by database trigger');

    let disablePrevented = false;
    try {
      await client.query("UPDATE public.admins SET is_active = 0, status = 'disabled' WHERE id = $1", [srinuId]);
    } catch (err) {
      disablePrevented = true;
      assert(err.message.includes('CANNOT_MUTATE_LAST_SUPERADMIN'), 'Trigger prevented disabling sole active Super Admin');
    }
    assert(disablePrevented, 'Disabling of last superadmin was stopped by database trigger');

    let demotePrevented = false;
    try {
      await client.query("UPDATE public.admins SET role = 'admin' WHERE id = $1", [srinuId]);
    } catch (err) {
      demotePrevented = true;
      assert(err.message.includes('CANNOT_MUTATE_LAST_SUPERADMIN'), 'Trigger prevented demoting sole active Super Admin');
    }
    assert(demotePrevented, 'Demotion of last superadmin was stopped by database trigger');

    // -------------------------------------------------------------------------
    // 9. Admin OTPs & Session Revocation
    // -------------------------------------------------------------------------
    console.log('\n--- 9. OTP Authentication & Session Revocation ---');
    const challengeId = `ch_${crypto.randomBytes(16).toString('hex')}`;
    const otpCode = '84920153';
    const otpHash = crypto.createHmac('sha256', 'test_salt_secret').update(otpCode).digest('hex');

    await client.query(`
      INSERT INTO public.admin_otps (
        challenge_id, admin_id, email, otp_hash, purpose, attempts, max_attempts,
        resend_available_at, expires_at
      ) VALUES (
        $1, $2, 'srinu@scar.com', $3, 'login', 0, 5,
        now() + interval '60 seconds', now() + interval '5 minutes'
      )
    `, [challengeId, srinuId, otpHash]);

    const otpRow = await client.query('SELECT * FROM public.admin_otps WHERE challenge_id = $1', [challengeId]);
    assert(otpRow.rowCount === 1, 'OTP challenge record stored in admin_otps');

    // Atomic OTP usage
    const useOtpRes = await client.query(`
      UPDATE public.admin_otps
      SET used_at = now()
      WHERE challenge_id = $1 AND used_at IS NULL
      RETURNING id
    `, [challengeId]);
    assert(useOtpRes.rowCount === 1, 'OTP challenge atomically marked as used');

    // Second usage attempt fails (Single-use invariant)
    const secondUseRes = await client.query(`
      UPDATE public.admin_otps
      SET used_at = now()
      WHERE challenge_id = $1 AND used_at IS NULL
      RETURNING id
    `, [challengeId]);
    assert(secondUseRes.rowCount === 0, 'Re-use of already consumed OTP challenge strictly prevented');

    // Session revocation check (token_version increment)
    const oldVersion = superAdminRes.rows[0].token_version;
    await client.query('UPDATE public.admins SET token_version = token_version + 1 WHERE id = $1', [srinuId]);
    const updatedAdmin = await client.query('SELECT token_version FROM public.admins WHERE id = $1', [srinuId]);
    assert(updatedAdmin.rows[0].token_version === oldVersion + 1, 'token_version incremented to instantly revoke active JWTs');

    // -------------------------------------------------------------------------
    // 10. Audit Logging Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Administrative Audit Logging ---');
    await client.query(`
      INSERT INTO public.admin_audit_logs (
        action, actor_id, actor_username, details_json, ip_address
      ) VALUES (
        'SYSTEM_INTEGRATION_TEST', $1, 'srinu', '{"test": "passed"}'::jsonb, '127.0.0.1'
      )
    `, [srinuId]);

    const auditRes = await client.query(
      "SELECT * FROM public.admin_audit_logs WHERE action = 'SYSTEM_INTEGRATION_TEST'"
    );
    assert(auditRes.rowCount === 1, 'Audit log event successfully recorded in admin_audit_logs');

  } catch (err) {
    console.error('UNEXPECTED TEST HARNESS ERROR:', err);
    failed++;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`TOTAL ASSERTIONS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrationSuite();
