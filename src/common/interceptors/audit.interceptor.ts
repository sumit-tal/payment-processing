import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogService } from '../../modules/audit/services/audit-log.service';
import { AuditAction } from '@/database/entities/audit-log.entity';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();
    
    const method = request.method;
    const path = request.path;
    const apiKey = (request as any).apiKey;
    
    // Determine audit action based on endpoint and method
    const action = this.getAuditAction(method, path);
    
    if (!action) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logAuditEvent(request, action, true, duration, apiKey);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logAuditEvent(request, action, false, duration, apiKey, error.message);
        throw error;
      })
    );
  }

  private getAuditAction(method: string, path: string): AuditAction | null {
    // Payment endpoints
    if (path.includes('/payments')) {
      if (method === 'POST' && path.includes('/purchase')) return AuditAction.PAYMENT_INITIATED;
      if (method === 'POST' && path.includes('/authorize')) return AuditAction.PAYMENT_AUTHORIZED;
      if (method === 'POST' && path.includes('/capture')) return AuditAction.PAYMENT_CAPTURED;
      if (method === 'POST' && path.includes('/refund')) return AuditAction.PAYMENT_REFUNDED;
      if (method === 'POST' && path.includes('/cancel')) return AuditAction.PAYMENT_VOIDED;
    }

    // Subscription endpoints
    if (path.includes('/subscriptions')) {
      if (method === 'POST' && !path.includes('/cancel')) return AuditAction.SUBSCRIPTION_CREATED;
      if (method === 'PUT' || method === 'PATCH') return AuditAction.SUBSCRIPTION_UPDATED;
      if (method === 'POST' && path.includes('/cancel')) return AuditAction.SUBSCRIPTION_CANCELLED;
    }

    // Webhook endpoints
    if (path.includes('/webhooks')) {
      if (method === 'POST') return AuditAction.WEBHOOK_RECEIVED;
    }

    return null;
  }

  private async logAuditEvent(
    request: Request,
    action: AuditAction,
    success: boolean,
    durationMs: number,
    apiKey?: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.auditLogService.logActivity({
        action,
        entityType: this.getEntityType(action),
        userId: apiKey?.clientId,
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        metadata: {
          endpoint: `${request.method} ${request.path}`,
          clientName: apiKey?.clientName,
          requestBody: this.sanitizeRequestBody(request.body),
        },
        success,
        errorMessage,
        durationMs,
      });
    } catch (error) {
      // Don't throw errors for audit logging failures
      console.error('Failed to log audit event:', error);
    }
  }

  private getEntityType(action: AuditAction): string {
    if (action.includes('PAYMENT')) return 'Transaction';
    if (action.includes('SUBSCRIPTION')) return 'Subscription';
    if (action.includes('WEBHOOK')) return 'WebhookEvent';
    return 'Unknown';
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return null;

    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'cardNumber', 'cvv', 'expiryMonth', 'expiryYear',
      'password', 'token', 'apiKey', 'secret'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
