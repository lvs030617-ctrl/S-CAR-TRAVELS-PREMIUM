import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db, initDatabase } from './server/db.js';
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpHash,
  maskEmail,
  signAdminToken,
  clearFailedLogin
} from './server/auth.js';
import {
  sendAdminPasswordResetOtpEmail,
  sendAdminPasswordChangedEmail,
  getLastDispatchedResetOtpForTest,
  clearLastDispatchedResetOtpForTest,
  getLastDispatchedPasswordChangedForTest,
  clearLastDispatchedPasswordChangedForTest,
  getLastDispatchedOtpForTest,
  clearLastDispatchedOtpForTest,
  buildAdminPasswordResetOtpEmailHtml,
  buildAdminPasswordResetOtpEmailText,
  buildAdminPasswordChangedEmailHtml,
  buildAdminPasswordChangedEmailText
} from './server/email.js';
import adminRouter from './server/routes/admin.js';
import publicRouter from './server/routes/public.js';

dotenv.config();
process.env.NODE_ENV = 'test';
process.env.RESEND_MOCK = 'true';

async function runForgotPasswordSecurityTests() {
  console.log('====================================================');
  console.log('🛡️ S CAR TRAVELS PREMIUM - ADMIN FORGOT PASSWORD TEST');
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

  // 1. Initialize DB and ensure test admin srinu has clean test password
  initDatabase();
  const knownInitialHash = bcrypt.hashSync('Srinu@2026', 10);
  db.prepare("UPDATE admins SET password_hash = ? WHERE username = 'srinu'").run(knownInitialHash);

  const admin = db.prepare("SELECT * FROM admins WHERE username = 'srinu' LIMIT 1").get();
  if (!admin) {
    throw new Error('Test admin "srinu" not found in SQLite database');
  }

  const adminEmail = admin.email;
  const originalPasswordHash = knownInitialHash;
  console.log(`[Test Setup] Verified admin: id=${admin.id}, username=${admin.username}, email=${adminEmail}, token_version=${admin.token_version}`);

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
  console.log(`[Test Server] Test server listening on ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Password Reset Email Templates & Branding
    // ----------------------------------------------------
    console.log('--- Test 1: Password Reset Email Templates & Branding ---');
    const resetHtml = buildAdminPasswordResetOtpEmailHtml({ adminName: 'Srinu', otp: '87654321', expiresMinutes: 5 });
    const resetText = buildAdminPasswordResetOtpEmailText({ adminName: 'Srinu', otp: '87654321', expiresMinutes: 5 });

    assert(resetHtml.includes('87654321'), 'Reset HTML displays the 8-digit OTP code');
    assert(resetHtml.includes('#0b132b') || resetHtml.includes('#080f1e'), 'Reset HTML uses branded dark navy blue styling');
    assert(resetHtml.includes('#e5b83b'), 'Reset HTML uses champagne gold accent');
    assert(resetHtml.includes('5 minutes'), 'Reset HTML mentions 5-minute expiry');
    assert(resetText.includes('87654321') && resetText.includes('S CAR TRAVELS PREMIUM'), 'Reset text includes OTP and brand');

    const changedHtml = buildAdminPasswordChangedEmailHtml({ adminName: 'Srinu', timestamp: Date.now(), clientIp: '127.0.0.1' });
    const changedText = buildAdminPasswordChangedEmailText({ adminName: 'Srinu', timestamp: Date.now() });
    assert(changedHtml.includes('Password Changed') && changedHtml.includes('Srinu'), 'Password Changed HTML contains notification details');
    assert(changedText.toUpperCase().includes('PASSWORD CHANGED') || changedText.includes('password has been successfully updated'), 'Password Changed text contains alert');

    // ----------------------------------------------------
    // TEST 2: Account Enumeration Prevention (Step 1)
    // ----------------------------------------------------
    console.log('\n--- Test 2: Account Enumeration Prevention ---');
    clearLastDispatchedResetOtpForTest();

    const nonExistentEmail = 'nonexistent_admin_12345@scar.com';
    const enumRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nonExistentEmail })
    });

    const enumData = await enumRes.json();
    assert(enumRes.status === 200, 'Non-existent email returns HTTP 200');
    assert(
      enumData.message.includes('verification code has been dispatched'),
      'Non-existent email returns identical generic success message'
    );
    assert(Boolean(enumData.challengeId), 'Returns dummy challengeId so client flow looks identical');
    assert(getLastDispatchedResetOtpForTest() === null, 'No email OTP was dispatched for non-existent account');

    // Trying to verify this dummy challenge returns standard invalid error
    const dummyVerifyRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: enumData.challengeId, otp: '12345678' })
    });
    const dummyVerifyData = await dummyVerifyRes.json();
    assert(dummyVerifyRes.status === 400, 'Dummy challenge verification fails with HTTP 400');
    assert(
      dummyVerifyData.code === 'INVALID_CHALLENGE' || dummyVerifyData.error?.includes('Invalid or expired'),
      'Dummy challenge returns standard invalid session message (no enumeration)'
    );

    // ----------------------------------------------------
    // TEST 3: Disabled Account Recovery Protection
    // ----------------------------------------------------
    console.log('\n--- Test 3: Disabled Account Recovery Protection ---');
    // Create a disabled admin for testing
    const disabledEmail = 'disabled_test_admin@scar.com';
    db.prepare("DELETE FROM admins WHERE email = ?").run(disabledEmail);
    const disabledHash = bcrypt.hashSync('TempPass@123', 10);
    db.prepare(`
      INSERT INTO admins (username, email, password_hash, role, status, token_version, created_at)
      VALUES (?, ?, ?, 'admin', 'disabled', 1, CURRENT_TIMESTAMP)
    `).run('disabled_admin_test', disabledEmail, disabledHash);

    clearLastDispatchedResetOtpForTest();
    const disabledForgotRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: disabledEmail })
    });
    const disabledForgotData = await disabledForgotRes.json();
    assert(disabledForgotRes.status === 200, 'Disabled account returns HTTP 200 generic message');
    assert(
      disabledForgotData.message.includes('verification code has been dispatched'),
      'Disabled account receives identical generic success message'
    );
    assert(getLastDispatchedResetOtpForTest() === null, 'No OTP email was dispatched for disabled account');

    // Clean up test disabled admin
    db.prepare("DELETE FROM admins WHERE email = ?").run(disabledEmail);

    // ----------------------------------------------------
    // TEST 4: Email Delivery Failure Handling
    // ----------------------------------------------------
    console.log('\n--- Test 4: Email Delivery Failure Handling ---');
    process.env.TEST_FORCE_RESEND_FAIL = 'true';
    clearLastDispatchedResetOtpForTest();

    const emailFailRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const emailFailData = await emailFailRes.json();

    assert(emailFailRes.status === 502, 'Email delivery failure returns HTTP 502');
    assert(emailFailData.code === 'EMAIL_DELIVERY_FAILED', 'Returns code EMAIL_DELIVERY_FAILED');
    assert(emailFailData.challengeId === undefined, 'No challengeId returned on delivery failure');

    // Restore delivery failure flag
    delete process.env.TEST_FORCE_RESEND_FAIL;

    // ----------------------------------------------------
    // TEST 5: Resend Cooldown (60s) & Hourly Rate Limiting
    // ----------------------------------------------------
    console.log('\n--- Test 5: Resend Cooldown & Hourly Limits ---');
    clearLastDispatchedResetOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    const step1Res = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const step1Data = await step1Res.json();
    assert(step1Res.status === 200, 'Reset request succeeds');
    const validChallengeId = step1Data.challengeId;

    // Immediate resend must be blocked by 60s cooldown
    const cooldownRes = await fetch(`${baseUrl}/api/admin/resend-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: validChallengeId })
    });
    const cooldownData = await cooldownRes.json();
    assert(cooldownRes.status === 429, 'Immediate resend returns HTTP 429');
    assert(cooldownData.code === 'RESEND_COOLDOWN', 'Returns code RESEND_COOLDOWN');

    // Test hourly limit: insert 5 recent OTP requests
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO admin_otps (challenge_id, admin_id, email, otp_hash, purpose, expires_at, resend_available_at, created_at, client_ip)
        VALUES (?, ?, ?, 'dummyhash', 'password_reset', datetime('now', '+5 minutes'), datetime('now', '+60 seconds'), datetime('now', '-${i * 2} minutes'), '127.0.0.1')
      `).run(`ch_test_rate_${i}`, admin.id, adminEmail);
    }

    const hourlyRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const hourlyData = await hourlyRes.json();
    assert(hourlyRes.status === 429, '6th request within 1 hour returns HTTP 429');
    assert(hourlyData.code === 'RATE_LIMIT_EXCEEDED', 'Returns code RATE_LIMIT_EXCEEDED');

    // Clean up rate-limit records
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    // ----------------------------------------------------
    // TEST 6: Wrong OTP Handling & Attempt Counter Decrement
    // ----------------------------------------------------
    console.log('\n--- Test 6: Wrong OTP Handling & Attempt Counter ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedResetOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    const otpReqRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const otpReqData = await otpReqRes.json();
    const testChallengeId = otpReqData.challengeId;

    const wrongOtpRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: testChallengeId, otp: '00000000' })
    });
    const wrongOtpData = await wrongOtpRes.json();
    assert(wrongOtpRes.status === 400, 'Wrong OTP returns HTTP 400');
    assert(wrongOtpData.code === 'INVALID_OTP', 'Returns code INVALID_OTP');
    assert(wrongOtpData.attemptsRemaining === 4, 'Reports exactly 4 attempts remaining');

    const dbRecord = db.prepare("SELECT attempts FROM admin_otps WHERE challenge_id = ?").get(testChallengeId);
    assert(dbRecord.attempts === 1, 'Database attempts count correctly updated to 1');

    // ----------------------------------------------------
    // TEST 7: Maximum Attempts Lockout (5 attempts)
    // ----------------------------------------------------
    console.log('\n--- Test 7: Maximum Attempts Lockout ---');
    // Attempt 2, 3, 4 with wrong OTP
    for (let a = 2; a <= 4; a++) {
      await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: testChallengeId, otp: `1111111${a}` })
      });
    }

    // 5th attempt (reaching 5 failed attempts)
    const fifthRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: testChallengeId, otp: '99999999' })
    });
    const fifthData = await fifthRes.json();
    assert(fifthRes.status === 400, '5th failed attempt returns HTTP 400');
    assert(fifthData.code === 'MAX_ATTEMPTS_EXCEEDED', 'Returns code MAX_ATTEMPTS_EXCEEDED');

    // 6th attempt (even with correct OTP) must be rejected because challenge is marked used/locked
    const correctDispatchedOtp = getLastDispatchedResetOtpForTest().otp;
    const sixthRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: testChallengeId, otp: correctDispatchedOtp })
    });
    const sixthData = await sixthRes.json();
    assert(sixthRes.status === 400, 'Attempt after lockout returns HTTP 400');
    assert(
      sixthData.code === 'MAX_ATTEMPTS_EXCEEDED' || sixthData.code === 'INVALID_CHALLENGE',
      'Locked challenge rejects further verification'
    );

    // ----------------------------------------------------
    // TEST 8: Expired OTP Rejection (5 minutes)
    // ----------------------------------------------------
    console.log('\n--- Test 8: Expired OTP Rejection ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedResetOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    const expReqRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const expReqData = await expReqRes.json();
    const expChallengeId = expReqData.challengeId;
    const expOtp = getLastDispatchedResetOtpForTest().otp;

    // Expire the challenge in database
    db.prepare("UPDATE admin_otps SET expires_at = datetime('now', '-1 minute') WHERE challenge_id = ?").run(expChallengeId);

    const expiredRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: expChallengeId, otp: expOtp })
    });
    const expiredData = await expiredRes.json();
    assert(expiredRes.status === 400, 'Expired challenge returns HTTP 400');
    assert(expiredData.code === 'OTP_EXPIRED', 'Returns code OTP_EXPIRED');

    // ----------------------------------------------------
    // TEST 9: Cross-Purpose Token Misuse
    // ----------------------------------------------------
    console.log('\n--- Test 9: Cross-Purpose Challenge & Token Misuse ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedResetOtpForTest();
    clearLastDispatchedOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    // 1. Create a LOGIN OTP challenge via POST /api/admin/login
    const loginChallengeRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    const loginChallengeData = await loginChallengeRes.json();
    const loginChallengeId = loginChallengeData.challengeId;
    const loginOtp = getLastDispatchedOtpForTest().otp;

    // Try to verify LOGIN challenge at verify-reset-otp (CROSS-PURPOSE MISUSE)
    const misuseResetRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: loginChallengeId, otp: loginOtp })
    });
    const misuseResetData = await misuseResetRes.json();
    assert(misuseResetRes.status === 400, 'Login OTP challenge rejected at verify-reset-otp');
    assert(misuseResetData.code === 'INVALID_CHALLENGE', 'Returns INVALID_CHALLENGE for wrong purpose');

    // 2. Create a PASSWORD RESET challenge via POST /api/admin/forgot-password
    clearFailedLogin('127.0.0.1');
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);
    clearLastDispatchedResetOtpForTest();

    const resetChallengeRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const resetChallengeData = await resetChallengeRes.json();
    const resetChallengeId = resetChallengeData.challengeId;
    const resetOtp = getLastDispatchedResetOtpForTest().otp;

    // Try to verify RESET challenge at verify-otp (login endpoint) (CROSS-PURPOSE MISUSE)
    const misuseLoginRes = await fetch(`${baseUrl}/api/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: resetChallengeId, otp: resetOtp })
    });
    const misuseLoginData = await misuseLoginRes.json();
    assert(misuseLoginRes.status === 400, 'Password reset challenge rejected at verify-otp (login)');
    assert(misuseLoginData.code === 'INVALID_CHALLENGE', 'Returns INVALID_CHALLENGE for wrong purpose');

    // ----------------------------------------------------
    // TEST 10: Successful Password Reset Flow (Full E2E)
    // ----------------------------------------------------
    console.log('\n--- Test 10: Successful Password Reset Flow ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedResetOtpForTest();
    clearLastDispatchedPasswordChangedForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    // Step 1: Request reset OTP
    const flowReqRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const flowReqData = await flowReqRes.json();
    const flowChallengeId = flowReqData.challengeId;
    const flowOtp = getLastDispatchedResetOtpForTest().otp;
    assert(Boolean(flowChallengeId && flowOtp), 'Step 1 issued challengeId and dispatched OTP');

    // Step 2: Verify reset OTP -> receive resetToken
    const flowVerifyRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: flowChallengeId, otp: flowOtp })
    });
    const flowVerifyCookies = flowVerifyRes.headers.get('set-cookie') || '';
    const flowVerifyData = await flowVerifyRes.json();

    assert(flowVerifyRes.status === 200, 'Step 2 verification returns HTTP 200');
    assert(Boolean(flowVerifyData.resetToken && flowVerifyData.resetToken.length === 64), 'Returns 64-character cryptographically random resetToken');
    assert(flowVerifyData.token === undefined, 'CRITICAL: No admin JWT token issued during reset OTP verification');
    assert(!flowVerifyCookies.includes('scar_admin_token='), 'CRITICAL: No session cookie set at verify-reset-otp');

    const flowResetToken = flowVerifyData.resetToken;

    // Check reset token cannot be used as a JWT bearer session
    const meResWithResetToken = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${flowResetToken}` }
    });
    assert(meResWithResetToken.status === 401, 'Reset token cannot be used to authenticate admin API routes');

    // Step 3: Complete password update
    const newTestPassword = 'NewSecretAdmin@2026';
    const resetRes = await fetch(`${baseUrl}/api/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: flowResetToken, password: newTestPassword })
    });
    const resetData = await resetRes.json();

    assert(resetRes.status === 200, 'Password reset update returns HTTP 200');
    assert(resetData.success === true, 'Response indicates success = true');

    // Verify security email was dispatched
    const changedEmailRecord = getLastDispatchedPasswordChangedForTest();
    assert(Boolean(changedEmailRecord && changedEmailRecord.email === adminEmail.toLowerCase()), 'Security confirmation email dispatched to registered admin');

    // Verify audit log record exists
    const auditRecord = db.prepare("SELECT * FROM admin_audit_logs WHERE action = 'ADMIN_PASSWORD_RESET' ORDER BY id DESC LIMIT 1").get();
    assert(Boolean(auditRecord), 'Recorded ADMIN_PASSWORD_RESET in admin_audit_logs');
    assert(!auditRecord.details_json?.includes(newTestPassword), 'Audit log does NOT leak the new password');
    assert(!auditRecord.details_json?.includes(flowOtp), 'Audit log does NOT leak the OTP');
    assert(!auditRecord.details_json?.includes(flowResetToken), 'Audit log does NOT leak the reset token');

    // Verify admin can log in with new password
    clearFailedLogin('127.0.0.1');
    const loginWithNewPassRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: newTestPassword })
    });
    const loginWithNewPassData = await loginWithNewPassRes.json();
    assert(loginWithNewPassRes.status === 200 && loginWithNewPassData.step === 'otp_required', 'Admin can initiate login with new password');

    // Verify admin CANNOT log in with old password
    const loginWithOldPassRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Srinu@2026' })
    });
    assert(loginWithOldPassRes.status === 401, 'Login with old password fails with HTTP 401');

    // ----------------------------------------------------
    // TEST 11: Weak Password Rejection (<8 chars)
    // ----------------------------------------------------
    console.log('\n--- Test 11: Weak Password Rejection ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedResetOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    const weakReqRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const weakReqData = await weakReqRes.json();
    const weakOtp = getLastDispatchedResetOtpForTest().otp;

    const weakVerifyRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: weakReqData.challengeId, otp: weakOtp })
    });
    const weakResetToken = (await weakVerifyRes.json()).resetToken;

    const weakSubmitRes = await fetch(`${baseUrl}/api/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: weakResetToken, password: 'short' })
    });
    const weakSubmitData = await weakSubmitRes.json();
    assert(weakSubmitRes.status === 400, 'Weak password (<8 chars) returns HTTP 400');
    assert(weakSubmitData.code === 'WEAK_PASSWORD', 'Returns code WEAK_PASSWORD');

    // ----------------------------------------------------
    // TEST 12: Replay & Token Reuse Prevention
    // ----------------------------------------------------
    console.log('\n--- Test 12: Replay & Token Reuse Prevention ---');
    clearFailedLogin('127.0.0.1');
    // Try to reuse the already-used resetToken from Test 10
    const reuseTokenRes = await fetch(`${baseUrl}/api/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: flowResetToken, password: 'AnotherPassword@2026' })
    });
    const reuseTokenData = await reuseTokenRes.json();
    assert(reuseTokenRes.status === 400, 'Reusing an already-consumed resetToken returns HTTP 400');
    assert(reuseTokenData.code === 'INVALID_RESET_TOKEN', 'Returns INVALID_RESET_TOKEN on token replay');

    // Try to reuse the already-verified OTP challenge from Test 10
    const reuseOtpRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: flowChallengeId, otp: flowOtp })
    });
    assert(reuseOtpRes.status === 400, 'Reusing an already-consumed OTP challenge returns HTTP 400');

    // ----------------------------------------------------
    // TEST 13: Concurrent Reset Requests / Race Condition Safety
    // ----------------------------------------------------
    console.log('\n--- Test 13: Concurrent Reset Requests (Race Condition Safety) ---');
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedResetOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    const raceReqRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const raceOtp = getLastDispatchedResetOtpForTest().otp;
    const raceChallengeId = (await raceReqRes.json()).challengeId;

    const raceVerifyRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: raceChallengeId, otp: raceOtp })
    });
    const raceResetToken = (await raceVerifyRes.json()).resetToken;

    // Fire 10 concurrent reset requests using the same resetToken
    const raceResults = await Promise.all(
      Array.from({ length: 10 }).map((_, idx) =>
        fetch(`${baseUrl}/api/admin/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetToken: raceResetToken, password: `RacePass@2026_${idx}` })
        }).then(async (r) => ({ status: r.status, data: await r.json() }))
      )
    );

    const raceSuccess = raceResults.filter((r) => r.status === 200);
    const raceFailed = raceResults.filter((r) => r.status === 400);
    assert(raceSuccess.length === 1, `Exactly ONE concurrent reset request succeeds (actual: ${raceSuccess.length})`);
    assert(raceFailed.length === 9, `All other 9 concurrent reset requests are rejected (actual: ${raceFailed.length})`);

    // ----------------------------------------------------
    // TEST 14: Revocation of Old Sessions (token_version verification)
    // ----------------------------------------------------
    console.log('\n--- Test 14: Reliable Session Revocation via token_version ---');
    clearFailedLogin('127.0.0.1');
    // Fetch live admin data
    const currentAdmin = db.prepare("SELECT * FROM admins WHERE id = ?").get(admin.id);
    const oldJwt = signAdminToken(currentAdmin);

    // Verify this oldJwt is initially valid at /api/admin/me
    const meBeforeReset = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${oldJwt}` }
    });
    assert(meBeforeReset.status === 200, 'Active JWT token succeeds before password reset');

    // Perform another password reset to increment token_version
    clearLastDispatchedResetOtpForTest();
    db.prepare("DELETE FROM admin_otps WHERE admin_id = ?").run(admin.id);

    const revokeReqRes = await fetch(`${baseUrl}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail })
    });
    const revokeOtp = getLastDispatchedResetOtpForTest().otp;
    const revokeChallengeId = (await revokeReqRes.json()).challengeId;

    const revokeVerifyRes = await fetch(`${baseUrl}/api/admin/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: revokeChallengeId, otp: revokeOtp })
    });
    const revokeResetToken = (await revokeVerifyRes.json()).resetToken;

    const finalPass = 'Srinu@2026'; // Restore standard password
    const revokeResetRes = await fetch(`${baseUrl}/api/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: revokeResetToken, password: finalPass })
    });
    assert(revokeResetRes.status === 200, 'Password reset successfully executed');

    // NOW test the PREVIOUS JWT token at /api/admin/me
    const meAfterReset = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${oldJwt}` }
    });
    const meAfterResetData = await meAfterReset.json();

    assert(meAfterReset.status === 401, 'Old JWT token is REJECTED with HTTP 401 after password reset');
    assert(
      meAfterResetData.code === 'SESSION_REVOKED' || meAfterResetData.error?.includes('revoked'),
      'Returns SESSION_REVOKED error code proving server-checked revocation'
    );

    // Verify new token issued with updated token_version works
    const updatedAdmin = db.prepare("SELECT * FROM admins WHERE id = ?").get(admin.id);
    const newJwt = signAdminToken(updatedAdmin);
    const meWithNewJwt = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { 'Authorization': `Bearer ${newJwt}` }
    });
    assert(meWithNewJwt.status === 200, 'New JWT issued with current token_version succeeds');

    // Clean up: make sure original password hash is preserved or reset
    db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(originalPasswordHash, admin.id);

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runForgotPasswordSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
