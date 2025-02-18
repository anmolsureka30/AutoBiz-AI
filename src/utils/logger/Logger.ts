export class Logger {
  constructor(private readonly context: string) {}

  info(message: string, data?: Record<string, unknown>): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('ERROR', message, data);
  }

  private log(level: string, message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...data,
    };

    // In production, you might want to send this to a logging service
    if (process.env.NODE_ENV === 'production') {
      // Send to logging service
      this.sendToLoggingService(logEntry);
    } else {
      // Development logging
      const color = this.getLogColor(level);
      console.log(`${color}[${timestamp}] ${level} [${this.context}]: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\x1b[0m`);
    }
  }

  private getLogColor(level: string): string {
    switch (level) {
      case 'ERROR': return '\x1b[31m'; // Red
      case 'WARN': return '\x1b[33m';  // Yellow
      case 'INFO': return '\x1b[36m';  // Cyan
      default: return '\x1b[0m';       // Reset
    }
  }

  private async sendToLoggingService(logEntry: Record<string, unknown>): Promise<void> {
    // Implementation would depend on your logging service
    // Example with generic logging service:
    try {
      await fetch(process.env.LOGGING_SERVICE_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOGGING_SERVICE_TOKEN}`,
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Failed to send log to logging service:', error);
    }
  }
} 