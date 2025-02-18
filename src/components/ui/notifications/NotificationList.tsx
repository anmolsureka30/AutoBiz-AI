import React, { useEffect, useState } from 'react';
import { X as CloseIcon } from 'react-feather';
import {
  NotificationContainer,
  NotificationItem,
  NotificationContent,
  NotificationTitle,
  NotificationMessage,
  NotificationActions,
  ActionButton,
  CloseButton,
  ProgressBar
} from './styles';
import { useNotifications } from './NotificationContext';
import { Notification } from './types';

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationItemComponent: React.FC<NotificationItemProps> = ({
  notification,
  onClose
}) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  return (
    <NotificationItem type={notification.type} isExiting={isExiting}>
      <NotificationContent>
        <NotificationTitle>{notification.title}</NotificationTitle>
        <NotificationMessage>{notification.message}</NotificationMessage>
        {notification.action && (
          <NotificationActions>
            <ActionButton onClick={notification.action.onClick}>
              {notification.action.label}
            </ActionButton>
          </NotificationActions>
        )}
        {notification.autoClose !== false && notification.duration && (
          <ProgressBar
            duration={notification.duration}
            type={notification.type}
          />
        )}
      </NotificationContent>
      <CloseButton onClick={handleClose} aria-label="Close notification">
        <CloseIcon size={16} />
      </CloseButton>
    </NotificationItem>
  );
};

export const NotificationList: React.FC = () => {
  const { state, removeNotification } = useNotifications();

  return (
    <NotificationContainer position={state.position}>
      {Array.from(state.notifications.values()).map(notification => (
        <NotificationItemComponent
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </NotificationContainer>
  );
}; 