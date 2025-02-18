import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { NotificationList } from '../NotificationList';

const theme = {
  colors: {
    surface: '#ffffff',
    primary: '#1890ff',
    success: '#52c41a',
    error: '#ff4d4f',
    warning: '#faad14',
    text: '#333333',
    textLight: '#666666'
  },
  shadows: {
    medium: '0 4px 12px rgba(0, 0, 0, 0.15)'
  }
};

const TestComponent = () => {
  const { addNotification } = useNotifications();

  return (
    <button
      onClick={() => addNotification({
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test notification',
        autoClose: false
      })}
    >
      Add Notification
    </button>
  );
};

describe('Notification System', () => {
  const renderNotificationSystem = () => {
    return render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <TestComponent />
          <NotificationList />
        </NotificationProvider>
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should display notification when added', () => {
    renderNotificationSystem();
    
    fireEvent.click(screen.getByText('Add Notification'));
    
    expect(screen.getByText('Test Notification')).toBeInTheDocument();
    expect(screen.getByText('This is a test notification')).toBeInTheDocument();
  });

  it('should auto-close notification after duration', () => {
    renderNotificationSystem();
    
    fireEvent.click(screen.getByText('Add Notification'));
    
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    expect(screen.queryByText('Test Notification')).not.toBeInTheDocument();
  });

  it('should close notification when close button clicked', () => {
    renderNotificationSystem();
    
    fireEvent.click(screen.getByText('Add Notification'));
    fireEvent.click(screen.getByLabelText('Close notification'));
    
    expect(screen.queryByText('Test Notification')).not.toBeInTheDocument();
  });

  it('should handle action buttons', () => {
    const mockAction = jest.fn();
    const { addNotification } = renderNotificationSystem().container
      .querySelector('button')
      ?.onclick?.({
        type: 'success',
        title: 'Action Test',
        message: 'Test with action',
        action: {
          label: 'Click Me',
          onClick: mockAction
        }
      });
    
    fireEvent.click(screen.getByText('Click Me'));
    expect(mockAction).toHaveBeenCalled();
  });
}); 