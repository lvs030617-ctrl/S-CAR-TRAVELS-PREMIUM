import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import { db, initDatabase } from './server/db.js';
import { clearFailedLogin } from './server/auth.js';
import { getLastDispatchedOtpForTest, clearLastDispatchedOtpForTest } from './server/email.js';
import publicRouter from './server/routes/public.js';
import adminRouter from './server/routes/admin.js';

dotenv.config();
process.env.NODE_ENV = 'test';
process.env.RESEND_MOCK = 'true';

let BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'scar_premium_kotananduru_super_secure_jwt_secret_key_2026_production_min64chars';

async function runAuthSecurityTests() {
  console.log('====================================================');
  console.log('🔒 S CAR TRAVELS PREMIUM - AUTHENTICATION AUDIT TEST');
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

  // Check if an external server is already running on BASE_URL
  let server = null;
  try {
    const ping = await fetch(`${BASE_URL}/api/health`);
    if (!ping.ok) throw new Error('Not running');
  } catch (e) {
    initDatabase();
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/public', publicRouter);
    app.use('/api/admin', adminRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    BASE_URL = `http://127.0.0.1:${server.address().port}`;
    console.log(`[Test Server] Started ephemeral server on ${BASE_URL}\n`);
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Correct admin credentials initiate OTP verification without session
    // ----------------------------------------------------
    console.log('--- Test 1: Two-Step Admin Login & OTP Verification ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedOtpForTest();

    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'srinu', password: 'Srinu@2026' })
    });

    const step1Cookies = loginRes.headers.get('set-cookie') || '';
    const loginData = await loginRes.json();

    assert(loginRes.status === 200, 'Step 1 login returns HTTP 200');
    assert(loginData.step === 'otp_required', 'Step 1 response indicates step="otp_required"');
    assert(Boolean(loginData.challengeId), 'Step 1 provides challengeId');
    assert(loginData.token === undefined, 'CRITICAL: No JWT issued at password verification stage');
    assert(!step1Cookies.includes('scar_admin_token='), 'CRITICAL: No scar_admin_token session cookie set at Step 1');

    // Complete Step 2 with dispatched OTP
    const dispatched = getLastDispatchedOtpForTest();
    assert(Boolean(dispatched?.otp), 'OTP was dispatched to admin registered email');

    const verifyRes = await fetch(`${BASE_URL}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: loginData.challengeId, otp: dispatched?.otp })
    });

    const step2Cookies = verifyRes.headers.get('set-cookie') || '';
    const verifyData = await verifyRes.json();

    assert(verifyRes.status === 200, 'Step 2 OTP verification returns HTTP 200');
    assert(Boolean(verifyData.token && verifyData.token.length > 30), 'Step 2 returns valid JWT token string');
    assert(verifyData.admin?.role === 'superadmin', 'Admin role is superadmin');
    assert(step2Cookies.includes('scar_admin_token='), 'Sets HttpOnly scar_admin_token cookie');
    assert(step2Cookies.includes('HttpOnly'), 'scar_admin_token has HttpOnly flag');
    assert(step2Cookies.includes('scar_csrf_token='), 'Sets scar_csrf_token cookie');

    const validToken = verifyData.token;

    // ----------------------------------------------------
    // TEST 2: Incorrect credentials rejected
    // ----------------------------------------------------
    console.log('\n--- Test 2: Incorrect Credentials & Rate Limiting ---');
    clearFailedLogin('127.0.0.1');

    const wrongPassRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'srinu', password: 'WrongPassword999' })
    });
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassRes.status === 401, 'Wrong password returns HTTP 401');
    assert(wrongPassData.error === 'Invalid email or password', 'Generic error returned for wrong password');

    const wrongUserRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_hacker', password: 'SomePassword' })
    });
    const wrongUserData = await wrongUserRes.json();
    assert(wrongUserRes.status === 401, 'Wrong username returns HTTP 401');
    assert(wrongUserData.error === 'Invalid email or password', 'Generic error returned for wrong username');

    // ----------------------------------------------------
    // TEST 3: Unauthenticated request to protected APIs rejected
    // ----------------------------------------------------
    console.log('\n--- Test 3: Unauthenticated Access To Admin Endpoints ---');
    const protectedEndpoints = [
      { method: 'GET', path: '/api/admin/me' },
      { method: 'GET', path: '/api/admin/metrics' },
      { method: 'GET', path: '/api/admin/bookings' },
      { method: 'GET', path: '/api/admin/bookings/1' },
      { method: 'PATCH', path: '/api/admin/bookings/1/status', body: { status: 'confirmed' } },
      { method: 'GET', path: '/api/admin/pricing' },
      { method: 'PUT', path: '/api/admin/pricing/1', body: { min_price: 1000 } },
      { method: 'GET', path: '/api/admin/destinations' },
      { method: 'POST', path: '/api/admin/destinations', body: { name_en: 'Test' } },
      { method: 'GET', path: '/api/admin/vehicle' },
      { method: 'PUT', path: '/api/admin/vehicle', body: { color: 'White' } },
      { method: 'GET', path: '/api/admin/blocked-dates' },
      { method: 'POST', path: '/api/admin/blocked-dates', body: { reason: 'Test' } },
      { method: 'GET', path: '/api/admin/settings' },
      { method: 'PUT', path: '/api/admin/settings', body: { settings: {} } }
    ];

    let allProtectedRejected = true;
    for (const ep of protectedEndpoints) {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      if (res.status !== 401) {
        allProtectedRejected = false;
        console.error(`Endpoint ${ep.method} ${ep.path} allowed unauthenticated access! Status: ${res.status}`);
      }
    }
    assert(allProtectedRejected, 'All 15 administrative endpoints reject unauthenticated access with 401');

    // ----------------------------------------------------
    // TEST 4: Invalid, tampered, or expired JWT rejected
    // ----------------------------------------------------
    console.log('\n--- Test 4: Tampered and Expired Token Rejection ---');
    const tamperedToken = validToken.substring(0, validToken.length - 6) + 'xxxxxx';
    const tamperedRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    assert(tamperedRes.status === 401, 'Tampered JWT rejected with HTTP 401');

    // Expired token
    const expiredToken = jwt.sign(
      { id: 1, username: 'srinu', role: 'admin' },
      JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '-5s',
        issuer: 'scar-travels-premium',
        audience: 'scar-admin-console'
      }
    );
    const expiredRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    const expiredData = await expiredRes.json();
    assert(expiredRes.status === 401, 'Expired token rejected with HTTP 401');
    assert(expiredData.code === 'TOKEN_EXPIRED', 'Expired token returns TOKEN_EXPIRED error code');

    // Wrong secret token
    const wrongSecretToken = jwt.sign(
      { id: 1, username: 'srinu', role: 'admin' },
      'completely_wrong_secret_key_12345678901234567890',
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: 'scar-travels-premium',
        audience: 'scar-admin-console'
      }
    );
    const wrongSecretRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${wrongSecretToken}` }
    });
    assert(wrongSecretRes.status === 401, 'Wrong secret token rejected with HTTP 401');

    // ----------------------------------------------------
    // TEST 5: Non-admin user cannot perform admin operations
    // ----------------------------------------------------
    console.log('\n--- Test 5: Role Authorization (Non-Admin Blocked) ---');
    const customerToken = jwt.sign(
      { id: 999, username: 'regular_customer', role: 'customer' },
      JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: 'scar-travels-premium',
        audience: 'scar-admin-console'
      }
    );
    const customerRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const customerData = await customerRes.json();
    assert(customerRes.status === 403, 'Customer role rejected with HTTP 403 Forbidden');
    assert(customerData.code === 'ROLE_FORBIDDEN', 'Returns ROLE_FORBIDDEN error code');

    // ----------------------------------------------------
    // TEST 6: Direct access without login does not expose protected data
    // ----------------------------------------------------
    console.log('\n--- Test 6: Direct Data Exposure Protection ---');
    const directBookings = await fetch(`${BASE_URL}/api/admin/bookings`);
    assert(directBookings.status === 401, 'Bookings list completely protected from unauthenticated access');

    // Public tracking requires both reference number and registered phone
    const missingPhoneTrack = await fetch(`${BASE_URL}/api/public/bookings/track?reference_no=SCT-2026-7959`);
    assert(missingPhoneTrack.status === 400, 'Tracking without phone rejected with HTTP 400');

    const wrongPhoneTrack = await fetch(`${BASE_URL}/api/public/bookings/track?reference_no=SCT-2026-7959&phone=9999999999`);
    assert(wrongPhoneTrack.status === 404, 'Tracking with mismatched phone rejected with HTTP 404');

    const publicTrack = await fetch(`${BASE_URL}/api/public/bookings/track?reference_no=SCT-2026-7959&phone=9550641408`);
    const trackData = await publicTrack.json();
    assert(publicTrack.status === 200, 'Public tracking route works with valid reference + phone');
    assert(trackData.booking?.admin_notes === undefined, 'Internal admin_notes stripped from public tracking response');
    assert(trackData.booking?.customer_phone.includes('******'), 'Customer phone number safely masked in public response');

    // ----------------------------------------------------
    // TEST 7: Public customer booking still works
    // ----------------------------------------------------
    console.log('\n--- Test 7: Public Booking Workflow ---');
    const bookingSubmission = await fetch(`${BASE_URL}/api/public/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Auth Verification Traveler',
        customer_phone: '9550641408',
        service_type: 'with_driver',
        trip_type: 'round_trip',
        pickup_location: 'Kotananduru Bus Stand',
        destination: 'Visakhapatnam Beach',
        pickup_datetime: '2026-11-25T07:00',
        return_datetime: '2026-11-25T20:00',
        passengers: 4
      })
    });
    const bookingResult = await bookingSubmission.json();
    assert(bookingSubmission.status === 201, 'Public booking inquiry saves with HTTP 201');
    assert(Boolean(bookingResult.reference_no), `Booking reference generated: ${bookingResult.reference_no}`);
    assert(bookingResult.whatsapp_url.includes('919550641408'), 'WhatsApp booking link contains correct phone number');

    // ----------------------------------------------------
    // TEST 8: Authorized admin operations work
    // ----------------------------------------------------
    console.log('\n--- Test 8: Authorized Admin Operations ---');
    const metricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const metricsData = await metricsRes.json();
    assert(metricsRes.status === 200, 'Authorized admin can fetch metrics');
    assert(metricsData.supabaseStatus?.connected === true, 'Supabase status confirmed connected in admin metrics');

    const pricingRes = await fetch(`${BASE_URL}/api/admin/pricing`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    assert(pricingRes.status === 200, 'Authorized admin can fetch pricing rules');

    // ----------------------------------------------------
    // TEST 9: Logout prevents further access
    // ----------------------------------------------------
    console.log('\n--- Test 9: Logout & Session Invalidation ---');
    const logoutRes = await fetch(`${BASE_URL}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    const logoutCookies = logoutRes.headers.get('set-cookie') || '';
    assert(logoutRes.status === 200, 'Logout returns HTTP 200');
    assert(logoutCookies.includes('scar_admin_token=;'), 'Logout clears scar_admin_token cookie');

    // ----------------------------------------------------
    // TEST 10: Production config does not expose secrets
    // ----------------------------------------------------
    console.log('\n--- Test 10: Secret Leakage Audit ---');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthText = await healthRes.text();
    assert(!healthText.includes('JWT_SECRET') && !healthText.includes('service_role'), 'Health endpoint does not leak secrets');

    const configRes = await fetch(`${BASE_URL}/api/public/config`);
    const configText = await configRes.text();
    assert(!configText.includes('JWT_SECRET') && !configText.includes('service_role'), 'Public config endpoint does not leak secret keys');

    // ----------------------------------------------------
    // TEST 11: Regression Test - Frontend Source & Public Endpoints Zero Default Credential Disclosure
    // ----------------------------------------------------
    console.log('\n--- Test 11: Zero Default Credential Disclosure Regression ---');
    const loginSrc = fs.readFileSync('./src/pages/admin/Login.jsx', 'utf-8');
    const modalSrc = fs.readFileSync('./src/components/AdminLoginModal.jsx', 'utf-8');

    assert(!loginSrc.includes('Srinu@2026'), 'src/pages/admin/Login.jsx has no hardcoded default password');
    assert(!loginSrc.includes("useState('srinu')"), 'src/pages/admin/Login.jsx does not pre-fill username');
    assert(!loginSrc.includes('Initial Default Credentials'), 'src/pages/admin/Login.jsx has no credential reminder box');

    assert(!modalSrc.includes('Srinu@2026'), 'src/components/AdminLoginModal.jsx has no hardcoded default password');
    assert(!modalSrc.includes("useState('srinu')"), 'src/components/AdminLoginModal.jsx does not pre-fill username');
    assert(!modalSrc.includes('Default credentials:'), 'src/components/AdminLoginModal.jsx has no credential reminder box');

    // Verify public endpoint config does not leak admin credentials
    const publicConfig = await fetch(`${BASE_URL}/api/public/config`);
    const configJson = await publicConfig.json();
    const configString = JSON.stringify(configJson);
    assert(!configString.includes('password') && !configString.includes('Srinu@2026'), 'Public config does not disclose credentials');

    // ----------------------------------------------------
    // TEST 12: Admin Change Password Endpoint Security
    // ----------------------------------------------------
    console.log('\n--- Test 12: Admin Password Change Security ---');
    clearFailedLogin('127.0.0.1');

    // 1. Unauthenticated request rejected
    const unauthChange = await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'Srinu@2026', newPassword: 'NewStrongPassword2026!' })
    });
    assert(unauthChange.status === 401, 'Unauthenticated change-password request rejected with HTTP 401');

    // 2. Short password rejected
    const shortPassRes = await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`
      },
      body: JSON.stringify({ currentPassword: 'Srinu@2026', newPassword: 'short' })
    });
    assert(shortPassRes.status === 400, 'Password shorter than 8 characters rejected with HTTP 400');

    // 3. Incorrect current password rejected
    const badCurrentRes = await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`
      },
      body: JSON.stringify({ currentPassword: 'IncorrectOldPassword123', newPassword: 'NewStrongPassword2026!' })
    });
    assert(badCurrentRes.status === 401, 'Incorrect current password rejected with HTTP 401');

    // 4. Valid password change succeeds
    const validChangeRes = await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`
      },
      body: JSON.stringify({ currentPassword: 'Srinu@2026', newPassword: 'UpdatedSecretPassword2026#' })
    });
    assert(validChangeRes.status === 200, 'Valid password change succeeds with HTTP 200');

    // 5. Verify new password works and old password fails
    const loginWithOld = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'srinu', password: 'Srinu@2026' })
    });
    assert(loginWithOld.status === 401, 'Old password no longer valid after change');

    clearFailedLogin('127.0.0.1');
    clearLastDispatchedOtpForTest();
    // Clean up OTPs to avoid hourly limit
    db.prepare("DELETE FROM admin_otps WHERE admin_id = 1").run();

    const loginWithNew = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'srinu', password: 'UpdatedSecretPassword2026#' })
    });
    const newLoginData = await loginWithNew.json();
    assert(loginWithNew.status === 200, 'New password successfully initiates Step 1 login');
    assert(newLoginData.step === 'otp_required', 'New password triggers OTP challenge');

    const newDispatched = getLastDispatchedOtpForTest();
    const newVerifyRes = await fetch(`${BASE_URL}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: newLoginData.challengeId,
        otp: newDispatched?.otp
      })
    });
    const newVerifyData = await newVerifyRes.json();
    assert(newVerifyRes.status === 200, 'New password OTP verification succeeds');

    // Reset back to test baseline so future test runs are idempotent
    await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newVerifyData.token}`
      },
      body: JSON.stringify({ currentPassword: 'UpdatedSecretPassword2026#', newPassword: 'Srinu@2026' })
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthSecurityTests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
