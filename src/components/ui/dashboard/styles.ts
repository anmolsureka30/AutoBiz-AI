import styled, { css } from 'styled-components';
import { Task } from './types';

export const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  grid-template-rows: auto 1fr;
  gap: 16px;
  padding: 16px;
  height: 100vh;
  background: ${({ theme }) => theme.colors.background};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }
`;

export const Header = styled.header`
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.small};
`;

export const Sidebar = styled.aside`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.small};
  overflow-y: auto;
`;

export const MainContent = styled.main`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.small};
  overflow-y: auto;
`;

export const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const MetricCard = styled.div`
  padding: 16px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 6px;
  box-shadow: ${({ theme }) => theme.shadows.small};
`;

export const MetricTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textLight};
`;

export const MetricValue = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const TaskItem = styled.div<{ status: Task['status']; selected?: boolean }>`
  padding: 12px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  cursor: pointer;
  transition: all 0.2s ease;

  ${({ selected, theme }) =>
    selected &&
    css`
      border-color: ${theme.colors.primary};
      background: ${theme.colors.primaryLight};
    `}

  ${({ status, theme }) => {
    switch (status) {
      case 'running':
        return css`
          border-left: 3px solid ${theme.colors.primary};
        `;
      case 'completed':
        return css`
          border-left: 3px solid ${theme.colors.success};
        `;
      case 'failed':
        return css`
          border-left: 3px solid ${theme.colors.error};
        `;
      case 'cancelled':
        return css`
          border-left: 3px solid ${theme.colors.warning};
        `;
      default:
        return css`
          border-left: 3px solid ${theme.colors.border};
        `;
    }
  }}

  &:hover {
    background: ${({ theme }) => theme.colors.hover};
  }
`;

export const TaskHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

export const TaskName = styled.div`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

export const TaskStatus = styled.span<{ status: Task['status'] }>`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

  ${({ status, theme }) => {
    switch (status) {
      case 'running':
        return css`
          background: ${theme.colors.primaryLight};
          color: ${theme.colors.primary};
        `;
      case 'completed':
        return css`
          background: ${theme.colors.successLight};
          color: ${theme.colors.success};
        `;
      case 'failed':
        return css`
          background: ${theme.colors.errorLight};
          color: ${theme.colors.error};
        `;
      case 'cancelled':
        return css`
          background: ${theme.colors.warningLight};
          color: ${theme.colors.warning};
        `;
      default:
        return css`
          background: ${theme.colors.borderLight};
          color: ${theme.colors.textLight};
        `;
    }
  }}
`;

export const TaskProgress = styled.div`
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
`;

export const ProgressBar = styled.div<{ progress: number; status: Task['status'] }>`
  height: 100%;
  width: ${({ progress }) => progress}%;
  transition: width 0.3s ease;

  ${({ status, theme }) => {
    switch (status) {
      case 'running':
        return css`
          background: ${theme.colors.primary};
        `;
      case 'completed':
        return css`
          background: ${theme.colors.success};
        `;
      case 'failed':
        return css`
          background: ${theme.colors.error};
        `;
      case 'cancelled':
        return css`
          background: ${theme.colors.warning};
        `;
      default:
        return css`
          background: ${theme.colors.border};
        `;
    }
  }}
`;

export const TaskDetails = styled.div`
  padding: 16px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.small};
`;

export const DetailRow = styled.div`
  display: flex;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const DetailLabel = styled.div`
  width: 120px;
  color: ${({ theme }) => theme.colors.textLight};
  font-size: 14px;
`;

export const DetailValue = styled.div`
  flex: 1;
  color: ${({ theme }) => theme.colors.text};
  font-size: 14px;
`;

export const FilterBar = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

export const FilterSelect = styled.select`
  padding: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
`;

export const DateRangePicker = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export const SearchInput = styled.input`
  padding: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  width: 200px;
`; 