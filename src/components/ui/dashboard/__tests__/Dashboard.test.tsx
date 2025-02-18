import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { ThemeProvider } from 'styled-components';

const theme = {
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
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
    small: '0 2px 8px rgba(0, 0, 0, 0.15)'
  }
};

describe('Dashboard', () => {
  const mockOnTaskAction = jest.fn();
  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderDashboard = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <Dashboard
          onTaskAction={mockOnTaskAction}
          onFilterChange={mockOnFilterChange}
          {...props}
        />
      </ThemeProvider>
    );
  };

  it('should render metrics section', () => {
    renderDashboard();
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('should handle filter changes', () => {
    renderDashboard();
    
    const typeFilter = screen.getByRole('combobox', { name: /type/i });
    fireEvent.change(typeFilter, { target: { value: 'upload' } });
    
    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ['upload']
      })
    );
  });

  it('should handle task selection', () => {
    const task = {
      id: 'task-1',
      type: 'upload',
      status: 'running',
      progress: 50,
      startTime: new Date(),
      name: 'Test Upload',
      description: 'Uploading test file'
    };

    renderDashboard();
    // Add task to dashboard state
    // Click on task
    // Verify task details are displayed
  });

  it('should display task details when selected', () => {
    // Similar to above test but focus on details display
  });

  it('should handle search filter', () => {
    renderDashboard();
    
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'test'
      })
    );
  });
}); 