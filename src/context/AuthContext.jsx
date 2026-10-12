import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiUrl } from '../lib/api';

const AuthContext = createContext();

// Helper to get CSRF token from document cookie
function getCsrfFromCookie() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(^|;)\s*scar_csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : '';
}

export function AuthProvider({ children }) {
  // Prefer in-memory & sessionStorage over persistent localStorage for sensitive tokens
  const [token, setToken] = useState(() => sessionStorage.getItem('scar_admin_token') || null);
  const [csrfToken, setCsrfToken] = useState(() => sessionStorage.getItem('scar_csrf_token') || getCsrfFromCookie() || '');
  const [admin, setAdmin] = useState(() => {
    const saved = sessionStorage.getItem('scar_admin_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/admin/logout'), {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      // Ignore network errors on logout
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }

    setToken(null);
    setCsrfToken('');
    setAdmin(null);
    sessionStorage.removeItem('scar_admin_token');
    sessionStorage.removeItem('scar_csrf_token');
    sessionStorage.removeItem('scar_admin_info');

    // Clean up legacy localStorage if present
    localStorage.removeItem('scar_admin_token');
    localStorage.removeItem('scar_admin_info');
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      // 1. If Supabase is configured, check if there's an active Supabase session
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            const sbUser = session.user;
            const adminObj = {
              id: sbUser.id,
              username: sbUser.user_metadata?.username || sbUser.email?.split('@')[0] || 'admin',
              email: sbUser.email,
              role: sbUser.app_metadata?.role || sbUser.user_metadata?.role || 'admin',
              isSupabase: true
            };
            if (mounted) {
              setToken(session.access_token);
              setAdmin(adminObj);
              sessionStorage.setItem('scar_admin_token', session.access_token);
              sessionStorage.setItem('scar_admin_info', JSON.stringify(adminObj));
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // 2. Check server session via HttpOnly cookie or token
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(apiUrl('/api/admin/me'), {
          credentials: 'include',
          headers
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setAdmin(data.admin);
            sessionStorage.setItem('scar_admin_info', JSON.stringify(data.admin));
            const cookieCsrf = getCsrfFromCookie();
            if (cookieCsrf) {
              setCsrfToken(cookieCsrf);
              sessionStorage.setItem('scar_csrf_token', cookieCsrf);
            }
          }
        } else {
          // If 401 or invalid, clear invalid state
          if (mounted) {
            setToken(null);
            setAdmin(null);
            sessionStorage.removeItem('scar_admin_token');
            sessionStorage.removeItem('scar_csrf_token');
            sessionStorage.removeItem('scar_admin_info');
          }
        }
      } catch (err) {
        if (mounted) {
          setToken(null);
          setAdmin(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [logout]);

  /**
   * Step 1: Initiate Admin Login with registered Email + Password.
   * Validates credentials and triggers 8-digit OTP email dispatch.
   * Does NOT issue tokens or set authenticated state.
   */
  const initiateLogin = async (email, password) => {
    const res = await fetch(apiUrl('/api/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email?.trim(), password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid email or password');
    }

    return data;
  };

  /**
   * Step 2: Verify 8-digit OTP code
   * Validates OTP against hashed challenge in SQLite and issues authenticated session.
   */
  const verifyLoginOtp = async (challengeId, otp) => {
    const res = await fetch(apiUrl('/api/admin/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ challengeId: challengeId?.trim(), otp: otp?.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid verification code');
    }

    setToken(data.token);
    setAdmin(data.admin);
    const newCsrf = data.csrfToken || getCsrfFromCookie();
    setCsrfToken(newCsrf);

    sessionStorage.setItem('scar_admin_token', data.token);
    sessionStorage.setItem('scar_csrf_token', newCsrf);
    sessionStorage.setItem('scar_admin_info', JSON.stringify(data.admin));

    // Clear legacy storage
    localStorage.removeItem('scar_admin_token');
    localStorage.removeItem('scar_admin_info');

    return data;
  };

  /**
   * Resend 8-digit OTP code (with 60-second cooldown check)
   */
  const resendLoginOtp = async (challengeId) => {
    const res = await fetch(apiUrl('/api/admin/resend-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ challengeId: challengeId?.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend verification code');
    }

    return data;
  };

  /**
   * Step 1 (Forgot Password): Request password reset OTP
   */
  const forgotPassword = async (email) => {
    const res = await fetch(apiUrl('/api/admin/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email?.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to request password reset code');
    }

    return data;
  };

  /**
   * Resend password reset OTP
   */
  const resendResetOtp = async (challengeId) => {
    const res = await fetch(apiUrl('/api/admin/resend-reset-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ challengeId: challengeId?.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend recovery code');
    }

    return data;
  };

  /**
   * Step 2 (Forgot Password): Verify reset OTP -> returns resetToken
   */
  const verifyResetOtp = async (challengeId, otp) => {
    const res = await fetch(apiUrl('/api/admin/verify-reset-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ challengeId: challengeId?.trim(), otp: otp?.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid or expired verification code');
    }

    return data;
  };

  /**
   * Step 3 (Forgot Password): Set new password using resetToken
   */
  const resetPassword = async (resetToken, password) => {
    const res = await fetch(apiUrl('/api/admin/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resetToken: resetToken?.trim(), password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }

    return data;
  };

  /**
   * Helper for making authenticated admin API requests with automatic credentials & CSRF
   */
  const adminFetch = useCallback(async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const effectiveCsrf = csrfToken || getCsrfFromCookie();
    if (effectiveCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase())) {
      headers['X-CSRF-Token'] = effectiveCsrf;
    }

    const res = await fetch(apiUrl(url), {
      ...options,
      credentials: 'include',
      headers
    });

    if (res.status === 401) {
      logout();
    }

    return res;
  }, [token, csrfToken, logout]);

  return (
    <AuthContext.Provider
      value={{
        token,
        csrfToken,
        admin,
        login: initiateLogin,
        initiateLogin,
        verifyLoginOtp,
        resendLoginOtp,
        forgotPassword,
        resendResetOtp,
        verifyResetOtp,
        resetPassword,
        logout,
        adminFetch,
        loading,
        isAuthenticated: !!admin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
