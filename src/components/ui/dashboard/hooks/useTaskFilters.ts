import { useMemo } from 'react';
import { Task, DashboardState } from '../types';

export function useTaskFilters(
  tasks: Map<string, Task>,
  filter: DashboardState['filter']
) {
  return useMemo(() => {
    const filteredTasks = new Map(tasks);
    
    if (filter.type?.length) {
      for (const [id, task] of filteredTasks) {
        if (!filter.type.includes(task.type)) {
          filteredTasks.delete(id);
        }
      }
    }

    if (filter.status?.length) {
      for (const [id, task] of filteredTasks) {
        if (!filter.status.includes(task.status)) {
          filteredTasks.delete(id);
        }
      }
    }

    if (filter.timeRange) {
      const { start, end } = filter.timeRange;
      for (const [id, task] of filteredTasks) {
        if (task.startTime < start || task.startTime > end) {
          filteredTasks.delete(id);
        }
      }
    }

    return filteredTasks;
  }, [tasks, filter]);
} 