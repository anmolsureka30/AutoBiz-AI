export type ScriptLanguage = 'javascript' | 'typescript' | 'python';

export interface ScriptAgentConfig {
  language: ScriptLanguage;
  code: string;
  timeout?: number;
  memoryLimit?: number;
  environmentVariables?: Record<string, string>;
  dependencies?: string[];
  parameters?: Record<string, unknown>;
}

export interface ScriptResult {
  output: unknown;
  console: {
    logs: string[];
    errors: string[];
    warnings: string[];
  };
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  memory: {
    used: number;
    peak: number;
  };
}

export interface ScriptError extends Error {
  scriptOutput?: ScriptResult;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: string;
} 