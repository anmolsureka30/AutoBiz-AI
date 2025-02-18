import React, { memo, useCallback } from 'react';
import styled from 'styled-components';
import { ChevronRight } from 'react-feather';
import { TaskGroup, Task } from './types';
import { TaskItem } from './TaskItem';
import { GroupStats } from './GroupStats';

const GroupContainer = styled.div`
  margin-bottom: 16px;
`;

const GroupHeader = styled.div<{ isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 4px;
  margin-bottom: 8px;

  svg {
    transform: rotate(${({ isCollapsed }) => (isCollapsed ? '0deg' : '90deg')});
    transition: transform 0.2s ease;
  }
`;

const GroupIcon = styled.span`
  margin-right: 8px;
  display: flex;
  align-items: center;
`;

const GroupName = styled.span`
  font-weight: 500;
`;

const TaskCount = styled.span`
  margin-left: auto;
  color: ${({ theme }) => theme.colors.textLight};
  font-size: 12px;
`;

interface TaskGroupListProps {
  group: TaskGroup;
  tasks: Map<string, Task>;
  onTaskSelect: (taskId: string) => void;
  selectedTaskId?: string;
}

export const TaskGroupList = memo<TaskGroupListProps>(({
  group,
  tasks,
  onTaskSelect,
  selectedTaskId
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(!!group.collapsed);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const groupTasks = Array.from(group.tasks)
    .map(id => tasks.get(id))
    .filter((task): task is Task => !!task);

  return (
    <GroupContainer>
      <GroupHeader
        isCollapsed={isCollapsed}
        onClick={toggleCollapse}
        role="button"
        aria-expanded={!isCollapsed}
        aria-controls={`group-${group.id}-content`}
      >
        <ChevronRight size={16} />
        {group.metadata?.icon && (
          <GroupIcon>{group.metadata.icon}</GroupIcon>
        )}
        <GroupName>{group.name}</GroupName>
        <TaskCount>{groupTasks.length} tasks</TaskCount>
      </GroupHeader>
      {group.stats && (
        <GroupStats stats={group.stats} compact={isCollapsed} />
      )}
      {!isCollapsed && (
        <div id={`