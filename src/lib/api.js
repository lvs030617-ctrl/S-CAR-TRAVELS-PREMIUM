/**
 * S CAR TRAVELS PREMIUM - Centralized API Configuration
 * Supports VITE_API_BASE_URL for decoupled deployments (e.g. Vercel frontend + Render backend)
 * Defaults to '' for same-origin or local development with Vite proxy.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * Returns a fully qualified or relative API endpoint URL.
 * Example: apiUrl('/api/public/config') -> 'https://api.my-service.onrender.com/api/public/config' or '/api/public/config'
 */
export function apiUrl(endpoint) {
  if (!endpoint) return API_BASE_URL || '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalized}`;
}

export default apiUrl;
