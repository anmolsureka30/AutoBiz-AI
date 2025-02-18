import { AgentId, AgentState } from '../../agents/base/types';
import { Logger } from '../utils/logger';

export interface StateStore {
  /**
   * Save agent state to persistent storage
   * @param agentId Unique identifier for the agent
   * @param state Current agent state to persist
   */
  saveState(agentId: AgentId, state: AgentState): Promise<void>;

  /**
   * Load agent state from persistent storage
   * @param agentId Unique identifier for the agent
   * @returns The stored agent state or null if not found
   */
  loadState(agentId: AgentId): Promise<AgentState | null>;

  /**
   * Clear stored state for an agent
   * @param agentId Unique identifier for the agent
   */
  clearState(agentId: AgentId): Promise<void>;

  /**
   * Get all stored agent states
   * @returns Map of agent IDs to their states
   */
  getAllStates(): Promise<Map<AgentId, AgentState>>;
}

export class IndexedDBStateStore implements StateStore {
  private readonly dbName = 'agent-system';
  private readonly storeName = 'agent-states';
  private readonly version = 1;
  private db: IDBDatabase | null = null;

  constructor(private readonly logger: Logger) {}

  async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      this.logger.info({
        message: 'State persistence initialized',
        database: this.dbName,
        version: this.version,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to initialize state persistence',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async saveState(agentId: AgentId, state: AgentState): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.put({ ...state, timestamp: new Date() });

      request.onerror = () => {
        reject(new Error('Failed to save state'));
      };

      request.onsuccess = () => {
        this.logger.info({
          message: 'Agent state saved',
          agentId,
          timestamp: new Date(),
        });
        resolve();
      };
    });
  }

  async loadState(agentId: AgentId): Promise<AgentState | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(agentId);

      request.onerror = () => {
        reject(new Error('Failed to load state'));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  async clearState(agentId: AgentId): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(agentId);

      request.onerror = () => {
        reject(new Error('Failed to clear state'));
      };

      request.onsuccess = () => {
        this.logger.info({
          message: 'Agent state cleared',
          agentId,
          timestamp: new Date(),
        });
        resolve();
      };
    });
  }

  async getAllStates(): Promise<Map<AgentId, AgentState>> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error('Failed to load states'));
      };

      request.onsuccess = () => {
        const states = new Map<AgentId, AgentState>();
        request.result.forEach((state: AgentState) => {
          states.set(state.id, state);
        });
        resolve(states);
      };
    });
  }
} 