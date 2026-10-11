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
 * Sign a secure JWT for an authenticated admin
 */
export function signAdminToken(admin) {
  const role = admin.role || 'admin';
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role
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
  loginAttempts.delete(identifier);
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

    // Enforce explicit admin role
    const role = decoded.role;
    if (!role || (role !== 'admin' && role !== 'superadmin')) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient administrative privileges',
        code: 'ROLE_FORBIDDEN'
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

    req.admin = decoded;
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
      } catch (sbErr) {
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
