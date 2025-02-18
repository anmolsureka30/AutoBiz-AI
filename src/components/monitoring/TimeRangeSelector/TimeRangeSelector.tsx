import React, { useState, useCallback } from 'react';
import styles from './TimeRangeSelector.module.css';

interface TimeRange {
  label: string;
  value: number; // milliseconds
}

const TIME_RANGES: TimeRange[] = [
  { label: '5m', value: 5 * 60 * 1000 },
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '30m', value: 30 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '3h', value: 3 * 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '12h', value: 12 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 },
];

interface TimeRangeSelectorProps {
  onChange: (range: { startTime: Date; endTime: Date }) => void;
  className?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  onChange,
  className,
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [customRange, setCustomRange] = useState<{
    start: string;
    end: string;
  }>({
    start: '',
    end: '',
  });

  const handleRangeClick = useCallback((range: TimeRange) => {
    setSelectedRange(range);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - range.value);
    onChange({ startTime, endTime });
  }, [onChange]);

  const handleCustomRangeChange = useCallback(() => {
    if (customRange.start && customRange.end) {
      const startTime = new Date(customRange.start);
      const endTime = new Date(customRange.end);
      if (startTime < endTime) {
        onChange({ startTime, endTime });
      }
    }
  }, [customRange, onChange]);

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.presets}>
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            className={`${styles.rangeButton} ${
              selectedRange.value === range.value ? styles.active : ''
            }`}
            onClick={() => handleRangeClick(range)}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className={styles.customRange}>
        <input
          type="datetime-local"
          value={customRange.start}
          onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
          className={styles.dateInput}
        />
        <span className={styles.separator}>to</span>
        <input
          type="datetime-local"
          value={customRange.end}
          onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
          className={styles.dateInput}
        />
        <button
          className={styles.applyButton}
          onClick={handleCustomRangeChange}
          disabled={!customRange.start || !customRange.end}
        >
          Apply
        </button>
      </div>
    </div>
  );
}; 