import React from 'react';
import styled from 'styled-components';
import { 
  BarChart2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle 
} from 'react-feather';
import { TaskGroupStats, Task } from './types';
import { formatDuration } from '../../../utils/format';

const StatsContainer = styled.div`
  padding: 12px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 4px;
  margin-top: 8px;
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatIcon = styled.div<{ color?: string }>`
  color: ${({ color, theme }) => color || theme.colors.primary};
  display: flex;
  align-items: center;
`;

const StatValue = styled.div`
  font-size: 1.1em;
  font-weight: 500;
`;

const StatLabel = styled.div`
  font-size: 0.9em;
  color: ${({ theme }) => theme.colors.textLight};
`;

const ProgressBar = styled.div<{ progress: number; status?: Task['status'] }>`
  width: 100%;
  height: 4px;
  background: ${({ theme }) => theme.colors.borderLight};
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${({ progress }) => progress}%;
    height: 100%;
    background: ${({ status, theme }) => {
      switch (status) {
        case 'completed':
          return theme.colors.success;
        case 'failed':
          return theme.colors.error;
        case 'running':
          return theme.colors.primary;
        default:
          return theme.colors.warning;
      }
    }};
    transition: width 0.3s ease;
  }
`;

interface GroupStatsProps {
  stats: TaskGroupStats;
  compact?: boolean;
}

export const GroupStats: React.FC<GroupStatsProps> = ({ stats, compact }) => {
  const renderProgressStats = () => (
    <>
      <StatItem>
        <StatIcon color="#52c41a">
          <CheckCircle size={16} />
        </StatIcon>
        <div>
          <StatValue>{(stats.completionRate * 100).toFixed(1)}%</StatValue>
          <StatLabel>Completion Rate</StatLabel>
        </div>
      </StatItem>
      <StatItem>
        <StatIcon color="#ff4d4f">
          <XCircle size={16} />
        </StatIcon>
        <div>
          <StatValue>{(stats.failureRate * 100).toFixed(1)}%</StatValue>
          <StatLabel>Failure Rate</StatLabel>
        </div>
      </StatItem>
    </>
  );

  const renderTimeStats = () => (
    <>
      <StatItem>
        <StatIcon>
          <Clock size={16} />
        </StatIcon>
        <div>
          <StatValue>
            {stats.averageDuration ? formatDuration(stats.averageDuration) : 'N/A'}
          </StatValue>
          <StatLabel>Avg Duration</StatLabel>
        </div>
      </StatItem>
      <StatItem>
        <StatIcon>
          <BarChart2 size={16} />
        </StatIcon>
        <div>
          <StatValue>{stats.averageProgress.toFixed(1)}%</StatValue>
          <StatLabel>Avg Progress</StatLabel>
        </div>
      </StatItem>
    </>
  );

  const renderStatusBreakdown = () => (
    <div>
      <StatLabel>Status Breakdown</StatLabel>
      {Object.entries(stats.byStatus).map(([status, count]) => (
        <StatItem key={status}>
          <StatValue>{count}</StatValue>
          <StatLabel>{status}</StatLabel>
        </StatItem>
      ))}
    </div>
  );

  if (compact) {
    return (
      <StatsContainer>
        <StatGrid>
          {renderProgressStats()}
        </StatGrid>
        <ProgressBar 
          progress={stats.averageProgress} 
          status={stats.failureRate > 0.5 ? 'failed' : 'running'}
        />
      </StatsContainer>
    );
  }

  return (
    <StatsContainer>
      <StatGrid>
        {renderProgressStats()}
        {renderTimeStats()}
      </StatGrid>
      {!compact && renderStatusBreakdown()}
      <ProgressBar 
        progress={stats.averageProgress}
        status={stats.failureRate > 0.5 ? 'failed' : 'running'}
      />
    </StatsContainer>
  );
}; 