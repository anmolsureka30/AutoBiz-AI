import { BaseAgent } from '../BaseAgent';
import { WorkflowStep } from '../../types';
import {
  DatabaseAgentConfig,
  DatabaseResult,
  DatabaseError,
  DatabaseType,
  DatabaseOperation,
  QueryOperation,
  ExecuteOperation,
  BatchOperation,
} from './types';
import { createConnection, Connection, QueryRunner } from 'typeorm';
import { MongoClient, Db } from 'mongodb';
import { Database as SQLiteDatabase } from 'sqlite3';

type DatabaseConnection = Connection | MongoClient | SQLiteDatabase;

export class DatabaseAgent extends BaseAgent {
  private readonly defaultConfig: Partial<DatabaseAgentConfig> = {
    timeout: 30000,
    maxRetries: 3,
    transactionOptions: {
      isolation: 'READ COMMITTED',
      readOnly: false,
    },
  };

  private connections: Map<string, DatabaseConnection>;

  constructor(config: Partial<DatabaseAgentConfig> = {}) {
    super('Database');
    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.connections = new Map();
  }

  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<DatabaseResult> {
    try {
      const config = this.prepareConfig(step);
      const startTime = Date.now();

      const connection = await this.getConnection(config);
      const result = await this.executeOperation(connection, config.operation);
      const endTime = Date.now();

      return {
        operation: config.operation.type,
        success: true,
        ...result,
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
        },
      };
    } catch (error) {
      throw this.handleDatabaseError(error, step);
    }
  }

  async validate(step: WorkflowStep): Promise<boolean> {
    try {
      await super.validate(step);
      const config = step.config as Partial<DatabaseAgentConfig>;
      
      this.validateRequiredConfig(config as Record<string, unknown>, ['connection', 'operation']);
      
      if (!this.isSupportedDatabase(config.connection?.type)) {
        throw new Error(`Unsupported database type: ${config.connection?.type}`);
      }

      await this.validateOperation(config.operation!);

      return true;
    } catch (error) {
      this.logger.error('Database validation failed', { error, step });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(async connection => {
      try {
        if ('close' in connection && typeof connection.close === 'function') {
          await connection.close();
        }
      } catch (error) {
        this.logger.error('Error closing connection', { error });
      }
    });

    await Promise.all(closePromises);
    this.connections.clear();
  }

  private prepareConfig(step: WorkflowStep): DatabaseAgentConfig {
    return { ...this.defaultConfig, ...step.config } as DatabaseAgentConfig;
  }

  private async getConnection(config: DatabaseAgentConfig): Promise<DatabaseConnection> {
    const connectionKey = this.getConnectionKey(config.connection);
    let connection = this.connections.get(connectionKey);

    if (!connection) {
      connection = await this.createConnection(config.connection);
      this.connections.set(connectionKey, connection);
    }

    return connection;
  }

  private async createConnection(config: DatabaseAgentConfig['connection']): Promise<DatabaseConnection> {
    switch (config.type) {
      case 'mysql':
      case 'postgresql':
        return createConnection({
          type: config.type,
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password,
          ...config.options,
        });

      case 'mongodb':
        const url = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
        return MongoClient.connect(url, config.options);

      case 'sqlite':
        return new Promise<SQLiteDatabase>((resolve, reject) => {
          const db = new SQLiteDatabase(config.database, (err: Error | null) => {
            if (err) reject(err);
            else resolve(db);
          });
        });

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  private async executeOperation(
    connection: DatabaseConnection,
    operation: DatabaseOperation
  ): Promise<Partial<DatabaseResult>> {
    switch (operation.type) {
      case 'query':
        return this.executeQuery(connection, operation);
      case 'execute':
        return this.executeStatement(connection, operation);
      case 'batch':
        return this.executeBatch(connection, operation);
      default:
        throw new Error(`Unsupported operation type: ${(operation as any).type}`);
    }
  }

  private async executeQuery(
    connection: DatabaseConnection,
    operation: QueryOperation
  ): Promise<Partial<DatabaseResult>> {
    const result = await this.runQuery(connection, operation.sql, operation.parameters);
    return {
      data: result,
      rowCount: Array.isArray(result) ? result.length : 0,
    };
  }

  private async executeStatement(
    connection: DatabaseConnection,
    operation: ExecuteOperation
  ): Promise<Partial<DatabaseResult>> {
    const result = await this.runStatement(connection, operation.sql, operation.parameters);
    return {
      affectedRows: result.affectedRows || 0,
    };
  }

  private async executeBatch(
    connection: DatabaseConnection,
    operation: BatchOperation
  ): Promise<Partial<DatabaseResult>> {
    const results = [];
    let totalAffected = 0;

    for (const stmt of operation.statements) {
      const result = await this.executeOperation(connection, stmt);
      results.push(result);
      totalAffected += result.affectedRows || 0;
    }

    return {
      data: results,
      affectedRows: totalAffected,
    };
  }

  private async runQuery(
    connection: DatabaseConnection,
    sql: string,
    parameters?: unknown[]
  ): Promise<unknown> {
    if (connection instanceof MongoClient) {
      // MongoDB query handling
      const db = connection.db();
      return db.eval(sql, parameters);
    } else if ('query' in connection) {
      // TypeORM/SQL query handling
      return connection.query(sql, parameters);
    } else {
      // SQLite query handling
      return new Promise((resolve, reject) => {
        (connection as SQLiteDatabase).all(sql, parameters, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  }

  private async runStatement(
    connection: DatabaseConnection,
    sql: string,
    parameters?: unknown[]
  ): Promise<{ affectedRows: number }> {
    if (connection instanceof MongoClient) {
      // MongoDB statement handling
      const db = connection.db();
      const result = await db.eval(sql, parameters);
      return { affectedRows: result.modifiedCount || 0 };
    } else if ('query' in connection) {
      // TypeORM/SQL statement handling
      const result = await connection.query(sql, parameters);
      return { affectedRows: result.affectedRows || 0 };
    } else {
      // SQLite statement handling
      return new Promise((resolve, reject) => {
        (connection as SQLiteDatabase).run(sql, parameters, function(err) {
          if (err) reject(err);
          else resolve({ affectedRows: this.changes });
        });
      });
    }
  }

  private getConnectionKey(connection: DatabaseAgentConfig['connection']): string {
    return `${connection.type}://${connection.host}:${connection.port}/${connection.database}`;
  }

  private isSupportedDatabase(type?: DatabaseType): boolean {
    return ['mysql', 'postgresql', 'mongodb', 'sqlite'].includes(type || '');
  }

  private async validateOperation(operation: DatabaseOperation): Promise<void> {
    if (!operation.type) {
      throw new Error('Operation type is required');
    }

    if (operation.type === 'batch' && (!operation.statements || operation.statements.length === 0)) {
      throw new Error('Batch operation requires at least one statement');
    }

    if ((operation.type === 'query' || operation.type === 'execute') && !operation.sql) {
      throw new Error('SQL statement is required for query/execute operations');
    }
  }

  private handleDatabaseError(error: unknown, step: WorkflowStep): never {
    const dbError: DatabaseError = new Error('Database operation failed') as DatabaseError;
    
    if (error instanceof Error) {
      dbError.message = error.message;
      dbError.stack = error.stack;
      
      // Extract database-specific error information
      if ('code' in error) dbError.code = (error as any).code;
      if ('sqlState' in error) dbError.sqlState = (error as any).sqlState;
      if ('sql' in error) dbError.query = (error as any).sql;
      if ('parameters' in error) dbError.parameters = (error as any).parameters;
    }

    throw this.handleError(dbError, step);
  }
} 