import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { apiClient } from '@/utils/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'teal';

interface ThemeContextType {
  /** Resolved visual mode (light | dark) after evaluating "system" preference */
  resolvedMode: 'light' | 'dark';
  /** Raw mode setting (light | dark | system) */
  mode: ThemeMode;
  accentColor: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system'];
const VALID_ACCENTS: AccentColor[] = ['blue', 'green', 'purple', 'red', 'orange', 'teal'];

function isValidMode(v: unknown): v is ThemeMode {
  return typeof v === 'string' && VALID_MODES.includes(v as ThemeMode);
}

function isValidAccent(v: unknown): v is AccentColor {
  return typeof v === 'string' && VALID_ACCENTS.includes(v as AccentColor);
}

/** Evaluate the effective mode when user picks "system". */
function getSystemMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemMode() : mode;
}

/** Apply dark class + accent class on the <html> element */
function applyThemeToDOM(resolved: 'light' | 'dark', accent: AccentColor) {
  const root = document.documentElement;

  // Dark mode
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Accent color — remove all accent-* classes, then add the current one
  VALID_ACCENTS.forEach((c) => root.classList.remove(`accent-${c}`));
  root.classList.add(`accent-${accent}`);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // Initialise from localStorage for instant paint, then sync from API
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme_mode');
    return isValidMode(stored) ? stored : 'system';
  });

  const [accentColor, setAccentState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem('theme_accent');
    return isValidAccent(stored) ? stored : 'blue';
  });

  const [isLoading, setIsLoading] = useState(true);

  const resolved = resolveMode(mode);

  // ---- Apply to DOM whenever resolved mode or accent changes ----
  useEffect(() => {
    applyThemeToDOM(resolved, accentColor);
  }, [resolved, accentColor]);

  // ---- Listen for OS-level dark mode changes when mode is "system" ----
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyThemeToDOM(getSystemMode(), accentColor);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode, accentColor]);

  // ---- Fetch from API on mount ----
  useEffect(() => {
    let cancelled = false;

    const fetchTheme = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch org-wide and user-level settings in parallel
        const [orgTheme, userTheme] = await Promise.allSettled([
          apiClient.getOrgTheme(),
          apiClient.getUserTheme(),
        ]);

        if (cancelled) return;

        // Start with localStorage values (not hardcoded defaults)
        const storedMode = localStorage.getItem('theme_mode');
        const storedAccent = localStorage.getItem('theme_accent');
        let effectiveMode: ThemeMode = isValidMode(storedMode) ? storedMode : 'system';
        let effectiveAccent: AccentColor = isValidAccent(storedAccent) ? storedAccent : 'blue';

        if (orgTheme.status === 'fulfilled') {
          const org = orgTheme.value;
          if (isValidMode(org.mode)) effectiveMode = org.mode;
          if (isValidAccent(org.accent_color)) effectiveAccent = org.accent_color;
        }

        // User preference overrides org if set
        if (userTheme.status === 'fulfilled') {
          const pref = userTheme.value.theme_preference;
          if (pref) {
            // theme_preference is stored as "mode:accent" e.g. "dark:purple" or just "dark"
            const parts = pref.split(':');
            if (isValidMode(parts[0])) effectiveMode = parts[0] as ThemeMode;
            if (parts[1] && isValidAccent(parts[1])) effectiveAccent = parts[1] as AccentColor;
          }
        }

        setModeState(effectiveMode);
        setAccentState(effectiveAccent);
        localStorage.setItem('theme_mode', effectiveMode);
        localStorage.setItem('theme_accent', effectiveAccent);
      } catch {
        // Silently fail — keep localStorage / defaults
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTheme();
    return () => { cancelled = true; };
  }, []);

  // ---- Setters that persist ----
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme_mode', newMode);

    // Persist to API (fire-and-forget)
    const accentStr = localStorage.getItem('theme_accent') || 'blue';
    apiClient.updateUserTheme(`${newMode}:${accentStr}`).catch(() => {});
  }, []);

  const setAccentColor = useCallback((newAccent: AccentColor) => {
    setAccentState(newAccent);
    localStorage.setItem('theme_accent', newAccent);

    // Persist to API (fire-and-forget)
    const modeStr = localStorage.getItem('theme_mode') || 'system';
    apiClient.updateUserTheme(`${modeStr}:${newAccent}`).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        resolvedMode: resolved,
        mode,
        accentColor,
        setMode,
        setAccentColor,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
