import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  requireAdminAuth,
  requireSuperAdmin,
  signAdminToken,
  generateCsrfToken,
  generateOtpCode,
  generateChallengeId,
  hashOtpCode,
  verifyOtpHash,
  maskEmail,
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogin
} from '../auth.js';
import { checkVehicleConflict } from './public.js';
import {
  supabaseAdmin,
  isSupabaseServerConfigured,
  testSupabaseServerConnection,
  formatSafeDbError,
  recordAdminAuditLog
} from '../supabase.js';
import {
  sendBookingNotificationEmail,
  sendAdminLoginOtpEmail,
  sendAdminInvitationEmail,
  sendAdminPasswordResetOtpEmail,
  sendAdminPasswordChangedEmail,
  getFromEmail,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_FROM_EMAIL
} from '../email.js';

const router = express.Router();

function assertSupabase(res) {
  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    res.status(503).json({
      error: 'Database service unavailable. Supabase PostgreSQL is required.',
      code: 'DB_UNAVAILABLE'
    });
    return false;
  }
  return true;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ==========================================
// 1. ADMIN AUTHENTICATION (PUBLIC ENDPOINTS)
// ==========================================

// 1a. POST /api/admin/login (Step 1: Email + Password verification -> Dispatches 8-digit OTP)
router.post('/login', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const identifier = (req.body.email || req.body.username || '').trim();
  const password = req.body.password;

  // Rate limiting check
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', String(rateLimitStatus.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed login attempts. Please wait ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  if (!identifier || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Registered email and password are required' });
  }

  const trimmedPassword = password;

  try {
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, password_hash, role, is_active, status')
      .or(`email.ilike.${identifier},username.ilike.${identifier}`)
      .maybeSingle();

    if (adminErr) {
      console.error('Supabase admin lookup error:', adminErr);
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Timing attack mitigation: perform dummy bcrypt check if user does not exist
    const dummyHash = '$2a$10$e8w8G7mZ2Y2C9bQxQ0wMbe7V.c1x9w1s6aB6t9sL5w3r9xY4zF1u2';
    if (!admin) {
      bcrypt.compareSync(trimmedPassword, dummyHash);
      recordFailedLogin(clientIp);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(trimmedPassword, admin.password_hash);
    if (!validPassword) {
      recordFailedLogin(clientIp);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Enforce explicit admin role
    if (admin.role !== 'admin' && admin.role !== 'superadmin') {
      recordFailedLogin(clientIp);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account has been disabled
    if (admin.is_active === 0 || admin.status === 'disabled') {
      recordFailedLogin(clientIp);
      return res.status(403).json({
        error: 'This administrator account has been disabled. Please contact your Super Administrator.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Check if account is pending invitation acceptance
    if (admin.status === 'invited') {
      recordFailedLogin(clientIp);
      return res.status(403).json({
        error: 'This account has not been activated yet. Please accept your email invitation to set your password.',
        code: 'ACCOUNT_PENDING_ACTIVATION'
      });
    }

    // Rate limit: max 5 OTP requests per hour per admin account
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyOtpCount } = await supabaseAdmin
      .from('admin_otps')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', admin.id)
      .eq('purpose', 'login')
      .gte('created_at', oneHourAgo);

    if (hourlyOtpCount && hourlyOtpCount >= 5) {
      return res.status(429).json({
        error: 'Too many verification code requests for this account. Please wait before trying again.',
        retryAfterSeconds: 3600
      });
    }

    // Generate cryptographically secure random 8-digit OTP & challenge ID
    const otp = generateOtpCode(8);
    const challengeId = generateChallengeId();
    const otpHash = hashOtpCode(otp);

    // Dispatch OTP email to the specific admin's registered email
    const emailResult = await sendAdminLoginOtpEmail({
      email: admin.email,
      adminName: admin.username,
      otp,
      expiresMinutes: 5
    });

    if (!emailResult.success) {
      return res.status(502).json({
        error: 'Failed to dispatch verification code to registered admin email. Please try again later.'
      });
    }

    // Invalidate previous active login OTP challenges for this admin
    await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_id', admin.id)
      .eq('purpose', 'login')
      .is('used_at', null);

    // Store hashed OTP challenge in Supabase
    const nowMs = Date.now();
    await supabaseAdmin.from('admin_otps').insert({
      challenge_id: challengeId,
      admin_id: admin.id,
      email: admin.email,
      otp_hash: otpHash,
      purpose: 'login',
      attempts: 0,
      max_attempts: 5,
      resend_available_at: new Date(nowMs + 60 * 1000).toISOString(),
      expires_at: new Date(nowMs + 5 * 60 * 1000).toISOString(),
      client_ip: clientIp
    });

    return res.json({
      success: true,
      step: 'otp_required',
      challengeId,
      emailMasked: maskEmail(admin.email),
      expiresInSeconds: 300,
      resendCooldownSeconds: 60
    });
  } catch (err) {
    console.error('Error during admin login:', err);
    return res.status(500).json({ error: 'An unexpected error occurred during login' });
  }
});

// 1b. POST /api/admin/verify-otp (Step 2: 8-digit OTP verification -> Issues JWT & session cookie)
router.post('/verify-otp', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { challengeId, otp } = req.body;

  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', String(rateLimitStatus.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed attempts. Please wait ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  if (!challengeId || !otp || typeof challengeId !== 'string' || typeof otp !== 'string') {
    return res.status(400).json({ error: 'Challenge ID and 8-digit verification code are required' });
  }

  const cleanOtp = otp.trim();
  const cleanChallengeId = challengeId.trim();

  try {
    const { data: challenge, error: challengeErr } = await supabaseAdmin
      .from('admin_otps')
      .select(`
        id, challenge_id, admin_id, email, otp_hash, purpose, attempts, max_attempts,
        resend_available_at, expires_at, used_at, client_ip, created_at,
        admins:admin_id (id, username, email, role, is_active, status, token_version)
      `)
      .eq('challenge_id', cleanChallengeId)
      .eq('purpose', 'login')
      .maybeSingle();

    if (challengeErr || !challenge || !challenge.admins) {
      recordFailedLogin(clientIp);
      return res.status(400).json({
        error: 'Invalid or expired verification session. Please sign in again.',
        code: 'INVALID_CHALLENGE'
      });
    }

    const admin = challenge.admins;
    if (admin.is_active === 0 || admin.status === 'disabled') {
      recordFailedLogin(clientIp);
      return res.status(403).json({
        error: 'This administrator account has been disabled. Access denied.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    if (challenge.used_at) {
      recordFailedLogin(clientIp);
      return res.status(400).json({ error: 'This verification code has already been used. Please sign in again.' });
    }

    if (new Date() > new Date(challenge.expires_at)) {
      recordFailedLogin(clientIp);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (challenge.attempts >= challenge.max_attempts) {
      await supabaseAdmin.from('admin_otps').update({ used_at: new Date().toISOString() }).eq('id', challenge.id);
      recordFailedLogin(clientIp);
      return res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
    }

    const isValid = verifyOtpHash(cleanOtp, challenge.otp_hash);
    if (!isValid) {
      const newAttempts = challenge.attempts + 1;
      const updates = { attempts: newAttempts };
      if (newAttempts >= challenge.max_attempts) {
        updates.used_at = new Date().toISOString();
      }

      await supabaseAdmin.from('admin_otps').update(updates).eq('id', challenge.id);
      recordFailedLogin(clientIp);

      const remaining = challenge.max_attempts - newAttempts;
      if (remaining <= 0) {
        return res.status(400).json({
          error: 'Invalid verification code. Maximum attempts reached. This code is now invalid. Please request a new code.'
        });
      } else {
        return res.status(400).json({
          error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        });
      }
    }

    // OTP is valid! Atomically mark as used
    const { data: markUsedData, error: markUsedErr } = await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', challenge.id)
      .is('used_at', null)
      .select()
      .maybeSingle();

    if (markUsedErr || !markUsedData) {
      recordFailedLogin(clientIp);
      return res.status(400).json({ error: 'This verification code has already been used or expired.' });
    }

    clearFailedLogin(clientIp);

    const adminObj = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      token_version: admin.token_version || 1
    };

    const token = signAdminToken(adminObj);
    const csrfToken = generateCsrfToken();

    const isProd = process.env.NODE_ENV === 'production';
    const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();

    res.cookie('scar_admin_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: '/'
    });

    res.cookie('scar_csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({
      success: true,
      token,
      csrfToken,
      admin: adminObj
    });
  } catch (err) {
    console.error('Error verifying OTP in Supabase:', err);
    return res.status(500).json({ error: 'Failed to verify verification code' });
  }
});

// 1c. POST /api/admin/resend-otp (Resend 8-digit OTP with 60s cooldown & hourly limits)
router.post('/resend-otp', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { challengeId } = req.body;

  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', String(rateLimitStatus.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many requests. Please wait ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  if (!challengeId || typeof challengeId !== 'string') {
    return res.status(400).json({ error: 'Challenge ID is required' });
  }

  const cleanChallengeId = challengeId.trim();

  try {
    const { data: challenge, error: challengeErr } = await supabaseAdmin
      .from('admin_otps')
      .select(`
        id, challenge_id, admin_id, email, resend_available_at, expires_at,
        admins:admin_id (id, username, email, role, is_active, status)
      `)
      .eq('challenge_id', cleanChallengeId)
      .eq('purpose', 'login')
      .maybeSingle();

    if (challengeErr || !challenge || !challenge.admins) {
      return res.status(400).json({ error: 'Invalid verification session. Please sign in again.' });
    }

    const admin = challenge.admins;
    const now = new Date();
    const resendAvailableAt = new Date(challenge.resend_available_at);

    if (now < resendAvailableAt) {
      const cooldownLeft = Math.ceil((resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        error: `Please wait ${cooldownLeft} seconds before requesting a new code.`,
        retryAfterSeconds: cooldownLeft
      });
    }

    // Hourly limit per account (max 5 OTP requests per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyOtpCount } = await supabaseAdmin
      .from('admin_otps')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', challenge.admin_id)
      .eq('purpose', 'login')
      .gte('created_at', oneHourAgo);

    if (hourlyOtpCount && hourlyOtpCount >= 5) {
      return res.status(429).json({
        error: 'Too many verification code requests for this account. Please wait before trying again.',
        retryAfterSeconds: 3600
      });
    }

    const newOtp = generateOtpCode(8);
    const newChallengeId = generateChallengeId();
    const newOtpHash = hashOtpCode(newOtp);

    const emailResult = await sendAdminLoginOtpEmail({
      email: admin.email,
      adminName: admin.username,
      otp: newOtp,
      expiresMinutes: 5
    });

    if (!emailResult.success) {
      return res.status(502).json({
        error: 'Failed to dispatch verification code to registered admin email. Please try again.'
      });
    }

    // Invalidate previous challenge(s) for this admin
    await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_id', challenge.admin_id)
      .eq('purpose', 'login')
      .is('used_at', null);

    // Insert new challenge
    const nowMs = Date.now();
    await supabaseAdmin.from('admin_otps').insert({
      challenge_id: newChallengeId,
      admin_id: challenge.admin_id,
      email: admin.email,
      otp_hash: newOtpHash,
      purpose: 'login',
      attempts: 0,
      max_attempts: 5,
      resend_available_at: new Date(nowMs + 60 * 1000).toISOString(),
      expires_at: new Date(nowMs + 5 * 60 * 1000).toISOString(),
      client_ip: clientIp
    });

    return res.json({
      success: true,
      challengeId: newChallengeId,
      emailMasked: maskEmail(admin.email),
      expiresInSeconds: 300,
      resendCooldownSeconds: 60
    });
  } catch (err) {
    console.error('Error resending OTP in Supabase:', err);
    return res.status(500).json({ error: 'Failed to resend verification code' });
  }
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

// ==========================================
// 2b. SECURE FORGOT PASSWORD WORKFLOW (EMAIL + OTP)
// ==========================================

// POST /api/admin/forgot-password - Step 1: Request Password Reset OTP
router.post('/forgot-password', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const emailInput = (req.body.email || '').trim().toLowerCase();

  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', String(rateLimitStatus.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many attempts. Please wait ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    return res.status(400).json({ error: 'Please enter a valid registered email address.' });
  }

  const genericMessage = 'If an active administrator account is associated with this email address, a verification code has been dispatched. Please check your inbox.';

  try {
    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, is_active, status')
      .eq('email', emailInput)
      .maybeSingle();

    if (!admin || admin.is_active === 0 || admin.status === 'disabled' || admin.status === 'invited') {
      const dummyHash = '$2a$10$e8w8G7mZ2Y2C9bQxQ0wMbe7V.c1x9w1s6aB6t9sL5w3r9xY4zF1u2';
      bcrypt.compareSync('dummy_timing_mitigation_token_check', dummyHash);

      const dummyChallenge = generateChallengeId();
      return res.json({
        success: true,
        message: genericMessage,
        step: 'otp_required',
        challengeId: dummyChallenge,
        emailMasked: maskEmail(emailInput),
        expiresInSeconds: 300,
        resendCooldownSeconds: 60
      });
    }

    // Hourly limit: max 5 password reset requests per hour per account
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabaseAdmin
      .from('admin_otps')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', admin.id)
      .eq('purpose', 'password_reset')
      .gte('created_at', oneHourAgo);

    if (hourlyCount && hourlyCount >= 5) {
      return res.status(429).json({
        error: 'Too many password reset requests for this account. Please wait before trying again.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: 3600
      });
    }

    // Check cooldown on existing active challenge
    const { data: latestChallenge } = await supabaseAdmin
      .from('admin_otps')
      .select('resend_available_at')
      .eq('admin_id', admin.id)
      .eq('purpose', 'password_reset')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestChallenge && new Date() < new Date(latestChallenge.resend_available_at)) {
      return res.status(429).json({
        error: 'Please wait 60 seconds before requesting another verification code.',
        code: 'RESEND_COOLDOWN',
        retryAfterSeconds: 60
      });
    }

    const otp = generateOtpCode(8);
    const challengeId = generateChallengeId();
    const otpHash = hashOtpCode(otp);

    const emailResult = await sendAdminPasswordResetOtpEmail({
      email: admin.email,
      adminName: admin.username,
      otp,
      expiresMinutes: 5
    });

    if (!emailResult.success) {
      return res.status(502).json({
        error: 'Failed to dispatch verification code to registered email. Please try again later.',
        code: 'EMAIL_DELIVERY_FAILED'
      });
    }

    // Invalidate previous open password_reset OTPs for this admin
    await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_id', admin.id)
      .eq('purpose', 'password_reset')
      .is('used_at', null);

    const nowMs = Date.now();
    await supabaseAdmin.from('admin_otps').insert({
      challenge_id: challengeId,
      admin_id: admin.id,
      email: admin.email,
      otp_hash: otpHash,
      purpose: 'password_reset',
      attempts: 0,
      max_attempts: 5,
      resend_available_at: new Date(nowMs + 60 * 1000).toISOString(),
      expires_at: new Date(nowMs + 5 * 60 * 1000).toISOString(),
      client_ip: clientIp
    });

    return res.json({
      success: true,
      message: genericMessage,
      step: 'otp_required',
      challengeId,
      emailMasked: maskEmail(admin.email),
      expiresInSeconds: 300,
      resendCooldownSeconds: 60
    });
  } catch (err) {
    console.error('Error during forgot password in Supabase:', err);
    return res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/admin/resend-reset-otp - Resend Password Reset OTP
router.post('/resend-reset-otp', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { challengeId } = req.body;

  if (!challengeId || typeof challengeId !== 'string') {
    return res.status(400).json({ error: 'Challenge ID is required.' });
  }

  const cleanChallengeId = challengeId.trim();

  try {
    const { data: challenge, error: challengeErr } = await supabaseAdmin
      .from('admin_otps')
      .select(`
        id, challenge_id, admin_id, email, resend_available_at, expires_at, used_at,
        admins:admin_id (id, username, email, is_active, status)
      `)
      .eq('challenge_id', cleanChallengeId)
      .eq('purpose', 'password_reset')
      .maybeSingle();

    if (challengeErr || !challenge || !challenge.admins) {
      return res.status(400).json({ error: 'Invalid or expired verification session. Please request a new code.' });
    }

    const admin = challenge.admins;
    if (admin.is_active === 0 || admin.status === 'disabled') {
      return res.status(403).json({
        error: 'This administrator account has been disabled. Access denied.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    const now = new Date();
    if (challenge.used_at || now > new Date(challenge.expires_at)) {
      return res.status(400).json({ error: 'Verification session has expired. Please initiate a new password reset.' });
    }

    const resendAvailableAt = new Date(challenge.resend_available_at);
    if (now < resendAvailableAt) {
      return res.status(429).json({
        error: 'Please wait 60 seconds before requesting another code.',
        code: 'RESEND_COOLDOWN',
        retryAfterSeconds: 60
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabaseAdmin
      .from('admin_otps')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', challenge.admin_id)
      .eq('purpose', 'password_reset')
      .gte('created_at', oneHourAgo);

    if (hourlyCount && hourlyCount >= 5) {
      return res.status(429).json({
        error: 'Too many verification code requests for this account. Please wait before trying again.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: 3600
      });
    }

    const newOtp = generateOtpCode(8);
    const newChallengeId = generateChallengeId();
    const newOtpHash = hashOtpCode(newOtp);

    const emailResult = await sendAdminPasswordResetOtpEmail({
      email: admin.email,
      adminName: admin.username,
      otp: newOtp,
      expiresMinutes: 5
    });

    if (!emailResult.success) {
      return res.status(502).json({
        error: 'Failed to dispatch verification code to registered email. Please try again later.'
      });
    }

    // Invalidate previous challenge
    await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', challenge.id);

    const nowMs = Date.now();
    await supabaseAdmin.from('admin_otps').insert({
      challenge_id: newChallengeId,
      admin_id: challenge.admin_id,
      email: admin.email,
      otp_hash: newOtpHash,
      purpose: 'password_reset',
      attempts: 0,
      max_attempts: 5,
      resend_available_at: new Date(nowMs + 60 * 1000).toISOString(),
      expires_at: new Date(nowMs + 5 * 60 * 1000).toISOString(),
      client_ip: clientIp
    });

    return res.json({
      success: true,
      message: 'A new verification code has been dispatched to your email.',
      challengeId: newChallengeId,
      emailMasked: maskEmail(admin.email),
      expiresInSeconds: 300,
      resendCooldownSeconds: 60
    });
  } catch (err) {
    console.error('Error resending reset OTP in Supabase:', err);
    return res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// POST /api/admin/verify-reset-otp - Step 2: Verify OTP -> Issues single-use resetToken (NO JWT!)
router.post('/verify-reset-otp', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { challengeId, otp } = req.body;

  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', String(rateLimitStatus.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed attempts. Please wait ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  if (!challengeId || !otp || typeof challengeId !== 'string' || typeof otp !== 'string') {
    return res.status(400).json({ error: 'Challenge ID and 8-digit verification code are required.' });
  }

  const cleanOtp = otp.trim();
  const cleanChallengeId = challengeId.trim();

  try {
    const { data: challenge, error: challengeErr } = await supabaseAdmin
      .from('admin_otps')
      .select(`
        id, challenge_id, admin_id, email, otp_hash, purpose, attempts, max_attempts,
        expires_at, used_at,
        admins:admin_id (id, username, email, is_active, status)
      `)
      .eq('challenge_id', cleanChallengeId)
      .eq('purpose', 'password_reset')
      .maybeSingle();

    if (challengeErr || !challenge || !challenge.admins) {
      recordFailedLogin(clientIp);
      return res.status(400).json({
        error: 'Invalid or expired verification session. Please request a new code.',
        code: 'INVALID_CHALLENGE'
      });
    }

    const admin = challenge.admins;
    if (admin.is_active === 0 || admin.status === 'disabled') {
      recordFailedLogin(clientIp);
      return res.status(403).json({
        error: 'This administrator account has been disabled. Access denied.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    if (challenge.used_at) {
      recordFailedLogin(clientIp);
      return res.status(400).json({
        error: 'This verification code has already been used. Please request a new code.',
        code: 'INVALID_CHALLENGE'
      });
    }

    if (new Date() > new Date(challenge.expires_at)) {
      recordFailedLogin(clientIp);
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
        code: 'OTP_EXPIRED'
      });
    }

    if (challenge.attempts >= challenge.max_attempts) {
      await supabaseAdmin.from('admin_otps').update({ used_at: new Date().toISOString() }).eq('id', challenge.id);
      recordFailedLogin(clientIp);
      return res.status(400).json({
        error: 'Maximum verification attempts exceeded. Please request a new code.',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      });
    }

    const isValid = verifyOtpHash(cleanOtp, challenge.otp_hash);
    if (!isValid) {
      const newAttempts = challenge.attempts + 1;
      const updates = { attempts: newAttempts };
      if (newAttempts >= challenge.max_attempts) {
        updates.used_at = new Date().toISOString();
      }

      await supabaseAdmin.from('admin_otps').update(updates).eq('id', challenge.id);
      recordFailedLogin(clientIp);

      const remaining = challenge.max_attempts - newAttempts;
      if (remaining <= 0) {
        return res.status(400).json({
          error: 'Invalid verification code. Maximum attempts reached. This code is now invalid. Please request a new code.',
          code: 'MAX_ATTEMPTS_EXCEEDED',
          attemptsRemaining: 0
        });
      } else {
        return res.status(400).json({
          error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
          code: 'INVALID_OTP',
          attemptsRemaining: remaining
        });
      }
    }

    // Mark OTP atomically as used
    const { data: markedData, error: markErr } = await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', challenge.id)
      .is('used_at', null)
      .select()
      .maybeSingle();

    if (markErr || !markedData) {
      recordFailedLogin(clientIp);
      return res.status(400).json({ error: 'This verification code has already been used or expired.' });
    }

    clearFailedLogin(clientIp);

    // Generate single-use password reset token (NO JWT)
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    await supabaseAdmin.from('admin_password_resets').insert({
      token_hash: tokenHash,
      challenge_id: challenge.challenge_id,
      admin_id: challenge.admin_id,
      email: challenge.email,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      client_ip: clientIp
    });

    return res.json({
      success: true,
      step: 'new_password_required',
      resetToken: rawResetToken,
      expiresInSeconds: 900
    });
  } catch (err) {
    console.error('Error verifying reset OTP in Supabase:', err);
    return res.status(500).json({ error: 'Failed to verify verification code' });
  }
});

// POST /api/admin/reset-password - Step 3: Complete Password Reset with Reset Token
router.post('/reset-password', async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { resetToken, password } = req.body;

  if (!resetToken || typeof resetToken !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 8) {
    return res.status(400).json({
      error: 'New password must be at least 8 characters long.',
      code: 'WEAK_PASSWORD'
    });
  }

  const cleanResetToken = resetToken.trim();
  const tokenHash = crypto.createHash('sha256').update(cleanResetToken).digest('hex');

  try {
    const { data: resetRecord, error: resetErr } = await supabaseAdmin
      .from('admin_password_resets')
      .select(`
        id, token_hash, challenge_id, admin_id, email, expires_at, used_at,
        admins:admin_id (id, username, email, is_active, status, role, token_version)
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (resetErr || !resetRecord || !resetRecord.admins) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token.',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    const admin = resetRecord.admins;
    if (resetRecord.used_at) {
      return res.status(400).json({
        error: 'This password reset token has already been used. Please request a new code.',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    if (new Date() > new Date(resetRecord.expires_at)) {
      return res.status(400).json({
        error: 'Password reset token has expired. Please request a new code.',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    if (admin.is_active === 0 || admin.status === 'disabled') {
      return res.status(403).json({
        error: 'This administrator account has been disabled. Access denied.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Atomically mark reset token used
    const { data: markedUsed, error: markErr } = await supabaseAdmin
      .from('admin_password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRecord.id)
      .is('used_at', null)
      .select()
      .maybeSingle();

    if (markErr || !markedUsed) {
      return res.status(400).json({ error: 'This password reset token has already been used or expired.' });
    }

    // Hash new password using bcryptjs
    const newHash = bcrypt.hashSync(trimmedPassword, 10);
    const nextTokenVersion = (admin.token_version || 1) + 1;

    // Atomically update password and increment token_version to invalidate existing JWTs
    await supabaseAdmin
      .from('admins')
      .update({
        password_hash: newHash,
        token_version: nextTokenVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', resetRecord.admin_id);

    // Invalidate any open OTP challenges for this admin
    await supabaseAdmin
      .from('admin_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_id', resetRecord.admin_id)
      .eq('purpose', 'password_reset')
      .is('used_at', null);

    // Clear cookie in current response if any
    const isProd = process.env.NODE_ENV === 'production';
    const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
    res.clearCookie('scar_admin_token', {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite
    });

    // Asynchronously dispatch security notification email
    sendAdminPasswordChangedEmail({
      email: admin.email,
      adminName: admin.username,
      timestamp: new Date().toISOString(),
      clientIp
    }).catch(e => console.warn('Password changed notification email warning:', e.message));

    // Record in audit log
    await recordAdminAuditLog({
      action: 'ADMIN_PASSWORD_RESET',
      actorId: resetRecord.admin_id,
      actorUsername: admin.username,
      targetAdminId: resetRecord.admin_id,
      targetEmail: admin.email,
      targetUsername: admin.username,
      details: { method: 'email_otp' },
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      message: 'Your password has been successfully reset! All existing sessions have been signed out. Please sign in with your new password.'
    });
  } catch (err) {
    console.error('Error completing password reset in Supabase:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ==========================================
// 3. AUTHENTICATED ADMIN ENDPOINTS
// ==========================================

// Enforce admin authentication for all routes below
router.use(requireAdminAuth);

// 3a. GET /api/admin/me
router.get('/me', async (req, res) => {
  let isDefaultPassword = false;
  if (isSupabaseServerConfigured && supabaseAdmin && req.admin?.id) {
    try {
      const { data: adminRecord } = await supabaseAdmin
        .from('admins')
        .select('password_hash')
        .eq('id', req.admin.id)
        .maybeSingle();

      if (adminRecord?.password_hash) {
        isDefaultPassword = bcrypt.compareSync('Srinu@2026', adminRecord.password_hash);
      }
    } catch (_e) {}
  }

  res.json({
    admin: {
      ...req.admin,
      usingDefaultPassword: isDefaultPassword
    }
  });
});

// 3b. POST /api/admin/change-password
router.post('/change-password', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required' });
  }

  if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  try {
    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, password_hash, token_version')
      .eq('id', req.admin.id)
      .maybeSingle();

    if (adminErr || !adminRecord) {
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
    const nextTokenVersion = (adminRecord.token_version || 1) + 1;

    await supabaseAdmin
      .from('admins')
      .update({
        password_hash: newHash,
        token_version: nextTokenVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminRecord.id);

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing admin password in Supabase:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// 3c. GET /api/admin/metrics
router.get('/metrics', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [bookingsRes, blockedRes, upcomingRes] = await Promise.all([
      supabaseAdmin.from('bookings').select('status, final_agreed_price, estimated_min_price'),
      supabaseAdmin.from('blocked_dates').select('*', { count: 'exact', head: true }).gte('end_date', today),
      supabaseAdmin
        .from('bookings')
        .select('id, reference_no, customer_name, customer_phone, destination, pickup_datetime, return_datetime, status, final_agreed_price, estimated_min_price')
        .in('status', ['confirmed', 'pending'])
        .order('pickup_datetime', { ascending: true })
        .limit(7)
    ]);

    if (bookingsRes.error) throw bookingsRes.error;
    if (blockedRes.error) throw blockedRes.error;
    if (upcomingRes.error) throw upcomingRes.error;

    const allBookings = bookingsRes.data || [];
    let pending = 0, confirmed = 0, completed = 0, cancelled = 0;
    let total_confirmed_revenue = 0, pending_potential_revenue = 0;

    for (const b of allBookings) {
      if (b.status === 'pending') {
        pending++;
        pending_potential_revenue += (b.estimated_min_price || 0);
      } else if (b.status === 'confirmed') {
        confirmed++;
        total_confirmed_revenue += (b.final_agreed_price || b.estimated_min_price || 0);
      } else if (b.status === 'completed') {
        completed++;
        total_confirmed_revenue += (b.final_agreed_price || b.estimated_min_price || 0);
      } else if (b.status === 'cancelled') {
        cancelled++;
      }
    }

    const diag = await testSupabaseServerConnection();

    res.json({
      metrics: {
        total: allBookings.length,
        pending,
        confirmed,
        completed,
        cancelled,
        total_confirmed_revenue,
        pending_potential_revenue,
        blocked_dates_count: blockedRes.count || 0
      },
      upcomingTrips: upcomingRes.data || [],
      supabaseStatus: diag
    });
  } catch (error) {
    console.error('Error fetching admin metrics from Supabase:', error);
    res.status(500).json({ error: 'Failed to load metrics' });
  }
});

// 4. GET /api/admin/bookings
router.get('/bookings', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { status, trip_type, search, from_date, to_date } = req.query;

    let query = supabaseAdmin.from('bookings').select('*');

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (trip_type && trip_type !== 'all') {
      query = query.eq('trip_type', trip_type);
    }

    if (from_date) {
      query = query.gte('pickup_datetime', from_date);
    }

    if (to_date) {
      query = query.lte('pickup_datetime', to_date);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`reference_no.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,destination.ilike.%${term}%`);
    }

    query = query.order('pickup_datetime', { ascending: false });

    const { data: bookings, error } = await query;
    if (error) throw error;

    res.json({ bookings: bookings || [] });
  } catch (error) {
    console.error('Error querying bookings from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// 5. GET /api/admin/bookings/:id
router.get('/bookings/:id', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const isUuid = UUID_REGEX.test(id);

  try {
    let bQuery = supabaseAdmin.from('bookings').select('*');
    if (isUuid) {
      bQuery = bQuery.eq('id', id);
    } else {
      bQuery = bQuery.eq('reference_no', id);
    }

    const { data: booking, error: bErr } = await bQuery.maybeSingle();
    if (bErr || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: auditLogs } = await supabaseAdmin
      .from('booking_status_history')
      .select('id, previous_status, new_status, changed_by, remarks, created_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false });

    res.json({
      booking,
      auditLogs: (auditLogs || []).map(l => ({
        ...l,
        old_status: l.previous_status
      }))
    });
  } catch (error) {
    console.error('Error fetching booking by ID from Supabase:', error);
    res.status(500).json({ error: 'Failed to retrieve booking' });
  }
});

// 6. PATCH /api/admin/bookings/:id/status
router.patch('/bookings/:id/status', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const { status, remarks, final_agreed_price } = req.body;

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const isUuid = UUID_REGEX.test(id);
  try {
    let findQuery = supabaseAdmin.from('bookings').select('*');
    if (isUuid) {
      findQuery = findQuery.eq('id', id);
    } else {
      findQuery = findQuery.eq('reference_no', id);
    }

    const { data: existing, error: findErr } = await findQuery.maybeSingle();
    if (findErr || !existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Status transition: if moving to 'confirmed', invoke atomic RPC with advisory lock
    if (status === 'confirmed') {
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('confirm_booking_atomic', {
        p_booking_id: existing.id,
        p_new_status: 'confirmed',
        p_remarks: remarks || `Status updated from ${existing.status} to confirmed`,
        p_final_price: final_agreed_price !== undefined && final_agreed_price !== null ? Number(final_agreed_price) : null,
        p_admin_user: req.admin?.username || 'Owner Srinu',
        p_reference_no: existing.reference_no
      });

      if (rpcErr) {
        if (rpcErr.message?.includes('CONFLICT') || rpcErr.code === 'P0002') {
          return res.status(409).json({
            error: formatSafeDbError(rpcErr),
            conflict: { hasConflict: true, message: rpcErr.message }
          });
        }
        return res.status(400).json({ error: formatSafeDbError(rpcErr) });
      }

      return res.json({ success: true, booking: rpcData?.booking || existing });
    }

    // Direct update for other statuses ('completed', 'cancelled', 'pending')
    const updatePayload = {
      status,
      updated_at: new Date().toISOString()
    };
    if (final_agreed_price !== undefined && final_agreed_price !== null) {
      updatePayload.final_agreed_price = Number(final_agreed_price);
    }
    if (remarks) {
      updatePayload.admin_notes = remarks;
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Error updating booking status in Supabase:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// 7. PATCH /api/admin/bookings/:id/details
router.patch('/bookings/:id/details', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const { admin_notes, final_agreed_price } = req.body;
  const isUuid = UUID_REGEX.test(id);

  try {
    let findQuery = supabaseAdmin.from('bookings').select('*');
    if (isUuid) {
      findQuery = findQuery.eq('id', id);
    } else {
      findQuery = findQuery.eq('reference_no', id);
    }

    const { data: existing, error: findErr } = await findQuery.maybeSingle();
    if (findErr || !existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const payload = { updated_at: new Date().toISOString() };
    if (admin_notes !== undefined) payload.admin_notes = admin_notes;
    if (final_agreed_price !== undefined && final_agreed_price !== null) {
      payload.final_agreed_price = Number(final_agreed_price);
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Error updating booking details in Supabase:', error);
    res.status(500).json({ error: 'Failed to update booking details' });
  }
});

// 8. DELETE /api/admin/bookings/:id (Data retention policy)
router.delete('/bookings/:id', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const isUuid = UUID_REGEX.test(id);

  try {
    let findQuery = supabaseAdmin.from('bookings').select('id, reference_no');
    if (isUuid) {
      findQuery = findQuery.eq('id', id);
    } else {
      findQuery = findQuery.eq('reference_no', id);
    }

    const { data: existing, error: findErr } = await findQuery.maybeSingle();
    if (findErr || !existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { error: delErr } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', existing.id);

    if (delErr) throw delErr;

    res.json({ success: true, message: `Booking ${existing.reference_no} removed per retention policy` });
  } catch (error) {
    console.error('Error deleting booking from Supabase:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// 9. GET /api/admin/export/csv
router.get('/export/csv', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        reference_no, customer_name, customer_phone, service_type, trip_type,
        pickup_location, destination, pickup_datetime, return_datetime,
        passengers, luggage_count, estimated_min_price, estimated_max_price,
        final_agreed_price, status, admin_notes, created_at
      `)
      .order('pickup_datetime', { ascending: false });

    if (error) throw error;

    const headers = [
      'Reference No', 'Customer Name', 'Phone', 'Service Type', 'Trip Type',
      'Pickup Location', 'Destination', 'Pickup Date Time', 'Return Date Time',
      'Passengers', 'Luggage', 'Min Estimate (INR)', 'Max Estimate (INR)',
      'Final Agreed Price (INR)', 'Status', 'Admin Notes', 'Booked On'
    ];

    const rows = (bookings || []).map(b => [
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
    console.error('Error generating CSV export from Supabase:', error);
    res.status(500).json({ error: 'Failed to export bookings' });
  }
});

// 10. Pricing Rules Endpoints
router.get('/pricing', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: rules, error } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ rules: rules || [] });
  } catch (error) {
    console.error('Error fetching pricing rules from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
});

router.put('/pricing/:id', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const {
    title_en, title_te, min_price, max_price, duration_hours,
    distance_limit_km, fuel_included, tolls_included, driver_bata_included,
    description_en, description_te, active
  } = req.body;

  const isUuid = UUID_REGEX.test(id);

  try {
    let updateQuery = supabaseAdmin.from('pricing_rules').update({
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
    });

    if (isUuid) {
      updateQuery = updateQuery.eq('id', id);
    } else {
      updateQuery = updateQuery.eq('rule_code', id);
    }

    const { data: updated, error } = await updateQuery.select().single();
    if (error) throw error;

    res.json({ success: true, rule: updated });
  } catch (error) {
    console.error('Error updating pricing rule in Supabase:', error);
    res.status(500).json({ error: 'Failed to update pricing rule' });
  }
});

// 11. Destinations Endpoints
router.get('/destinations', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: destinations, error } = await supabaseAdmin
      .from('destinations')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('distance_km', { ascending: true });

    if (error) throw error;
    res.json({ destinations: destinations || [] });
  } catch (error) {
    console.error('Error fetching destinations from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

router.post('/destinations', async (req, res) => {
  if (!assertSupabase(res)) return;

  const {
    key_slug, name_en, name_te, distance_km, duration_hours,
    one_way_price_min, round_trip_price_min, round_trip_price_max,
    popular, category, description_en, description_te, sort_order
  } = req.body;

  try {
    const slug = (key_slug || name_en).toLowerCase().replace(/[^a-z0-9]/g, '-');

    const { data: created, error } = await supabaseAdmin
      .from('destinations')
      .insert({
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
        sort_order: Number(sort_order || 0),
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, destination: created });
  } catch (error) {
    console.error('Error creating destination in Supabase:', error);
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

router.put('/destinations/:id', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const {
    name_en, name_te, distance_km, duration_hours,
    one_way_price_min, round_trip_price_min, round_trip_price_max,
    popular, category, description_en, description_te, active, sort_order
  } = req.body;

  const isUuid = UUID_REGEX.test(id);

  try {
    let updateQuery = supabaseAdmin.from('destinations').update({
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
      sort_order: Number(sort_order || 0),
      updated_at: new Date().toISOString()
    });

    if (isUuid) {
      updateQuery = updateQuery.eq('id', id);
    } else {
      updateQuery = updateQuery.eq('key_slug', id);
    }

    const { data: updated, error } = await updateQuery.select().single();
    if (error) throw error;

    res.json({ success: true, destination: updated });
  } catch (error) {
    console.error('Error updating destination in Supabase:', error);
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

router.delete('/destinations/:id', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const isUuid = UUID_REGEX.test(id);

  try {
    let delQuery = supabaseAdmin.from('destinations').delete();
    if (isUuid) {
      delQuery = delQuery.eq('id', id);
    } else {
      delQuery = delQuery.eq('key_slug', id);
    }

    const { error } = await delQuery;
    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting destination in Supabase:', error);
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

// 12. Vehicle Management (Single Ertiga)
router.get('/vehicle', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: vehicle, error } = await supabaseAdmin
      .from('vehicles')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

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

    res.json({ vehicle });
  } catch (error) {
    console.error('Error fetching vehicle from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle details' });
  }
});

router.put('/vehicle', async (req, res) => {
  if (!assertSupabase(res)) return;

  const {
    model_name, color, registration_number, seating_capacity,
    fuel_type, transmission, air_conditioning, luggage_capacity,
    features, status, last_sanitized_at, insurance_valid_until, fitness_valid_until
  } = req.body;

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('vehicles')
      .update({
        model_name,
        color,
        registration_number,
        seating_capacity: Number(seating_capacity),
        fuel_type,
        transmission,
        air_conditioning: String(air_conditioning),
        luggage_capacity: String(luggage_capacity),
        features: Array.isArray(features) ? features : [],
        status,
        last_sanitized_at,
        insurance_valid_until: insurance_valid_until || null,
        fitness_valid_until: fitness_valid_until || null,
        updated_at: new Date().toISOString()
      })
      .eq('is_sole_fleet_vehicle', true)
      .select()
      .single();

    if (error) throw error;

    if (updated) {
      updated.features_json = JSON.stringify(updated.features || []);
    }

    res.json({ success: true, vehicle: updated });
  } catch (error) {
    console.error('Error updating vehicle in Supabase:', error);
    res.status(500).json({ error: 'Failed to update vehicle details' });
  }
});

// 13. Blocked Dates Endpoints
router.get('/blocked-dates', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: blockedDates, error } = await supabaseAdmin
      .from('blocked_dates')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) throw error;
    res.json({ blockedDates: blockedDates || [] });
  } catch (error) {
    console.error('Error fetching blocked dates from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch blocked dates' });
  }
});

router.post('/blocked-dates', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { start_date, end_date, reason } = req.body;
  if (!start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'Start date, end date, and reason are required' });
  }

  try {
    const { data, error: rpcErr } = await supabaseAdmin.rpc('block_dates_atomic', {
      p_start_date: start_date,
      p_end_date: end_date,
      p_reason: reason.trim(),
      p_admin_user: req.admin?.username || 'Owner Srinu'
    });

    if (rpcErr) {
      if (rpcErr.message?.includes('CONFLICT') || rpcErr.code === 'P0002') {
        return res.status(409).json({
          error: formatSafeDbError(rpcErr),
          conflict: { hasConflict: true, message: rpcErr.message }
        });
      }
      return res.status(400).json({ error: formatSafeDbError(rpcErr) });
    }

    res.status(201).json({ success: true, blockedDate: data?.blockedDate });
  } catch (error) {
    console.error('Error blocking dates in Supabase:', error);
    res.status(500).json({ error: 'Failed to add blocked date' });
  }
});

router.delete('/blocked-dates/:id', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { id } = req.params;
  const isUuid = UUID_REGEX.test(id);

  try {
    if (isUuid) {
      const { error: rpcErr } = await supabaseAdmin.rpc('unblock_dates_atomic', {
        p_block_id: id,
        p_admin_user: req.admin?.username || 'Owner Srinu'
      });
      if (rpcErr) throw rpcErr;
    } else {
      const { error: delErr } = await supabaseAdmin
        .from('blocked_dates')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting blocked date from Supabase:', error);
    res.status(500).json({ error: 'Failed to delete blocked date' });
  }
});

// 14. Settings Endpoints
router.get('/settings', async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: raw, error } = await supabaseAdmin
      .from('site_settings')
      .select('key, value');

    if (error) throw error;

    const settings = {};
    for (const s of (raw || [])) {
      settings[s.key] = s.value;
    }
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching settings from Supabase:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/settings', async (req, res) => {
  if (!assertSupabase(res)) return;

  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings object' });
  }

  try {
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert(rows);

    if (error) throw error;

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings in Supabase:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 15. Email Notification Diagnostics
router.get('/email-status', (req, res) => {
  const isConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
  const fromEmail = getFromEmail();
  const isSandbox = fromEmail.includes('onboarding@resend.dev');

  res.json({
    configured: isConfigured,
    recipient: process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL,
    fromEmail,
    isSandbox,
    provider: 'Resend'
  });
});

router.post('/test-email', async (req, res) => {
  const isConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
  if (!isConfigured) {
    return res.status(400).json({
      error: 'RESEND_API_KEY is not configured on the server. Please set it in your environment variables.'
    });
  }

  const sampleBooking = {
    reference_no: `TEST-${new Date().getFullYear()}-0001`,
    customer_name: 'Test Customer (Admin Diagnostic)',
    customer_phone: '9550641408',
    customer_email: 'test@example.com',
    service_type: 'with_driver',
    trip_type: 'round_trip',
    pickup_location: 'Kotananduru',
    destination: 'Visakhapatnam Beach',
    pickup_datetime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    return_datetime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    passengers: 4,
    luggage_count: 2,
    estimated_min_price: 3500,
    estimated_max_price: 4000,
    special_notes: 'This is a test notification generated from the admin settings dashboard to verify Resend delivery.',
    hasConflict: false
  };

  const result = await sendBookingNotificationEmail(sampleBooking);
  if (result.success) {
    return res.json({
      success: true,
      message: `Test email sent successfully to ${process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL}`,
      messageId: result.messageId
    });
  } else {
    return res.status(502).json({
      error: result.error || 'Failed to deliver test email via Resend'
    });
  }
});

// ==========================================
// 16. MULTIPLE ADMIN MANAGEMENT (SUPER ADMIN ONLY)
// ==========================================

// GET /api/admin/accounts - List all admin accounts and pending invitations
router.get('/accounts', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const [adminsRes, invitesRes] = await Promise.all([
      supabaseAdmin
        .from('admins')
        .select('id, username, email, role, is_active, status, created_at')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('admin_invitations')
        .select(`
          id, admin_id, email, role, expires_at, used_at, created_at, invited_by,
          admins!invited_by (username)
        `)
        .is('used_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
    ]);

    if (adminsRes.error) throw adminsRes.error;
    if (invitesRes.error) throw invitesRes.error;

    const pendingInvites = (invitesRes.data || []).map(i => ({
      id: i.id,
      admin_id: i.admin_id,
      email: i.email,
      role: i.role,
      expires_at: i.expires_at,
      used_at: i.used_at,
      created_at: i.created_at,
      invited_by_username: i.admins?.username || 'Super Admin'
    }));

    res.json({
      admins: adminsRes.data || [],
      pendingInvites
    });
  } catch (err) {
    console.error('Error fetching admin accounts from Supabase:', err);
    res.status(500).json({ error: 'Failed to retrieve administrator accounts' });
  }
});

// POST /api/admin/accounts/invite - Send single-use time-limited invitation
router.post('/accounts/invite', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { username, email, role } = req.body;

  if (!username || typeof username !== 'string' || !email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Username and email are required.' });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const assignedRole = role === 'superadmin' ? 'superadmin' : 'admin';

  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    return res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and dashes.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    // Prevent duplicate username or email
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, status')
      .or(`email.ilike.${cleanEmail},username.ilike.${cleanUsername}`)
      .maybeSingle();

    if (existingAdmin) {
      if (existingAdmin.email.toLowerCase() === cleanEmail) {
        if (existingAdmin.status === 'invited') {
          return res.status(409).json({
            error: `An invitation for ${cleanEmail} is already pending. You can click 'Resend Invite' or 'Delete' in the Administrator Accounts list below.`
          });
        }
        return res.status(400).json({ error: 'An administrator with this email address already exists.' });
      }
      return res.status(400).json({ error: 'An administrator with this username already exists.' });
    }

    const placeholderHash = '$2a$10$' + crypto.randomBytes(24).toString('base64');

    const { data: newAdmin, error: insertErr } = await supabaseAdmin
      .from('admins')
      .insert({
        username: cleanUsername,
        email: cleanEmail,
        password_hash: placeholderHash,
        role: assignedRole,
        is_active: 0,
        status: 'invited'
      })
      .select()
      .single();

    if (insertErr || !newAdmin) throw insertErr;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresHours = 48;
    const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();

    const { error: inviteInsertErr } = await supabaseAdmin.from('admin_invitations').insert({
      token_hash: tokenHash,
      admin_id: newAdmin.id,
      email: cleanEmail,
      role: assignedRole,
      invited_by: req.admin.id,
      expires_at: expiresAt
    });

    if (inviteInsertErr) {
      await supabaseAdmin.from('admins').delete().eq('id', newAdmin.id);
      throw inviteInsertErr;
    }

    const frontendBaseUrl = req.headers.origin || process.env.APP_BASE_URL || process.env.FRONTEND_URL || (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',')[0].trim() : '') || 'https://s-car-travels-premium.onrender.com';

    const emailResult = await sendAdminInvitationEmail({
      email: cleanEmail,
      adminName: cleanUsername,
      inviteToken: rawToken,
      role: assignedRole,
      invitedByName: req.admin.username,
      frontendBaseUrl,
      expiresHours
    });

    if (!emailResult.success) {
      // Roll back the pending invitation and admin record so:
      // 1. The database is not left in a misleading "Pending Invite" state
      // 2. The Super Admin is not blocked from retrying once the sender domain is verified in Resend
      await supabaseAdmin.from('admin_invitations').delete().eq('admin_id', newAdmin.id);
      await supabaseAdmin.from('admins').delete().eq('id', newAdmin.id);

      await recordAdminAuditLog({
        action: 'ADMIN_INVITE_FAILED',
        actorId: req.admin.id,
        actorUsername: req.admin.username,
        targetEmail: cleanEmail,
        targetUsername: cleanUsername,
        details: { role: assignedRole, error: emailResult.error },
        ipAddress: clientIp
      });

      return res.status(502).json({
        error: `Invitation email could not be delivered: ${emailResult.error || 'Resend delivery failed'}. The pending invitation was rolled back so you can retry once the sender domain is verified.`
      });
    }

    await recordAdminAuditLog({
      action: 'ADMIN_INVITED',
      actorId: req.admin.id,
      actorUsername: req.admin.username,
      targetAdminId: newAdmin.id,
      targetEmail: cleanEmail,
      targetUsername: cleanUsername,
      details: { role: assignedRole, expiresHours, emailSent: true },
      ipAddress: clientIp
    });

    res.status(201).json({
      success: true,
      message: `Invitation successfully sent to ${cleanEmail}. The recipient has 48 hours to activate their account.`,
      emailSent: true,
      admin: {
        id: newAdmin.id,
        username: cleanUsername,
        email: cleanEmail,
        role: assignedRole,
        is_active: 0,
        status: 'invited'
      }
    });
  } catch (err) {
    console.error('Error inviting administrator in Supabase:', err);
    res.status(500).json({ error: 'Failed to create administrator invitation.' });
  }
});

// POST /api/admin/accounts/:id/resend-invite - Resend invitation email
router.post('/accounts/:id/resend-invite', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const targetId = req.params.id;

  try {
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, role, is_active, status')
      .eq('id', targetId)
      .maybeSingle();

    if (targetErr || !target) {
      return res.status(404).json({ error: 'Administrator account not found' });
    }

    if (target.status !== 'invited') {
      return res.status(400).json({ error: 'Only pending invited accounts can receive invitation resends.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresHours = 48;
    const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();

    const frontendBaseUrl = req.headers.origin || process.env.APP_BASE_URL || process.env.FRONTEND_URL || (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',')[0].trim() : '') || 'https://s-car-travels-premium.onrender.com';

    const emailResult = await sendAdminInvitationEmail({
      email: target.email,
      adminName: target.username,
      inviteToken: rawToken,
      role: target.role,
      invitedByName: req.admin.username,
      frontendBaseUrl,
      expiresHours
    });

    if (!emailResult.success) {
      await recordAdminAuditLog({
        action: 'ADMIN_INVITE_RESEND_FAILED',
        actorId: req.admin.id,
        actorUsername: req.admin.username,
        targetAdminId: target.id,
        targetEmail: target.email,
        targetUsername: target.username,
        details: { role: target.role, error: emailResult.error },
        ipAddress: clientIp
      });

      return res.status(502).json({
        error: `Failed to deliver invitation email to ${target.email}: ${emailResult.error || 'Resend delivery failed'}. Please ensure your sender domain is verified in Resend.`
      });
    }

    // Invalidate existing invitations only after delivery succeeds
    await supabaseAdmin
      .from('admin_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_id', target.id)
      .is('used_at', null);

    await supabaseAdmin.from('admin_invitations').insert({
      token_hash: tokenHash,
      admin_id: target.id,
      email: target.email,
      role: target.role,
      invited_by: req.admin.id,
      expires_at: expiresAt
    });

    await recordAdminAuditLog({
      action: 'ADMIN_INVITE_RESENT',
      actorId: req.admin.id,
      actorUsername: req.admin.username,
      targetAdminId: target.id,
      targetEmail: target.email,
      targetUsername: target.username,
      details: { role: target.role, expiresHours, emailSent: true },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: `Invitation successfully resent to ${target.email}.`,
      emailSent: true
    });
  } catch (err) {
    console.error('Error resending invite in Supabase:', err);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// PATCH /api/admin/accounts/:id/status - Enable or disable an admin account
router.patch('/accounts/:id/status', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const targetId = req.params.id;
  const { status, is_active } = req.body;

  try {
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, role, is_active, status')
      .eq('id', targetId)
      .maybeSingle();

    if (targetErr || !target) {
      return res.status(404).json({ error: 'Administrator account not found' });
    }

    let newStatus = status;
    let newActive = is_active !== undefined ? (is_active ? 1 : 0) : undefined;

    if (newStatus === undefined && newActive !== undefined) {
      newStatus = newActive === 1 ? 'active' : 'disabled';
    } else if (newStatus !== undefined && newActive === undefined) {
      newActive = newStatus === 'active' ? 1 : 0;
    }

    if (newActive !== 0 && newActive !== 1) {
      return res.status(400).json({ error: 'Invalid status specified. Must be "active" or "disabled".' });
    }

    // Invariant: Prevent disabling the last active Super Admin
    if (newActive === 0 && target.role === 'superadmin' && target.is_active === 1) {
      const { count: activeSuperAdmins } = await supabaseAdmin
        .from('admins')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'superadmin')
        .eq('is_active', 1)
        .eq('status', 'active');

      if (!activeSuperAdmins || activeSuperAdmins <= 1) {
        return res.status(400).json({
          error: 'Cannot disable the last active Super Administrator. At least one active Super Admin is required to manage the system.'
        });
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from('admins')
      .update({
        is_active: newActive,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', target.id);

    if (updateErr) {
      return res.status(400).json({ error: formatSafeDbError(updateErr) });
    }

    // If disabling, invalidate any open OTPs for this admin
    if (newActive === 0) {
      await supabaseAdmin
        .from('admin_otps')
        .update({ used_at: new Date().toISOString() })
        .eq('admin_id', target.id)
        .is('used_at', null);
    }

    await recordAdminAuditLog({
      action: newActive === 1 ? 'ADMIN_ENABLED' : 'ADMIN_DISABLED',
      actorId: req.admin.id,
      actorUsername: req.admin.username,
      targetAdminId: target.id,
      targetEmail: target.email,
      targetUsername: target.username,
      details: { previousStatus: target.status, newStatus },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: `Administrator ${target.username} has been ${newActive === 1 ? 'enabled' : 'disabled'}.`,
      admin: {
        id: target.id,
        username: target.username,
        email: target.email,
        role: target.role,
        is_active: newActive,
        status: newStatus
      }
    });
  } catch (err) {
    console.error('Error changing admin account status in Supabase:', err);
    res.status(500).json({ error: 'Failed to update administrator status' });
  }
});

// PATCH /api/admin/accounts/:id/role - Change admin role (Super Admin vs Admin)
router.patch('/accounts/:id/role', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const targetId = req.params.id;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(400).json({ error: 'Role must be either "admin" or "superadmin".' });
  }

  try {
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, role, is_active, status')
      .eq('id', targetId)
      .maybeSingle();

    if (targetErr || !target) {
      return res.status(404).json({ error: 'Administrator account not found' });
    }

    // Invariant: Prevent demoting the last active Super Admin
    if (target.role === 'superadmin' && role === 'admin' && target.is_active === 1) {
      const { count: activeSuperAdmins } = await supabaseAdmin
        .from('admins')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'superadmin')
        .eq('is_active', 1)
        .eq('status', 'active');

      if (!activeSuperAdmins || activeSuperAdmins <= 1) {
        return res.status(400).json({
          error: 'Cannot demote the last active Super Administrator. At least one active Super Admin is required to manage the system.'
        });
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from('admins')
      .update({
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', target.id);

    if (updateErr) {
      return res.status(400).json({ error: formatSafeDbError(updateErr) });
    }

    await recordAdminAuditLog({
      action: 'ADMIN_ROLE_CHANGED',
      actorId: req.admin.id,
      actorUsername: req.admin.username,
      targetAdminId: target.id,
      targetEmail: target.email,
      targetUsername: target.username,
      details: { previousRole: target.role, newRole: role },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: `Role for ${target.username} updated to ${role}.`,
      admin: {
        id: target.id,
        username: target.username,
        email: target.email,
        role,
        is_active: target.is_active,
        status: target.status
      }
    });
  } catch (err) {
    console.error('Error changing admin role in Supabase:', err);
    res.status(500).json({ error: 'Failed to update administrator role' });
  }
});

// DELETE /api/admin/accounts/:id - Remove an admin account
router.delete('/accounts/:id', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const targetId = req.params.id;

  if (targetId === req.admin.id) {
    return res.status(400).json({ error: 'You cannot delete your own administrator account while logged in.' });
  }

  try {
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, role, is_active, status')
      .eq('id', targetId)
      .maybeSingle();

    if (targetErr || !target) {
      return res.status(404).json({ error: 'Administrator account not found' });
    }

    // Invariant: Prevent deleting the last active Super Admin
    if (target.role === 'superadmin' && target.is_active === 1) {
      const { count: activeSuperAdmins } = await supabaseAdmin
        .from('admins')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'superadmin')
        .eq('is_active', 1)
        .eq('status', 'active');

      if (!activeSuperAdmins || activeSuperAdmins <= 1) {
        return res.status(400).json({
          error: 'Cannot delete the last active Super Administrator.'
        });
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from('admins')
      .delete()
      .eq('id', target.id);

    if (delErr) {
      return res.status(400).json({ error: formatSafeDbError(delErr) });
    }

    await recordAdminAuditLog({
      action: 'ADMIN_DELETED',
      actorId: req.admin.id,
      actorUsername: req.admin.username,
      targetAdminId: target.id,
      targetEmail: target.email,
      targetUsername: target.username,
      details: { deletedRole: target.role },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: `Administrator ${target.username} removed successfully.`
    });
  } catch (err) {
    console.error('Error deleting admin from Supabase:', err);
    res.status(500).json({ error: 'Failed to delete administrator' });
  }
});

// GET /api/admin/accounts/audit-logs - View recent administrative activity logs
router.get('/accounts/audit-logs', requireSuperAdmin, async (req, res) => {
  if (!assertSupabase(res)) return;

  try {
    const { data: logs, error } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('id, action, actor_id, actor_username, target_admin_id, target_username, target_email, details_json, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ logs: logs || [] });
  } catch (err) {
    console.error('Error fetching admin audit logs from Supabase:', err);
    res.status(500).json({ error: 'Failed to retrieve administrative audit logs' });
  }
});

export default router;
