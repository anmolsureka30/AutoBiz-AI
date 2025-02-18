export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgSurface: string;
  bgSurfaceHover: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnColor: string;
  
  // Border colors
  borderColor: string;
  borderColorHover: string;
  
  // Status colors
  success: string;
  successDark: string;
  error: string;
  errorDark: string;
  warning: string;
  warningDark: string;
  info: string;
  infoDark: string;
  disabled: string;
  
  // Special colors
  accent: string;
  accentHover: string;
  selection: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontSizes: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  fontWeights: {
    normal: number;
    medium: number;
    bold: number;
  };
  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
} 