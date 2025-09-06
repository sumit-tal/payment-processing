import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { SqsService, SqsMessage, SqsMessagePayload } from './sqs.service';
import { WebhookEventType, WebhookEventStatus } from '../entities/webhook-event.entity';

@Injectable()
export class WebhookWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookWorkerService.name);
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;
  private readonly pollingIntervalMs: number;
  private readonly maxConcurrentMessages: number;
  private readonly processingTimeoutMs: number;

  constructor(
    private readonly webhookService: WebhookService,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) {
    this.pollingIntervalMs = this.configService.get<number>('WEBHOOK_POLLING_INTERVAL_MS', 5000);
    this.maxConcurrentMessages = this.configService.get<number>('WEBHOOK_MAX_CONCURRENT_MESSAGES', 10);
    this.processingTimeoutMs = this.configService.get<number>('WEBHOOK_TIMEOUT', 30000);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Starting webhook worker service');
    await this.startProcessing();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Stopping webhook worker service');
    await this.stopProcessing();
  }

  /**
   * Start the webhook processing loop
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Webhook processing is already running');
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      try {
        await this.processWebhookMessages();
      } catch (error) {
        this.logger.error('Error in webhook processing loop', {
          error: error.message,
          stack: error.stack,
        });
      }
    }, this.pollingIntervalMs);

    this.logger.log('Webhook worker service started', {
      pollingIntervalMs: this.pollingIntervalMs,
      maxConcurrentMessages: this.maxConcurrentMessages,
    });
  }

  /**
   * Stop the webhook processing loop
   */
  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.logger.log('Webhook worker service stopped');
  }

  /**
   * Process webhook messages from SQS queue
   */
  async processWebhookMessages(): Promise<void> {
    try {
      const messages = await this.sqsService.receiveWebhookEvents(this.maxConcurrentMessages);

      if (messages.length === 0) {
        return;
      }

      this.logger.log('Processing webhook messages', {
        messageCount: messages.length,
      });

      // Process messages concurrently
      const processingPromises = messages.map(message => 
        this.processWebhookMessage(message).catch(error => {
          this.logger.error('Failed to process individual webhook message', {
            messageId: message.id,
            error: error.message,
            stack: error.stack,
          });
        })
      );

      await Promise.allSettled(processingPromises);
    } catch (error) {
      this.logger.error('Failed to process webhook messages batch', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Process a single webhook message
   */
  async processWebhookMessage(message: SqsMessage): Promise<void> {
    let payload: SqsMessagePayload;
    let eventId: string;

    try {
      // Parse message payload
      payload = this.sqsService.parseMessagePayload(message);
      eventId = payload.eventId;

      this.logger.log('Processing webhook message', {
        messageId: message.id,
        eventId,
        eventType: payload.eventType,
        retryCount: payload.retryCount || 0,
      });

      // Update event status to processing
      await this.webhookService.updateEventStatus(eventId, WebhookEventStatus.PROCESSING);

      // Process the webhook event based on its type
      const processingResult = await this.processWebhookEventByType(payload);

      // Mark event as processed
      await this.webhookService.updateEventStatus(
        eventId,
        WebhookEventStatus.PROCESSED,
        undefined,
        processingResult,
      );

      // Delete message from queue
      await this.sqsService.deleteMessage(message.receiptHandle);

      this.logger.log('Webhook message processed successfully', {
        messageId: message.id,
        eventId,
        eventType: payload.eventType,
      });

    } catch (error) {
      this.logger.error('Failed to process webhook message', {
        messageId: message.id,
        eventId: eventId || 'unknown',
        error: error.message,
        stack: error.stack,
      });

      try {
        if (eventId) {
          // Increment retry count and update status
          const updatedEvent = await this.webhookService.incrementRetryCount(eventId);
          
          if (updatedEvent.canRetry()) {
            // Requeue for retry with exponential backoff
            await this.webhookService.queueWebhookEvent(updatedEvent);
            this.logger.log('Webhook event requeued for retry', {
              eventId,
              retryCount: updatedEvent.retryCount,
              maxRetries: updatedEvent.maxRetries,
            });
          } else {
            // Mark as failed
            await this.webhookService.updateEventStatus(
              eventId,
              WebhookEventStatus.FAILED,
              error.message,
            );
            this.logger.error('Webhook event failed after max retries', {
              eventId,
              retryCount: updatedEvent.retryCount,
              maxRetries: updatedEvent.maxRetries,
            });
          }
        }

        // Delete message from queue to prevent infinite processing
        await this.sqsService.deleteMessage(message.receiptHandle);

      } catch (updateError) {
        this.logger.error('Failed to update event status after processing error', {
          eventId: eventId || 'unknown',
          originalError: error.message,
          updateError: updateError.message,
        });
      }
    }
  }

  /**
   * Process webhook event based on its type
   */
  async processWebhookEventByType(payload: SqsMessagePayload): Promise<Record<string, any>> {
    const { eventType, payload: eventPayload } = payload;

    switch (eventType) {
      case WebhookEventType.PAYMENT_AUTHORIZED:
        return this.processPaymentAuthorized(eventPayload);
      
      case WebhookEventType.PAYMENT_CAPTURED:
        return this.processPaymentCaptured(eventPayload);
      
      case WebhookEventType.PAYMENT_SETTLED:
        return this.processPaymentSettled(eventPayload);
      
      case WebhookEventType.PAYMENT_FAILED:
        return this.processPaymentFailed(eventPayload);
      
      case WebhookEventType.PAYMENT_REFUNDED:
        return this.processPaymentRefunded(eventPayload);
      
      case WebhookEventType.PAYMENT_VOIDED:
        return this.processPaymentVoided(eventPayload);
      
      case WebhookEventType.SUBSCRIPTION_CREATED:
        return this.processSubscriptionCreated(eventPayload);
      
      case WebhookEventType.SUBSCRIPTION_UPDATED:
        return this.processSubscriptionUpdated(eventPayload);
      
      case WebhookEventType.SUBSCRIPTION_CANCELLED:
        return this.processSubscriptionCancelled(eventPayload);
      
      case WebhookEventType.SUBSCRIPTION_EXPIRED:
        return this.processSubscriptionExpired(eventPayload);
      
      case WebhookEventType.SUBSCRIPTION_PAYMENT_SUCCESS:
        return this.processSubscriptionPaymentSuccess(eventPayload);
      
      case WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED:
        return this.processSubscriptionPaymentFailed(eventPayload);
      
      default:
        this.logger.warn('Unknown webhook event type', { eventType });
        return { processed: true, message: 'Unknown event type processed' };
    }
  }

  /**
   * Process payment authorized webhook
   */
  private async processPaymentAuthorized(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing payment authorized webhook', {
      transactionId: payload.id,
    });

    // TODO: Update transaction status in database
    // TODO: Send notification to customer
    // TODO: Update analytics/metrics

    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_authorized',
    };
  }

  /**
   * Process payment captured webhook
   */
  private async processPaymentCaptured(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing payment captured webhook', {
      transactionId: payload.id,
    });

    // TODO: Update transaction status in database
    // TODO: Trigger fulfillment process
    // TODO: Send confirmation to customer

    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_captured',
    };
  }

  /**
   * Process payment settled webhook
   */
  private async processPaymentSettled(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing payment settled webhook', {
      transactionId: payload.id,
    });

    // TODO: Update transaction status to settled
    // TODO: Update accounting records
    // TODO: Generate settlement report

    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_settled',
    };
  }

  /**
   * Process payment failed webhook
   */
  private async processPaymentFailed(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing payment failed webhook', {
      transactionId: payload.id,
    });

    // TODO: Update transaction status to failed
    // TODO: Send failure notification to customer
    // TODO: Trigger retry logic if applicable

    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_failed',
    };
  }

  /**
   * Process payment refunded webhook
   */
  private async processPaymentRefunded(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing payment refunded webhook', {
      transactionId: payload.id,
    });

    // TODO: Update transaction status to refunded
    // TODO: Update inventory if applicable
    // TODO: Send refund confirmation to customer

    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_refunded',
    };
  }

  /**
   * Process payment voided webhook
   */
  private async processPaymentVoided(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing payment voided webhook', {
      transactionId: payload.id,
    });

    // TODO: Update transaction status to voided
    // TODO: Release inventory hold
    // TODO: Send cancellation notification

    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_voided',
    };
  }

  /**
   * Process subscription created webhook
   */
  private async processSubscriptionCreated(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing subscription created webhook', {
      subscriptionId: payload.id,
    });

    // TODO: Update subscription status in database
    // TODO: Send welcome email to customer
    // TODO: Set up billing schedule

    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_created',
    };
  }

  /**
   * Process subscription updated webhook
   */
  private async processSubscriptionUpdated(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing subscription updated webhook', {
      subscriptionId: payload.id,
    });

    // TODO: Update subscription details in database
    // TODO: Send update notification to customer
    // TODO: Adjust billing schedule if needed

    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_updated',
    };
  }

  /**
   * Process subscription cancelled webhook
   */
  private async processSubscriptionCancelled(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing subscription cancelled webhook', {
      subscriptionId: payload.id,
    });

    // TODO: Update subscription status to cancelled
    // TODO: Send cancellation confirmation
    // TODO: Handle end-of-period access

    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_cancelled',
    };
  }

  /**
   * Process subscription expired webhook
   */
  private async processSubscriptionExpired(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing subscription expired webhook', {
      subscriptionId: payload.id,
    });

    // TODO: Update subscription status to expired
    // TODO: Revoke access to services
    // TODO: Send expiration notification

    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_expired',
    };
  }

  /**
   * Process subscription payment success webhook
   */
  private async processSubscriptionPaymentSuccess(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing subscription payment success webhook', {
      subscriptionId: payload.subscriptionId,
      paymentId: payload.id,
    });

    // TODO: Record successful payment
    // TODO: Extend subscription period
    // TODO: Send payment confirmation

    return {
      processed: true,
      subscriptionId: payload.subscriptionId,
      paymentId: payload.id,
      action: 'subscription_payment_success',
    };
  }

  /**
   * Process subscription payment failed webhook
   */
  private async processSubscriptionPaymentFailed(payload: any): Promise<Record<string, any>> {
    this.logger.log('Processing subscription payment failed webhook', {
      subscriptionId: payload.subscriptionId,
      paymentId: payload.id,
    });

    // TODO: Record failed payment
    // TODO: Trigger retry mechanism
    // TODO: Send payment failure notification

    return {
      processed: true,
      subscriptionId: payload.subscriptionId,
      paymentId: payload.id,
      action: 'subscription_payment_failed',
    };
  }
}
