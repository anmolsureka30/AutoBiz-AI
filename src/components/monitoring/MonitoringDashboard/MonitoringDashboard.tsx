import React, { useState, useCallback } from 'react';
import { MetricsDisplay } from '../MetricsDisplay';
import { MetricsChart } from '../MetricsChart';
import { TimeRangeSelector } from '../TimeRangeSelector';
import { ErrorBoundary } from '../../common/ErrorBoundary';
import { useMonitoringService } from '../../../hooks/useMonitoringService';
import styles from './MonitoringDashboard.module.css';

const CHART_METRICS = [
  {
    key: 'cpuUsage',
    name: 'CPU Usage',
    color: '#8884d8',
    formatter: (value: number) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'memoryUsage',
    name: 'Memory Usage',
    color: '#82ca9d',
    formatter: (value: number) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'averageResponseTime',
    name: 'Response Time',
    color: '#ffc658',
    formatter: (value: number) => `${(value / 1000).toFixed(2)}s`,
  },
];

const LoadingSpinner = () => (
  <div className={styles.loading}>
    <div className={styles.spinner} />
    <span>Loading monitoring data...</span>
  </div>
);

const ErrorMessage: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className={styles.error}>
    <p>{error.message}</p>
    <button onClick={onRetry} className={styles.retryButton}>
      Retry
    </button>
  </div>
);

export const MonitoringDashboard: React.FC = () => {
  const { metrics, snapshots, isLoading, error, getTimeRangeSnapshots, clearError } = useMonitoringService();
  const [filteredSnapshots, setFilteredSnapshots] = useState(snapshots);

  const handleTimeRangeChange = useCallback(({ startTime, endTime }) => {
    const filtered = getTimeRangeSnapshots(startTime, endTime);
    setFilteredSnapshots(filtered);
  }, [getTimeRangeSnapshots]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={clearError} />;
  }

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <MetricsDisplay metrics={metrics} className={styles.metricsDisplay} />
          <TimeRangeSelector onChange={handleTimeRangeChange} className={styles.timeRange} />
        </div>
        <MetricsChart
          snapshots={filteredSnapshots}
          metrics={CHART_METRICS}
          className={styles.metricsChart}
        />
      </div>
    </ErrorBoundary>
  );
}; 