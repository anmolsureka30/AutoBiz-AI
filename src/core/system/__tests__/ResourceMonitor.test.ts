import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceMonitor } from '../ResourceMonitor';
import { Logger } from '../../../utils/logger';
import os from 'os';

type MockLogger = {
  info: jest.Mock;
  error: jest.Mock;
};

jest.mock('os', () => ({
  cpus: jest.fn(),
  freemem: jest.fn(),
  totalmem: jest.fn(),
  loadavg: jest.fn()
}));

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    monitor = new ResourceMonitor(mockLogger as Logger, {
      updateInterval: 100,
      thresholds: {
        cpu: 80,
        memory: 90
      }
    });

    // Mock OS functions with default values
    (os.cpus as jest.Mock).mockReturnValue([
      {
        times: {
          user: 100,
          nice: 0,
          sys: 50,
          idle: 850,
          irq: 0
        }
      }
    ]);

    (os.freemem as jest.Mock).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    (os.totalmem as jest.Mock).mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
    (os.loadavg as jest.Mock).mockReturnValue([1.5, 1.2, 1.0]);
  });

  afterEach(() => {
    monitor.stop();
    jest.clearAllMocks();
  });

  it('should start monitoring resources', async () => {
    await monitor.start();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Resource monitoring started'
      })
    );
  });

  it('should get resource usage', async () => {
    const usage = await monitor.getResourceUsage();
    
    expect(usage).toHaveProperty('cpu');
    expect(usage).toHaveProperty('memory');
    expect(usage).toHaveProperty('loadAverage');
    expect(usage.loadAverage).toEqual([1.5, 1.2, 1.0]);
  });

  it('should calculate CPU usage correctly', async () => {
    // First measurement
    await monitor.getResourceUsage();

    // Simulate CPU usage change
    (os.cpus as jest.Mock).mockReturnValue([
      {
        times: {
          user: 200, // Increased by 100
          nice: 0,
          sys: 100, // Increased by 50
          idle: 900, // Increased by 50
          irq: 0
        }
      }
    ]);

    const usage = await monitor.getResourceUsage();
    expect(usage.cpu).toBe(75); // (150 used / 200 total) * 100
  });

  it('should calculate memory usage correctly', async () => {
    (os.freemem as jest.Mock).mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB free
    (os.totalmem as jest.Mock).mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB total

    const usage = await monitor.getResourceUsage();
    expect(usage.memory).toBe(75); // (12GB used / 16GB total) * 100
  });

  it('should emit threshold exceeded events for memory', async () => {
    const thresholdSpy = jest.fn();
    monitor.on('threshold:exceeded', thresholdSpy);

    // Mock high memory usage (95%)
    (os.freemem as jest.Mock).mockReturnValue(0.8 * 1024 * 1024 * 1024); // 0.8GB free
    (os.totalmem as jest.Mock).mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB total

    await monitor.start();
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(thresholdSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'memory',
        current: 95
      })
    );
  });

  it('should emit threshold exceeded events for load average', async () => {
    const monitor = new ResourceMonitor(mockLogger as Logger, {
      updateInterval: 100,
      thresholds: {
        cpu: 80,
        memory: 90,
        loadAverage: 2.0
      }
    });

    const thresholdSpy = jest.fn();
    monitor.on('threshold:exceeded', thresholdSpy);

    // Mock high load average
    (os.loadavg as jest.Mock).mockReturnValue([2.5, 2.0, 1.8]);

    await monitor.start();
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(thresholdSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'loadAverage',
        current: 2.5
      })
    );
  });

  it('should handle errors during monitoring', async () => {
    (os.cpus as jest.Mock).mockImplementation(() => {
      throw new Error('CPU info not available');
    });

    await monitor.start();
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error monitoring resources',
        error: 'CPU info not available'
      })
    );
  });

  it('should stop monitoring when requested', async () => {
    await monitor.start();
    monitor.stop();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Resource monitoring stopped'
      })
    );
  });

  it('should not start monitoring if already running', async () => {
    await monitor.start();
    await monitor.start(); // Second call

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('should track network and disk IO', async () => {
    const usage = await monitor.getResourceUsage();
    
    expect(usage.networkIO).toBeDefined();
    expect(usage.networkIO).toHaveProperty('bytesIn');
    expect(usage.networkIO).toHaveProperty('bytesOut');
    
    expect(usage.diskIO).toBeDefined();
    expect(usage.diskIO).toHaveProperty('bytesRead');
    expect(usage.diskIO).toHaveProperty('bytesWritten');
  });
}); 