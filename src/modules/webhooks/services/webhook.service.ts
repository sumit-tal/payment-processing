import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { WebhookEvent, WebhookEventType, WebhookEventStatus } from '@/database/entities/webhook-event.entity';
import { CreateWebhookEventDto, WebhookEventQueryDto, AuthorizeNetWebhookDto } from '../dto/webhook-event.dto';
import { WebhookValidationService } from './webhook-validation.service';
import { SqsService, SqsMessagePayload } from './sqs.service';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    private readonly webhookValidationService: WebhookValidationService,
    private readonly sqsService: SqsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Process incoming Authorize.Net webhook
   */
  async processAuthorizeNetWebhook(
    payload: string,
    headers: Record<string, string>,
  ): Promise<{ eventId: string; status: string }> {
    try {
      // Parse the payload
      const parsedPayload: AuthorizeNetWebhookDto = JSON.parse(payload);

      // Validate the webhook
      const validationResult = await this.webhookValidationService.validateWebhook(
        payload,
        headers,
        parsedPayload,
      );

      if (!validationResult.isValid) {
        this.logger.warn('Webhook validation failed', {
          error: validationResult.errorMessage,
          notificationId: parsedPayload.notificationId,
        });
        throw new Error(`Webhook validation failed: ${validationResult.errorMessage}`);
      }

      // Check for duplicate webhook (idempotency)
      const idempotencyResult = await this.idempotencyService.checkWebhookIdempotency(
        parsedPayload.notificationId,
        parsedPayload.eventType,
        parsedPayload.payload,
      );

      if (idempotencyResult.isIdempotent && idempotencyResult.existingResult) {
        this.logger.log('Duplicate webhook received, returning existing event', {
          eventId: idempotencyResult.existingResult.id,
          notificationId: parsedPayload.notificationId,
        });
        return {
          eventId: idempotencyResult.existingResult.id,
          status: idempotencyResult.existingResult.status,
        };
      }

      // Map Authorize.Net event type to internal event type
      const eventType = this.mapAuthorizeNetEventType(parsedPayload.eventType);

      // Create webhook event record
      const webhookEvent = await this.createWebhookEvent({
        eventType,
        externalId: parsedPayload.notificationId,
        payload: parsedPayload.payload,
        signature: this.webhookValidationService.extractWebhookHeaders(headers).signature || undefined,
      });

      // Queue the event for async processing
      await this.queueWebhookEvent(webhookEvent);

      this.logger.log('Webhook processed successfully', {
        eventId: webhookEvent.id,
        eventType: webhookEvent.eventType,
        notificationId: parsedPayload.notificationId,
      });

      return {
        eventId: webhookEvent.id,
        status: webhookEvent.status,
      };
    } catch (error) {
      this.logger.error('Failed to process Authorize.Net webhook', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Create a new webhook event
   */
  async createWebhookEvent(dto: CreateWebhookEventDto): Promise<WebhookEvent> {
    try {
      const webhookEvent = this.webhookEventRepository.create({
        eventType: dto.eventType,
        externalId: dto.externalId,
        payload: dto.payload,
        signature: dto.signature,
        status: WebhookEventStatus.PENDING,
        retryCount: 0,
      });

      const savedEvent = await this.webhookEventRepository.save(webhookEvent);

      this.logger.log('Webhook event created', {
        eventId: savedEvent.id,
        eventType: savedEvent.eventType,
        externalId: savedEvent.externalId,
      });

      return savedEvent;
    } catch (error) {
      this.logger.error('Failed to create webhook event', {
        error: error.message,
        eventType: dto.eventType,
        externalId: dto.externalId,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find webhook event by ID
   */
  async findById(id: string): Promise<WebhookEvent> {
    const event = await this.webhookEventRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Webhook event with ID ${id} not found`);
    }
    return event;
  }

  /**
   * Find webhook event by external ID
   */
  async findByExternalId(externalId: string): Promise<WebhookEvent | null> {
    return this.webhookEventRepository.findOne({ where: { externalId } });
  }

  /**
   * Find webhook events with query filters
   */
  async findEvents(query: WebhookEventQueryDto): Promise<{
    events: WebhookEvent[];
    total: number;
  }> {
    const where: FindOptionsWhere<WebhookEvent> = {};

    if (query.eventType) {
      where.eventType = query.eventType;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.externalId) {
      where.externalId = query.externalId;
    }

    const [events, total] = await this.webhookEventRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit || 20,
      skip: query.offset || 0,
    });

    return { events, total };
  }

  /**
   * Update webhook event status
   */
  async updateEventStatus(
    id: string,
    status: WebhookEventStatus,
    errorMessage?: string,
    processingResult?: Record<string, any>,
  ): Promise<WebhookEvent> {
    const event = await this.findById(id);

    event.status = status;
    if (errorMessage) {
      event.errorMessage = errorMessage;
    }
    if (processingResult) {
      event.processingResult = processingResult;
    }
    if (status === WebhookEventStatus.PROCESSED) {
      event.processedAt = new Date();
    }

    return this.webhookEventRepository.save(event);
  }

  /**
   * Increment retry count for failed event
   */
  async incrementRetryCount(id: string): Promise<WebhookEvent> {
    const event = await this.findById(id);
    event.incrementRetry();
    return this.webhookEventRepository.save(event);
  }

  /**
   * Queue webhook event for async processing
   */
  async queueWebhookEvent(event: WebhookEvent): Promise<string> {
    const sqsPayload: SqsMessagePayload = {
      eventId: event.id,
      eventType: event.eventType,
      payload: event.payload,
      timestamp: event.createdAt.toISOString(),
      retryCount: event.retryCount,
    };

    return this.sqsService.sendWebhookEvent(sqsPayload);
  }

  /**
   * Retry failed webhook event
   */
  async retryWebhookEvent(id: string, forceRetry: boolean = false): Promise<WebhookEvent> {
    const event = await this.findById(id);

    if (!forceRetry && !event.canRetry()) {
      throw new Error(`Event ${id} cannot be retried. Max retries exceeded or already processed.`);
    }

    // Increment retry count
    const updatedEvent = await this.incrementRetryCount(id);

    // Queue for processing
    await this.queueWebhookEvent(updatedEvent);

    this.logger.log('Webhook event queued for retry', {
      eventId: updatedEvent.id,
      retryCount: updatedEvent.retryCount,
      maxRetries: updatedEvent.maxRetries,
    });

    return updatedEvent;
  }

  /**
   * Get events that need to be retried
   */
  async getEventsForRetry(): Promise<WebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: {
        status: WebhookEventStatus.FAILED,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    retrying: number;
  }> {
    const stats = await this.webhookEventRepository
      .createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.status')
      .getRawMany();

    const result = {
      pending: 0,
      processing: 0,
      processed: 0,
      failed: 0,
      retrying: 0,
    };

    stats.forEach(stat => {
      if (stat.status in result) {
        result[stat.status] = parseInt(stat.count);
      }
    });

    return result;
  }

  /**
   * Map Authorize.Net event types to internal event types
   */
  private mapAuthorizeNetEventType(authorizeNetEventType: string): WebhookEventType {
    const eventTypeMap: Record<string, WebhookEventType> = {
      'net.authorize.payment.authcapture.created': WebhookEventType.PAYMENT_CAPTURED,
      'net.authorize.payment.authorization.created': WebhookEventType.PAYMENT_AUTHORIZED,
      'net.authorize.payment.capture.created': WebhookEventType.PAYMENT_CAPTURED,
      'net.authorize.payment.refund.created': WebhookEventType.PAYMENT_REFUNDED,
      'net.authorize.payment.void.created': WebhookEventType.PAYMENT_VOIDED,
      'net.authorize.payment.fraud.approved': WebhookEventType.PAYMENT_AUTHORIZED,
      'net.authorize.payment.fraud.declined': WebhookEventType.PAYMENT_FAILED,
      'net.authorize.customer.subscription.created': WebhookEventType.SUBSCRIPTION_CREATED,
      'net.authorize.customer.subscription.updated': WebhookEventType.SUBSCRIPTION_UPDATED,
      'net.authorize.customer.subscription.cancelled': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'net.authorize.customer.subscription.expired': WebhookEventType.SUBSCRIPTION_EXPIRED,
      'net.authorize.customer.paymentProfile.created': WebhookEventType.PAYMENT_AUTHORIZED,
      'net.authorize.customer.paymentProfile.updated': WebhookEventType.PAYMENT_AUTHORIZED,
      'net.authorize.customer.paymentProfile.deleted': WebhookEventType.PAYMENT_VOIDED,
    };

    const mappedType = eventTypeMap[authorizeNetEventType];
    if (!mappedType) {
      this.logger.warn('Unknown Authorize.Net event type', {
        authorizeNetEventType,
      });
      // Default to a generic payment event
      return WebhookEventType.PAYMENT_AUTHORIZED;
    }

    return mappedType;
  }
}
