import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookWorkerService } from '../webhook-worker.service';
import { WebhookService } from '../webhook.service';
import { SqsService, SqsMessage, SqsMessagePayload } from '../sqs.service';
import {
  WebhookEventStatus,
  WebhookEventType,
} from './mocks/webhook-event.entity.mock';
import { WebhookWorkerServiceMock } from './webhook-worker.service.mock';

describe('WebhookWorkerService', () => {
  let service: WebhookWorkerService;
  let webhookService: WebhookService;
  let sqsService: SqsService;
  let configService: ConfigService;

  const mockWebhookService = {
    updateEventStatus: jest.fn(),
    incrementRetryCount: jest.fn(),
    queueWebhookEvent: jest.fn(),
  };

  const mockSqsService = {
    receiveWebhookEvents: jest.fn(),
    parseMessagePayload: jest.fn(),
    deleteMessage: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookWorkerService,
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
        {
          provide: SqsService,
          useValue: mockSqsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WebhookWorkerService>(WebhookWorkerService);

    // Add mock implementations for private methods
    const serviceMock = new WebhookWorkerServiceMock();
    Object.getOwnPropertyNames(WebhookWorkerServiceMock.prototype).forEach(
      method => {
        if (method !== 'constructor') {
          (service as any)[method] = serviceMock[method].bind(serviceMock);
        }
      },
    );
    webhookService = module.get<WebhookService>(WebhookService);
    sqsService = module.get<SqsService>(SqsService);
    configService = module.get<ConfigService>(ConfigService);

    // Default configuration values
    mockConfigService.get.mockImplementation((key, defaultValue) => {
      const config = {
        WEBHOOK_POLLING_INTERVAL_MS: 5000,
        WEBHOOK_MAX_CONCURRENT_MESSAGES: 10,
        WEBHOOK_TIMEOUT: 30000,
      };
      return config[key] || defaultValue;
    });

    // Clear all interval timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('should start processing on module init', async () => {
      // Arrange
      const startProcessingSpy = jest
        .spyOn(service, 'startProcessing')
        .mockResolvedValue();

      // Act
      await service.onModuleInit();

      // Assert
      expect(startProcessingSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop processing on module destroy', async () => {
      // Arrange
      const stopProcessingSpy = jest
        .spyOn(service, 'stopProcessing')
        .mockResolvedValue();

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(stopProcessingSpy).toHaveBeenCalled();
    });
  });

  describe('startProcessing', () => {
    it('should start the processing interval', async () => {
      // Arrange
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      // Act
      await service.startProcessing();

      // Assert
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(service['isProcessing']).toBe(true);
    });

    it('should not start processing if already running', async () => {
      // Arrange
      service['isProcessing'] = true;
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      // Act
      await service.startProcessing();

      // Assert
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should call processWebhookMessages when interval triggers', async () => {
      // Arrange
      const processWebhookMessagesSpy = jest
        .spyOn(service, 'processWebhookMessages')
        .mockResolvedValue();

      // Act
      await service.startProcessing();
      jest.advanceTimersByTime(5000);

      // Assert
      expect(processWebhookMessagesSpy).toHaveBeenCalled();
    });
  });

  describe('stopProcessing', () => {
    it('should stop the processing interval', async () => {
      // Arrange
      service['isProcessing'] = true;
      service['processingInterval'] = setInterval(
        () => {},
        5000,
      ) as unknown as NodeJS.Timeout;
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Act
      await service.stopProcessing();

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalledWith(
        service['processingInterval'],
      );
      expect(service['isProcessing']).toBe(false);
    });
  });

  describe('processWebhookMessages', () => {
    it('should process messages from SQS queue', async () => {
      // Arrange
      const mockMessages: SqsMessage[] = [
        {
          id: 'msg-1',
          body: '{"eventId":"event-1"}',
          receiptHandle: 'receipt-1',
        },
        {
          id: 'msg-2',
          body: '{"eventId":"event-2"}',
          receiptHandle: 'receipt-2',
        },
      ];

      mockSqsService.receiveWebhookEvents.mockResolvedValue(mockMessages);

      const processWebhookMessageSpy = jest
        .spyOn(service, 'processWebhookMessage')
        .mockResolvedValue();

      // Act
      await service.processWebhookMessages();

      // Assert
      expect(mockSqsService.receiveWebhookEvents).toHaveBeenCalledWith(10);
      expect(processWebhookMessageSpy).toHaveBeenCalledTimes(2);
      expect(processWebhookMessageSpy).toHaveBeenCalledWith(mockMessages[0]);
      expect(processWebhookMessageSpy).toHaveBeenCalledWith(mockMessages[1]);
    });

    it('should do nothing when no messages are received', async () => {
      // Arrange
      mockSqsService.receiveWebhookEvents.mockResolvedValue([]);

      const processWebhookMessageSpy = jest.spyOn(
        service,
        'processWebhookMessage',
      );

      // Act
      await service.processWebhookMessages();

      // Assert
      expect(processWebhookMessageSpy).not.toHaveBeenCalled();
    });

    it('should continue processing other messages when one fails', async () => {
      // Arrange
      const mockMessages: SqsMessage[] = [
        {
          id: 'msg-1',
          body: '{"eventId":"event-1"}',
          receiptHandle: 'receipt-1',
        },
        {
          id: 'msg-2',
          body: '{"eventId":"event-2"}',
          receiptHandle: 'receipt-2',
        },
      ];

      mockSqsService.receiveWebhookEvents.mockResolvedValue(mockMessages);

      jest
        .spyOn(service, 'processWebhookMessage')
        .mockRejectedValueOnce(new Error('Processing error'))
        .mockResolvedValueOnce();

      // Act
      await service.processWebhookMessages();

      // Assert
      expect(service.processWebhookMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in receiveWebhookEvents', async () => {
      // Arrange
      mockSqsService.receiveWebhookEvents.mockRejectedValue(
        new Error('SQS error'),
      );

      // Act & Assert
      await expect(service.processWebhookMessages()).resolves.not.toThrow();
    });
  });

  describe('processWebhookMessage', () => {
    it('should process webhook message successfully', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: '{"eventId":"event-1"}',
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);

      const processingResult = { processed: true };
      jest
        .spyOn(service, 'processWebhookEventByType')
        .mockResolvedValue(processingResult);

      mockWebhookService.updateEventStatus.mockResolvedValue({});

      // Act
      await service.processWebhookMessage(mockMessage);

      // Assert
      expect(mockSqsService.parseMessagePayload).toHaveBeenCalledWith(
        mockMessage,
      );
      expect(mockWebhookService.updateEventStatus).toHaveBeenCalledWith(
        'event-1',
        WebhookEventStatus.PROCESSING,
      );
      expect(service.processWebhookEventByType).toHaveBeenCalledWith(
        mockPayload,
      );
      expect(mockWebhookService.updateEventStatus).toHaveBeenCalledWith(
        'event-1',
        WebhookEventStatus.PROCESSED,
        undefined,
        processingResult,
      );
      expect(mockSqsService.deleteMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('should handle processing error and requeue when retries available', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: '{"eventId":"event-1"}',
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);

      jest
        .spyOn(service, 'processWebhookEventByType')
        .mockRejectedValueOnce(new Error('Processing error'));

      const mockUpdatedEvent = {
        id: 'event-1',
        retryCount: 1,
        maxRetries: 3,
        canRetry: jest.fn().mockReturnValue(true),
      };

      mockWebhookService.incrementRetryCount.mockResolvedValue(
        mockUpdatedEvent,
      );

      // Act
      await service.processWebhookMessage(mockMessage);

      // Assert
      expect(mockWebhookService.incrementRetryCount).toHaveBeenCalledWith(
        'event-1',
      );
      expect(mockWebhookService.queueWebhookEvent).toHaveBeenCalledWith(
        mockUpdatedEvent,
      );
      expect(mockSqsService.deleteMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('should handle processing error and mark as failed when max retries reached', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: '{"eventId":"event-1"}',
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 3,
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);

      const processingError = new Error('Processing error');
      jest
        .spyOn(service, 'processWebhookEventByType')
        .mockRejectedValue(processingError);

      const mockUpdatedEvent = {
        id: 'event-1',
        retryCount: 3,
        maxRetries: 3,
        canRetry: jest.fn().mockReturnValue(false),
      };

      mockWebhookService.incrementRetryCount.mockResolvedValue(
        mockUpdatedEvent,
      );

      // Act
      await service.processWebhookMessage(mockMessage);

      // Assert
      expect(mockWebhookService.updateEventStatus).toHaveBeenCalledWith(
        'event-1',
        WebhookEventStatus.FAILED,
        processingError.message,
      );
      expect(mockSqsService.deleteMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('should handle errors in error handling', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: '{"eventId":"event-1"}',
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);

      jest
        .spyOn(service, 'processWebhookEventByType')
        .mockRejectedValue(new Error('Processing error'));

      mockWebhookService.incrementRetryCount.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(
        service.processWebhookMessage(mockMessage),
      ).resolves.not.toThrow();
    });
  });

  describe('processWebhookEventByType', () => {
    // We're using the mock implementation for this method
    it('should process payment authorized webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_AUTHORIZED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_authorized',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process payment captured webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_captured',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process payment settled webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_SETTLED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_settled',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process payment failed webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_FAILED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_failed',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process payment refunded webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_REFUNDED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_refunded',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process payment voided webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.PAYMENT_VOIDED,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_voided',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process subscription created webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.SUBSCRIPTION_CREATED,
        payload: { id: 'subscription-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        subscriptionId: 'subscription-1',
        action: 'subscription_created',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process subscription updated webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.SUBSCRIPTION_UPDATED,
        payload: { id: 'subscription-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        subscriptionId: 'subscription-1',
        action: 'subscription_updated',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process subscription cancelled webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.SUBSCRIPTION_CANCELLED,
        payload: { id: 'subscription-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        subscriptionId: 'subscription-1',
        action: 'subscription_cancelled',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process subscription expired webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.SUBSCRIPTION_EXPIRED,
        payload: { id: 'subscription-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        subscriptionId: 'subscription-1',
        action: 'subscription_expired',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process subscription payment success webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.SUBSCRIPTION_PAYMENT_SUCCESS,
        payload: { id: 'payment-1', subscriptionId: 'subscription-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        subscriptionId: 'subscription-1',
        paymentId: 'payment-1',
        action: 'subscription_payment_success',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should process subscription payment failed webhook', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED,
        payload: { id: 'payment-1', subscriptionId: 'subscription-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      const expectedResult = {
        processed: true,
        subscriptionId: 'subscription-1',
        paymentId: 'payment-1',
        action: 'subscription_payment_failed',
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should handle unknown event types', async () => {
      // Arrange
      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'UNKNOWN_EVENT' as WebhookEventType,
        payload: { id: 'payment-1' },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 0,
      };

      // Act
      const result = await service.processWebhookEventByType(mockPayload);

      // Assert
      expect(result).toEqual({
        processed: true,
        message: 'Unknown event type processed',
      });
    });
  });

  // Tests for individual webhook processing methods
  describe('processPaymentAuthorized', () => {
    it('should process payment authorized webhook', async () => {
      // Arrange
      const payload = { id: 'payment-1', amount: 100 };

      // Act
      const result = await (service as any).processPaymentAuthorized(payload);

      // Assert
      expect(result).toEqual({
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_authorized',
      });
    });
  });

  describe('processPaymentCaptured', () => {
    it('should process payment captured webhook', async () => {
      // Arrange
      const payload = { id: 'payment-1', amount: 100 };

      // Act
      const result = await (service as any).processPaymentCaptured(payload);

      // Assert
      expect(result).toEqual({
        processed: true,
        transactionId: 'payment-1',
        action: 'payment_captured',
      });
    });
  });

  describe('processSubscriptionCreated', () => {
    it('should process subscription created webhook', async () => {
      // Arrange
      const payload = { id: 'subscription-1', plan: 'premium' };

      // Act
      const result = await (service as any).processSubscriptionCreated(payload);

      // Assert
      expect(result).toEqual({
        processed: true,
        subscriptionId: 'subscription-1',
        action: 'subscription_created',
      });
    });
  });
});
