import styled, { css, keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const UploadContainer = styled.div`
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
`;

export const DropZone = styled.div<{ isDragActive: boolean; disabled?: boolean }>`
  border: 2px dashed ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.2s ease;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  background: ${({ theme }) => theme.colors.background};

  ${({ isDragActive, theme }) =>
    isDragActive &&
    css`
      border-color: ${theme.colors.primary};
      background: ${theme.colors.primaryLight};
    `}

  &:hover {
    border-color: ${({ theme, disabled }) =>
      disabled ? theme.colors.border : theme.colors.primary};
  }
`;

export const UploadMessage = styled.div`
  margin-bottom: 16px;
  color: ${({ theme }) => theme.colors.text};
  font-size: 16px;

  p {
    margin: 8px 0;
  }
`;

export const FileList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  max-height: 300px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 3px;
  }
`;

export const FileItem = styled.li`
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  margin-bottom: 8px;
  background: ${({ theme }) => theme.colors.background};
  animation: ${fadeIn} 0.3s ease;
`;

export const FileInfo = styled.div`
  flex: 1;
  margin: 0 12px;
  overflow: hidden;
`;

export const FileName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const FileSize = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textLight};
`;

export const ProgressBar = styled.div<{ progress: number; status: string }>`
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${({ progress }) => progress}%;
    background: ${({ status, theme }) => {
      switch (status) {
        case 'error':
          return theme.colors.error;
        case 'completed':
          return theme.colors.success;
        default:
          return theme.colors.primary;
      }
    }};
    transition: width 0.3s ease;
  }
`;

export const FileActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const ActionButton = styled.button<{ variant?: string }>`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: ${({ theme, variant }) =>
    variant === 'error' ? theme.colors.error : theme.colors.text};
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }
`;

export const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: 12px;
  margin-top: 4px;
`;

export const TotalProgress = styled.div`
  margin-top: 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textLight};
  font-size: 14px;
`; 