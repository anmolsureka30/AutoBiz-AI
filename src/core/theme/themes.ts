import { Theme, ThemeMode } from './types';

const baseTheme = {
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyMono: 'JetBrains Mono, monospace',
    fontSizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      bold: 600,
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
};

export const lightTheme: Theme = {
  mode: 'light',
  ...baseTheme,
  colors: {
    // Background colors
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f9fa',
    bgSurface: '#ffffff',
    bgSurfaceHover: '#f8f9fa',
    
    // Text colors
    textPrimary: '#1a1a1a',
    textSecondary: '#4a5568',
    textTertiary: '#718096',
    textOnColor: '#ffffff',
    
    // Border colors
    borderColor: '#e2e8f0',
    borderColorHover: '#cbd5e0',
    
    // Status colors
    success: '#48bb78',
    successDark: '#2f855a',
    error: '#f56565',
    errorDark: '#c53030',
    warning: '#ed8936',
    warningDark: '#c05621',
    info: '#4299e1',
    infoDark: '#2b6cb0',
    disabled: '#a0aec0',
    
    // Special colors
    accent: '#5a67d8',
    accentHover: '#4c51bf',
    selection: 'rgba(66, 153, 225, 0.15)',
  },
};

export const darkTheme: Theme = {
  mode: 'dark',
  ...baseTheme,
  colors: {
    // Background colors
    bgPrimary: '#1a202c',
    bgSecondary: '#2d3748',
    bgSurface: '#2d3748',
    bgSurfaceHover: '#3a4a63',
    
    // Text colors
    textPrimary: '#f7fafc',
    textSecondary: '#e2e8f0',
    textTertiary: '#a0aec0',
    textOnColor: '#1a202c',
    
    // Border colors
    borderColor: '#4a5568',
    borderColorHover: '#718096',
    
    // Status colors
    success: '#48bb78',
    successDark: '#2f855a',
    error: '#f56565',
    errorDark: '#c53030',
    warning: '#ed8936',
    warningDark: '#c05621',
    info: '#4299e1',
    infoDark: '#2b6cb0',
    disabled: '#718096',
    
    // Special colors
    accent: '#5a67d8',
    accentHover: '#4c51bf',
    selection: 'rgba(66, 153, 225, 0.25)',
  },
}; 