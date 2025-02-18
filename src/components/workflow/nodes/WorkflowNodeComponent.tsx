import React from 'react';
import { WorkflowNode, NodeMetrics } from '../../../core/workflow/visualization/types';
import { WorkflowStatus } from '../../../core/workflow/types';
import styles from './WorkflowNode.module.css';

interface WorkflowNodeProps {
  node: WorkflowNode;
  onClick?: (nodeId: string) => void;
  onStatusChange?: (nodeId: string, status: WorkflowStatus) => void;
}

export const WorkflowNodeComponent: React.FC<WorkflowNodeProps> = ({
  node,
  onClick,
  onStatusChange,
}) => {
  const handleClick = () => {
    onClick?.(node.id);
  };

  const getStatusColor = (status: WorkflowStatus): string => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'processing': return '#2196F3';
      case 'pending': return '#9E9E9E';
      case 'paused': return '#FFC107';
      default: return '#9E9E9E';
    }
  };

  const renderMetrics = (metrics: NodeMetrics) => {
    if (!metrics) return null;

    return (
      <div className={styles.metrics}>
        {metrics.executionTime && (
          <div className={styles.metric}>
            <span>Time:</span>
            <span>{(metrics.executionTime / 1000).toFixed(2)}s</span>
          </div>
        )}
        {metrics.retryCount !== undefined && metrics.retryCount > 0 && (
          <div className={styles.metric}>
            <span>Retries:</span>
            <span>{metrics.retryCount}</span>
          </div>
        )}
        {metrics.errorRate !== undefined && metrics.errorRate > 0 && (
          <div className={styles.metric}>
            <span>Error Rate:</span>
            <span>{(metrics.errorRate * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${styles.node} ${styles[node.type]}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        borderColor: getStatusColor(node.status),
      }}
      onClick={handleClick}
    >
      <div className={styles.header}>
        <div className={styles.status} style={{ backgroundColor: getStatusColor(node.status) }} />
        <span className={styles.label}>{node.label}</span>
      </div>
      {node.metrics && renderMetrics(node.metrics)}
    </div>
  );
}; 