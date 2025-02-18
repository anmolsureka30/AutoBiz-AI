import React, { useState, useEffect, useCallback } from 'react';
import {
  DashboardContainer,
  Header,
  Sidebar,
  MainContent,
  MetricsGrid,
  MetricCard,
  MetricTitle,
  MetricValue,
  TaskList,
  TaskItem,
  TaskHeader,
  TaskName,
  TaskStatus,
  TaskProgress,
  ProgressBar,
  TaskDetails,
  DetailRow,
  DetailLabel,
  DetailValue,
  FilterBar,
  FilterSelect,
  DateRangePicker,
  SearchInput
} from './styles';
import { DashboardState, Task, SystemMetrics } from './types';
import { formatBytes, formatDuration } from '../../../utils/format';
import { useNotifications } from '../notifications/NotificationContext';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ErrorBoundary } from '../ErrorBoundary';
import { TaskSkeleton, MetricSkeleton, DetailsSkeleton } from './Skeleton';
import { VisuallyHidden } from '../common/VisuallyHidden';
import { KeyboardHelp } from './KeyboardHelp';
import { LiveRegion } from '../common/LiveRegion';
import { FocusTrap } from '../common/FocusTrap';
import { TaskGroupList } from './TaskGroupList';
import { TaskGroupManager } from './TaskGroupManager';

interface DashboardProps {
  onTaskAction?: (taskId: string, action: 'cancel' | 'retry' | 'remove') => void;
  onFilterChange?: (filter: DashboardState['filter']) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onTaskAction,
  onFilterChange
}) => {
  const [state, setState] = useState<DashboardState>({
    tasks: new Map(),
    groups: new Map(),
    metrics: {
      cpu: 0,
      memory: 0,
      storage: { total: 0, used: 0, free: 0 },
      network: { upload: 0, download: 0 }
    },
    filter: {}
  });

  const { addNotification } = useNotifications();

  const [isLoading, setIsLoading] = useState(true);

  const [announcement, setAnnouncement] = useState('');

  const groupManager = React.useRef(new TaskGroupManager());

  const updateMetrics = useCallback((metrics: SystemMetrics) => {
    setState(prev => ({ ...prev, metrics }));
  }, []);

  const updateTask = useCallback((task: Task) => {
    setState(prev => {
      const tasks = new Map(prev.tasks);
      tasks.set(task.id, task);
      groupManager.current.addTask(task);
      return { ...prev, tasks };
    });
  }, []);

  const handleTaskSelect = useCallback((taskId: string) => {
    setState(prev => ({ ...prev, selectedTaskId: taskId }));
    const task = state.tasks.get(taskId);
    if (task) {
      setAnnouncement(`Selected task: ${task.name}, Status: ${task.status}, Progress: ${task.progress}%`);
    }
  }, [state.tasks]);

  const handleTaskAction = useCallback((taskId: string, action: 'cancel' | 'retry' | 'remove') => {
    try {
      onTaskAction?.(taskId, action);
      addNotification({
        type: 'success',
        title: 'Task Updated',
        message: `Task ${action} successful`,
        autoClose: true
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: error instanceof Error ? error.message : 'Failed to update task',
        autoClose: true,
        duration: 8000
      });
    }
  }, [onTaskAction, addNotification]);

  const handleFilterChange = useCallback((
    type: keyof DashboardState['filter'],
    value: any
  ) => {
    try {
      setState(prev => {
        const filter = { ...prev.filter, [type]: value };
        onFilterChange?.(filter);
        return { ...prev, filter };
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Filter Error',
        message: 'Failed to update filters',
        autoClose: true
      });
    }
  }, [onFilterChange, addNotification]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const tasks = Array.from(state.tasks.values());
    const currentIndex = state.selectedTaskId 
      ? tasks.findIndex(task => task.id === state.selectedTaskId)
      : -1;

    switch (event.key) {
      case 'ArrowUp':
        if (currentIndex > 0) {
          handleTaskSelect(tasks[currentIndex - 1].id);
        }
        break;
      case 'ArrowDown':
        if (currentIndex < tasks.length - 1) {
          handleTaskSelect(tasks[currentIndex + 1].id);
        }
        break;
      case 'Enter':
        if (state.selectedTaskId) {
          const task = state.tasks.get(state.selectedTaskId);
          if (task?.status === 'failed') {
            handleTaskAction(task.id, 'retry');
          }
        }
        break;
      case 'Escape':
        setState(prev => ({ ...prev, selectedTaskId: undefined }));
        break;
    }
  }, [state.tasks, state.selectedTaskId, handleTaskSelect, handleTaskAction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        // Load data here
        await Promise.all([
          // Load tasks
          // Load metrics
        ]);
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Loading Error',
          message: 'Failed to load dashboard data',
          autoClose: true
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const renderMetrics = () => (
    <MetricsGrid>
      <MetricCard>
        <MetricTitle>CPU Usage</MetricTitle>
        <MetricValue>{state.metrics.cpu.toFixed(1)}%</MetricValue>
      </MetricCard>
      <MetricCard>
        <MetricTitle>Memory Usage</MetricTitle>
        <MetricValue>{state.metrics.memory.toFixed(1)}%</MetricValue>
      </MetricCard>
      <MetricCard>
        <MetricTitle>Storage</MetricTitle>
        <MetricValue>
          {formatBytes(state.metrics.storage.used)} / {formatBytes(state.metrics.storage.total)}
        </MetricValue>
      </MetricCard>
      <MetricCard>
        <MetricTitle>Network</MetricTitle>
        <MetricValue>
          ↑ {formatBytes(state.metrics.network.upload)}/s
          ↓ {formatBytes(state.metrics.network.download)}/s
        </MetricValue>
      </MetricCard>
    </MetricsGrid>
  );

  const MemoizedTaskItem = React.memo(TaskItem);

  const renderTaskList = () => {
    const groupedView = groupManager.current.getGroupedView();
    
    return (
      <div>
        {Array.from(groupedView.groups.values()).map(group => (
          <TaskGroupList
            key={group.id}
            group={group}
            tasks={state.tasks}
            onTaskSelect={handleTaskSelect}
            selectedTaskId={state.selectedTaskId}
          />
        ))}
        {groupedView.ungroupedTasks.size > 0 && (
          <div>
            <h3>Ungrouped Tasks</h3>
            {Array.from(groupedView.ungroupedTasks).map(taskId => {
              const task = state.tasks.get(taskId);
              if (!task) return null;
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  isSelected={task.id === state.selectedTaskId}
                  onSelect={() => handleTaskSelect(task.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTaskDetails = () => {
    const task = state.selectedTaskId ? state.tasks.get(state.selectedTaskId) : null;
    if (!task) return null;

    return (
      <TaskDetails>
        <DetailRow>
          <DetailLabel>Name</DetailLabel>
          <DetailValue>{task.name}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Type</DetailLabel>
          <DetailValue>{task.type}</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Status</DetailLabel>
          <DetailValue>
            <TaskStatus status={task.status}>
              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </TaskStatus>
          </DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Progress</DetailLabel>
          <DetailValue>{task.progress.toFixed(1)}%</DetailValue>
        </DetailRow>
        <DetailRow>
          <DetailLabel>Start Time</DetailLabel>
          <DetailValue>{task.startTime.toLocaleString()}</DetailValue>
        </DetailRow>
        {task.endTime && (
          <DetailRow>
            <DetailLabel>End Time</DetailLabel>
            <DetailValue>{task.endTime.toLocaleString()}</DetailValue>
          </DetailRow>
        )}
        {task.error && (
          <DetailRow>
            <DetailLabel>Error</DetailLabel>
            <DetailValue style={{ color: 'error' }}>{task.error}</DetailValue>
          </DetailRow>
        )}
      </TaskDetails>
    );
  };

  return (
    <>
      <LiveRegion>
        {announcement}
      </LiveRegion>
      <FocusTrap active={!!state.selectedTaskId}>
        <ErrorBoundary>
          <DashboardContainer role="application" aria-label="Task Management Dashboard">
            <Header role="banner">
              <VisuallyHidden>
                <h1>Task Dashboard</h1>
              </VisuallyHidden>
              <FilterBar role="search" aria-label="Task filters">
                <FilterSelect
                  id="type-filter"
                  aria-label="Filter by task type"
                  value={state.filter.type?.[0] || ''}
                  onChange={e => handleFilterChange('type', [e.target.value])}
                >
                  <option value="">All Types</option>
                  <option value="upload">Upload</option>
                  <option value="download">Download</option>
                  <option value="sync">Sync</option>
                  <option value="process">Process</option>
                  <option value="backup">Backup</option>
                </FilterSelect>
                <FilterSelect
                  id="status-filter"
                  aria-label="Filter by task status"
                  value={state.filter.status?.[0] || ''}
                  onChange={e => handleFilterChange('status', [e.target.value])}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </FilterSelect>
                <SearchInput
                  aria-label="Search tasks"
                  placeholder="Search tasks..."
                  onChange={e => handleFilterChange('search', e.target.value)}
                />
              </FilterBar>
            </Header>
            <Sidebar role="complementary" aria-label="Task list">
              {isLoading ? (
                <div aria-busy="true" aria-label="Loading tasks">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TaskSkeleton key={i} />
                  ))}
                </div>
              ) : (
                renderTaskList()
              )}
            </Sidebar>
            <MainContent role="main" aria-label="Task details">
              {isLoading ? (
                <div aria-busy="true" aria-label="Loading content">
                  <MetricSkeleton />
                  <DetailsSkeleton />
                </div>
              ) : (
                <>
                  <section aria-label="System metrics">
                    {renderMetrics()}
                  </section>
                  <section aria-label="Selected task details">
                    {renderTaskDetails()}
                  </section>
                </>
              )}
            </MainContent>
          </DashboardContainer>
        </ErrorBoundary>
      </FocusTrap>
      <KeyboardHelp />
    </>
  );
}; 