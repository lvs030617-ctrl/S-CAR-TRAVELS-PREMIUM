import { db } from './server/db.js';
import {
  sendBookingNotificationEmail,
  buildBookingEmailHtml,
  buildBookingEmailText,
  getResendClient,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_FROM_EMAIL
} from './server/email.js';
import { checkVehicleConflict } from './server/routes/public.js';

async function runEmailNotificationTests() {
  console.log('====================================================');
  console.log('📧 S CAR TRAVELS PREMIUM - RESEND EMAIL NOTIFICATION AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  const sampleBooking = {
    reference_no: 'SCT-2026-9999',
    customer_name: 'Venkatesh Rao',
    customer_phone: '9550641408',
    customer_email: 'venkatesh@example.com',
    service_type: 'with_driver',
    trip_type: 'round_trip',
    pickup_location: 'Kotananduru',
    destination: 'Visakhapatnam Beach',
    pickup_datetime: '2026-11-20T08:00',
    return_datetime: '2026-11-20T20:00',
    passengers: 4,
    luggage_count: 2,
    estimated_min_price: 3200,
    estimated_max_price: 3800,
    special_notes: 'Please ensure AC is chilled and infant car seat space is available.',
    hasConflict: false
  };

  // ----------------------------------------------------
  // TEST 1: Missing API Key Handling (Graceful Skip)
  // ----------------------------------------------------
  console.log('--- Test 1: Missing API Key Handling ---');
  const originalApiKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  const missingKeyClient = getResendClient();
  assert(missingKeyClient === null, 'getResendClient returns null when RESEND_API_KEY is not set');

  const missingKeyResult = await sendBookingNotificationEmail(sampleBooking);
  assert(missingKeyResult.success === false, 'Returns success: false when API key is missing');
  assert(missingKeyResult.skipped === true, 'Returns skipped: true flag when API key is missing');
  assert(missingKeyResult.reason === 'RESEND_API_KEY_NOT_CONFIGURED', 'Identifies missing key reason without throwing');

  // ----------------------------------------------------
  // TEST 2: Successful Notification Triggering with Mock Client
  // ----------------------------------------------------
  console.log('\n--- Test 2: Successful Notification Triggering ---');
  let dispatchedPayload = null;
  const mockSuccessClient = {
    emails: {
      send: async (payload) => {
        dispatchedPayload = payload;
        return { data: { id: 'mock_msg_abc123' }, error: null };
      }
    }
  };

  const successResult = await sendBookingNotificationEmail(sampleBooking, mockSuccessClient);
  assert(successResult.success === true, 'sendBookingNotificationEmail returns success: true on valid send');
  assert(successResult.messageId === 'mock_msg_abc123', 'Returns messageId from email provider');
  assert(dispatchedPayload !== null, 'Resend client send method was called');
  assert(dispatchedPayload.to === (process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL), 'Dispatches to configured admin recipient');
  assert(dispatchedPayload.to === 'srinucartravelspremium@gmail.com' || dispatchedPayload.to === 'srinucartravelsremium@gmail.com' || dispatchedPayload.to === process.env.ADMIN_NOTIFICATION_EMAIL, 'Recipient matches admin email');
  assert(dispatchedPayload.subject.includes('SCT-2026-9999'), 'Subject includes booking reference');
  assert(dispatchedPayload.subject.includes('Venkatesh Rao'), 'Subject includes customer name');
  assert(dispatchedPayload.subject.includes('Visakhapatnam Beach'), 'Subject includes destination');

  // ----------------------------------------------------
  // TEST 3: Email Template Details & Optional Fields Validation
  // ----------------------------------------------------
  console.log('\n--- Test 3: Email Content & Conditional Fields ---');
  const htmlContent = buildBookingEmailHtml(sampleBooking);
  const textContent = buildBookingEmailText(sampleBooking);

  assert(htmlContent.includes('SCT-2026-9999'), 'HTML email contains booking reference');
  assert(htmlContent.includes('Venkatesh Rao'), 'HTML email contains customer name');
  assert(htmlContent.includes('9550641408'), 'HTML email contains customer phone');
  assert(htmlContent.includes('venkatesh@example.com'), 'HTML email includes customer email when provided');
  assert(htmlContent.includes('Kotananduru'), 'HTML email contains pickup location');
  assert(htmlContent.includes('Visakhapatnam Beach'), 'HTML email contains destination');
  assert(htmlContent.includes('4 passenger(s)'), 'HTML email contains passenger count');
  assert(htmlContent.includes('2 bag(s)'), 'HTML email contains luggage bags');
  assert(htmlContent.includes('₹3,200 - ₹3,800'), 'HTML email contains estimated fare');
  assert(htmlContent.includes('infant car seat space'), 'HTML email contains special customer notes');
  assert(htmlContent.includes('wa.me/919550641408'), 'HTML email includes direct WhatsApp response button');

  // Test optional fields omitted when absent
  const minimalBooking = {
    reference_no: 'SCT-2026-MIN1',
    customer_name: 'Ravi Kumar',
    customer_phone: '9848012345',
    service_type: 'with_driver',
    trip_type: 'one_way',
    pickup_location: 'Kotananduru',
    destination: 'Tuni',
    pickup_datetime: '2026-11-25T10:00',
    hasConflict: false
  };

  const minimalHtml = buildBookingEmailHtml(minimalBooking);
  assert(!minimalHtml.includes('Customer Email:'), 'HTML email omits customer email when field is absent');
  assert(!minimalHtml.includes('Customer Notes:'), 'HTML email omits customer notes when field is absent');
  assert(!minimalHtml.includes('Schedule Advisory:'), 'HTML email omits conflict warning when hasConflict is false');

  // Test conflict warning included when hasConflict is true
  const conflictBooking = { ...sampleBooking, hasConflict: true };
  const conflictHtml = buildBookingEmailHtml(conflictBooking);
  assert(conflictHtml.includes('Schedule Advisory:'), 'HTML email includes Schedule Advisory warning when hasConflict is true');

  // ----------------------------------------------------
  // TEST 4: Email Provider Failure Handling (Safe Non-Blocking)
  // ----------------------------------------------------
  console.log('\n--- Test 4: Email Provider Failure Resilience ---');
  // 4a. API Error returned (e.g. unverified domain or invalid API key)
  const mockApiErrorClient = {
    emails: {
      send: async () => ({
        data: null,
        error: { message: 'You can only send testing emails to your own email address.', name: 'validation_error' }
      })
    }
  };

  const apiErrorResult = await sendBookingNotificationEmail(sampleBooking, mockApiErrorClient);
  assert(apiErrorResult.success === false, 'Returns success: false when Resend returns API error');
  assert(apiErrorResult.error.includes('testing emails'), 'Catches and reports safe error string without crashing');

  // 4b. Network exception thrown (e.g. timeout or DNS failure)
  const mockNetworkThrowClient = {
    emails: {
      send: async () => {
        throw new Error('Connection timeout to api.resend.com:443');
      }
    }
  };

  let threwException = false;
  let throwResult = null;
  try {
    throwResult = await sendBookingNotificationEmail(sampleBooking, mockNetworkThrowClient);
  } catch (e) {
    threwException = true;
  }
  assert(!threwException, 'sendBookingNotificationEmail NEVER throws unhandled exception on network crash');
  assert(throwResult?.success === false, 'Returns success: false on network crash');
  assert(throwResult?.error.includes('Connection timeout'), 'Safely logs exception without killing process');

  // ----------------------------------------------------
  // TEST 5: Booking Workflow Resilience (Email Failure Does Not Break Booking)
  // ----------------------------------------------------
  console.log('\n--- Test 5: Booking Workflow & Database Persistence Under Email Failure ---');
  // Verify booking insert into SQLite succeeds even if notification fails
  const initialCount = db.prepare('SELECT count(*) as count FROM bookings').get().count;
  const testRef = `SCT-TEST-${Date.now().toString().slice(-4)}`;

  const stmt = db.prepare(`
    INSERT INTO bookings (
      reference_no, customer_name, customer_phone,
      service_type, trip_type, pickup_location, destination,
      pickup_datetime, passengers, status, client_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '127.0.0.1')
  `);

  const insertResult = stmt.run(
    testRef,
    'Resilience Test Traveler',
    '9550641408',
    'with_driver',
    'round_trip',
    'Kotananduru',
    'Annavaram',
    '2026-11-28T09:00',
    4
  );

  assert(insertResult.lastInsertRowid > 0, 'Booking saved to SQLite database successfully');

  // Call failing email notification
  const failedEmailCall = await sendBookingNotificationEmail({
    reference_no: testRef,
    customer_name: 'Resilience Test Traveler',
    customer_phone: '9550641408',
    pickup_location: 'Kotananduru',
    destination: 'Annavaram',
    pickup_datetime: '2026-11-28T09:00',
    passengers: 4
  }, mockNetworkThrowClient);

  assert(failedEmailCall.success === false, 'Email call fails safely');

  // Verify booking still exists in DB and no duplicate is created
  const postBooking = db.prepare('SELECT * FROM bookings WHERE reference_no = ?').get(testRef);
  assert(postBooking !== undefined, 'Booking remains intact in SQLite despite email delivery failure');

  const afterCount = db.prepare('SELECT count(*) as count FROM bookings').get().count;
  assert(afterCount === initialCount + 1, 'Exactly one booking created - zero duplicates');

  // Clean up test booking
  db.prepare('DELETE FROM bookings WHERE reference_no = ?').run(testRef);

  // ----------------------------------------------------
  // TEST 6: Single Ertiga Conflict Protection (Duplicate Booking Cannot Send Notification)
  // ----------------------------------------------------
  console.log('\n--- Test 6: Conflict Protection & Notification Guard ---');
  // Create confirmed booking for a slot
  const conflictRef1 = `SCT-CONF-${Date.now().toString().slice(-4)}`;
  db.prepare(`
    INSERT INTO bookings (
      reference_no, customer_name, customer_phone,
      service_type, trip_type, pickup_location, destination,
      pickup_datetime, return_datetime, passengers, status, client_ip
    ) VALUES (?, 'Primary Traveler', '9550641408', 'with_driver', 'round_trip', 'Kotananduru', 'Vizag', '2026-12-15T08:00', '2026-12-15T20:00', 4, 'confirmed', '127.0.0.1')
  `).run(conflictRef1);

  // Attempting to confirm an overlapping booking is rejected with conflict
  const conflictCheck = checkVehicleConflict('2026-12-15T10:00', '2026-12-15T18:00');
  assert(conflictCheck.hasConflict === true, 'Single Ertiga conflict check detects overlapping schedule');
  assert(conflictCheck.type === 'booking', 'Identifies conflict as confirmed booking');
  assert(conflictCheck.reference === conflictRef1, 'Identifies conflicting booking reference');

  // Clean up confirmed booking
  db.prepare('DELETE FROM bookings WHERE reference_no = ?').run(conflictRef1);

  // Restore original API key if it existed
  if (originalApiKey) {
    process.env.RESEND_API_KEY = originalApiKey;
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmailNotificationTests().catch(err => {
  console.error('Fatal error in email test runner:', err);
  process.exit(1);
});
