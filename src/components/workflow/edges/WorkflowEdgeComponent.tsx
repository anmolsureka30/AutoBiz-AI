import React from 'react';
import { WorkflowEdge } from '../../../core/workflow/visualization/types';
import styles from './WorkflowEdge.module.css';

interface WorkflowEdgeProps {
  edge: WorkflowEdge;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
}

export const WorkflowEdgeComponent: React.FC<WorkflowEdgeProps> = ({
  edge,
  sourcePosition,
  targetPosition,
}) => {
  const getPath = (): string => {
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const midX = sourcePosition.x + dx / 2;

    return `M ${sourcePosition.x} ${sourcePosition.y} 
            C ${midX} ${sourcePosition.y}, 
              ${midX} ${targetPosition.y}, 
              ${targetPosition.x} ${targetPosition.y}`;
  };

  const getEdgeColor = (): string => {
    switch (edge.type) {
      case 'dependency': return '#2196F3';
      case 'data': return '#4CAF50';
      case 'control': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  return (
    <g className={styles.edge}>
      <path
        d={getPath()}
        stroke={getEdgeColor()}
        fill="none"
        className={edge.animated ? styles.animated : ''}
      />
      {edge.label && (
        <text
          x={(sourcePosition.x + targetPosition.x) / 2}
          y={(sourcePosition.y + targetPosition.y) / 2}
          dy={-10}
          textAnchor="middle"
          className={styles.label}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}; 