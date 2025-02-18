import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { MetricsSnapshot } from '../../../core/workflow/monitoring/types';
import styles from './MetricsChart.module.css';

interface MetricsChartProps {
  snapshots: MetricsSnapshot[];
  metrics: Array<{
    key: keyof MetricsSnapshot['metrics'];
    name: string;
    color: string;
    formatter?: (value: number) => string;
  }>;
  className?: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  snapshots,
  metrics,
  className
}) => {
  const data = useMemo(() => {
    return snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp.getTime(),
      ...snapshot.metrics,
    }));
  }, [snapshots]);

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatTooltipValue = (value: number, key: string): string => {
    const metric = metrics.find(m => m.key === key);
    if (metric?.formatter) {
      return metric.formatter(value);
    }
    return value.toLocaleString();
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            type="number"
            domain={['auto', 'auto']}
          />
          <YAxis />
          <Tooltip
            labelFormatter={formatTimestamp}
            formatter={formatTooltipValue}
          />
          <Legend />
          {metrics.map(({ key, name, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}; 