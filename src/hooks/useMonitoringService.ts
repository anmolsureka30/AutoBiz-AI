import { useState, useEffect, useCallback } from 'react';
import { AgentMetrics, MetricsSnapshot } from '../core/workflow/monitoring/types';
import { AgentMonitoringService } from '../core/workflow/monitoring/AgentMonitoringService';

const monitoringService = new AgentMonitoringService();

interface MonitoringState {
  metrics: AgentMetrics;
  snapshots: MetricsSnapshot[];
  isLoading: boolean;
  error: Error | null;
}

export function useMonitoringService() {
  const [state, setState] = useState<MonitoringState>({
    metrics: monitoringService.getMetrics(),
    snapshots: monitoringService.getSnapshots(),
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await monitoringService.initialize();
        if (mounted) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error : new Error('Failed to initialize monitoring'),
          }));
        }
      }
    };

    initialize();

    // Subscribe to metrics updates
    monitoringService.on('metricsUpdated', (updatedMetrics) => {
      if (mounted) {
        setState(prev => ({ ...prev, metrics: updatedMetrics }));
      }
    });

    // Subscribe to snapshot updates
    monitoringService.on('snapshot', (snapshot) => {
      if (mounted) {
        setState(prev => ({
          ...prev,
          snapshots: [...prev.snapshots, snapshot],
        }));
      }
    });

    // Subscribe to errors
    monitoringService.on('error', (error) => {
      if (mounted) {
        setState(prev => ({ ...prev, error }));
      }
    });

    return () => {
      mounted = false;
      monitoringService.off('metricsUpdated', setState);
      monitoringService.off('snapshot', setState);
      monitoringService.off('error', setState);
    };
  }, []);

  const getTimeRangeSnapshots = useCallback((startTime?: Date, endTime?: Date) => {
    try {
      return monitoringService.getSnapshots({ startTime, endTime });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to get snapshots'),
      }));
      return [];
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    getTimeRangeSnapshots,
    clearError,
  };
} 