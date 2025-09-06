import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';
import {
  WebhookEventResponseDto,
  WebhookEventQueryDto,
  ProcessWebhookEventDto,
  RetryWebhookEventDto,
} from '../dto/webhook-event.dto';
import { WebhookEvent } from '../entities/webhook-event.entity';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('authorize-net')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Authorize.Net webhook',
    description: 'Endpoint to receive and process webhooks from Authorize.Net payment gateway',
  })
  @ApiHeader({
    name: 'X-ANET-Signature',
    description: 'Webhook signature for verification',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'pending' },
        message: { type: 'string', example: 'Webhook received and queued for processing' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook payload or signature',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during webhook processing',
  })
  async receiveAuthorizeNetWebhook(
    @Body() rawBody: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{
    eventId: string;
    status: string;
    message: string;
  }> {
    try {
      this.logger.log('Received Authorize.Net webhook', {
        contentType: headers['content-type'],
        userAgent: headers['user-agent'],
        hasSignature: !!headers['x-anet-signature'],
      });

      // Convert body to string if it's an object
      const payload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

      const result = await this.webhookService.processAuthorizeNetWebhook(payload, headers);

      return {
        eventId: result.eventId,
        status: result.status,
        message: 'Webhook received and queued for processing',
      };
    } catch (error) {
      this.logger.error('Failed to process Authorize.Net webhook', {
        error: error.message,
        stack: error.stack,
      });

      if (error.message.includes('validation failed')) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('Failed to process webhook');
    }
  }

  @Get('events')
  @ApiOperation({
    summary: 'Get webhook events',
    description: 'Retrieve webhook events with optional filtering',
  })
  @ApiQuery({ name: 'eventType', required: false, description: 'Filter by event type' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by event status' })
  @ApiQuery({ name: 'externalId', required: false, description: 'Filter by external ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Page offset', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Webhook events retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: { $ref: '#/components/schemas/WebhookEventResponseDto' },
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  })
  async getWebhookEvents(
    @Query() query: WebhookEventQueryDto,
  ): Promise<{
    events: WebhookEventResponseDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const result = await this.webhookService.findEvents(query);

      const events: WebhookEventResponseDto[] = result.events.map(event => ({
        id: event.id,
        eventType: event.eventType,
        externalId: event.externalId,
        status: event.status,
        retryCount: event.retryCount,
        maxRetries: event.maxRetries,
        processedAt: event.processedAt,
        errorMessage: event.errorMessage,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      }));

      return {
        events,
        total: result.total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve webhook events', {
        error: error.message,
        query,
        stack: error.stack,
      });
      throw new InternalServerErrorException('Failed to retrieve webhook events');
    }
  }

  @Get('events/:id')
  @ApiOperation({
    summary: 'Get webhook event by ID',
    description: 'Retrieve a specific webhook event by its ID',
  })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook event retrieved successfully',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook event not found',
  })
  async getWebhookEventById(@Param('id') id: string): Promise<WebhookEventResponseDto> {
    try {
      const event = await this.webhookService.findById(id);

      return {
        id: event.id,
        eventType: event.eventType,
        externalId: event.externalId,
        status: event.status,
        retryCount: event.retryCount,
        maxRetries: event.maxRetries,
        processedAt: event.processedAt,
        errorMessage: event.errorMessage,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve webhook event', {
        error: error.message,
        eventId: id,
        stack: error.stack,
      });

      if (error.message.includes('not found')) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to retrieve webhook event');
    }
  }

  @Post('events/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry webhook event processing',
    description: 'Manually retry processing of a failed webhook event',
  })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook event queued for retry',
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        status: { type: 'string' },
        retryCount: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Event cannot be retried',
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook event not found',
  })
  async retryWebhookEvent(
    @Param('id') id: string,
    @Body() dto: RetryWebhookEventDto,
  ): Promise<{
    eventId: string;
    status: string;
    retryCount: number;
    message: string;
  }> {
    try {
      const event = await this.webhookService.retryWebhookEvent(id, dto.forceRetry);

      return {
        eventId: event.id,
        status: event.status,
        retryCount: event.retryCount,
        message: 'Event queued for retry processing',
      };
    } catch (error) {
      this.logger.error('Failed to retry webhook event', {
        error: error.message,
        eventId: id,
        forceRetry: dto.forceRetry,
        stack: error.stack,
      });

      if (error.message.includes('not found')) {
        throw error;
      }

      if (error.message.includes('cannot be retried')) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('Failed to retry webhook event');
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get webhook processing statistics',
    description: 'Retrieve statistics about webhook event processing',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        pending: { type: 'number', description: 'Number of pending events' },
        processing: { type: 'number', description: 'Number of events being processed' },
        processed: { type: 'number', description: 'Number of successfully processed events' },
        failed: { type: 'number', description: 'Number of failed events' },
        retrying: { type: 'number', description: 'Number of events being retried' },
        queueStats: {
          type: 'object',
          properties: {
            approximateNumberOfMessages: { type: 'number' },
            approximateNumberOfMessagesNotVisible: { type: 'number' },
            approximateNumberOfMessagesDelayed: { type: 'number' },
          },
        },
      },
    },
  })
  async getWebhookStats(): Promise<{
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    retrying: number;
    queueStats: {
      approximateNumberOfMessages: number;
      approximateNumberOfMessagesNotVisible: number;
      approximateNumberOfMessagesDelayed: number;
    };
  }> {
    try {
      const [processingStats, queueStats] = await Promise.all([
        this.webhookService.getProcessingStats(),
        // Note: This would require injecting SqsService directly or through WebhookService
        // For now, we'll return mock queue stats
        Promise.resolve({
          approximateNumberOfMessages: 0,
          approximateNumberOfMessagesNotVisible: 0,
          approximateNumberOfMessagesDelayed: 0,
        }),
      ]);

      return {
        ...processingStats,
        queueStats,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve webhook statistics', {
        error: error.message,
        stack: error.stack,
      });
      throw new InternalServerErrorException('Failed to retrieve webhook statistics');
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'Webhook service health check',
    description: 'Check the health status of the webhook processing service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2023-09-06T14:30:00Z' },
        uptime: { type: 'number', example: 3600 },
      },
    },
  })
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
  }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
