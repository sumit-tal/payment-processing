// Mock for WebhookEvent entity - using the same enum values as the actual entity
export enum WebhookEventType {
  PAYMENT_AUTHORIZED = 'payment.authorized',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_SETTLED = 'payment.settled',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_VOIDED = 'payment.voided',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  SUBSCRIPTION_PAYMENT_SUCCESS = 'subscription.payment.success',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment.failed',
}

export enum WebhookEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  RETRYING = 'retrying',
  FAILED = 'failed',
}

export class WebhookEvent {
  id: string;
  externalId: string;
  eventType: WebhookEventType;
  status: WebhookEventStatus;
  payload: Record<string, any>;
  signature?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  processingResult?: Record<string, any>;

  canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }
}
