import { Theme } from './types';

export function generateThemeVariables(theme: Theme): Record<string, string> {
  const variables: Record<string, string> = {};

  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    variables[`--${key}`] = value;
  });

  // Typography
  variables['--font-family'] = theme.typography.fontFamily;
  variables['--font-mono'] = theme.typography.fontFamilyMono;

  Object.entries(theme.typography.fontSizes).forEach(([key, value]) => {
    variables[`--font-size-${key}`] = value;
  });

  Object.entries(theme.typography.fontWeights).forEach(([key, value]) => {
    variables[`--font-weight-${key}`] = value.toString();
  });

  Object.entries(theme.typography.lineHeights).forEach(([key, value]) => {
    variables[`--line-height-${key}`] = value.toString();
  });

  // Spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    variables[`--spacing-${key}`] = value;
  });

  return variables;
}

export function getThemeVariable(name: string): string {
  return `var(--${name})`;
} 