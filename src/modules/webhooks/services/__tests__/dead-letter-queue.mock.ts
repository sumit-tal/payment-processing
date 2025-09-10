// Mock implementation for DeadLetterQueueService private methods
import { WebhookEventStatus } from './mocks/webhook-event.entity.mock';
import { SqsMessagePayload } from '../sqs.service';

export class DeadLetterQueueServiceMock {
  // Mock implementations of private methods
  analyzeFailureAndDecideAction(webhookEvent: any, payload: SqsMessagePayload): Promise<'requeue' | 'permanent_failure' | 'ignore'> {
    // Check if event is already processed
    if (webhookEvent.status === WebhookEventStatus.PROCESSED) {
      return Promise.resolve('ignore');
    }

    // Check retry count
    if (webhookEvent.retryCount >= webhookEvent.maxRetries) {
      return Promise.resolve('permanent_failure');
    }

    // Check event age (don't retry events older than 24 hours)
    const eventAge = Date.now() - webhookEvent.createdAt.getTime();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

    if (eventAge > maxAgeMs) {
      return Promise.resolve('permanent_failure');
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
      return Promise.resolve('permanent_failure');
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
      return Promise.resolve('requeue');
    }

    // Default to permanent failure for unknown errors
    return Promise.resolve('permanent_failure');
  }

  async requeueMessage(webhookEvent: any, payload: SqsMessagePayload): Promise<void> {
    // This is a mock implementation that does nothing
    return Promise.resolve();
  }

  async markAsPermanentFailure(webhookEvent: any, reason: string): Promise<void> {
    // This is a mock implementation that does nothing
    return Promise.resolve();
  }

  async receiveDeadLetterMessages(): Promise<any[]> {
    // This is a mock implementation that returns test messages
    return Promise.resolve([
      {
        id: 'msg-1',
        body: '{"eventId":"event-1"}',
        receiptHandle: 'receipt-1',
        attributes: { SentTimestamp: '1630000000000' },
        messageAttributes: { eventType: { StringValue: 'PAYMENT_CAPTURED' } },
      },
      {
        id: 'msg-2',
        body: '{"eventId":"event-2"}',
        receiptHandle: 'receipt-2',
        attributes: { SentTimestamp: '1630000000001' },
        messageAttributes: { eventType: { StringValue: 'PAYMENT_FAILED' } },
      },
    ]);
  }

  async deleteDeadLetterMessage(receiptHandle: string): Promise<void> {
    // This is a mock implementation that does nothing
    return Promise.resolve();
  }
}
