declare module '@jest/globals' {
  export const jest: typeof import('jest');
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: typeof import('expect');
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
}

declare module 'jest-mock' {
  export type Mock<T = any, Y extends any[] = any> = {
    (...args: Y): T;
    mockImplementation(fn: (...args: Y) => T): Mock<T, Y>;
    mockReturnValue(value: T): Mock<T, Y>;
    mockReturnThis(): Mock<T, Y>;
    mockResolvedValue(value: T): Mock<Promise<T>, Y>;
    mockRejectedValue(value: any): Mock<Promise<T>, Y>;
    mockReset(): void;
    mockClear(): void;
    getMockName(): string;
    mock: {
      calls: Y[];
      instances: T[];
      invocationCallOrder: number[];
      results: { type: string; value: T }[];
    };
  };
} 