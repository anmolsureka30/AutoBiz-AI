import type { Config } from '@jest/types';
import type { Mock } from 'jest-mock';
import { AgentState } from '../agents/base/types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWith(...args: any[]): R;
      toBeCalledWith(...args: any[]): R;
      lastCalledWith(...args: any[]): R;
      toHaveBeenLastCalledWith(...args: any[]): R;
      toHaveBeenNthCalledWith(n: number, ...args: any[]): R;
      nthCalledWith(n: number, ...args: any[]): R;
      toBeValidAgentState(): R;
    }

    interface Mock<T = any, Y extends any[] = any> {
      (...args: Y): T;
      mockImplementation(fn: (...args: Y) => T): this;
      mockReturnValue(value: T): this;
      mockReturnThis(): this;
      mockResolvedValue(value: T): this;
      mockRejectedValue(value: any): this;
      mockReset(): void;
      mockClear(): void;
      getMockName(): string;
      mock: {
        calls: Y[];
        instances: T[];
        invocationCallOrder: number[];
        results: { type: string; value: T }[];
      };
    }
  }

  // Add this to expose jest globally
  const jest: {
    fn<T = any>(): jest.Mock<T>;
    spyOn<T extends {}, M extends keyof T>(object: T, method: M): jest.Mock;
  };
}

declare module '@jest/globals' {
  interface JestGlobal {
    fn<T = any>(): jest.Mock<T>;
    spyOn<T extends {}, M extends keyof T>(object: T, method: M): jest.Mock;
    clearAllMocks(): void;
    useFakeTimers(): void;
    useRealTimers(): void;
    advanceTimersByTime(ms: number): void;
  }

  export const jest: JestGlobal;
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: <T = any>(actual: T) => jest.Matchers<T>;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
}

declare module 'jest-mock' {
  export type Mock<T = any, Y extends any[] = any> = jest.Mock<T, Y>;
}

export {}; 