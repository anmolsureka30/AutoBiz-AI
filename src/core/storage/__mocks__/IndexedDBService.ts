import { StoreConfig } from '../types';

export class MockIndexedDBService {
  private stores: Map<string, Map<string, any>> = new Map();
  private indexes: Map<string, Map<string, Map<string, any[]>>> = new Map();

  async initialize(stores: StoreConfig[]): Promise<void> {
    stores.forEach(store => {
      this.stores.set(store.name, new Map());
      
      // Initialize indexes
      const storeIndexes = new Map<string, Map<string, any[]>>();
      store.indexes?.forEach(index => {
        storeIndexes.set(index.name, new Map());
      });
      this.indexes.set(store.name, storeIndexes);
    });
  }

  async put(storeName: string, item: any): Promise<void> {
    const store = this.getStore(storeName);
    store.set(item.id, item);

    // Update indexes
    const storeIndexes = this.indexes.get(storeName);
    if (storeIndexes) {
      storeIndexes.forEach((indexMap, indexName) => {
        const indexValue = item[indexName];
        if (indexValue !== undefined) {
          const items = indexMap.get(indexValue) || [];
          items.push(item);
          indexMap.set(indexValue, items);
        }
      });
    }
  }

  async get(storeName: string, key: string): Promise<any> {
    const store = this.getStore(storeName);
    return store.get(key);
  }

  async getAll(storeName: string): Promise<any[]> {
    const store = this.getStore(storeName);
    return Array.from(store.values());
  }

  async getByIndex(storeName: string, indexName: string, range: IDBKeyRange): Promise<any[]> {
    const storeIndexes = this.indexes.get(storeName);
    if (!storeIndexes) {
      throw new Error(`Store ${storeName} not found`);
    }

    const indexMap = storeIndexes.get(indexName);
    if (!indexMap) {
      throw new Error(`Index ${indexName} not found in store ${storeName}`);
    }

    const results: any[] = [];
    indexMap.forEach((items, key) => {
      const keyNum = Number(key);
      if (
        (range.lower === undefined || keyNum >= range.lower) &&
        (range.upper === undefined || keyNum <= range.upper)
      ) {
        results.push(...items);
      }
    });

    return results;
  }

  async delete(storeName: string, key: string): Promise<void> {
    const store = this.getStore(storeName);
    const item = store.get(key);
    if (item) {
      store.delete(key);

      // Update indexes
      const storeIndexes = this.indexes.get(storeName);
      if (storeIndexes) {
        storeIndexes.forEach((indexMap, indexName) => {
          const indexValue = item[indexName];
          if (indexValue !== undefined) {
            const items = indexMap.get(indexValue) || [];
            const index = items.findIndex(i => i.id === item.id);
            if (index !== -1) {
              items.splice(index, 1);
            }
            indexMap.set(indexValue, items);
          }
        });
      }
    }
  }

  private getStore(name: string): Map<string, any> {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Store ${name} not found`);
    }
    return store;
  }

  clear(): void {
    this.stores.clear();
    this.indexes.clear();
  }
} 