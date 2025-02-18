export type DatabaseType = 'mysql' | 'postgresql' | 'mongodb' | 'sqlite';

export interface DatabaseConnection {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  options?: Record<string, unknown>;
}

export interface DatabaseAgentConfig {
  connection: DatabaseConnection;
  operation: DatabaseOperation;
  timeout?: number;
  maxRetries?: number;
  transactionOptions?: {
    isolation?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
    readOnly?: boolean;
  };
}

export type DatabaseOperation = 
  | QueryOperation 
  | ExecuteOperation 
  | BatchOperation;

export interface QueryOperation {
  type: 'query';
  sql: string;
  parameters?: unknown[];
}

export interface ExecuteOperation {
  type: 'execute';
  sql: string;
  parameters?: unknown[];
}

export interface BatchOperation {
  type: 'batch';
  statements: Array<QueryOperation | ExecuteOperation>;
}

export interface DatabaseResult {
  operation: string;
  success: boolean;
  data?: unknown;
  rowCount?: number;
  affectedRows?: number;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  transaction?: {
    id: string;
    operations: number;
  };
}

export interface DatabaseError extends Error {
  code?: string;
  sqlState?: string;
  query?: string;
  parameters?: unknown[];
  constraint?: string;
} 