import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from '../services/metrics.service';
import { LoggingService } from '../services/logging.service';
import { TracingService } from '../services/tracing.service';

/**
 * Controller for observability endpoints including metrics and health checks
 */
@ApiTags('Observability')
@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
    private readonly tracingService: TracingService,
  ) {}

  /**
   * Get Prometheus metrics endpoint
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get system metrics in Prometheus format' })
  @ApiResponse({
    status: 200,
    description: 'Metrics data in Prometheus format',
    type: String,
  })
  async getMetrics(): Promise<string> {
    this.loggingService.info('Metrics endpoint accessed', {
      component: 'observability',
      operation: 'metrics_export',
    });

    return this.metricsService.getMetrics();
  }

  /**
   * Get observability health status
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get observability system health status' })
  @ApiResponse({
    status: 200,
    description: 'Observability health status',
  })
  getHealth(): Record<string, any> {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        logging: 'operational',
        metrics: 'operational',
        tracing: 'operational',
      },
      version: '1.0.0',
    };

    this.loggingService.info('Health check performed', {
      component: 'observability',
      operation: 'health_check',
      status: healthStatus.status,
    });

    return healthStatus;
  }
}
