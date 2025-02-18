import { DocumentProcessor, ProcessingOptions } from '../wasm/DocumentProcessor';
import { WasmLoader } from '../wasm/WasmLoader';
import { Logger } from '../utils/logger';

let processor: DocumentProcessor;

self.onmessage = async (event: MessageEvent) => {
  const { type, id, payload } = event.data;

  try {
    switch (type) {
      case 'init':
        await initializeProcessor(payload.wasmModulePath);
        self.postMessage({ type: 'initialized' });
        break;

      case 'process':
        if (!processor) {
          throw new Error('Processor not initialized');
        }

        const result = await processor.processDocument(
          payload.document,
          payload.options
        );

        self.postMessage({
          type: 'result',
          id,
          payload: result,
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      payload: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

async function initializeProcessor(wasmModulePath: string): Promise<void> {
  const logger: Logger = {
    info: (msg: any) => console.log('[Worker]', msg),
    error: (msg: any) => console.error('[Worker]', msg),
  };

  const wasmLoader = new WasmLoader(logger);
  
  processor = new DocumentProcessor(wasmLoader, logger, {
    modulePath: wasmModulePath,
    memorySize: 256,
  });

  await processor.initialize();
}

// Handle worker termination
self.onclose = () => {
  // Cleanup resources if needed
}; 