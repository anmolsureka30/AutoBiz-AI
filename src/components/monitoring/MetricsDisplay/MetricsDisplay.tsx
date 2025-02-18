import React from 'react';
import { AgentMetrics } from '../../../core/workflow/monitoring/types';
import styles from './MetricsDisplay.module.css';

interface MetricsDisplayProps {
  metrics: AgentMetrics;
  className?: string;
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ metrics, className }) => {
  const formatNumber = (num: number): string => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const errorRate = metrics.completedTasks + metrics.failedTasks > 0
    ? metrics.failedTasks / (metrics.completedTasks + metrics.failedTasks)
    : 0;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.section}>
        <h3>Agent Status</h3>
        <div className={styles.metric}>
          <span className={styles.label}>Active Agents</span>
          <span className={styles.value}>{formatNumber(metrics.activeAgents)}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Task Metrics</h3>
        <div className={styles.metric}>
          <span className={styles.label}>Completed Tasks</span>
          <span className={styles.value}>{formatNumber(metrics.completedTasks)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Failed Tasks</span>
          <span className={`${styles.value} ${styles.error}`}>
            {formatNumber(metrics.failedTasks)}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Error Rate</span>
          <span className={`${styles.value} ${errorRate > 0.1 ? styles.error : ''}`}>
            {formatPercentage(errorRate)}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Performance</h3>
        <div className={styles.metric}>
          <span className={styles.label}>Response Time</span>
          <span className={`${styles.value} ${metrics.averageResponseTime > 5000 ? styles.warning : ''}`}>
            {formatDuration(metrics.averageResponseTime)}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Resources</h3>
        <div className={styles.metric}>
          <span className={styles.label}>CPU Usage</span>
          <span className={`${styles.value} ${metrics.cpuUsage > 0.8 ? styles.warning : ''}`}>
            {formatPercentage(metrics.cpuUsage)}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Memory Usage</span>
          <span className={`${styles.value} ${metrics.memoryUsage > 0.8 ? styles.warning : ''}`}>
            {formatPercentage(metrics.memoryUsage)}
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.timestamp}>
          Last Updated: {metrics.lastUpdated.toLocaleString()}
        </span>
      </div>
    </div>
  );
}; 