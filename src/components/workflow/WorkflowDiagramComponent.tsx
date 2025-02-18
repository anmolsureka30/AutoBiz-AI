import React, { useEffect, useRef, useState } from 'react';
import { WorkflowGraph } from '../../core/workflow/visualization/types';
import { WorkflowNodeComponent } from './nodes/WorkflowNodeComponent';
import { WorkflowEdgeComponent } from './edges/WorkflowEdgeComponent';
import styles from './WorkflowDiagram.module.css';

interface WorkflowDiagramProps {
  graph: WorkflowGraph;
  onNodeClick?: (nodeId: string) => void;
  onNodeStatusChange?: (nodeId: string, status: string) => void;
}

export const WorkflowDiagramComponent: React.FC<WorkflowDiagramProps> = ({
  graph,
  onNodeClick,
  onNodeStatusChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.max(0.1, Math.min(2, s * delta)));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className={styles.graph}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
      >
        <svg className={styles.edges}>
          {graph.edges.map(edge => {
            const sourceNode = graph.nodes.find(n => n.id === edge.source);
            const targetNode = graph.nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <WorkflowEdgeComponent
                key={edge.id}
                edge={edge}
                sourcePosition={sourceNode.position}
                targetPosition={targetNode.position}
              />
            );
          })}
        </svg>
        <div className={styles.nodes}>
          {graph.nodes.map(node => (
            <WorkflowNodeComponent
              key={node.id}
              node={node}
              onClick={onNodeClick}
              onStatusChange={onNodeStatusChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 