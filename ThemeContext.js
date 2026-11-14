import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from './theme';

const THEME_STORAGE_KEY = '@lumityo/theme-mode';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedMode) => {
      if (active && (storedMode === 'light' || storedMode === 'dark')) {
        setMode(storedMode);
      }
    }).catch((error) => {
      console.error('Unable to load saved theme preference:', error);
    });

    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode) => {
    if (nextMode !== 'light' && nextMode !== 'dark') {
      throw new Error(`Unsupported theme mode: ${nextMode}`);
    }

    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    setMode(nextMode);
  }, []);

  const value = useMemo(() => ({
    mode,
    theme: mode === 'dark' ? darkTheme : lightTheme,
    setThemeMode,
  }), [mode, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
