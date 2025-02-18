import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Theme, ThemeMode } from './types';
import { lightTheme, darkTheme } from './themes';
import { generateThemeVariables } from './utils';
import { ThemePreferences, loadThemePreferences, saveThemePreferences } from './storage';
import { useSystemTheme } from './useSystemTheme';

interface ThemeContextValue {
  theme: Theme;
  preferences: ThemePreferences;
  setThemeMode: (mode: ThemeMode) => void;
  setUseSystemTheme: (use: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = React.useState<ThemePreferences>(loadThemePreferences);
  const systemTheme = useSystemTheme();

  const currentMode = useMemo(() => {
    return preferences.useSystemTheme ? systemTheme : preferences.mode;
  }, [preferences.useSystemTheme, preferences.mode, systemTheme]);

  const theme = useMemo(() => {
    return currentMode === 'light' ? lightTheme : darkTheme;
  }, [currentMode]);

  useEffect(() => {
    // Apply theme variables to document root
    const variables = generateThemeVariables(theme);
    Object.entries(variables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [theme]);

  const setThemeMode = React.useCallback((mode: ThemeMode) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, mode, useSystemTheme: false };
      saveThemePreferences(newPrefs);
      return newPrefs;
    });
  }, []);

  const setUseSystemTheme = React.useCallback((use: boolean) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, useSystemTheme: use };
      saveThemePreferences(newPrefs);
      return newPrefs;
    });
  }, []);

  const value = useMemo(() => ({
    theme,
    preferences,
    setThemeMode,
    setUseSystemTheme,
  }), [theme, preferences, setThemeMode, setUseSystemTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 