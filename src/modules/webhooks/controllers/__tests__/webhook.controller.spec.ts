import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WebhookController } from '../webhook.controller';
import { WebhookService } from '../../services/webhook.service';
import {
  WebhookEventResponseDto,
  WebhookEventQueryDto,
  RetryWebhookEventDto,
} from '../../dto/webhook-event.dto';
import {
  WebhookEvent,
  WebhookEventType,
  WebhookEventStatus,
} from '../../../../database/entities/webhook-event.entity';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: jest.Mocked<WebhookService>;

  const mockWebhookEvent: WebhookEvent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    eventType: WebhookEventType.PAYMENT_CAPTURED,
    externalId: 'ext-12345',
    payload: { transactionId: 'txn-123', amount: 100.0 },
    signature: 'sha256=abc123',
    status: WebhookEventStatus.PROCESSED,
    retryCount: 0,
    maxRetries: 3,
    processedAt: new Date('2023-09-06T14:30:00Z'),
    errorMessage: '',
    processingResult: { success: true },
    createdAt: new Date('2023-09-06T14:00:00Z'),
    updatedAt: new Date('2023-09-06T14:30:00Z'),
    canRetry: jest.fn().mockReturnValue(true),
    markAsProcessing: jest.fn(),
    markAsProcessed: jest.fn(),
    markAsFailed: jest.fn(),
    incrementRetry: jest.fn(),
  } as unknown as WebhookEvent;

  const mockProcessingResult = {
    eventId: '123e4567-e89b-12d3-a456-426614174000',
    status: 'pending',
  };

  const mockProcessingStats = {
    pending: 5,
    processing: 2,
    processed: 100,
    failed: 3,
    retrying: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            processAuthorizeNetWebhook: jest.fn(),
            findEvents: jest.fn(),
            findById: jest.fn(),
            retryWebhookEvent: jest.fn(),
            getProcessingStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get(WebhookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When receiving Authorize.Net webhook', () => {
    const mockHeaders = {
      'content-type': 'application/json',
      'user-agent': 'Authorize.Net Webhooks',
      'x-anet-signature': 'sha256=abc123def456',
    };

    it('Then should process webhook successfully with object payload', async () => {
      // Arrange
      const rawBody = {
        notificationId: '12345678-1234-1234-1234-123456789012',
        eventType: 'net.authorize.payment.authcapture.created',
        eventDate: '2023-09-06T14:30:00Z',
        webhookId: 'webhook123',
        payload: { transactionId: 'txn-123', amount: 100.0 },
      };
      webhookService.processAuthorizeNetWebhook.mockResolvedValue(
        mockProcessingResult,
      );

      // Act
      const result = await controller.receiveAuthorizeNetWebhook(
        rawBody,
        mockHeaders,
      );

      // Assert
      expect(result).toEqual({
        eventId: mockProcessingResult.eventId,
        status: mockProcessingResult.status,
        message: 'Webhook received and queued for processing',
      });
      expect(webhookService.processAuthorizeNetWebhook).toHaveBeenCalledWith(
        JSON.stringify(rawBody),
        mockHeaders,
      );
    });

    it('Then should process webhook successfully with string payload', async () => {
      // Arrange
      const rawBody =
        '{"notificationId":"12345678-1234-1234-1234-123456789012","eventType":"net.authorize.payment.authcapture.created"}';
      webhookService.processAuthorizeNetWebhook.mockResolvedValue(
        mockProcessingResult,
      );

      // Act
      const result = await controller.receiveAuthorizeNetWebhook(
        rawBody,
        mockHeaders,
      );

      // Assert
      expect(result).toEqual({
        eventId: mockProcessingResult.eventId,
        status: mockProcessingResult.status,
        message: 'Webhook received and queued for processing',
      });
      expect(webhookService.processAuthorizeNetWebhook).toHaveBeenCalledWith(
        rawBody,
        mockHeaders,
      );
    });

    it('Then should throw BadRequestException when validation fails', async () => {
      // Arrange
      const rawBody = { invalid: 'payload' };
      const validationError = new Error(
        'validation failed: missing required fields',
      );
      webhookService.processAuthorizeNetWebhook.mockRejectedValue(
        validationError,
      );

      // Act & Assert
      await expect(
        controller.receiveAuthorizeNetWebhook(rawBody, mockHeaders),
      ).rejects.toThrow(BadRequestException);
      expect(webhookService.processAuthorizeNetWebhook).toHaveBeenCalledWith(
        JSON.stringify(rawBody),
        mockHeaders,
      );
    });

    it('Then should throw InternalServerErrorException for other errors', async () => {
      // Arrange
      const rawBody = { valid: 'payload' };
      const serviceError = new Error('Database connection failed');
      webhookService.processAuthorizeNetWebhook.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.receiveAuthorizeNetWebhook(rawBody, mockHeaders),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('Then should handle missing signature header', async () => {
      // Arrange
      const rawBody = { valid: 'payload' };
      const headersWithoutSignature = {
        'content-type': 'application/json',
        'user-agent': 'Authorize.Net Webhooks',
      };
      webhookService.processAuthorizeNetWebhook.mockResolvedValue(
        mockProcessingResult,
      );

      // Act
      const result = await controller.receiveAuthorizeNetWebhook(
        rawBody,
        headersWithoutSignature,
      );

      // Assert
      expect(result).toEqual({
        eventId: mockProcessingResult.eventId,
        status: mockProcessingResult.status,
        message: 'Webhook received and queued for processing',
      });
    });
  });

  describe('When getting webhook events', () => {
    const mockEventsResult = {
      events: [mockWebhookEvent],
      total: 1,
    };

    it('Then should return events with default pagination', async () => {
      // Arrange
      const query: WebhookEventQueryDto = {};
      webhookService.findEvents.mockResolvedValue(mockEventsResult);

      // Act
      const result = await controller.getWebhookEvents(query);

      // Assert
      expect(result).toEqual({
        events: [
          {
            id: mockWebhookEvent.id,
            eventType: mockWebhookEvent.eventType,
            externalId: mockWebhookEvent.externalId,
            status: mockWebhookEvent.status,
            retryCount: mockWebhookEvent.retryCount,
            maxRetries: mockWebhookEvent.maxRetries,
            processedAt: mockWebhookEvent.processedAt,
            errorMessage: mockWebhookEvent.errorMessage,
            createdAt: mockWebhookEvent.createdAt,
            updatedAt: mockWebhookEvent.updatedAt,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });
      expect(webhookService.findEvents).toHaveBeenCalledWith(query);
    });

    it('Then should return events with custom pagination and filters', async () => {
      // Arrange
      const query: WebhookEventQueryDto = {
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        status: WebhookEventStatus.PROCESSED,
        externalId: 'ext-12345',
        limit: 10,
        offset: 5,
      };
      webhookService.findEvents.mockResolvedValue(mockEventsResult);

      // Act
      const result = await controller.getWebhookEvents(query);

      // Assert
      expect(result).toEqual({
        events: [
          {
            id: mockWebhookEvent.id,
            eventType: mockWebhookEvent.eventType,
            externalId: mockWebhookEvent.externalId,
            status: mockWebhookEvent.status,
            retryCount: mockWebhookEvent.retryCount,
            maxRetries: mockWebhookEvent.maxRetries,
            processedAt: mockWebhookEvent.processedAt,
            errorMessage: mockWebhookEvent.errorMessage,
            createdAt: mockWebhookEvent.createdAt,
            updatedAt: mockWebhookEvent.updatedAt,
          },
        ],
        total: 1,
        limit: 10,
        offset: 5,
      });
    });

    it('Then should return empty array when no events found', async () => {
      // Arrange
      const query: WebhookEventQueryDto = {};
      const emptyResult = { events: [], total: 0 };
      webhookService.findEvents.mockResolvedValue(emptyResult);

      // Act
      const result = await controller.getWebhookEvents(query);

      // Assert
      expect(result).toEqual({
        events: [],
        total: 0,
        limit: 20,
        offset: 0,
      });
    });

    it('Then should throw InternalServerErrorException when service fails', async () => {
      // Arrange
      const query: WebhookEventQueryDto = {};
      const serviceError = new Error('Database query failed');
      webhookService.findEvents.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getWebhookEvents(query)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('When getting webhook event by ID', () => {
    const eventId = '123e4567-e89b-12d3-a456-426614174000';

    it('Then should return event details successfully', async () => {
      // Arrange
      webhookService.findById.mockResolvedValue(mockWebhookEvent);

      // Act
      const result = await controller.getWebhookEventById(eventId);

      // Assert
      expect(result).toEqual({
        id: mockWebhookEvent.id,
        eventType: mockWebhookEvent.eventType,
        externalId: mockWebhookEvent.externalId,
        status: mockWebhookEvent.status,
        retryCount: mockWebhookEvent.retryCount,
        maxRetries: mockWebhookEvent.maxRetries,
        processedAt: mockWebhookEvent.processedAt,
        errorMessage: mockWebhookEvent.errorMessage,
        createdAt: mockWebhookEvent.createdAt,
        updatedAt: mockWebhookEvent.updatedAt,
      });
      expect(webhookService.findById).toHaveBeenCalledWith(eventId);
    });

    it('Then should throw original error when event not found', async () => {
      // Arrange
      const notFoundError = new NotFoundException('Webhook event not found');
      webhookService.findById.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(controller.getWebhookEventById(eventId)).rejects.toThrow(
        notFoundError,
      );
    });

    it('Then should throw InternalServerErrorException for other errors', async () => {
      // Arrange
      const serviceError = new Error('Database connection failed');
      webhookService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getWebhookEventById(eventId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('Then should handle invalid UUID format', async () => {
      // Arrange
      const invalidId = 'invalid-uuid';
      const serviceError = new Error('Invalid UUID format');
      webhookService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getWebhookEventById(invalidId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('When retrying webhook event', () => {
    const eventId = '123e4567-e89b-12d3-a456-426614174000';
    const retryDto: RetryWebhookEventDto = {
      eventId,
      forceRetry: false,
    };

    it('Then should retry event successfully', async () => {
      // Arrange
      const retriedEvent = {
        ...mockWebhookEvent,
        status: WebhookEventStatus.RETRYING,
        retryCount: 1,
      } as WebhookEvent;
      webhookService.retryWebhookEvent.mockResolvedValue(retriedEvent);

      // Act
      const result = await controller.retryWebhookEvent(eventId, retryDto);

      // Assert
      expect(result).toEqual({
        eventId: retriedEvent.id,
        status: retriedEvent.status,
        retryCount: retriedEvent.retryCount,
        message: 'Event queued for retry processing',
      });
      expect(webhookService.retryWebhookEvent).toHaveBeenCalledWith(
        eventId,
        retryDto.forceRetry,
      );
    });

    it('Then should retry event with force flag', async () => {
      // Arrange
      const forceRetryDto: RetryWebhookEventDto = {
        eventId,
        forceRetry: true,
      };
      const retriedEvent = {
        ...mockWebhookEvent,
        status: WebhookEventStatus.RETRYING,
        retryCount: 4, // Exceeds max retries but forced
      } as WebhookEvent;
      webhookService.retryWebhookEvent.mockResolvedValue(retriedEvent);

      // Act
      const result = await controller.retryWebhookEvent(eventId, forceRetryDto);

      // Assert
      expect(result).toEqual({
        eventId: retriedEvent.id,
        status: retriedEvent.status,
        retryCount: retriedEvent.retryCount,
        message: 'Event queued for retry processing',
      });
      expect(webhookService.retryWebhookEvent).toHaveBeenCalledWith(
        eventId,
        true,
      );
    });

    it('Then should throw original error when event not found', async () => {
      // Arrange
      const notFoundError = new NotFoundException('Webhook event not found');
      webhookService.retryWebhookEvent.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.retryWebhookEvent(eventId, retryDto),
      ).rejects.toThrow(notFoundError);
    });

    it('Then should throw BadRequestException when event cannot be retried', async () => {
      // Arrange
      const cannotRetryError = new Error(
        'Event cannot be retried: max retries exceeded',
      );
      webhookService.retryWebhookEvent.mockRejectedValue(cannotRetryError);

      // Act & Assert
      await expect(
        controller.retryWebhookEvent(eventId, retryDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('Then should throw InternalServerErrorException for other errors', async () => {
      // Arrange
      const serviceError = new Error('Database update failed');
      webhookService.retryWebhookEvent.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.retryWebhookEvent(eventId, retryDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('When getting webhook statistics', () => {
    const mockQueueStats = {
      approximateNumberOfMessages: 0,
      approximateNumberOfMessagesNotVisible: 0,
      approximateNumberOfMessagesDelayed: 0,
    };

    it('Then should return processing statistics successfully', async () => {
      // Arrange
      webhookService.getProcessingStats.mockResolvedValue(mockProcessingStats);

      // Act
      const result = await controller.getWebhookStats();

      // Assert
      expect(result).toEqual({
        ...mockProcessingStats,
        queueStats: mockQueueStats,
      });
      expect(webhookService.getProcessingStats).toHaveBeenCalled();
    });

    it('Then should handle empty statistics', async () => {
      // Arrange
      const emptyStats = {
        pending: 0,
        processing: 0,
        processed: 0,
        failed: 0,
        retrying: 0,
      };
      webhookService.getProcessingStats.mockResolvedValue(emptyStats);

      // Act
      const result = await controller.getWebhookStats();

      // Assert
      expect(result).toEqual({
        ...emptyStats,
        queueStats: mockQueueStats,
      });
    });

    it('Then should throw InternalServerErrorException when service fails', async () => {
      // Arrange
      const serviceError = new Error('Statistics query failed');
      webhookService.getProcessingStats.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getWebhookStats()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('When performing health check', () => {
    it('Then should return healthy status', async () => {
      // Arrange
      const mockDate = new Date('2023-09-06T14:30:00Z');
      const mockUptime = 3600;
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      jest.spyOn(process, 'uptime').mockReturnValue(mockUptime);

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        timestamp: mockDate.toISOString(),
        uptime: mockUptime,
      });
    });

    it('Then should return current timestamp and uptime', async () => {
      // Arrange
      const beforeCall = new Date().getTime();
      const uptimeBefore = process.uptime();

      // Act
      const result = await controller.healthCheck();

      // Assert
      const afterCall = new Date().getTime();
      const resultTimestamp = new Date(result.timestamp).getTime();

      expect(result.status).toBe('healthy');
      expect(resultTimestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(resultTimestamp).toBeLessThanOrEqual(afterCall);
      expect(result.uptime).toBeGreaterThanOrEqual(uptimeBefore);
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    describe('When handling large payloads', () => {
      it('Then should process large webhook payload', async () => {
        // Arrange
        const largePayload = {
          notificationId: '12345678-1234-1234-1234-123456789012',
          eventType: 'net.authorize.payment.authcapture.created',
          payload: {
            transactions: Array(1000)
              .fill(0)
              .map((_, i) => ({
                id: `txn-${i}`,
                amount: Math.random() * 1000,
                status: 'completed',
              })),
          },
        };
        webhookService.processAuthorizeNetWebhook.mockResolvedValue(
          mockProcessingResult,
        );

        // Act
        const result = await controller.receiveAuthorizeNetWebhook(
          largePayload,
          {},
        );

        // Assert
        expect(result.eventId).toBe(mockProcessingResult.eventId);
        expect(webhookService.processAuthorizeNetWebhook).toHaveBeenCalledWith(
          JSON.stringify(largePayload),
          {},
        );
      });
    });

    describe('When handling special characters in payload', () => {
      it('Then should process payload with special characters', async () => {
        // Arrange
        const payloadWithSpecialChars = {
          notificationId: '12345678-1234-1234-1234-123456789012',
          eventType: 'net.authorize.payment.authcapture.created',
          customerName: 'José María Ñoño',
          description: 'Payment for "Special" items & services',
          unicode: '🎉💳✅',
        };
        webhookService.processAuthorizeNetWebhook.mockResolvedValue(
          mockProcessingResult,
        );

        // Act
        const result = await controller.receiveAuthorizeNetWebhook(
          payloadWithSpecialChars,
          {},
        );

        // Assert
        expect(result.eventId).toBe(mockProcessingResult.eventId);
      });
    });

    describe('When handling pagination edge cases', () => {
      it('Then should handle zero limit in query', async () => {
        // Arrange
        const query: WebhookEventQueryDto = { limit: 0 };
        const emptyResult = { events: [], total: 0 };
        webhookService.findEvents.mockResolvedValue(emptyResult);

        // Act
        const result = await controller.getWebhookEvents(query);

        // Assert
        expect(result.limit).toBe(query.limit || 20); // Controller uses default if not provided
        expect(result.events).toEqual([]);
      });

      it('Then should handle large offset in query', async () => {
        // Arrange
        const query: WebhookEventQueryDto = { offset: 999999 };
        const emptyResult = { events: [], total: 0 };
        webhookService.findEvents.mockResolvedValue(emptyResult);

        // Act
        const result = await controller.getWebhookEvents(query);

        // Assert
        expect(result.offset).toBe(999999);
        expect(result.events).toEqual([]);
      });
    });

    describe('When handling null and undefined values', () => {
      it('Then should handle webhook event with null processedAt', async () => {
        // Arrange
        const eventWithNullProcessedAt = {
          ...mockWebhookEvent,
          processedAt: null,
          errorMessage: null,
          canRetry: jest.fn().mockReturnValue(true),
          markAsProcessing: jest.fn(),
          markAsProcessed: jest.fn(),
          markAsFailed: jest.fn(),
          incrementRetry: jest.fn(),
        } as unknown as WebhookEvent;
        webhookService.findById.mockResolvedValue(eventWithNullProcessedAt);

        // Act
        const result = await controller.getWebhookEventById('test-id');

        // Assert
        expect(result.processedAt).toBeNull();
        expect(result.errorMessage).toBeNull();
      });
    });
  });
});
