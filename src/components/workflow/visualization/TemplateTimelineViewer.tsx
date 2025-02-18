import React, { useMemo } from 'react';
import { WorkflowTemplate, WorkflowStep } from '../../../core/workflow/template-types';
import { WorkflowExecution, ExecutionStatus } from '../../../core/workflow/visualization/types';
import styles from './TemplateTimelineViewer.module.css';

interface TemplateTimelineViewerProps {
  template: WorkflowTemplate;
  executions: WorkflowExecution[];
  onExecutionSelect?: (executionId: string) => void;
}

interface TimelineStep {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: ExecutionStatus;
  error?: Error;
}

interface TimelineData {
  id: string;
  startTime: Date;
  duration: number;
  steps: TimelineStep[];
}

export const TemplateTimelineViewer: React.FC<TemplateTimelineViewerProps> = ({
  template,
  executions,
  onExecutionSelect,
}) => {
  const timelineData = useMemo(() => {
    return executions.map((execution: WorkflowExecution) => {
      const steps = template.steps.map((step: WorkflowStep) => {
        const stepResult = execution.result.stepResults[step.id];
        return {
          id: step.id,
          name: step.name,
          startTime: stepResult.startTime,
          endTime: stepResult.endTime,
          duration: stepResult.duration,
          status: stepResult.status,
          error: stepResult.error,
        };
      });

      return {
        id: execution.id,
        startTime: execution.startTime,
        duration: execution.duration,
        steps,
      };
    });
  }, [executions, template.steps]);

  const maxDuration = useMemo(() => {
    return Math.max(...timelineData.map((execution: TimelineData) => execution.duration));
  }, [timelineData]);

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0
      ? `${minutes}m ${seconds % 60}s`
      : `${seconds}s`;
  };

  const timeScale = (ms: number): number => {
    return (ms / maxDuration) * 100;
  };

  const getStatusColor = (status: ExecutionStatus): string => {
    switch (status) {
      case 'completed':
        return styles.completed;
      case 'failed':
        return styles.failed;
      case 'processing':
        return styles.processing;
      default:
        return styles.pending;
    }
  };

  const renderTimeline = (execution: TimelineData) => {
    return (
      <div
        key={execution.id}
        className={styles.timeline}
        onClick={() => onExecutionSelect?.(execution.id)}
      >
        <div className={styles.timelineHeader}>
          <div className={styles.timelineInfo}>
            <span className={styles.executionTime}>
              {formatTime(execution.startTime)}
            </span>
            <span className={styles.duration}>
              {formatDuration(execution.duration)}
            </span>
          </div>
        </div>
        <div className={styles.timelineContent}>
          <div className={styles.timelineTracks}>
            {execution.steps.map(step => {
              const startPercent = timeScale(
                step.startTime - execution.startTime.getTime()
              );
              const durationPercent = timeScale(step.duration);

              return (
                <div
                  key={step.id}
                  className={styles.timelineTrack}
                  style={{
                    left: `${startPercent}%`,
                    width: `${durationPercent}%`,
                  }}
                >
                  <div
                    className={`${styles.timelineBar} ${getStatusColor(
                      step.status
                    )}`}
                  >
                    <span className={styles.stepName}>{step.name}</span>
                    {step.error && (
                      <div className={styles.errorIndicator} title={step.error.message}>
                        !
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.timelineAxis}>
            {[0, 25, 50, 75, 100].map(percent => (
              <div
                key={percent}
                className={styles.timelineTick}
                style={{ left: `${percent}%` }}
              >
                <span>
                  {formatDuration((percent / 100) * maxDuration)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Execution Timeline</h3>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.completed}`} />
            <span>Completed</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.failed}`} />
            <span>Failed</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.processing}`} />
            <span>Processing</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.pending}`} />
            <span>Pending</span>
          </div>
        </div>
      </div>
      <div className={styles.timelines}>
        {timelineData.map((execution: TimelineData) => renderTimeline(execution))}
      </div>
    </div>
  );
}; 