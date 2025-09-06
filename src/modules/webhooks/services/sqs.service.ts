import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  Message,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs';

export interface SqsMessage {
  readonly id: string;
  readonly body: string;
  readonly receiptHandle: string;
  readonly attributes?: Record<string, string>;
  readonly messageAttributes?: Record<string, any>;
}

export interface SqsMessagePayload {
  readonly eventId: string;
  readonly eventType: string;
  readonly payload: Record<string, any>;
  readonly timestamp: string;
  readonly retryCount?: number;
}

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqsClient: SQSClient;
  private readonly webhookQueueUrl: string;
  private readonly webhookDlqUrl: string;
  private readonly visibilityTimeout: number;
  private readonly maxReceiveCount: number;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.sqsClient = new SQSClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });

    this.webhookQueueUrl = this.configService.get<string>(
      'SQS_WEBHOOK_QUEUE_URL',
    );
    this.webhookDlqUrl = this.configService.get<string>('SQS_WEBHOOK_DLQ_URL');
    this.visibilityTimeout = this.configService.get<number>(
      'SQS_VISIBILITY_TIMEOUT',
      300,
    );
    this.maxReceiveCount = this.configService.get<number>(
      'SQS_MAX_RECEIVE_COUNT',
      3,
    );

    if (!this.webhookQueueUrl) {
      throw new Error('SQS_WEBHOOK_QUEUE_URL must be configured');
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.validateQueueConfiguration();
      this.logger.log('SQS service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SQS service', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Send a webhook event to the processing queue
   */
  async sendWebhookEvent(payload: SqsMessagePayload): Promise<string> {
    try {
      const messageBody = JSON.stringify(payload);
      const messageAttributes: Record<
        string,
        { DataType: string; StringValue: string }
      > = {
        eventType: {
          DataType: 'String',
          StringValue: payload.eventType,
        },
        eventId: {
          DataType: 'String',
          StringValue: payload.eventId,
        },
        timestamp: {
          DataType: 'String',
          StringValue: payload.timestamp,
        },
      };

      if (payload.retryCount !== undefined) {
        messageAttributes.retryCount = {
          DataType: 'Number',
          StringValue: payload.retryCount.toString(),
        };
      }

      const command = new SendMessageCommand({
        QueueUrl: this.webhookQueueUrl,
        MessageBody: messageBody,
        MessageAttributes: messageAttributes,
        DelaySeconds: this.calculateDelaySeconds(payload.retryCount || 0),
      });

      const result = await this.sqsClient.send(command);

      this.logger.log('Webhook event sent to SQS', {
        messageId: result.MessageId,
        eventId: payload.eventId,
        eventType: payload.eventType,
        retryCount: payload.retryCount || 0,
      });

      return result.MessageId;
    } catch (error) {
      this.logger.error('Failed to send webhook event to SQS', {
        error: error.message,
        eventId: payload.eventId,
        eventType: payload.eventType,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Send multiple webhook events in batch
   */
  async sendWebhookEventsBatch(
    payloads: SqsMessagePayload[],
  ): Promise<string[]> {
    try {
      const entries: SendMessageBatchRequestEntry[] = payloads.map(
        (payload, index) => ({
          Id: `msg-${index}`,
          MessageBody: JSON.stringify(payload),
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: payload.eventType,
            },
            eventId: {
              DataType: 'String',
              StringValue: payload.eventId,
            },
            timestamp: {
              DataType: 'String',
              StringValue: payload.timestamp,
            },
          },
          DelaySeconds: this.calculateDelaySeconds(payload.retryCount || 0),
        }),
      );

      const command = new SendMessageBatchCommand({
        QueueUrl: this.webhookQueueUrl,
        Entries: entries,
      });

      const result = await this.sqsClient.send(command);

      const messageIds =
        result.Successful?.map(success => success.MessageId) || [];

      if (result.Failed && result.Failed.length > 0) {
        this.logger.warn('Some messages failed to send in batch', {
          failedCount: result.Failed.length,
          failures: result.Failed,
        });
      }

      this.logger.log('Webhook events batch sent to SQS', {
        successfulCount: messageIds.length,
        failedCount: result.Failed?.length || 0,
      });

      return messageIds;
    } catch (error) {
      this.logger.error('Failed to send webhook events batch to SQS', {
        error: error.message,
        payloadCount: payloads.length,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Receive webhook events from the queue
   */
  async receiveWebhookEvents(maxMessages: number = 10): Promise<SqsMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.webhookQueueUrl,
        MaxNumberOfMessages: Math.min(maxMessages, 10), // SQS limit is 10
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: this.visibilityTimeout,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
      });

      const result = await this.sqsClient.send(command);
      const messages = result.Messages || [];

      const sqsMessages: SqsMessage[] = messages.map(message => ({
        id: message.MessageId,
        body: message.Body,
        receiptHandle: message.ReceiptHandle,
        attributes: message.Attributes,
        messageAttributes: message.MessageAttributes,
      }));

      if (sqsMessages.length > 0) {
        this.logger.log('Received webhook events from SQS', {
          messageCount: sqsMessages.length,
        });
      }

      return sqsMessages;
    } catch (error) {
      this.logger.error('Failed to receive webhook events from SQS', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Delete a processed message from the queue
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.webhookQueueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);

      this.logger.debug('Message deleted from SQS', {
        receiptHandle: receiptHandle.substring(0, 20) + '...',
      });
    } catch (error) {
      this.logger.error('Failed to delete message from SQS', {
        error: error.message,
        receiptHandle: receiptHandle.substring(0, 20) + '...',
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get queue attributes and statistics
   */
  async getQueueStats(): Promise<{
    approximateNumberOfMessages: number;
    approximateNumberOfMessagesNotVisible: number;
    approximateNumberOfMessagesDelayed: number;
  }> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.webhookQueueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'ApproximateNumberOfMessagesDelayed',
        ],
      });

      const result = await this.sqsClient.send(command);
      const attributes = result.Attributes || {};

      return {
        approximateNumberOfMessages: parseInt(
          attributes.ApproximateNumberOfMessages || '0',
        ),
        approximateNumberOfMessagesNotVisible: parseInt(
          attributes.ApproximateNumberOfMessagesNotVisible || '0',
        ),
        approximateNumberOfMessagesDelayed: parseInt(
          attributes.ApproximateNumberOfMessagesDelayed || '0',
        ),
      };
    } catch (error) {
      this.logger.error('Failed to get queue statistics', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Parse SQS message payload
   */
  parseMessagePayload(message: SqsMessage): SqsMessagePayload {
    try {
      return JSON.parse(message.body);
    } catch (error) {
      this.logger.error('Failed to parse SQS message payload', {
        error: error.message,
        messageId: message.id,
      });
      throw new Error('Invalid message payload format');
    }
  }

  /**
   * Calculate delay seconds for retry with exponential backoff
   */
  private calculateDelaySeconds(retryCount: number): number {
    if (retryCount === 0) {
      return 0; // No delay for first attempt
    }

    // Exponential backoff: 2^retryCount * 60 seconds, max 15 minutes (900 seconds)
    const delaySeconds = Math.min(Math.pow(2, retryCount) * 60, 900);
    return delaySeconds;
  }

  /**
   * Validate queue configuration on startup
   */
  private async validateQueueConfiguration(): Promise<void> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.webhookQueueUrl,
        AttributeNames: ['QueueArn', 'VisibilityTimeout'],
      });

      const result = await this.sqsClient.send(command);

      if (!result.Attributes?.QueueArn) {
        throw new Error('Unable to access webhook queue');
      }

      this.logger.log('Queue configuration validated', {
        queueArn: result.Attributes.QueueArn,
        visibilityTimeout: result.Attributes.VisibilityTimeout,
      });
    } catch (error) {
      this.logger.error('Queue configuration validation failed', {
        error: error.message,
        queueUrl: this.webhookQueueUrl,
      });
      throw error;
    }
  }
}
