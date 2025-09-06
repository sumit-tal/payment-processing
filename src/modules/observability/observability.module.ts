import { Module, Global } from '@nestjs/common';
import { LoggingService } from './services/logging.service';
import { MetricsService } from './services/metrics.service';
import { TracingService } from './services/tracing.service';
import { ObservabilityController } from './controllers/observability.controller';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';

/**
 * Global observability module providing distributed tracing, structured logging, and metrics collection
 */
@Global()
@Module({
  providers: [
    LoggingService,
    MetricsService,
    TracingService,
    LoggingInterceptor,
    MetricsInterceptor,
  ],
  controllers: [ObservabilityController],
  exports: [
    LoggingService,
    MetricsService,
    TracingService,
    LoggingInterceptor,
    MetricsInterceptor,
  ],
})
export class ObservabilityModule {}
