import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookService } from '../webhook.service';
import { WebhookEvent, WebhookEventType, WebhookEventStatus } from '../../entities/webhook-event.entity';
import { WebhookValidationService } from '../webhook-validation.service';
import { SqsService } from '../sqs.service';
import { IdempotencyService } from '../idempotency.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let repository: Repository<WebhookEvent>;
  let validationService: WebhookValidationService;
  let sqsService: SqsService;
  let idempotencyService: IdempotencyService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockValidationService = {
    validateWebhook: jest.fn(),
    extractWebhookHeaders: jest.fn(),
  };

  const mockSqsService = {
    sendWebhookEvent: jest.fn(),
  };

  const mockIdempotencyService = {
    checkWebhookIdempotency: jest.fn(),
    storeProcessingResult: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: mockRepository,
        },
        {
          provide: WebhookValidationService,
          useValue: mockValidationService,
        },
        {
          provide: SqsService,
          useValue: mockSqsService,
        },
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    repository = module.get<Repository<WebhookEvent>>(getRepositoryToken(WebhookEvent));
    validationService = module.get<WebhookValidationService>(WebhookValidationService);
    sqsService = module.get<SqsService>(SqsService);
    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processAuthorizeNetWebhook', () => {
    const mockPayload = JSON.stringify({
      notificationId: '12345678-1234-1234-1234-123456789012',
      eventType: 'net.authorize.payment.authcapture.created',
      eventDate: '2023-09-06T14:30:00Z',
      webhookId: 'webhook123',
      payload: {
        id: 'trans123',
        amount: 100.00,
      },
    });

    const mockHeaders = {
      'x-anet-signature': 'sha512=abc123',
      'content-type': 'application/json',
    };

    it('should process webhook successfully when validation passes', async () => {
      // Arrange
      mockValidationService.validateWebhook.mockResolvedValue({ isValid: true });
      mockIdempotencyService.checkWebhookIdempotency.mockResolvedValue({
        isIdempotent: false,
        shouldProcess: true,
      });

      const mockWebhookEvent = {
        id: 'event-123',
        eventType: WebhookEventType.PAYMENT_CAPTURED,
        externalId: '12345678-1234-1234-1234-123456789012',
        status: WebhookEventStatus.PENDING,
      };

      mockRepository.create.mockReturnValue(mockWebhookEvent);
      mockRepository.save.mockResolvedValue(mockWebhookEvent);
      mockSqsService.sendWebhookEvent.mockResolvedValue('message-123');

      // Act
      const result = await service.processAuthorizeNetWebhook(mockPayload, mockHeaders);

      // Assert
      expect(result).toEqual({
        eventId: 'event-123',
        status: WebhookEventStatus.PENDING,
      });
      expect(mockValidationService.validateWebhook).toHaveBeenCalledWith(
        mockPayload,
        mockHeaders,
        JSON.parse(mockPayload),
      );
      expect(mockIdempotencyService.checkWebhookIdempotency).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockSqsService.sendWebhookEvent).toHaveBeenCalled();
    });

    it('should return existing event when webhook is idempotent', async () => {
      // Arrange
      mockValidationService.validateWebhook.mockResolvedValue({ isValid: true });
      
      const existingEvent = {
        id: 'existing-123',
        status: WebhookEventStatus.PROCESSED,
      };

      mockIdempotencyService.checkWebhookIdempotency.mockResolvedValue({
        isIdempotent: true,
        existingResult: existingEvent,
        shouldProcess: false,
      });

      // Act
      const result = await service.processAuthorizeNetWebhook(mockPayload, mockHeaders);

      // Assert
      expect(result).toEqual({
        eventId: 'existing-123',
        status: WebhookEventStatus.PROCESSED,
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockSqsService.sendWebhookEvent).not.toHaveBeenCalled();
    });

    it('should throw error when validation fails', async () => {
      // Arrange
      mockValidationService.validateWebhook.mockResolvedValue({
        isValid: false,
        errorMessage: 'Invalid signature',
      });

      // Act & Assert
      await expect(
        service.processAuthorizeNetWebhook(mockPayload, mockHeaders),
      ).rejects.toThrow('Webhook validation failed: Invalid signature');
    });

    it('should throw error when payload is invalid JSON', async () => {
      // Arrange
      const invalidPayload = 'invalid json';

      // Act & Assert
      await expect(
        service.processAuthorizeNetWebhook(invalidPayload, mockHeaders),
      ).rejects.toThrow();
    });
  });

  describe('createWebhookEvent', () => {
    it('should create webhook event successfully', async () => {
      // Arrange
      const dto = {
        eventType: WebhookEventType.PAYMENT_AUTHORIZED,
        externalId: 'ext-123',
        payload: { test: 'data' },
        signature: 'sig-123',
      };

      const mockEvent = {
        id: 'event-123',
        ...dto,
        status: WebhookEventStatus.PENDING,
        retryCount: 0,
      };

      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      // Act
      const result = await service.createWebhookEvent(dto);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRepository.create).toHaveBeenCalledWith({
        eventType: dto.eventType,
        externalId: dto.externalId,
        payload: dto.payload,
        signature: dto.signature,
        status: WebhookEventStatus.PENDING,
        retryCount: 0,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('findById', () => {
    it('should return webhook event when found', async () => {
      // Arrange
      const eventId = 'event-123';
      const mockEvent = { id: eventId, eventType: WebhookEventType.PAYMENT_AUTHORIZED };
      mockRepository.findOne.mockResolvedValue(mockEvent);

      // Act
      const result = await service.findById(eventId);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: eventId } });
    });

    it('should throw NotFoundException when event not found', async () => {
      // Arrange
      const eventId = 'non-existent';
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(eventId)).rejects.toThrow('Webhook event with ID non-existent not found');
    });
  });

  describe('updateEventStatus', () => {
    it('should update event status successfully', async () => {
      // Arrange
      const eventId = 'event-123';
      const mockEvent = {
        id: eventId,
        status: WebhookEventStatus.PENDING,
        errorMessage: null,
        processingResult: null,
        processedAt: null,
      };

      mockRepository.findOne.mockResolvedValue(mockEvent);
      mockRepository.save.mockResolvedValue({
        ...mockEvent,
        status: WebhookEventStatus.PROCESSED,
        processedAt: expect.any(Date),
      });

      // Act
      const result = await service.updateEventStatus(
        eventId,
        WebhookEventStatus.PROCESSED,
        undefined,
        { success: true },
      );

      // Assert
      expect(result.status).toBe(WebhookEventStatus.PROCESSED);
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('mapAuthorizeNetEventType', () => {
    it('should map known Authorize.Net event types correctly', () => {
      // Test private method through reflection or make it public for testing
      const testCases = [
        {
          input: 'net.authorize.payment.authcapture.created',
          expected: WebhookEventType.PAYMENT_CAPTURED,
        },
        {
          input: 'net.authorize.payment.authorization.created',
          expected: WebhookEventType.PAYMENT_AUTHORIZED,
        },
        {
          input: 'net.authorize.payment.refund.created',
          expected: WebhookEventType.PAYMENT_REFUNDED,
        },
        {
          input: 'net.authorize.customer.subscription.created',
          expected: WebhookEventType.SUBSCRIPTION_CREATED,
        },
      ];

      testCases.forEach(({ input, expected }) => {
        // Access private method for testing
        const result = (service as any).mapAuthorizeNetEventType(input);
        expect(result).toBe(expected);
      });
    });

    it('should return default event type for unknown events', () => {
      const result = (service as any).mapAuthorizeNetEventType('unknown.event.type');
      expect(result).toBe(WebhookEventType.PAYMENT_AUTHORIZED);
    });
  });
});
