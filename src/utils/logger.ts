export interface LogMessage {
  message: string;
  [key: string]: unknown;
}

export interface Logger {
  info(msg: LogMessage): void;
  error(msg: LogMessage): void;
}

export class ConsoleLogger implements Logger {
  constructor(private readonly context: string = 'App') {}

  info(msg: LogMessage): void {
    console.log(`[${this.context}] [INFO] ${msg.message}`, {
      timestamp: new Date(),
      ...msg,
    });
  }

  error(msg: LogMessage): void {
    console.error(`[${this.context}] [ERROR] ${msg.message}`, {
      timestamp: new Date(),
      ...msg,
    });
  }
} 