declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
  }

  interface Global {
    process: Process;
  }
}

declare const process: NodeJS.Process;
declare const global: NodeJS.Global & typeof globalThis; 