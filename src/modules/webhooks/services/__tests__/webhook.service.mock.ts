// Mock implementation for WebhookService private methods
import { WebhookEventType } from './mocks/webhook-event.entity.mock';

export class WebhookServiceMock {
  // Mock implementation of mapAuthorizeNetEventType
  mapAuthorizeNetEventType(eventType: string): WebhookEventType {
    const eventTypeMap: Record<string, WebhookEventType> = {
      'net.authorize.payment.authcapture.created': WebhookEventType.PAYMENT_CAPTURED,
      'net.authorize.payment.authorization.created': WebhookEventType.PAYMENT_AUTHORIZED,
      'net.authorize.payment.refund.created': WebhookEventType.PAYMENT_REFUNDED,
      'net.authorize.payment.void.created': WebhookEventType.PAYMENT_VOIDED,
      'net.authorize.payment.priorAuthCapture.created': WebhookEventType.PAYMENT_CAPTURED,
      'net.authorize.customer.subscription.created': WebhookEventType.SUBSCRIPTION_CREATED,
      'net.authorize.customer.subscription.updated': WebhookEventType.SUBSCRIPTION_UPDATED,
      'net.authorize.customer.subscription.cancelled': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'net.authorize.customer.subscription.expired': WebhookEventType.SUBSCRIPTION_EXPIRED,
      'net.authorize.customer.subscription.billing.created': WebhookEventType.SUBSCRIPTION_PAYMENT_SUCCESS,
      'net.authorize.customer.subscription.billing.failed': WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED,
    };

    return eventTypeMap[eventType] || WebhookEventType.PAYMENT_AUTHORIZED;
  }
}
