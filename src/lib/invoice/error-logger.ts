// src/lib/invoice/error-logger.ts

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Error context information
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
  invoiceId?: string;
  format?: string;
  [key: string]: any;
}

/**
 * Structured error log entry
 */
export interface ErrorLogEntry {
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  error?: Error;
  context?: ErrorContext;
  stack?: string;
}

/**
 * Logger for invoice-related errors
 * 
 * Provides structured logging with context information
 * for debugging and monitoring purposes.
 * 
 * Requirements addressed:
 * - Log errors for debugging
 * - Structured error information
 */
export class InvoiceErrorLogger {
  private static instance: InvoiceErrorLogger;
  private logs: ErrorLogEntry[] = [];
  private maxLogs: number = 100;

  private constructor() {}

  /**
   * Get singleton instance of the logger
   */
  static getInstance(): InvoiceErrorLogger {
    if (!InvoiceErrorLogger.instance) {
      InvoiceErrorLogger.instance = new InvoiceErrorLogger();
    }
    return InvoiceErrorLogger.instance;
  }

  /**
   * Log an error with context
   */
  log(
    severity: ErrorSeverity,
    message: string,
    error?: Error,
    context?: ErrorContext
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      error,
      context,
      stack: error?.stack,
    };

    // Add to in-memory logs
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console logging based on severity
    const logMessage = this.formatLogMessage(entry);
    
    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(logMessage);
        break;
      case ErrorSeverity.WARNING:
        console.warn(logMessage);
        break;
      case ErrorSeverity.ERROR:
        console.error(logMessage);
        if (error) console.error(error);
        break;
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL:', logMessage);
        if (error) console.error(error);
        break;
    }

    // In production, you might want to send critical errors to a monitoring service
    // Example: if (severity === ErrorSeverity.CRITICAL) { sendToMonitoring(entry); }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: ErrorContext): void {
    this.log(ErrorSeverity.INFO, message, undefined, context);
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: ErrorContext): void {
    this.log(ErrorSeverity.WARNING, message, undefined, context);
  }

  /**
   * Log an error
   */
  error(message: string, error?: Error, context?: ErrorContext): void {
    this.log(ErrorSeverity.ERROR, message, error, context);
  }

  /**
   * Log a critical error
   */
  critical(message: string, error?: Error, context?: ErrorContext): void {
    this.log(ErrorSeverity.CRITICAL, message, error, context);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 10): ErrorLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get all logs
   */
  getAllLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Format a log entry for console output
   */
  private formatLogMessage(entry: ErrorLogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.severity}]`,
      entry.message,
    ];

    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      parts.push(`(${contextStr})`);
    }

    return parts.join(' ');
  }
}

/**
 * Convenience function to get the logger instance
 */
export function getInvoiceLogger(): InvoiceErrorLogger {
  return InvoiceErrorLogger.getInstance();
}

/**
 * Convenience functions for logging
 */
export const invoiceLogger = {
  info: (message: string, context?: ErrorContext) => 
    getInvoiceLogger().info(message, context),
  
  warn: (message: string, context?: ErrorContext) => 
    getInvoiceLogger().warn(message, context),
  
  error: (message: string, error?: Error, context?: ErrorContext) => 
    getInvoiceLogger().error(message, error, context),
  
  critical: (message: string, error?: Error, context?: ErrorContext) => 
    getInvoiceLogger().critical(message, error, context),
};
