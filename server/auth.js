import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabaseAdmin, isSupabaseServerConfigured } from './supabase.js';


// JWT Configuration Constants
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'scar-travels-premium';
export const JWT_AUDIENCE = 'scar-admin-console';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters in production.');
    return secret || 'scar_premium_kotananduru_super_secure_jwt_secret_key_2026_production_min64chars';
  }
  return secret.trim();
}

/**
 * Express middleware to restrict routes strictly to Super Administrators
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Forbidden: Super Administrator privileges required',
      code: 'SUPERADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * Sign a secure JWT for an authenticated admin
 */
export function signAdminToken(admin) {
  const role = admin.role || 'admin';
  const tokenVersion = admin.token_version !== undefined ? admin.token_version : 1;
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role,
      token_version: tokenVersion
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: process.env.JWT_EXPIRY || '8h',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: String(admin.id)
    }
  );
}

/**
 * Generate a cryptographically random CSRF token
 */
export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Generate a cryptographically secure random 8-digit numeric OTP code
 */
export function generateOtpCode(digits = 8) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits);
  return String(crypto.randomInt(min, max));
}

/**
 * Generate a cryptographically random challenge ID for OTP sessions
 */
export function generateChallengeId() {
  return `ch_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Hash an OTP code using HMAC-SHA256 with server-side secret key / salt
 */
export function hashOtpCode(otp, salt = getJwtSecret()) {
  const secretKey = typeof salt === 'string' && salt.length > 0 ? salt : getJwtSecret();
  return crypto.createHmac('sha256', secretKey).update(String(otp).trim()).digest('hex');
}

/**
 * Timing-safe comparison of submitted OTP code against stored hash
 */
export function verifyOtpHash(submittedOtp, storedHash, salt = getJwtSecret()) {
  if (!submittedOtp || !storedHash) return false;
  const computed = hashOtpCode(submittedOtp, salt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Mask an email address for safe display in UI
 * e.g. "srinu@scar.com" -> "s***@scar.com"
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const visibleLen = Math.min(3, Math.max(1, Math.floor(name.length / 2)));
  const visible = name.slice(0, visibleLen);
  return `${visible}***@${domain}`;
}

// In-memory brute-force rate limiter for admin login
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkLoginRateLimit(identifier) {
  const now = Date.now();
  const record = loginAttempts.get(identifier);

  if (!record) {
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  }

  // Reset window if lockout period has passed
  if (now - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    loginAttempts.delete(identifier);
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  }

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.firstAttemptAt + LOCKOUT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - record.attempts };
}

export function recordFailedLogin(identifier) {
  const now = Date.now();
  const record = loginAttempts.get(identifier) || { attempts: 0, firstAttemptAt: now };
  record.attempts += 1;
  loginAttempts.set(identifier, record);
}

export function clearFailedLogin(identifier) {
  if (!identifier) {
    loginAttempts.clear();
    return;
  }
  loginAttempts.delete(identifier);
  if (identifier === '127.0.0.1' || identifier === '::1' || identifier === '::ffff:127.0.0.1') {
    loginAttempts.delete('127.0.0.1');
    loginAttempts.delete('::ffff:127.0.0.1');
    loginAttempts.delete('::1');
  }
}

/**
 * Express middleware to authenticate and authorize admin requests
 */
export async function requireAdminAuth(req, res, next) {
  let token = null;

  // 1. Check Authorization: Bearer <token> header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1].trim();
  }

  // 2. Fall back to HttpOnly cookie if header is not present
  if (!token && req.cookies && req.cookies.scar_admin_token) {
    token = req.cookies.scar_admin_token.trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Admin authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // 3. Verify JWT with signature, issuer, audience, and algorithm constraints
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    // Enforce explicit admin role from token claims
    const role = decoded.role;
    if (!role || (role !== 'admin' && role !== 'superadmin')) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient administrative privileges',
        code: 'ROLE_FORBIDDEN'
      });
    }

    // Verify admin account is active in Supabase (instantly invalidates sessions of disabled admins)
    if (!isSupabaseServerConfigured || !supabaseAdmin) {
      return res.status(503).json({
        error: 'Database service unavailable. Supabase PostgreSQL is required.',
        code: 'DB_UNAVAILABLE'
      });
    }

    const { data: currentAdmin, error: sbAdminErr } = await supabaseAdmin
      .from('admins')
      .select('id, username, email, role, is_active, status, token_version')
      .eq('id', decoded.id)
      .maybeSingle();

    if (sbAdminErr) {
      console.error('Failed to verify admin in Supabase:', sbAdminErr);
      return res.status(503).json({
        error: 'Database service unavailable. Please try again.',
        code: 'DB_UNAVAILABLE'
      });
    }
    if (!currentAdmin || currentAdmin.is_active === 0 || currentAdmin.status === 'disabled') {
      return res.status(401).json({
        error: 'Administrator account has been disabled or removed. Access denied.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Reliable session revocation check: verify token_version matches current active version
    const currentTokenVersion = currentAdmin.token_version || 1;
    const decodedTokenVersion = decoded.token_version || 1;
    if (decodedTokenVersion !== currentTokenVersion) {
      return res.status(401).json({
        error: 'Session has been invalidated due to a password reset or security update. Please sign in again.',
        code: 'SESSION_REVOKED'
      });
    }

    // CSRF Protection:
    // If request was authenticated via Cookie (not explicit Bearer header)
    // and is a state-changing method (POST, PUT, PATCH, DELETE), verify CSRF token
    const isHeaderAuth = Boolean(authHeader && authHeader.startsWith('Bearer '));
    if (!isHeaderAuth && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const headerCsrf = req.headers['x-csrf-token'];
      const cookieCsrf = req.cookies?.scar_csrf_token;
      if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf) {
        return res.status(403).json({
          error: 'Forbidden: Invalid or missing CSRF token',
          code: 'CSRF_INVALID'
        });
      }
    }

    req.admin = {
      ...decoded,
      username: currentAdmin.username,
      email: currentAdmin.email,
      role: currentAdmin.role,
      is_active: currentAdmin.is_active,
      status: currentAdmin.status
    };
    return next();
  } catch (jwtErr) {
    if (jwtErr.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Attempt Supabase Auth access token verification if configured
    if (isSupabaseServerConfigured && supabaseAdmin) {
      try {
        const { data: { user }, error: sbAuthErr } = await supabaseAdmin.auth.getUser(token);
        if (!sbAuthErr && user) {
          const role = user.app_metadata?.role || user.user_metadata?.role || 'user';
          if (role !== 'admin' && role !== 'superadmin') {
            return res.status(403).json({
              error: 'Forbidden: Insufficient administrative privileges',
              code: 'ROLE_FORBIDDEN'
            });
          }

          req.admin = {
            id: user.id,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'admin',
            email: user.email,
            role,
            isSupabaseAuth: true
          };
          return next();
        }
      } catch (_sbErr) {
        // Fall through to 401
      }
    }

    return res.status(401).json({
      error: 'Invalid or tampered authentication token. Please log in again.',
      code: 'TOKEN_INVALID'
    });
  }
}

/**
 * Optional middleware for routes requiring superadmin privileges
 */
export function requireSuperAdminRole(req, res, next) {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Forbidden: Superadmin privilege required',
      code: 'SUPERADMIN_REQUIRED'
    });
  }
  next();
}
