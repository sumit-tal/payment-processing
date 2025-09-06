import { Injectable } from '@nestjs/common';
import { createLogger, Logger, format, transports } from 'winston';
import { Request } from 'express';

export interface LogContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  apiKeyId?: string;
  operation?: string;
  component?: string;
  [key: string]: any;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  component?: string;
  operation?: string;
  userId?: string;
  apiKeyId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * PCI-compliant structured logging service with sensitive data masking
 */
@Injectable()
export class LoggingService {
  private readonly logger: Logger;
  private readonly sensitiveFields = [
    'password',
    'cardNumber',
    'cvv',
    'cvv2',
    'expirationDate',
    'accountNumber',
    'routingNumber',
    'ssn',
    'socialSecurityNumber',
    'bankAccount',
    'creditCard',
    'debitCard',
    'pin',
    'securityCode',
    'authCode',
    'token',
    'apiKey',
    'secret',
    'privateKey',
  ];

  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          ),
        }),
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  /**
   * Log info level message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    } : context;
    
    this.log('error', message, errorContext);
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log payment operation with PCI compliance
   */
  logPaymentOperation(
    operation: string,
    transactionId: string,
    amount: number,
    currency: string,
    status: string,
    context?: LogContext
  ): void {
    const paymentContext: LogContext = {
      ...context,
      operation,
      component: 'payment',
      transactionId,
      amount,
      currency,
      status,
    };

    this.info(`Payment ${operation} ${status}`, paymentContext);
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context?: LogContext
  ): void {
    const securityContext: LogContext = {
      ...context,
      component: 'security',
      event,
      severity,
      details: this.maskSensitiveData(details),
    };

    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.log(level, `Security event: ${event}`, securityContext);
  }

  /**
   * Log audit event
   */
  logAuditEvent(
    action: string,
    resource: string,
    resourceId: string,
    result: 'success' | 'failure',
    context?: LogContext
  ): void {
    const auditContext: LogContext = {
      ...context,
      component: 'audit',
      action,
      resource,
      resourceId,
      result,
    };

    this.info(`Audit: ${action} on ${resource}:${resourceId} - ${result}`, auditContext);
  }

  /**
   * Extract logging context from request
   */
  getRequestContext(req: Request): LogContext {
    return {
      correlationId: req['correlationId'],
      userId: req['user']?.id,
      apiKeyId: req['apiKey']?.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    };
  }

  /**
   * Core logging method with structured format
   */
  private log(level: string, message: string, context?: LogContext): void {
    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: context?.correlationId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      component: context?.component,
      operation: context?.operation,
      userId: context?.userId,
      apiKeyId: context?.apiKeyId,
      metadata: context ? this.maskSensitiveData(context) : undefined,
    };

    // Remove undefined fields
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key] === undefined) {
        delete logEntry[key];
      }
    });

    this.logger.log(level, logEntry);
  }

  /**
   * Mask sensitive data for PCI compliance
   */
  private maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    const masked = { ...data };
    
    Object.keys(masked).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      // Check if field contains sensitive data
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        masked[key] = this.maskValue(masked[key]);
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    });

    return masked;
  }

  /**
   * Mask sensitive value
   */
  private maskValue(value: any): string {
    if (typeof value !== 'string') {
      return '[MASKED]';
    }

    if (value.length <= 4) {
      return '[MASKED]';
    }

    // Show first 2 and last 2 characters for card numbers
    if (value.length >= 8) {
      return `${value.substring(0, 2)}${'*'.repeat(value.length - 4)}${value.substring(value.length - 2)}`;
    }

    return '[MASKED]';
  }
}
