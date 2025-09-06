import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { WebhookEvent, WebhookEventStatus } from '../entities/webhook-event.entity';
import { SqsService, SqsMessage, SqsMessagePayload } from './sqs.service';

export interface DeadLetterQueueStats {
  readonly messageCount: number;
  readonly oldestMessageAge: number;
  readonly newestMessageAge: number;
}

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly dlqUrl: string;

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    this.sqsClient = new SQSClient({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    });

    this.dlqUrl = this.configService.get<string>('SQS_WEBHOOK_DLQ_URL');

    if (!this.dlqUrl) {
      this.logger.warn('SQS_WEBHOOK_DLQ_URL not configured, dead letter queue features disabled');
    }
  }

  /**
   * Process messages from the dead letter queue
   */
  async processDeadLetterQueue(): Promise<{
    processed: number;
    requeued: number;
    permanentlyFailed: number;
  }> {
    if (!this.dlqUrl) {
      throw new Error('Dead letter queue URL not configured');
    }

    let processed = 0;
    let requeued = 0;
    let permanentlyFailed = 0;

    try {
      this.logger.log('Starting dead letter queue processing');

      // Receive messages from DLQ
      const messages = await this.receiveDeadLetterMessages();

      for (const message of messages) {
        try {
          const result = await this.processDeadLetterMessage(message);
          
          switch (result.action) {
            case 'requeued':
              requeued++;
              break;
            case 'permanently_failed':
              permanentlyFailed++;
              break;
            default:
              processed++;
          }

          // Delete message from DLQ after processing
          await this.deleteDeadLetterMessage(message.receiptHandle);

        } catch (error) {
          this.logger.error('Failed to process dead letter message', {
            messageId: message.id,
            error: error.message,
            stack: error.stack,
          });
          processed++;
        }
      }

      this.logger.log('Dead letter queue processing completed', {
        totalMessages: messages.length,
        processed,
        requeued,
        permanentlyFailed,
      });

      return { processed, requeued, permanentlyFailed };

    } catch (error) {
      this.logger.error('Failed to process dead letter queue', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Process a single message from the dead letter queue
   */
  async processDeadLetterMessage(message: SqsMessage): Promise<{
    action: 'requeued' | 'permanently_failed' | 'processed';
    eventId?: string;
  }> {
    try {
      const payload = this.sqsService.parseMessagePayload(message);
      const eventId = payload.eventId;

      this.logger.log('Processing dead letter message', {
        messageId: message.id,
        eventId,
        eventType: payload.eventType,
      });

      // Find the webhook event in database
      const webhookEvent = await this.webhookEventRepository.findOne({
        where: { id: eventId },
      });

      if (!webhookEvent) {
        this.logger.warn('Webhook event not found for dead letter message', {
          eventId,
          messageId: message.id,
        });
        return { action: 'processed' };
      }

      // Analyze the failure reason and decide on action
      const action = await this.analyzeFailureAndDecideAction(webhookEvent, payload);

      switch (action) {
        case 'requeue':
          await this.requeueMessage(webhookEvent, payload);
          return { action: 'requeued', eventId };

        case 'permanent_failure':
          await this.markAsPermanentFailure(webhookEvent, 'Moved to dead letter queue');
          return { action: 'permanently_failed', eventId };

        default:
          this.logger.log('Dead letter message processed without action', {
            eventId,
            action,
          });
          return { action: 'processed', eventId };
      }

    } catch (error) {
      this.logger.error('Failed to process dead letter message', {
        messageId: message.id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Analyze failure and decide on appropriate action
   */
  private async analyzeFailureAndDecideAction(
    webhookEvent: WebhookEvent,
    payload: SqsMessagePayload,
  ): Promise<'requeue' | 'permanent_failure' | 'ignore'> {
    // Check if event is already processed
    if (webhookEvent.status === WebhookEventStatus.PROCESSED) {
      return 'ignore';
    }

    // Check retry count
    if (webhookEvent.retryCount >= webhookEvent.maxRetries) {
      return 'permanent_failure';
    }

    // Check event age (don't retry events older than 24 hours)
    const eventAge = Date.now() - webhookEvent.createdAt.getTime();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

    if (eventAge > maxAgeMs) {
      this.logger.warn('Event too old for retry', {
        eventId: webhookEvent.id,
        ageHours: Math.round(eventAge / (60 * 60 * 1000)),
      });
      return 'permanent_failure';
    }

    // Analyze error patterns
    const errorMessage = webhookEvent.errorMessage?.toLowerCase() || '';

    // Permanent failures (don't retry)
    const permanentErrorPatterns = [
      'invalid signature',
      'malformed payload',
      'authentication failed',
      'authorization failed',
      'invalid webhook',
    ];

    if (permanentErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
      return 'permanent_failure';
    }

    // Temporary failures (can retry)
    const retryableErrorPatterns = [
      'timeout',
      'connection',
      'network',
      'service unavailable',
      'internal server error',
      'database',
    ];

    if (retryableErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
      return 'requeue';
    }

    // Default to permanent failure for unknown errors
    return 'permanent_failure';
  }

  /**
   * Requeue message for processing
   */
  private async requeueMessage(
    webhookEvent: WebhookEvent,
    payload: SqsMessagePayload,
  ): Promise<void> {
    try {
      // Reset event status and increment retry count
      webhookEvent.status = WebhookEventStatus.RETRYING;
      webhookEvent.retryCount += 1;
      webhookEvent.errorMessage = null;

      await this.webhookEventRepository.save(webhookEvent);

      // Create new SQS message with updated retry count
      const newPayload: SqsMessagePayload = {
        ...payload,
        retryCount: webhookEvent.retryCount,
        timestamp: new Date().toISOString(),
      };

      await this.sqsService.sendWebhookEvent(newPayload);

      this.logger.log('Message requeued from dead letter queue', {
        eventId: webhookEvent.id,
        retryCount: webhookEvent.retryCount,
      });

    } catch (error) {
      this.logger.error('Failed to requeue message from dead letter queue', {
        eventId: webhookEvent.id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Mark event as permanent failure
   */
  private async markAsPermanentFailure(
    webhookEvent: WebhookEvent,
    reason: string,
  ): Promise<void> {
    try {
      webhookEvent.status = WebhookEventStatus.FAILED;
      webhookEvent.errorMessage = `Permanent failure: ${reason}`;

      await this.webhookEventRepository.save(webhookEvent);

      this.logger.log('Event marked as permanent failure', {
        eventId: webhookEvent.id,
        reason,
      });

    } catch (error) {
      this.logger.error('Failed to mark event as permanent failure', {
        eventId: webhookEvent.id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Receive messages from dead letter queue
   */
  private async receiveDeadLetterMessages(): Promise<SqsMessage[]> {
    if (!this.dlqUrl) {
      return [];
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.dlqUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 5,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
      });

      const result = await this.sqsClient.send(command);
      const messages = result.Messages || [];

      return messages.map(message => ({
        id: message.MessageId,
        body: message.Body,
        receiptHandle: message.ReceiptHandle,
        attributes: message.Attributes,
        messageAttributes: message.MessageAttributes,
      }));

    } catch (error) {
      this.logger.error('Failed to receive messages from dead letter queue', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Delete message from dead letter queue
   */
  private async deleteDeadLetterMessage(receiptHandle: string): Promise<void> {
    if (!this.dlqUrl) {
      return;
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.dlqUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);

    } catch (error) {
      this.logger.error('Failed to delete message from dead letter queue', {
        error: error.message,
        receiptHandle: receiptHandle.substring(0, 20) + '...',
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get dead letter queue statistics
   */
  async getDeadLetterQueueStats(): Promise<DeadLetterQueueStats> {
    if (!this.dlqUrl) {
      return {
        messageCount: 0,
        oldestMessageAge: 0,
        newestMessageAge: 0,
      };
    }

    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.dlqUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
        ],
      });

      const result = await this.sqsClient.send(command);
      const attributes = result.Attributes || {};

      return {
        messageCount: parseInt(attributes.ApproximateNumberOfMessages || '0'),
        oldestMessageAge: 0, // Not available in this SDK version
        newestMessageAge: 0, // SQS doesn't provide this directly
      };

    } catch (error) {
      this.logger.error('Failed to get dead letter queue statistics', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Purge all messages from dead letter queue (use with caution)
   */
  async purgeDeadLetterQueue(): Promise<void> {
    if (!this.dlqUrl) {
      throw new Error('Dead letter queue URL not configured');
    }

    this.logger.warn('Purging dead letter queue - all messages will be permanently deleted');

    // Note: SQS PurgeQueue is not implemented here for safety
    // Instead, we'll process and delete messages individually
    let totalDeleted = 0;

    try {
      while (true) {
        const messages = await this.receiveDeadLetterMessages();
        
        if (messages.length === 0) {
          break;
        }

        for (const message of messages) {
          await this.deleteDeadLetterMessage(message.receiptHandle);
          totalDeleted++;
        }
      }

      this.logger.log('Dead letter queue purged', {
        totalDeleted,
      });

    } catch (error) {
      this.logger.error('Failed to purge dead letter queue', {
        error: error.message,
        totalDeleted,
        stack: error.stack,
      });
      throw error;
    }
  }
}
