import React, { useRef, useEffect } from 'react';
import { Task } from './types';
import {
  TaskItemContainer,
  TaskHeader,
  TaskName,
  TaskStatus,
  TaskProgress,
  ProgressBar
} from './styles';

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  isSelected,
  onSelect
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
      itemRef.current.focus();
    }
  }, [isSelected]);

  return (
    <TaskItemContainer
      ref={itemRef}
      role="button"
      tabIndex={0}
      status={task.status}
      selected={isSelected}
      onClick={onSelect}
      onKeyPress={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect();
        }
      }}
      aria-selected={isSelected}
      aria-label={`${task.name} - ${task.status} - ${task.progress}% complete`}
    >
      <TaskHeader>
        <TaskName>{task.name}</TaskName>
        <TaskStatus status={task.status}>
          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
        </TaskStatus>
      </TaskHeader>
      <TaskProgress>
        <ProgressBar 
          progress={task.progress} 
          status={task.status}
          role="progressbar"
          aria-valuenow={task.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </TaskProgress>
    </TaskItemContainer>
  );
}; 