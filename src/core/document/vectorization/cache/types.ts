export interface CacheConfig {
  enabled: boolean;
  ttl?: number;
  maxSize?: number;
  storage?: CacheStorageType;
  path?: string;
  prefix?: string;
  compression?: boolean;
}

export type CacheStorageType = 'memory' | 'redis' | 'filesystem';

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  bytesUsed: number;
  evictions: number;
  lastEvictionTime?: Date;
}

export interface CacheEntry {
  vector: number[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface CacheStorage {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
  stats(): Promise<CacheStats>;
} 