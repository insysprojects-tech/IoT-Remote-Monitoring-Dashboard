import { useState, useEffect } from 'react';

/**
 * Custom hook to detect and respond to theme changes ('light' or 'dark').
 * Accurately detects `data-theme` attribute set on <html>, with fallback
 * to localStorage and system preferences.
 */
export const useTheme = () => {
  const getTheme = () => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') return attr;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('app-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Observe data-theme changes on <html>
    const observer = new MutationObserver(() => {
      setTheme(getTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Listen to localStorage changes across tabs/windows
    const handleStorage = (e) => {
      if (e.key === 'app-theme') {
        setTheme(getTheme());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };
};
