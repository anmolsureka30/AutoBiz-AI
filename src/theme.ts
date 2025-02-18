export const theme = {
  colors: {
    background: '#f0f2f5',
    surface: '#ffffff',
    primary: '#1890ff',
    primaryLight: '#e6f7ff',
    success: '#52c41a',
    successLight: '#f6ffed',
    error: '#ff4d4f',
    errorLight: '#fff1f0',
    warning: '#faad14',
    warningLight: '#fffbe6',
    text: '#333333',
    textLight: '#666666',
    border: '#d9d9d9',
    borderLight: '#f0f0f0',
    hover: '#fafafa'
  },
  shadows: {
    small: '0 2px 8px rgba(0, 0, 0, 0.15)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.15)'
  }
};

export type Theme = typeof theme; 