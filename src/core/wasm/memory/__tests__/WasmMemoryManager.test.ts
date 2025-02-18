import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { WasmMemoryManager } from '../WasmMemoryManager';
import { WasmError } from '../../types';

describe('WasmMemoryManager', () => {
  let memory: WebAssembly.Memory;
  let manager: WasmMemoryManager;

  beforeEach(() => {
    memory = new WebAssembly.Memory({ initial: 1, maximum: 10 });
    manager = new WasmMemoryManager(memory);
  });

  describe('allocation', () => {
    it('should allocate memory with proper alignment', () => {
      const ptr = manager.allocate(100, 8);
      expect(ptr % 8).toBe(0);
    });

    it('should track allocated memory', () => {
      const ptr1 = manager.allocate(100);
      const ptr2 = manager.allocate(200);
      
      const stats = manager.getStats();
      expect(stats.usedPages).toBeGreaterThan(0);
    });

    it('should handle allocation failures', () => {
      const hugeSize = 1024 * 1024 * 1024; // 1GB
      expect(() => manager.allocate(hugeSize)).toThrow(WasmError);
    });
  });

  describe('deallocation', () => {
    it('should free memory correctly', () => {
      const ptr = manager.allocate(100);
      const beforeStats = manager.getStats();
      
      manager.free(ptr);
      const afterStats = manager.getStats();
      
      expect(afterStats.usedPages).toBeLessThan(beforeStats.usedPages);
    });

    it('should handle invalid free operations', () => {
      expect(() => manager.free(12345)).not.toThrow();
    });
  });

  describe('garbage collection', () => {
    it('should merge adjacent free blocks', () => {
      const ptr1 = manager.allocate(100);
      const ptr2 = manager.allocate(100);
      const ptr3 = manager.allocate(100);

      manager.free(ptr1);
      manager.free(ptr2);
      
      // Force GC
      manager.allocate(1024 * 1024); // Trigger GC threshold
      
      const stats = manager.getStats();
      expect(stats.freePages).toBeGreaterThan(0);
    });
  });

  describe('memory growth', () => {
    it('should grow memory when needed', () => {
      const initialStats = manager.getStats();
      
      // Allocate more than initial page
      manager.allocate(64 * 1024); // One page
      
      const finalStats = manager.getStats();
      expect(finalStats.totalPages).toBeGreaterThan(initialStats.totalPages);
    });

    it('should respect maximum memory limit', () => {
      const maxSize = 10 * 64 * 1024; // 10 pages
      expect(() => manager.allocate(maxSize + 1)).toThrow(WasmError);
    });
  });
}); 