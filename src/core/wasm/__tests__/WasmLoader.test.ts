import { WasmLoader, WasmModuleConfig } from '../WasmLoader';
import { Logger } from '../../utils/logger';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

// Mock fetch
global.fetch = jest.fn();

// Mock WebAssembly
const mockMemory = {
  buffer: new ArrayBuffer(64 * 1024), // 64KB
};

const mockInstance = {
  exports: {
    memory: mockMemory,
    malloc: jest.fn(),
  },
};

global.WebAssembly = {
  Memory: jest.fn().mockImplementation(() => mockMemory),
  compile: jest.fn().mockResolvedValue({}),
  instantiate: jest.fn().mockResolvedValue(mockInstance),
} as unknown as typeof WebAssembly;

describe('WasmLoader', () => {
  let wasmLoader: WasmLoader;
  const testConfig: WasmModuleConfig = {
    modulePath: '/test.wasm',
    memorySize: 256,
  };

  beforeEach(() => {
    wasmLoader = new WasmLoader(mockLogger);
    jest.clearAllMocks();
  });

  it('should load a WASM module successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    const instance = await wasmLoader.loadModule(testConfig);
    
    expect(instance).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith('/test.wasm');
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should cache and reuse loaded modules', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    const instance1 = await wasmLoader.loadModule(testConfig);
    const instance2 = await wasmLoader.loadModule(testConfig);

    expect(instance1).toBe(instance2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(wasmLoader.loadModule(testConfig)).rejects.toThrow(
      'Failed to fetch WASM module'
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should transfer data to WASM memory correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    const instance = await wasmLoader.loadModule(testConfig);
    const testData = new Uint8Array([1, 2, 3, 4]);
    
    (instance.exports.malloc as jest.Mock).mockReturnValue(0);

    const ptr = wasmLoader.transferToWasm(instance, testData);
    
    expect(ptr).toBeDefined();
    expect(instance.exports.malloc).toHaveBeenCalledWith(testData.length);
  });
}); 