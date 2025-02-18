declare module 'events' {
  class EventEmitter {
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(event: string | symbol): Function[];
    rawListeners(event: string | symbol): Function[];
    emit(event: string | symbol, ...args: any[]): boolean;
    listenerCount(event: string | symbol): number;
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
    eventNames(): Array<string | symbol>;
  }

  export = EventEmitter;
}

declare module 'jest' {
  export interface Jest {
    fn: <T = any>(implementation?: (...args: any[]) => T) => jest.Mock<T>;
    spyOn: (object: any, methodName: string) => jest.SpyInstance;
    mock: (moduleName: string, factory?: any, options?: any) => jest.Mock;
  }

  global {
    namespace jest {
      interface Mock<T = any> {
        new (...args: any[]): T;
        (...args: any[]): T;
        mockImplementation(fn: (...args: any[]) => T): this;
        mockReturnValue(value: T): this;
        mockReturnThis(): this;
        mockResolvedValue(value: T): this;
        mockRejectedValue(value: any): this;
        mockClear(): void;
        mockReset(): void;
        mockRestore(): void;
        getMockName(): string;
        mock: {
          calls: any[][];
          instances: T[];
          contexts: any[];
          results: Array<{ type: string; value: any }>;
        };
      }

      interface SpyInstance<T = any> extends Mock<T> {
        mockRestore(): void;
      }
    }
  }
} 