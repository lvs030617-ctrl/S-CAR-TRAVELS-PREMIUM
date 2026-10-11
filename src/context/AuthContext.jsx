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

  const login = async (username, password) => {
    // 1. If Supabase is configured and input has @, attempt Supabase Auth first
    if (isSupabaseConfigured && username.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username.trim(),
          password
        });
        if (!error && data?.session) {
          const adminObj = {
            id: data.user.id,
            username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'admin',
            email: data.user.email,
            role: data.user.app_metadata?.role || data.user.user_metadata?.role || 'admin',
            isSupabase: true
          };
          setToken(data.session.access_token);
          setAdmin(adminObj);
          sessionStorage.setItem('scar_admin_token', data.session.access_token);
          sessionStorage.setItem('scar_admin_info', JSON.stringify(adminObj));
          return { token: data.session.access_token, admin: adminObj };
        }
      } catch (sbLoginErr) {
        console.warn('Supabase Auth login attempt deferred to local API:', sbLoginErr.message);
      }
    }

    // 2. Server login (Sets HttpOnly session cookie + CSRF cookie)
    const res = await fetch(apiUrl('/api/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid username or password');
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
        login,
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
