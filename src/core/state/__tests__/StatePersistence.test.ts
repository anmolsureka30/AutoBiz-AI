import { IndexedDBStateStore } from '../StatePersistence';
import { AgentState, AgentId } from '../../../agents/base/types';
import { Logger } from '../../utils/logger';

// Mock IndexedDB
const indexedDB = {
  open: jest.fn(),
};

const mockDB = {
  transaction: jest.fn(),
  objectStoreNames: {
    contains: jest.fn(),
  },
  createObjectStore: jest.fn(),
};

const mockTransaction = {
  objectStore: jest.fn(),
};

const mockObjectStore = {
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  getAll: jest.fn(),
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

describe('IndexedDBStateStore', () => {
  let stateStore: IndexedDBStateStore;
  const testAgentId: AgentId = 'test-agent';
  const testState: AgentState = {
    id: testAgentId,
    status: 'idle',
    currentTasks: [],
    performance: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageProcessingTime: 0,
      learningIterations: 0,
      lastLearningUpdate: new Date(),
    },
    lastUpdated: new Date(),
  };

  beforeEach(async () => {
    // Setup IndexedDB mocks
    (global as any).indexedDB = indexedDB;
    indexedDB.open.mockImplementation(() => ({
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      result: mockDB,
    }));

    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockObjectStore);

    stateStore = new IndexedDBStateStore(mockLogger);
    await stateStore.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    expect(indexedDB.open).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'State persistence initialized',
      })
    );
  });

  it('should save state', async () => {
    mockObjectStore.put.mockImplementation((data) => ({
      onsuccess: () => {},
      onerror: null,
    }));

    await stateStore.saveState(testAgentId, testState);

    expect(mockObjectStore.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: testAgentId,
      })
    );
  });

  it('should load state', async () => {
    mockObjectStore.get.mockImplementation(() => ({
      onsuccess: function() {
        this.result = testState;
      },
      onerror: null,
    }));

    const loadedState = await stateStore.loadState(testAgentId);

    expect(loadedState).toEqual(testState);
    expect(mockObjectStore.get).toHaveBeenCalledWith(testAgentId);
  });

  it('should clear state', async () => {
    mockObjectStore.delete.mockImplementation(() => ({
      onsuccess: () => {},
      onerror: null,
    }));

    await stateStore.clearState(testAgentId);

    expect(mockObjectStore.delete).toHaveBeenCalledWith(testAgentId);
  });

  it('should get all states', async () => {
    mockObjectStore.getAll.mockImplementation(() => ({
      onsuccess: function() {
        this.result = [testState];
      },
      onerror: null,
    }));

    const states = await stateStore.getAllStates();

    expect(states.size).toBe(1);
    expect(states.get(testAgentId)).toEqual(testState);
  });
}); 