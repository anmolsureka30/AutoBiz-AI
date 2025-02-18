import React from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import { NodeMetrics } from '../../../core/workflow/visualization/types';
import styles from './TemplateMetricsViewer.module.css';

interface TemplateMetricsViewerProps {
  template: WorkflowTemplate;
  executionStats: {
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
    lastExecuted?: Date;
    stepMetrics: Record<string, NodeMetrics>;
  };
}

export const TemplateMetricsViewer: React.FC<TemplateMetricsViewerProps> = ({
  template,
  executionStats,
}) => {
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}m`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const renderOverallMetrics = () => (
    <div className={styles.section}>
      <h3>Overall Performance</h3>
      <div className={styles.metricsGrid}>
        <div className={styles.metric}>
          <label>Total Executions</label>
          <span>{executionStats.totalExecutions}</span>
        </div>
        <div className={styles.metric}>
          <label>Success Rate</label>
          <span className={getSuccessRateColor(executionStats.successRate)}>
            {formatPercentage(executionStats.successRate)}
          </span>
        </div>
        <div className={styles.metric}>
          <label>Average Execution Time</label>
          <span>{formatDuration(executionStats.averageExecutionTime)}</span>
        </div>
        {executionStats.lastExecuted && (
          <div className={styles.metric}>
            <label>Last Executed</label>
            <span>{executionStats.lastExecuted.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderStepMetrics = () => (
    <div className={styles.section}>
      <h3>Step Performance</h3>
      <div className={styles.stepMetrics}>
        {template.steps.map(step => {
          const metrics = executionStats.stepMetrics[step.id];
          if (!metrics) return null;

          return (
            <div key={step.id} className={styles.stepMetric}>
              <div className={styles.stepHeader}>
                <h4>{step.name}</h4>
                <span className={styles.stepType}>{step.type}</span>
              </div>
              <div className={styles.stepStats}>
                {metrics.executionTime !== undefined && (
                  <div className={styles.stat}>
                    <label>Execution Time</label>
                    <span>{formatDuration(metrics.executionTime)}</span>
                  </div>
                )}
                {metrics.retryCount !== undefined && (
                  <div className={styles.stat}>
                    <label>Retries</label>
                    <span>{metrics.retryCount}</span>
                  </div>
                )}
                {metrics.errorRate !== undefined && (
                  <div className={styles.stat}>
                    <label>Error Rate</label>
                    <span className={getErrorRateColor(metrics.errorRate)}>
                      {formatPercentage(metrics.errorRate)}
                    </span>
                  </div>
                )}
                {metrics.resourceUsage && (
                  <>
                    {metrics.resourceUsage.cpu !== undefined && (
                      <div className={styles.stat}>
                        <label>CPU Usage</label>
                        <span>{formatPercentage(metrics.resourceUsage.cpu)}</span>
                      </div>
                    )}
                    {metrics.resourceUsage.memory !== undefined && (
                      <div className={styles.stat}>
                        <label>Memory Usage</label>
                        <span>{formatPercentage(metrics.resourceUsage.memory)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.95) return styles.excellent;
    if (rate >= 0.9) return styles.good;
    if (rate >= 0.8) return styles.fair;
    return styles.poor;
  };

  const getErrorRateColor = (rate: number): string => {
    if (rate <= 0.05) return styles.excellent;
    if (rate <= 0.1) return styles.good;
    if (rate <= 0.2) return styles.fair;
    return styles.poor;
  };

  return (
    <div className={styles.container}>
      {renderOverallMetrics()}
      {renderStepMetrics()}
    </div>
  );
}; 