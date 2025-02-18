import { Task, TaskGroup, GroupedTaskView, TaskGroupStats } from './types';

export class TaskGroupManager {
  private tasks: Map<string, Task>;
  private groups: Map<string, TaskGroup>;
  private taskToGroup: Map<string, Set<string>>;

  constructor() {
    this.tasks = new Map();
    this.groups = new Map();
    this.taskToGroup = new Map();
  }

  addTask(task: Task): void {
    this.tasks.set(task.id, task);
    this.autoGroupTask(task);
  }

  removeTask(taskId: string): void {
    this.tasks.delete(taskId);
    const groupIds = this.taskToGroup.get(taskId);
    if (groupIds) {
      groupIds.forEach(groupId => {
        const group = this.groups.get(groupId);
        if (group) {
          group.tasks.delete(taskId);
          if (group.tasks.size === 0) {
            this.groups.delete(groupId);
          }
        }
      });
      this.taskToGroup.delete(taskId);
    }
  }

  createGroup(group: Omit<TaskGroup, 'tasks'>): TaskGroup {
    const newGroup: TaskGroup = {
      ...group,
      tasks: new Set()
    };
    this.groups.set(group.id, newGroup);
    return newGroup;
  }

  addTaskToGroup(taskId: string, groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.tasks.add(taskId);
    let groupIds = this.taskToGroup.get(taskId);
    if (!groupIds) {
      groupIds = new Set();
      this.taskToGroup.set(taskId, groupIds);
    }
    groupIds.add(groupId);
  }

  removeTaskFromGroup(taskId: string, groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.tasks.delete(taskId);
    const groupIds = this.taskToGroup.get(taskId);
    if (groupIds) {
      groupIds.delete(groupId);
      if (groupIds.size === 0) {
        this.taskToGroup.delete(taskId);
      }
    }
  }

  getTaskGroups(taskId: string): TaskGroup[] {
    const groupIds = this.taskToGroup.get(taskId);
    if (!groupIds) return [];
    return Array.from(groupIds)
      .map(id => this.groups.get(id))
      .filter((group): group is TaskGroup => !!group);
  }

  private autoGroupTask(task: Task): void {
    // Auto-group by type
    const typeGroupId = `type-${task.type}`;
    let typeGroup = this.groups.get(typeGroupId);
    if (!typeGroup) {
      typeGroup = this.createGroup({
        id: typeGroupId,
        name: `${task.type.charAt(0).toUpperCase()}${task.type.slice(1)}s`,
        type: 'category',
        metadata: {
          icon: getIconForType(task.type),
          color: getColorForType(task.type)
        }
      });
    }
    this.addTaskToGroup(task.id, typeGroupId);

    // Auto-group by status
    const statusGroupId = `status-${task.status}`;
    let statusGroup = this.groups.get(statusGroupId);
    if (!statusGroup) {
      statusGroup = this.createGroup({
        id: statusGroupId,
        name: `${task.status.charAt(0).toUpperCase()}${task.status.slice(1)}`,
        type: 'category',
        metadata: {
          icon: getIconForStatus(task.status),
          color: getColorForStatus(task.status)
        }
      });
    }
    this.addTaskToGroup(task.id, statusGroupId);
  }

  private calculateGroupStats(group: TaskGroup): TaskGroupStats {
    const tasks = Array.from(group.tasks)
      .map(id => this.tasks.get(id))
      .filter((task): task is Task => !!task);

    if (tasks.length === 0) {
      return {
        total: 0,
        byStatus: {} as Record<Task['status'], number>,
        byType: {} as Record<Task['type'], number>,
        averageProgress: 0,
        completionRate: 0,
        failureRate: 0
      };
    }

    const byStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<Task['status'], number>);

    const byType = tasks.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1;
      return acc;
    }, {} as Record<Task['type'], number>);

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    const tasksWithDuration = tasks.filter(t => t.endTime && t.startTime);

    const stats: TaskGroupStats = {
      total: tasks.length,
      byStatus,
      byType,
      averageProgress: tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length,
      completionRate: completedTasks.length / tasks.length,
      failureRate: failedTasks.length / tasks.length,
    };

    if (tasksWithDuration.length > 0) {
      stats.averageDuration = tasksWithDuration.reduce(
        (sum, t) => sum + (t.endTime!.getTime() - t.startTime.getTime()),
        0
      ) / tasksWithDuration.length;
    }

    const dates = tasks.map(t => t.startTime);
    if (dates.length > 0) {
      stats.oldestTask = new Date(Math.min(...dates.map(d => d.getTime())));
      stats.newestTask = new Date(Math.max(...dates.map(d => d.getTime())));
    }

    return stats;
  }

  getGroupedView(): GroupedTaskView {
    const ungroupedTasks = new Set(this.tasks.keys());
    this.taskToGroup.forEach((_, taskId) => {
      ungroupedTasks.delete(taskId);
    });

    // Calculate stats for each group
    const groupsWithStats = new Map(
      Array.from(this.groups.entries()).map(([id, group]) => [
        id,
        {
          ...group,
          stats: this.calculateGroupStats(group)
        }
      ])
    );

    return {
      groups: groupsWithStats,
      ungroupedTasks
    };
  }
}

// Helper functions for icons and colors
function getIconForType(type: Task['type']): React.ReactNode {
  // Return appropriate icon component
  return null;
}

function getColorForType(type: Task['type']): string {
  // Return appropriate color
  return '';
}

function getIconForStatus(status: Task['status']): React.ReactNode {
  // Return appropriate icon component
  return null;
}

function getColorForStatus(status: Task['status']): string {
  // Return appropriate color
  return '';
} 