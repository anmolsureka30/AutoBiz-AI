import styled, { css, keyframes } from 'styled-components';
import { NotificationState, NotificationType } from './types';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

export const NotificationContainer = styled.div<{ position: NotificationState['position'] }>`
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
  padding: 16px;

  ${({ position }) => {
    switch (position) {
      case 'top-right':
        return css`
          top: 0;
          right: 0;
        `;
      case 'top-left':
        return css`
          top: 0;
          left: 0;
        `;
      case 'bottom-right':
        return css`
          bottom: 0;
          right: 0;
        `;
      case 'bottom-left':
        return css`
          bottom: 0;
          left: 0;
        `;
    }
  }}
`;

export const NotificationItem = styled.div<{ 
  type: NotificationType;
  isExiting?: boolean;
}>`
  display: flex;
  padding: 12px;
  border-radius: 6px;
  box-shadow: ${({ theme }) => theme.shadows.medium};
  animation: ${({ isExiting }) => isExiting ? slideOut : slideIn} 0.3s ease;
  background: ${({ theme }) => theme.colors.surface};
  border-left: 4px solid;
  border-left-color: ${({ type, theme }) => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  }};
`;

export const NotificationContent = styled.div`
  flex: 1;
  min-width: 0;
`;

export const NotificationTitle = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
  color: ${({ theme }) => theme.colors.text};
`;

export const NotificationMessage = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textLight};
  word-wrap: break-word;
`;

export const NotificationActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
`;

export const ActionButton = styled.button`
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  margin-left: 8px;
  color: ${({ theme }) => theme.colors.textLight};
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

export const ProgressBar = styled.div<{ duration: number; type: NotificationType }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: ${({ type, theme }) => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  }};
  animation: shrink ${({ duration }) => duration}ms linear;

  @keyframes shrink {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`; 