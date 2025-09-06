import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggingService } from '../services/logging.service';
import { TracingService } from '../services/tracing.service';

/**
 * Interceptor for automatic request/response logging with distributed tracing
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly tracingService: TracingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();
    
    const correlationId = this.tracingService.getCorrelationId(request);
    const span = this.tracingService.startSpan(
      `${request.method} ${request.route?.path || request.url}`,
      correlationId,
    );

    // Set span tags
    this.tracingService.setSpanTags(span.spanId, {
      'http.method': request.method,
      'http.url': request.url,
      'http.route': request.route?.path,
      'user.id': request['user']?.id,
      'api_key.id': request['apiKey']?.id,
    });

    const requestContext = this.loggingService.getRequestContext(request);
    requestContext.traceId = span.traceId;
    requestContext.spanId = span.spanId;

    // Log incoming request
    this.loggingService.info(
      `Incoming ${request.method} ${request.url}`,
      {
        ...requestContext,
        component: 'http',
        operation: 'request',
      }
    );

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        
        // Set response tags
        this.tracingService.setSpanTags(span.spanId, {
          'http.status_code': response.statusCode,
          'response.size': JSON.stringify(data || {}).length,
        });

        // Log successful response
        this.loggingService.info(
          `Completed ${request.method} ${request.url} - ${response.statusCode}`,
          {
            ...requestContext,
            component: 'http',
            operation: 'response',
            statusCode: response.statusCode,
            duration,
            responseSize: JSON.stringify(data || {}).length,
          }
        );

        // Finish span
        this.tracingService.finishSpan(span.spanId);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Set error tags
        this.tracingService.setSpanTags(span.spanId, {
          'error': true,
          'error.name': error.name,
          'error.message': error.message,
          'http.status_code': error.status || 500,
        });

        // Log error response
        this.loggingService.error(
          `Failed ${request.method} ${request.url} - ${error.status || 500}`,
          error,
          {
            ...requestContext,
            component: 'http',
            operation: 'error',
            statusCode: error.status || 500,
            duration,
          }
        );

        // Log to span
        this.tracingService.logToSpan(
          span.spanId,
          'error',
          error.message,
          { stack: error.stack }
        );

        // Finish span
        this.tracingService.finishSpan(span.spanId);

        throw error;
      }),
    );
  }
}
