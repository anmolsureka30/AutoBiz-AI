import { WorkerCoordinator, WorkerConfig } from '../WorkerCoordinator';
import { Logger } from '../../utils/logger';

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(public url: string, public options: WorkerOptions) {}

  postMessage(message: any, transfer?: Transferable[]): void {
    // Simulate worker initialization
    if (message.type === 'init') {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: { type: 'initialized' }
        }));
      }, 0);
    }
  }

  terminate(): void {}
}

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: () => '1234-5678',
} as Crypto;

// Setup mocks
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

describe('WorkerCoordinator', () => {
  let coordinator: WorkerCoordinator;
  const config: WorkerConfig = {
    workerPath: '/worker.js',
    maxWorkers: 2,
    wasmModulePath: '/wasm/document-processor.wasm',
  };

  beforeEach(() => {
    // @ts-ignore
    global.Worker = MockWorker;
    coordinator = new WorkerCoordinator(config, mockLogger);
  });

  afterEach(async () => {
    await coordinator.terminate();
    jest.clearAllMocks();
  });

  it('should initialize workers successfully', async () => {
    await coordinator.initialize();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Worker coordinator initialized',
        workerCount: 2,
      })
    );
  });

  it('should process document using available worker', async () => {
    await coordinator.initialize();
    
    const document = new Uint8Array([1, 2, 3, 4]);
    const processPromise = coordinator.processDocument(document);

    // Simulate worker response
    const worker = (global as any).Worker.mock.instances[0];
    worker.onmessage(new MessageEvent('message', {
      data: {
        type: 'result',
        id: '1234-5678',
        payload: { metadata: {} },
      },
    }));

    const result = await processPromise;
    expect(result).toBeDefined();
  });

  it('should handle worker errors gracefully', async () => {
    await coordinator.initialize();

    const worker = (global as any).Worker.mock.instances[0];
    worker.onerror(new ErrorEvent('error', {
      message: 'Worker failed',
    }));

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Worker error',
      })
    );
  });
}); 