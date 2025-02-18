import React from 'react';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { ThemeMode } from '../../../core/theme/types';
import styles from './ThemeSwitcher.module.css';

interface ThemeOption {
  mode: ThemeMode | 'system';
  label: string;
  icon: React.ReactNode;
}

const themeOptions: ThemeOption[] = [
  {
    mode: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
      </svg>
    ),
  },
  {
    mode: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
      </svg>
    ),
  },
  {
    mode: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M4 6h16v10H4V6zm16 12H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2z" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
];

export const ThemeSwitcher: React.FC = () => {
  const { preferences, setThemeMode, setUseSystemTheme } = useTheme();
  const currentMode = preferences.useSystemTheme ? 'system' : preferences.mode;

  const handleThemeChange = (option: ThemeOption) => {
    if (option.mode === 'system') {
      setUseSystemTheme(true);
    } else {
      setThemeMode(option.mode as ThemeMode);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.buttons} role="radiogroup" aria-label="Theme selection">
        {themeOptions.map(option => (
          <button
            key={option.mode}
            className={`${styles.button} ${currentMode === option.mode ? styles.active : ''}`}
            onClick={() => handleThemeChange(option)}
            role="radio"
            aria-checked={currentMode === option.mode}
            aria-label={`${option.label} theme`}
          >
            <span className={styles.icon}>{option.icon}</span>
            <span className={styles.label}>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}; 