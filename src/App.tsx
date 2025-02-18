import React from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from './theme';
import { Dashboard } from './components/ui/dashboard/Dashboard';
import { GlobalStyle } from './GlobalStyle';

// Mock data generator
const generateMockTasks = () => {
  const tasks = new Map();
  const types = ['upload', 'download', 'sync', 'process', 'backup'] as const;
  const statuses = ['pending', 'running', 'completed', 'failed'] as const;

  for (let i = 0; i < 20; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const progress = status === 'completed' ? 100 : Math.random() * 100;

    tasks.set(`task-${i}`, {
      id: `task-${i}`,
      type,
      status,
      progress,
      startTime: new Date(Date.now() - Math.random() * 86400000),
      endTime: status === 'completed' ? new Date() : undefined,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Task ${i}`,
      description: `This is a ${type} task`,
      error: status === 'failed' ? 'Something went wrong' : undefined
    });
  }

  return tasks;
};

function App() {
  const [tasks] = React.useState(generateMockTasks());

  const handleTaskAction = (taskId: string, action: string) => {
    console.log(`Task ${taskId} action: ${action}`);
  };

  const handleFilterChange = (filter: any) => {
    console.log('Filter changed:', filter);
  };

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Dashboard
        onTaskAction={handleTaskAction}
        onFilterChange={handleFilterChange}
      />
    </ThemeProvider>
  );
}

export default App; 