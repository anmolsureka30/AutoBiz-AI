import { ThemeMode } from './types';

const THEME_STORAGE_KEY = 'js-autoagent-theme';

export interface ThemePreferences {
  mode: ThemeMode;
  useSystemTheme: boolean;
}

export const defaultPreferences: ThemePreferences = {
  mode: 'light',
  useSystemTheme: true,
};

export function saveThemePreferences(preferences: ThemePreferences): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save theme preferences:', error);
  }
}

export function loadThemePreferences(): ThemePreferences {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ThemePreferences;
    }
  } catch (error) {
    console.warn('Failed to load theme preferences:', error);
  }
  return defaultPreferences;
} 