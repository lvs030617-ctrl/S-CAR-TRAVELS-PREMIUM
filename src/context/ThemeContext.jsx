import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'scar_theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference) {
  if (preference === 'system' || !preference) return getSystemTheme();
  return preference;
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#070b14' : '#F8FAFC');
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || 'system';
    return resolveTheme(stored);
  });

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    if (preference === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = useCallback((newPref) => {
    setPreference(newPref);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
