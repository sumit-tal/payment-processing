// Mock implementation of private methods for WebhookWorkerService
import { WebhookEventType } from './mocks/webhook-event.entity.mock';

export class WebhookWorkerServiceMock {
  // Mock implementations of private methods
  processPaymentAuthorized(payload: any) {
    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_authorized',
    };
  }

  processPaymentCaptured(payload: any) {
    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_captured',
    };
  }

  processPaymentSettled(payload: any) {
    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_settled',
    };
  }

  processPaymentFailed(payload: any) {
    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_failed',
    };
  }

  processPaymentRefunded(payload: any) {
    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_refunded',
    };
  }

  processPaymentVoided(payload: any) {
    return {
      processed: true,
      transactionId: payload.id,
      action: 'payment_voided',
    };
  }

  processSubscriptionCreated(payload: any) {
    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_created',
    };
  }

  processSubscriptionUpdated(payload: any) {
    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_updated',
    };
  }

  processSubscriptionCancelled(payload: any) {
    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_cancelled',
    };
  }

  processSubscriptionExpired(payload: any) {
    return {
      processed: true,
      subscriptionId: payload.id,
      action: 'subscription_expired',
    };
  }

  processSubscriptionPaymentSuccess(payload: any) {
    return {
      processed: true,
      subscriptionId: payload.subscriptionId,
      paymentId: payload.id,
      action: 'subscription_payment_success',
    };
  }

  processSubscriptionPaymentFailed(payload: any) {
    return {
      processed: true,
      subscriptionId: payload.subscriptionId,
      paymentId: payload.id,
      action: 'subscription_payment_failed',
    };
  }

  // Mock implementation of the processWebhookEventByType method
  processWebhookEventByType(payload: any) {
    const { eventType } = payload;

    switch (eventType) {
      case WebhookEventType.PAYMENT_AUTHORIZED:
        return this.processPaymentAuthorized(payload.payload);
      
      case WebhookEventType.PAYMENT_CAPTURED:
        return this.processPaymentCaptured(payload.payload);
      
      case WebhookEventType.PAYMENT_SETTLED:
        return this.processPaymentSettled(payload.payload);
      
      case WebhookEventType.PAYMENT_FAILED:
        return this.processPaymentFailed(payload.payload);
      
      case WebhookEventType.PAYMENT_REFUNDED:
        return this.processPaymentRefunded(payload.payload);
      
      case WebhookEventType.PAYMENT_VOIDED:
        return this.processPaymentVoided(payload.payload);
      
      case WebhookEventType.SUBSCRIPTION_CREATED:
        return this.processSubscriptionCreated(payload.payload);
      
      case WebhookEventType.SUBSCRIPTION_UPDATED:
        return this.processSubscriptionUpdated(payload.payload);
      
      case WebhookEventType.SUBSCRIPTION_CANCELLED:
        return this.processSubscriptionCancelled(payload.payload);
      
      case WebhookEventType.SUBSCRIPTION_EXPIRED:
        return this.processSubscriptionExpired(payload.payload);
      
      case WebhookEventType.SUBSCRIPTION_PAYMENT_SUCCESS:
        return this.processSubscriptionPaymentSuccess(payload.payload);
      
      case WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED:
        return this.processSubscriptionPaymentFailed(payload.payload);
      
      default:
        return { processed: true, message: 'Unknown event type processed' };
    }
  }
}
