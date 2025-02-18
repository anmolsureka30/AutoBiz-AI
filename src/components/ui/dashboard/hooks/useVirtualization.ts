import { useCallback, useMemo } from 'react';
import { Task, TaskGroup } from '../types';

interface VirtualizationOptions {
  itemHeight: number;
  overscan?: number;
  containerHeight: number;
}

export function useVirtualization(
  items: (Task | TaskGroup)[],
  options: VirtualizationOptions
) {
  const {
    itemHeight,
    overscan = 3,
    containerHeight
  } = options;

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const totalCount = items.length;

  const getVisibleRange = useCallback((scrollTop: number) => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      totalCount,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { start, end };
  }, [itemHeight, totalCount, containerHeight, overscan]);

  const getOffsetForIndex = useCallback((index: number) => {
    return index * itemHeight;
  }, [itemHeight]);

  return {
    getVisibleRange,
    getOffsetForIndex,
    totalHeight: totalCount * itemHeight
  };
} 