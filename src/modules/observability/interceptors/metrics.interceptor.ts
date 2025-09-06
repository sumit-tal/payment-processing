import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service';

/**
 * Interceptor for automatic metrics collection on HTTP requests
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        const route = request.route?.path || request.url;
        const apiKeyId = request['apiKey']?.id;

        this.metricsService.recordHttpRequest(
          request.method,
          route,
          response.statusCode,
          duration,
          apiKeyId,
        );
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        const route = request.route?.path || request.url;
        const statusCode = error.status || 500;
        const apiKeyId = request['apiKey']?.id;

        this.metricsService.recordHttpRequest(
          request.method,
          route,
          statusCode,
          duration,
          apiKeyId,
        );

        // Record error metric
        this.metricsService.recordError('http', error.name || 'UnknownError');

        throw error;
      }),
    );
  }
}
