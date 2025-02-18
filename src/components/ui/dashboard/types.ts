export interface Task {
  id: string;
  type: 'upload' | 'download' | 'sync' | 'process' | 'backup';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: Date;
  endTime?: Date;
  name: string;
  description?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskGroupStats {
  total: number;
  byStatus: Record<Task['status'], number>;
  byType: Record<Task['type'], number>;
  averageProgress: number;
  completionRate: number;
  failureRate: number;
  averageDuration?: number; // in milliseconds
  oldestTask?: Date;
  newestTask?: Date;
}

export interface TaskGroup {
  id: string;
  name: string;
  type: 'folder' | 'batch' | 'category';
  tasks: Set<string>; // Task IDs
  metadata?: {
    icon?: React.ReactNode;
    color?: string;
    description?: string;
    priority?: number;
  };
  collapsed?: boolean;
  stats?: TaskGroupStats;
}

export interface GroupedTaskView {
  groups: Map<string, TaskGroup>;
  ungroupedTasks: Set<string>;
  activeGroupId?: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  storage: {
    total: number;
    used: number;
    free: number;
  };
  network: {
    upload: number;
    download: number;
  };
}

export interface DashboardState {
  tasks: Map<string, Task>;
  groups: Map<string, TaskGroup>;
  groupView: GroupedTaskView;
  metrics: SystemMetrics;
  selectedTaskId?: string;
  selectedGroupId?: string;
  filter: {
    type?: Task['type'][];
    status?: Task['status'][];
    timeRange?: {
      start: Date;
      end: Date;
    };
  };
} 