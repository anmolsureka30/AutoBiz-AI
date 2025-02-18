import { Logger } from '../../utils/logger/Logger';
import { WasmMemoryStats, WasmError } from '../types';

interface MemoryBlock {
  ptr: number;
  size: number;
  used: boolean;
  timestamp: number;
}

export class WasmMemoryManager {
  private readonly logger: Logger;
  private readonly memory: WebAssembly.Memory;
  private readonly blocks: Map<number, MemoryBlock>;
  private readonly gcThreshold: number;
  private totalAllocated: number = 0;
  private lastGC: number = 0;

  constructor(
    memory: WebAssembly.Memory,
    options: {
      gcThreshold?: number; // Bytes before triggering GC
      logLevel?: string;
    } = {}
  ) {
    this.logger = new Logger('WasmMemoryManager');
    this.memory = memory;
    this.blocks = new Map();
    this.gcThreshold = options.gcThreshold || 1024 * 1024; // 1MB default
  }

  allocate(size: number, alignment: number = 8): number {
    try {
      // Check if GC is needed
      if (this.totalAllocated + size > this.gcThreshold) {
        this.collectGarbage();
      }

      // Find suitable block or allocate new memory
      const ptr = this.findFreeBlock(size, alignment) || this.growMemory(size, alignment);

      // Record allocation
      this.blocks.set(ptr, {
        ptr,
        size,
        used: true,
        timestamp: Date.now(),
      });

      this.totalAllocated += size;

      this.logger.debug('Memory allocated', {
        ptr,
        size,
        totalAllocated: this.totalAllocated,
      });

      return ptr;
    } catch (error) {
      const memError = new Error('Memory allocation failed') as WasmError;
      memError.code = 'MEMORY_ALLOCATION_ERROR';
      memError.details = {
        requestedSize: size,
        alignment,
        availableMemory: this.getAvailableMemory(),
        error: error.message,
      };
      throw memError;
    }
  }

  free(ptr: number): void {
    const block = this.blocks.get(ptr);
    if (!block) {
      this.logger.warn('Attempting to free unallocated memory', { ptr });
      return;
    }

    block.used = false;
    this.totalAllocated -= block.size;

    this.logger.debug('Memory freed', {
      ptr,
      size: block.size,
      totalAllocated: this.totalAllocated,
    });
  }

  getStats(): WasmMemoryStats {
    const totalPages = this.memory.buffer.byteLength / (64 * 1024);
    const usedPages = Math.ceil(this.totalAllocated / (64 * 1024));
    
    return {
      totalPages,
      usedPages,
      freePages: totalPages - usedPages,
      growthCount: this.getGrowthCount(),
    };
  }

  private findFreeBlock(size: number, alignment: number): number | null {
    for (const [ptr, block] of this.blocks) {
      if (!block.used && block.size >= size) {
        const alignedPtr = this.alignAddress(ptr, alignment);
        if (alignedPtr + size <= ptr + block.size) {
          // Split block if necessary
          if (alignedPtr > ptr || alignedPtr + size < ptr + block.size) {
            this.splitBlock(block, alignedPtr, size);
          }
          return alignedPtr;
        }
      }
    }
    return null;
  }

  private growMemory(size: number, alignment: number): number {
    const currentPages = this.memory.buffer.byteLength / (64 * 1024);
    const requiredBytes = size + alignment;
    const requiredPages = Math.ceil(requiredBytes / (64 * 1024));
    
    try {
      const newPages = this.memory.grow(requiredPages);
      const ptr = newPages * 64 * 1024;
      return this.alignAddress(ptr, alignment);
    } catch (error) {
      throw new Error(`Failed to grow memory: ${error.message}`);
    }
  }

  private alignAddress(ptr: number, alignment: number): number {
    return Math.ceil(ptr / alignment) * alignment;
  }

  private splitBlock(block: MemoryBlock, alignedPtr: number, size: number): void {
    // Create fragment before aligned address if necessary
    if (alignedPtr > block.ptr) {
      this.blocks.set(block.ptr, {
        ptr: block.ptr,
        size: alignedPtr - block.ptr,
        used: false,
        timestamp: block.timestamp,
      });
    }

    // Create main block
    this.blocks.set(alignedPtr, {
      ptr: alignedPtr,
      size,
      used: true,
      timestamp: Date.now(),
    });

    // Create fragment after allocated block if necessary
    const remainingPtr = alignedPtr + size;
    const remainingSize = (block.ptr + block.size) - remainingPtr;
    if (remainingSize > 0) {
      this.blocks.set(remainingPtr, {
        ptr: remainingPtr,
        size: remainingSize,
        used: false,
        timestamp: block.timestamp,
      });
    }

    // Remove original block
    this.blocks.delete(block.ptr);
  }

  private collectGarbage(): void {
    const now = Date.now();
    if (now - this.lastGC < 1000) return; // Prevent too frequent GC

    this.logger.debug('Starting garbage collection');
    let freedBytes = 0;

    // Merge adjacent free blocks
    const sortedBlocks = Array.from(this.blocks.values())
      .sort((a, b) => a.ptr - b.ptr);

    let i = 0;
    while (i < sortedBlocks.length - 1) {
      const current = sortedBlocks[i];
      const next = sortedBlocks[i + 1];

      if (!current.used && !next.used) {
        // Merge blocks
        current.size += next.size;
        this.blocks.delete(next.ptr);
        sortedBlocks.splice(i + 1, 1);
        freedBytes += next.size;
      } else {
        i++;
      }
    }

    this.lastGC = now;
    this.logger.info('Garbage collection completed', {
      freedBytes,
      totalAllocated: this.totalAllocated,
    });
  }

  private getGrowthCount(): number {
    return this.memory.buffer.byteLength / (64 * 1024) - 1;
  }

  private getAvailableMemory(): number {
    return this.memory.buffer.byteLength - this.totalAllocated;
  }
} 