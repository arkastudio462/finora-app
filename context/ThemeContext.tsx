import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, DARK_COLORS, Colors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'finora.theme.mode';

interface ThemeValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw === 'light' || raw === 'dark' || raw === 'system') setModeState(raw);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const colors = resolved === 'dark' ? DARK_COLORS : COLORS;

  const value = useMemo(() => ({ mode, resolved, colors, setMode }), [mode, resolved, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useColors(): Colors {
  return useTheme().colors;
}

export function useStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
