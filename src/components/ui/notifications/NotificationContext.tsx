import React, { createContext, useContext, useCallback, useState } from 'react';
import { 
  NotificationContextValue, 
  NotificationState, 
  Notification 
} from './types';

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
  position?: NotificationState['position'];
  maxVisible?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  position = 'top-right',
  maxVisible = 5
}) => {
  const [state, setState] = useState<NotificationState>({
    notifications: new Map(),
    position,
    maxVisible
  });

  const addNotification = useCallback((
    notification: Omit<Notification, 'id' | 'timestamp'>
  ): string => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const timestamp = new Date();

    setState(prev => {
      const notifications = new Map(prev.notifications);
      notifications.set(id, { ...notification, id, timestamp });

      // Remove oldest notifications if exceeding maxVisible
      const notificationArray = Array.from(notifications.entries());
      if (notificationArray.length > prev.maxVisible) {
        const toRemove = notificationArray
          .slice(0, notificationArray.length - prev.maxVisible)
          .map(([id]) => id);
        
        toRemove.forEach(id => notifications.delete(id));
      }

      return { ...prev, notifications };
    });

    if (notification.autoClose !== false) {
      const duration = notification.duration || 5000;
      setTimeout(() => removeNotification(id), duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setState(prev => {
      const notifications = new Map(prev.notifications);
      notifications.delete(id);
      return { ...prev, notifications };
    });
  }, []);

  const clearAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: new Map()
    }));
  }, []);

  const updatePosition = useCallback((position: NotificationState['position']) => {
    setState(prev => ({ ...prev, position }));
  }, []);

  const value: NotificationContextValue = {
    state,
    addNotification,
    removeNotification,
    clearAll,
    updatePosition
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 