import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import dotenv from 'dotenv';
import { db, initDatabase } from './server/db.js';
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpHash,
  maskEmail,
  clearFailedLogin
} from './server/auth.js';
import {
  sendAdminLoginOtpEmail,
  getLastDispatchedOtpForTest,
  clearLastDispatchedOtpForTest,
  buildAdminLoginOtpEmailHtml,
  buildAdminLoginOtpEmailText
} from './server/email.js';
import adminRouter from './server/routes/admin.js';
import publicRouter from './server/routes/public.js';

dotenv.config();
process.env.NODE_ENV = 'test';
process.env.RESEND_MOCK = 'true';

async function runOtpSecurityTests() {
  console.log('====================================================');
  console.log('🔐 S CAR TRAVELS PREMIUM - ADMIN EMAIL & OTP AUTH AUDIT');
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

  // 1. Initialize DB and find registered admin
  initDatabase();
  const admin = db.prepare("SELECT * FROM admins WHERE username = 'srinu' LIMIT 1").get();
  if (!admin) {
    throw new Error('Test admin "srinu" not found in SQLite database');
  }

  const adminEmail = admin.email;
  console.log(`[Test Setup] Verified registered admin: id=${admin.id}, username=${admin.username}, email=${adminEmail}`);

  // 2. Start lightweight in-process Express server for HTTP tests
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api/public', publicRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Ephemeral test server active on ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Unit Test Cryptographic OTP Generation & Hashing
    // ----------------------------------------------------
    console.log('--- Test 1: Cryptographic OTP Utilities ---');
    const otp1 = generateOtpCode(8);
    const otp2 = generateOtpCode(8);
    assert(otp1.length === 8 && /^\d{8}$/.test(otp1), 'generateOtpCode produces exact 8-digit numeric string');
    assert(otp1 !== otp2, 'generateOtpCode produces distinct random codes');

    const hash1 = hashOtpCode(otp1);
    assert(typeof hash1 === 'string' && hash1.length === 64, 'hashOtpCode generates 64-character SHA-256 hash');
    assert(verifyOtpHash(otp1, hash1) === true, 'verifyOtpHash validates matching OTP timing-safely');
    assert(verifyOtpHash('00000000', hash1) === false, 'verifyOtpHash rejects incorrect OTP');
    assert(verifyOtpHash('', hash1) === false, 'verifyOtpHash rejects empty OTP');

    assert(maskEmail('srinucartravelsremium@gmail.com').startsWith('sri***@gmail.com'), 'maskEmail masks email correctly');

    // ----------------------------------------------------
    // TEST 2: Email Template Branding & Content
    // ----------------------------------------------------
    console.log('\n--- Test 2: Navy Blue & Gold OTP Email Template ---');
    const htmlTemplate = buildAdminLoginOtpEmailHtml({ adminName: 'Srinu', otp: '87654321', expiresMinutes: 5 });
    const textTemplate = buildAdminLoginOtpEmailText({ adminName: 'Srinu', otp: '87654321', expiresMinutes: 5 });

    assert(htmlTemplate.includes('87654321'), 'HTML email displays the 8-digit OTP code');
    assert(htmlTemplate.includes('#0b132b') || htmlTemplate.includes('#080f1e'), 'HTML email uses branded dark navy blue styling');
    assert(htmlTemplate.includes('#e5b83b'), 'HTML email uses branded champagne gold accent');
    assert(htmlTemplate.includes('5 minutes'), 'HTML email specifies 5-minute expiry alert');
    assert(textTemplate.includes('87654321') && textTemplate.includes('S CAR TRAVELS PREMIUM'), 'Plain text email includes code and brand signature');

    // ----------------------------------------------------
    // TEST 3: Step 1 - Correct Email & Password Sends OTP Without Issuing Session
    // ----------------------------------------------------
    console.log('\n--- Test 3: Step 1 Credential Verification & Session Isolation ---');
    clearLastDispatchedOtpForTest();

    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });

    const loginCookies = loginRes.headers.get('set-cookie') || '';
    const loginData = await loginRes.json();

    assert(loginRes.status === 200, 'Step 1 login returns HTTP 200');
    assert(loginData.step === 'otp_required', 'Step 1 response indicates step="otp_required"');
    assert(Boolean(loginData.challengeId && loginData.challengeId.startsWith('ch_')), 'Returns challengeId string');
    assert(Boolean(loginData.emailMasked), 'Returns masked admin email for user feedback');
    assert(loginData.token === undefined, 'CRITICAL: No admin JWT token issued at Step 1');
    assert(!loginCookies.includes('scar_admin_token='), 'CRITICAL: No scar_admin_token cookie set at Step 1');
    assert(!loginCookies.includes('scar_csrf_token='), 'CRITICAL: No scar_csrf_token cookie set at Step 1');

    // Verify OTP was dispatched to registered admin's email
    const dispatched = getLastDispatchedOtpForTest();
    assert(Boolean(dispatched), 'OTP email dispatcher was invoked');
    assert(dispatched?.email === adminEmail.toLowerCase(), 'OTP dispatched specifically to admin registered email');
    assert(dispatched?.otp && /^\d{8}$/.test(dispatched.otp), 'Dispatched OTP is an 8-digit code');

    // Verify SQLite stores ONLY the hash, never plaintext OTP
    const storedChallenge = db.prepare('SELECT * FROM admin_otps WHERE challenge_id = ?').get(loginData.challengeId);
    assert(Boolean(storedChallenge), 'Challenge saved to SQLite admin_otps table');
    assert(storedChallenge.otp_hash !== dispatched.otp, 'CRITICAL: SQLite does NOT store plaintext OTP');
    assert(storedChallenge.otp_hash === hashOtpCode(dispatched.otp), 'SQLite stores exact SHA-256 hash of OTP');
    assert(storedChallenge.attempts === 0, 'Initial attempt counter is 0');
    assert(storedChallenge.used_at === null, 'Initial used_at is NULL');

    // ----------------------------------------------------
    // TEST 4: Step 1 - Incorrect Credentials Rejection
    // ----------------------------------------------------
    console.log('\n--- Test 4: Incorrect Credentials Rejection ---');
    const badPassRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'WrongPassword999' })
    });
    const badPassData = await badPassRes.json();
    assert(badPassRes.status === 401, 'Wrong password returns HTTP 401');
    assert(badPassData.error === 'Invalid email or password', 'Generic error message prevents account enumeration');

    const badEmailRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_user@scar.com', password: 'SomePassword' })
    });
    const badEmailData = await badEmailRes.json();
    assert(badEmailRes.status === 401, 'Nonexistent email returns HTTP 401');
    assert(badEmailData.error === 'Invalid email or password', 'Generic error message for nonexistent email');

    // ----------------------------------------------------
    // TEST 5: Step 2 - Correct OTP Creates Valid Authenticated Session
    // ----------------------------------------------------
    console.log('\n--- Test 5: Step 2 OTP Verification & Session Issuance ---');
    const correctChallengeId = loginData.challengeId;
    const correctOtp = dispatched.otp;

    const verifyRes = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: correctChallengeId, otp: correctOtp })
    });

    const verifyCookies = verifyRes.headers.get('set-cookie') || '';
    const verifyData = await verifyRes.json();

    assert(verifyRes.status === 200, 'Correct OTP verification returns HTTP 200');
    assert(Boolean(verifyData.token && verifyData.token.length > 30), 'Returns valid signed JWT token');
    assert(verifyData.admin?.username === 'srinu', 'Returns authenticated admin details');
    assert(verifyCookies.includes('scar_admin_token='), 'Sets HttpOnly scar_admin_token cookie');
    assert(verifyCookies.includes('scar_csrf_token='), 'Sets scar_csrf_token cookie');

    // Verify challenge is marked used in SQLite
    const usedChallenge = db.prepare('SELECT used_at FROM admin_otps WHERE challenge_id = ?').get(correctChallengeId);
    assert(Boolean(usedChallenge.used_at), 'OTP challenge marked as used (used_at is set)');

    // ----------------------------------------------------
    // TEST 6: Single-Use Enforcement (Replay Attack Rejected)
    // ----------------------------------------------------
    console.log('\n--- Test 6: Single-Use OTP Enforcement ---');
    const replayRes = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: correctChallengeId, otp: correctOtp })
    });
    const replayData = await replayRes.json();
    assert(replayRes.status === 400, 'Re-using already verified OTP returns HTTP 400');
    assert(replayData.error.includes('already been used'), 'Replay returns already used error');

    // ----------------------------------------------------
    // TEST 7: Incorrect OTP Attempts & Lockout After 5 Failures
    // ----------------------------------------------------
    console.log('\n--- Test 7: Incorrect OTP Attempts & Lockout After 5 Attempts ---');
    clearFailedLogin('127.0.0.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    clearLastDispatchedOtpForTest();

    const freshLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const freshLoginData = await freshLoginRes.json();
    const freshChallengeId = freshLoginData.challengeId;
    const freshOtp = getLastDispatchedOtpForTest().otp;

    // Attempt 1 with wrong OTP
    const wrong1Res = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: freshChallengeId, otp: '11111111' })
    });
    const wrong1Data = await wrong1Res.json();
    assert(wrong1Res.status === 400, 'Wrong OTP attempt 1 returns HTTP 400');
    assert(wrong1Data.error.includes('4 attempts remaining'), 'Reports 4 attempts remaining');

    // Attempts 2, 3, 4
    for (let i = 2; i <= 4; i++) {
      await fetch(`${baseUrl}/api/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: freshChallengeId, otp: `1111111${i}` })
      });
    }

    // Attempt 5 (Maximum attempt reached -> challenge invalidated)
    const wrong5Res = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: freshChallengeId, otp: '99999999' })
    });
    const wrong5Data = await wrong5Res.json();
    assert(wrong5Res.status === 400, 'Wrong OTP attempt 5 returns HTTP 400');
    assert(wrong5Data.error.includes('Maximum attempts reached'), 'Error indicates maximum attempts reached');

    // Attempt 6 with CORRECT OTP should now fail because challenge is locked out
    const correctAfterLockoutRes = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: freshChallengeId, otp: freshOtp })
    });
    assert(correctAfterLockoutRes.status === 400, 'Correct OTP rejected after 5 failed attempts (lockout enforced)');

    // ----------------------------------------------------
    // TEST 8: Expired OTP Rejection
    // ----------------------------------------------------
    console.log('\n--- Test 8: Expired OTP Rejection ---');
    clearFailedLogin('127.0.0.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    clearLastDispatchedOtpForTest();

    const expLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const expLoginData = await expLoginRes.json();
    const expChallengeId = expLoginData.challengeId;
    const expOtp = getLastDispatchedOtpForTest().otp;

    // Simulate OTP expiry by winding expires_at back 10 minutes in SQLite
    db.prepare("UPDATE admin_otps SET expires_at = datetime('now', '-10 minutes') WHERE challenge_id = ?").run(expChallengeId);

    const expVerifyRes = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: expChallengeId, otp: expOtp })
    });
    const expVerifyData = await expVerifyRes.json();
    assert(expVerifyRes.status === 400, 'Expired OTP rejected with HTTP 400');
    assert(expVerifyData.error.includes('expired'), 'Error message states verification code has expired');

    // ----------------------------------------------------
    // TEST 9: Resend OTP Cooldown (60 Seconds)
    // ----------------------------------------------------
    console.log('\n--- Test 9: Resend OTP Cooldown ---');
    clearFailedLogin('127.0.0.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    clearLastDispatchedOtpForTest();

    const resendTestLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const resendTestData = await resendTestLogin.json();
    const resendChallengeId = resendTestData.challengeId;

    // Immediate resend should trigger cooldown 429
    const immediateResendRes = await fetch(`${baseUrl}/api/admin/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: resendChallengeId })
    });
    const immediateResendData = await immediateResendRes.json();
    assert(immediateResendRes.status === 429, 'Resend within 60s cooldown rejected with HTTP 429');
    assert(immediateResendData.error.includes('Please wait'), 'Reports cooldown seconds remaining');

    // Fast-forward cooldown by updating resend_available_at in SQLite
    db.prepare("UPDATE admin_otps SET resend_available_at = datetime('now', '-5 seconds') WHERE challenge_id = ?").run(resendChallengeId);

    // Resend after cooldown expires
    const allowedResendRes = await fetch(`${baseUrl}/api/admin/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: resendChallengeId })
    });
    const allowedResendData = await allowedResendRes.json();
    assert(allowedResendRes.status === 200, 'Resend after cooldown succeeds with HTTP 200');
    assert(Boolean(allowedResendData.challengeId), 'Returns fresh challengeId');
    assert(allowedResendData.challengeId !== resendChallengeId, 'Issues new challengeId on resend');

    // Verify old challenge was invalidated
    const oldChRow = db.prepare('SELECT used_at FROM admin_otps WHERE challenge_id = ?').get(resendChallengeId);
    assert(Boolean(oldChRow.used_at), 'Previous challenge invalidated when new OTP is resent');

    // ----------------------------------------------------
    // TEST 9b: Hourly Limit Per Account (5 Requests Per Hour)
    // ----------------------------------------------------
    console.log('\n--- Test 9b: Hourly Account Rate Limit Enforcement ---');
    clearFailedLogin('127.0.0.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    // Insert 5 challenges in the past 10 minutes to reach limit
    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO admin_otps (
          challenge_id, admin_id, email, otp_hash, purpose, attempts, max_attempts,
          resend_available_at, expires_at, created_at
        ) VALUES (
          ?, ?, ?, 'dummyhash', 'login', 0, 5,
          datetime('now', '+60 seconds'), datetime('now', '+5 minutes'), datetime('now')
        )
      `).run(`ch_hourly_dummy_${i}`, admin.id, adminEmail);
    }

    const hourlyOverLimitRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const hourlyOverLimitData = await hourlyOverLimitRes.json();
    assert(hourlyOverLimitRes.status === 429, '6th OTP request in 1 hour returns HTTP 429');
    assert(hourlyOverLimitData.error.includes('Too many verification code requests'), 'Reports hourly request rate limit reached');

    // Clean up dummy hourly records for clean subsequent tests
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    // ----------------------------------------------------
    // TEST 10: Email Delivery Failure Safety
    // ----------------------------------------------------
    console.log('\n--- Test 10: Email Delivery Failure Safety ---');
    // Mock delivery failure client
    const failingMockClient = {
      emails: {
        send: async () => ({ data: null, error: { message: 'Resend API Network Timeout' } })
      }
    };
    const deliveryFailureResult = await sendAdminLoginOtpEmail({
      email: 'test@scar.com',
      adminName: 'Srinu',
      otp: '12345678'
    }, failingMockClient);

    assert(deliveryFailureResult.success === false, 'sendAdminLoginOtpEmail returns success: false on provider error');
    assert(deliveryFailureResult.error.includes('Resend API Network Timeout'), 'Returns delivery error description safely');

    // ----------------------------------------------------
    // TEST 11: Protected Admin Routes Without Completed OTP
    // ----------------------------------------------------
    console.log('\n--- Test 11: Protected Admin Route Enforcement ---');
    const unauthMetricsRes = await fetch(`${baseUrl}/api/admin/metrics`);
    assert(unauthMetricsRes.status === 401, 'GET /api/admin/metrics rejects unauthenticated access with HTTP 401');

    const unauthMeRes = await fetch(`${baseUrl}/api/admin/me`);
    assert(unauthMeRes.status === 401, 'GET /api/admin/me rejects unauthenticated access with HTTP 401');

    // Access with completed OTP token succeeds
    const authMeRes = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { Authorization: `Bearer ${verifyData.token}` }
    });
    assert(authMeRes.status === 200, 'GET /api/admin/me allows access with valid OTP-verified session');

    // ----------------------------------------------------
    // TEST 12: Admin Logout Session Termination
    // ----------------------------------------------------
    console.log('\n--- Test 12: Admin Logout Session Termination ---');
    const logoutRes = await fetch(`${baseUrl}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    const logoutCookies = logoutRes.headers.get('set-cookie') || '';
    assert(logoutRes.status === 200, 'POST /api/admin/logout returns HTTP 200');
    assert(logoutCookies.includes('scar_admin_token=;'), 'Logout clears scar_admin_token cookie');
    assert(logoutCookies.includes('scar_csrf_token=;'), 'Logout clears scar_csrf_token cookie');

    // ----------------------------------------------------
    // TEST 13: Concurrency Race Condition Security Audit (Atomic Single-Use)
    // ----------------------------------------------------
    console.log('\n--- Test 13: Concurrency Race Condition & Atomicity Audit ---');
    clearFailedLogin('127.0.0.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    clearLastDispatchedOtpForTest();

    // 1. Race condition on correct OTP verification: 10 concurrent requests
    const concurrentLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const concurrentLoginData = await concurrentLoginRes.json();
    const concurrentChallengeId = concurrentLoginData.challengeId;
    const concurrentOtp = getLastDispatchedOtpForTest().otp;

    // Send 10 simultaneous verification requests with the SAME correct OTP
    const concurrentResults = await Promise.all(
      Array.from({ length: 10 }).map((_, idx) =>
        fetch(`${baseUrl}/api/admin/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `10.0.0.${idx + 1}`
          },
          body: JSON.stringify({ challengeId: concurrentChallengeId, otp: concurrentOtp })
        }).then(async (r) => ({ status: r.status, data: await r.json() }))
      )
    );

    const successfulAttempts = concurrentResults.filter((r) => r.status === 200);
    const rejectedAttempts = concurrentResults.filter((r) => r.status === 400);

    assert(successfulAttempts.length === 1, `Exactly ONE concurrent request receives HTTP 200 (actual: ${successfulAttempts.length})`);
    assert(rejectedAttempts.length === 9, `All other 9 concurrent requests receive HTTP 400 (actual: ${rejectedAttempts.length})`);
    assert(Boolean(successfulAttempts[0].data.token), 'The winning concurrent request received the valid session token');

    // 2. Race condition on incorrect OTP: 10 concurrent wrong requests
    clearFailedLogin('127.0.0.1');
    clearFailedLogin('10.0.1.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    clearLastDispatchedOtpForTest();

    const wrongRaceLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.1.1'
      },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const wrongRaceLoginData = await wrongRaceLoginRes.json();
    const wrongRaceChallengeId = wrongRaceLoginData.challengeId;

    await Promise.all(
      Array.from({ length: 10 }).map((_, idx) =>
        fetch(`${baseUrl}/api/admin/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `10.0.1.${idx + 2}`
          },
          body: JSON.stringify({ challengeId: wrongRaceChallengeId, otp: '00000000' })
        })
      )
    );

    const lockedChallenge = db.prepare('SELECT attempts, max_attempts, used_at FROM admin_otps WHERE challenge_id = ?').get(wrongRaceChallengeId);
    assert(lockedChallenge?.attempts === 5, `Atomically capped at max attempts of 5 (actual: ${lockedChallenge?.attempts})`);
    assert(Boolean(lockedChallenge?.used_at), 'Challenge atomically locked out (used_at is set)');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Server] Ephemeral test server closed.');
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOtpSecurityTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
