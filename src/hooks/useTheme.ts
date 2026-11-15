import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('ws_theme_mode') as ThemeMode | null;
    return saved || 'auto';
  });

  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'auto' ? systemDark : themeMode === 'dark';

  const cycleTheme = () => {
    const next: ThemeMode =
      themeMode === 'auto' ? 'dark' : themeMode === 'dark' ? 'light' : 'auto';
    setThemeMode(next);
    localStorage.setItem('ws_theme_mode', next);
  };

  return { themeMode, isDark, cycleTheme };
}