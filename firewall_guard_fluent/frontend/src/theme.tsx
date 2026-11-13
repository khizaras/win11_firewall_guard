import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FluentProvider, webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-components';

/** Segoe UI Variable and WinUI radii, on top of the Fluent 2 web theme. */
function windowsTheme(base: Theme): Theme {
  return {
    ...base,
    fontFamilyBase: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
    fontFamilyMonospace: '"Cascadia Mono", Consolas, monospace',
    fontFamilyNumeric: '"Segoe UI Variable Display", "Segoe UI Variable", "Segoe UI", sans-serif',
    borderRadiusSmall: '2px',
    borderRadiusMedium: '4px',
    borderRadiusLarge: '8px',
    borderRadiusXLarge: '8px',
    shadow2: 'none',
    shadow4: '0 8px 16px rgba(0, 0, 0, 0.14)',
  };
}

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'fgf.themeMode';

type ThemeCtxValue = { mode: ThemeMode; setMode: (m: ThemeMode) => void; isDark: boolean; theme: Theme };
const ThemeCtx = createContext<ThemeCtxValue>({ mode: 'system', setMode: () => {}, isDark: false, theme: webLightTheme });

function readMode(fallback: ThemeMode): ThemeMode {
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : fallback;
}

export function FluentThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<ThemeMode>(() => readMode('system'));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const setMode = (m: ThemeMode) => {
    if (m === 'light' || m === 'dark') window.localStorage.setItem(STORAGE_KEY, m);
    else window.localStorage.removeItem(STORAGE_KEY);
    setModeRaw(m);
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);
  const theme = windowsTheme(isDark ? webDarkTheme : webLightTheme);

  useEffect(() => {
    document.body.style.background = theme.colorNeutralBackground3;
    document.body.style.color = theme.colorNeutralForeground1;
  }, [theme]);

  const value = useMemo(() => ({ mode, setMode, isDark, theme }), [mode, isDark, theme]);
  return (
    <ThemeCtx.Provider value={value}>
      <FluentProvider theme={theme}>{children}</FluentProvider>
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
