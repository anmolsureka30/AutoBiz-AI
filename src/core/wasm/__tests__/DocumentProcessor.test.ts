import { DocumentProcessor, ProcessingOptions } from '../DocumentProcessor';
import { WasmLoader } from '../WasmLoader';
import { Logger } from '../../utils/logger';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

const mockWasmInstance = {
  exports: {
    memory: {
      buffer: new ArrayBuffer(1024),
    },
    processDocument: jest.fn(),
    malloc: jest.fn(),
    free: jest.fn(),
  },
};

const mockWasmLoader = {
  loadModule: jest.fn().mockResolvedValue(mockWasmInstance),
  transferToWasm: jest.fn().mockReturnValue(0),
} as unknown as WasmLoader;

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  const testConfig = {
    modulePath: '/document-processor.wasm',
    memorySize: 256,
  };

  beforeEach(async () => {
    processor = new DocumentProcessor(mockWasmLoader, mockLogger, testConfig);
    await processor.initialize();
    jest.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    expect(mockWasmLoader.loadModule).toHaveBeenCalledWith(testConfig);
  });

  it('should process document with default options', async () => {
    const testDocument = new Uint8Array([1, 2, 3, 4]);
    mockWasmInstance.exports.processDocument.mockReturnValue(0);

    const result = await processor.processDocument(testDocument);

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(mockWasmLoader.transferToWasm).toHaveBeenCalled();
    expect(mockWasmInstance.exports.processDocument).toHaveBeenCalled();
  });

  it('should handle processing errors gracefully', async () => {
    const testDocument = new Uint8Array([1, 2, 3, 4]);
    mockWasmInstance.exports.processDocument.mockImplementation(() => {
      throw new Error('Processing failed');
    });

    const result = await processor.processDocument(testDocument);

    expect(result.error).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should process document with custom options', async () => {
    const testDocument = new Uint8Array([1, 2, 3, 4]);
    const options: ProcessingOptions = {
      extractText: true,
      performOCR: true,
      quality: 'high',
    };

    const result = await processor.processDocument(testDocument, options);

    expect(result).toBeDefined();
    expect(mockWasmInstance.exports.processDocument).toHaveBeenCalled();
  });

  it('should cleanup memory after processing', async () => {
    const testDocument = new Uint8Array([1, 2, 3, 4]);
    await processor.processDocument(testDocument);

    expect(mockWasmInstance.exports.free).toHaveBeenCalled();
  });
}); 