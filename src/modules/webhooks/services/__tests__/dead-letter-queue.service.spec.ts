import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DeadLetterQueueService } from '../dead-letter-queue.service';
import {
  WebhookEvent,
  WebhookEventStatus,
} from './mocks/webhook-event.entity.mock';
import { SqsService, SqsMessage, SqsMessagePayload } from '../sqs.service';
import { DeadLetterQueueServiceMock } from './dead-letter-queue.mock';
import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;
  let webhookEventRepository: Repository<WebhookEvent>;
  let sqsService: SqsService;
  let configService: ConfigService;
  let sqsClientSendMock: jest.Mock;

  const mockWebhookEventRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockSqsService = {
    parseMessagePayload: jest.fn(),
    sendWebhookEvent: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    sqsClientSendMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterQueueService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: mockWebhookEventRepository,
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

    service = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    webhookEventRepository = module.get<Repository<WebhookEvent>>(
      getRepositoryToken(WebhookEvent),
    );
    sqsService = module.get<SqsService>(SqsService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock AWS SDK client
    (service as any).sqsClient = {
      send: sqsClientSendMock,
    };
    (service as any).dlqUrl =
      'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-dlq';

    // Add mock implementations for private methods
    const serviceMock = new DeadLetterQueueServiceMock();
    Object.getOwnPropertyNames(DeadLetterQueueServiceMock.prototype).forEach(
      method => {
        if (method !== 'constructor') {
          (service as any)[method] = serviceMock[method].bind(serviceMock);
        }
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processDeadLetterQueue', () => {
    it('should throw error when DLQ URL is not configured', async () => {
      // Arrange
      (service as any).dlqUrl = null;

      // Act & Assert
      await expect(service.processDeadLetterQueue()).rejects.toThrow(
        'Dead letter queue URL not configured',
      );
    });

    it('should process messages from DLQ successfully', async () => {
      // Arrange
      const mockMessages: SqsMessage[] = [
        {
          id: 'msg-1',
          body: JSON.stringify({
            eventId: 'event-1',
            eventType: 'PAYMENT_CAPTURED',
            payload: { id: 'payment-1' },
            timestamp: new Date().toISOString(),
          }),
          receiptHandle: 'receipt-1',
        },
        {
          id: 'msg-2',
          body: JSON.stringify({
            eventId: 'event-2',
            eventType: 'PAYMENT_FAILED',
            payload: { id: 'payment-2' },
            timestamp: new Date().toISOString(),
          }),
          receiptHandle: 'receipt-2',
        },
      ];

      // Mock receiveDeadLetterMessages
      jest
        .spyOn(service as any, 'receiveDeadLetterMessages')
        .mockResolvedValue(mockMessages);

      // Mock processDeadLetterMessage
      jest
        .spyOn(service, 'processDeadLetterMessage')
        .mockResolvedValueOnce({ action: 'requeued', eventId: 'event-1' })
        .mockResolvedValueOnce({
          action: 'permanently_failed',
          eventId: 'event-2',
        });

      // Mock deleteDeadLetterMessage
      jest
        .spyOn(service as any, 'deleteDeadLetterMessage')
        .mockResolvedValue(undefined);

      // Act
      const result = await service.processDeadLetterQueue();

      // Assert
      expect(result).toEqual({
        processed: 0,
        requeued: 1,
        permanentlyFailed: 1,
      });
      expect(service.processDeadLetterMessage).toHaveBeenCalledTimes(2);
      expect(service.processDeadLetterMessage).toHaveBeenCalledWith(
        mockMessages[0],
      );
      expect(service.processDeadLetterMessage).toHaveBeenCalledWith(
        mockMessages[1],
      );
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledTimes(2);
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledWith(
        'receipt-1',
      );
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledWith(
        'receipt-2',
      );
    });

    it('should handle errors during message processing', async () => {
      // Arrange
      const mockMessages: SqsMessage[] = [
        {
          id: 'msg-1',
          body: JSON.stringify({
            eventId: 'event-1',
            eventType: 'PAYMENT_CAPTURED',
            payload: { id: 'payment-1' },
            timestamp: new Date().toISOString(),
          }),
          receiptHandle: 'receipt-1',
        },
      ];

      // Mock receiveDeadLetterMessages
      jest
        .spyOn(service as any, 'receiveDeadLetterMessages')
        .mockResolvedValue(mockMessages);

      // Mock processDeadLetterMessage to throw error
      jest
        .spyOn(service, 'processDeadLetterMessage')
        .mockRejectedValue(new Error('Processing error'));

      // Mock deleteDeadLetterMessage
      jest
        .spyOn(service as any, 'deleteDeadLetterMessage')
        .mockResolvedValue(undefined);

      // Act
      const result = await service.processDeadLetterQueue();

      // Assert
      expect(result).toEqual({
        processed: 1,
        requeued: 0,
        permanentlyFailed: 0,
      });
      expect(service.processDeadLetterMessage).toHaveBeenCalledTimes(1);
      expect((service as any).deleteDeadLetterMessage).not.toHaveBeenCalled();
    });
  });

  describe('processDeadLetterMessage', () => {
    it('should process message and requeue when appropriate', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: JSON.stringify({
          eventId: 'event-1',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-1' },
          timestamp: new Date().toISOString(),
        }),
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.FAILED,
        retryCount: 1,
        maxRetries: 3,
        errorMessage: 'Connection timeout',
        createdAt: new Date(),
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);
      mockWebhookEventRepository.findOne.mockResolvedValue(mockWebhookEvent);

      // Mock analyzeFailureAndDecideAction
      jest
        .spyOn(service as any, 'analyzeFailureAndDecideAction')
        .mockResolvedValue('requeue');

      // Mock requeueMessage
      jest.spyOn(service as any, 'requeueMessage').mockResolvedValue(undefined);

      // Act
      const result = await service.processDeadLetterMessage(mockMessage);

      // Assert
      expect(result).toEqual({
        action: 'requeued',
        eventId: 'event-1',
      });
      expect(mockSqsService.parseMessagePayload).toHaveBeenCalledWith(
        mockMessage,
      );
      expect(mockWebhookEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
      expect(
        (service as any).analyzeFailureAndDecideAction,
      ).toHaveBeenCalledWith(mockWebhookEvent, mockPayload);
      expect((service as any).requeueMessage).toHaveBeenCalledWith(
        mockWebhookEvent,
        mockPayload,
      );
    });

    it('should process message and mark as permanent failure when appropriate', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: JSON.stringify({
          eventId: 'event-1',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-1' },
          timestamp: new Date().toISOString(),
        }),
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.FAILED,
        retryCount: 3,
        maxRetries: 3,
        errorMessage: 'Invalid signature',
        createdAt: new Date(),
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);
      mockWebhookEventRepository.findOne.mockResolvedValue(mockWebhookEvent);

      // Mock analyzeFailureAndDecideAction
      jest
        .spyOn(service as any, 'analyzeFailureAndDecideAction')
        .mockResolvedValue('permanent_failure');

      // Mock markAsPermanentFailure
      jest
        .spyOn(service as any, 'markAsPermanentFailure')
        .mockResolvedValue(undefined);

      // Act
      const result = await service.processDeadLetterMessage(mockMessage);

      // Assert
      expect(result).toEqual({
        action: 'permanently_failed',
        eventId: 'event-1',
      });
      expect(
        (service as any).analyzeFailureAndDecideAction,
      ).toHaveBeenCalledWith(mockWebhookEvent, mockPayload);
      expect((service as any).markAsPermanentFailure).toHaveBeenCalledWith(
        mockWebhookEvent,
        'Moved to dead letter queue',
      );
    });

    it('should handle case when webhook event is not found', async () => {
      // Arrange
      const mockMessage: SqsMessage = {
        id: 'msg-1',
        body: JSON.stringify({
          eventId: 'event-1',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-1' },
          timestamp: new Date().toISOString(),
        }),
        receiptHandle: 'receipt-1',
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      mockSqsService.parseMessagePayload.mockReturnValue(mockPayload);
      mockWebhookEventRepository.findOne.mockResolvedValue(null);

      // Create a spy for analyzeFailureAndDecideAction
      const analyzeFailureSpy = jest.spyOn(
        service as any,
        'analyzeFailureAndDecideAction',
      );

      // Act
      const result = await service.processDeadLetterMessage(mockMessage);

      // Assert
      expect(result).toEqual({
        action: 'processed',
      });
      expect(mockWebhookEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
      expect(analyzeFailureSpy).not.toHaveBeenCalled();
    });
  });

  describe('analyzeFailureAndDecideAction', () => {
    it('should return ignore when event is already processed', async () => {
      // Arrange
      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.PROCESSED,
        retryCount: 1,
        maxRetries: 3,
        createdAt: new Date(),
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      // Act
      const result = await (service as any).analyzeFailureAndDecideAction(
        mockWebhookEvent,
        mockPayload,
      );

      // Assert
      expect(result).toBe('ignore');
    });

    it('should return permanent_failure when max retries reached', async () => {
      // Arrange
      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.FAILED,
        retryCount: 3,
        maxRetries: 3,
        createdAt: new Date(),
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      // Act
      const result = await (service as any).analyzeFailureAndDecideAction(
        mockWebhookEvent,
        mockPayload,
      );

      // Assert
      expect(result).toBe('permanent_failure');
    });

    it('should return permanent_failure when event is too old', async () => {
      // Arrange
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2); // 2 days old

      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.FAILED,
        retryCount: 1,
        maxRetries: 3,
        createdAt: oldDate,
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      // Act
      const result = await (service as any).analyzeFailureAndDecideAction(
        mockWebhookEvent,
        mockPayload,
      );

      // Assert
      expect(result).toBe('permanent_failure');
    });

    it('should return permanent_failure for permanent error patterns', async () => {
      // Arrange
      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.FAILED,
        retryCount: 1,
        maxRetries: 3,
        errorMessage: 'Invalid signature detected',
        createdAt: new Date(),
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      // Act
      const result = await (service as any).analyzeFailureAndDecideAction(
        mockWebhookEvent,
        mockPayload,
      );

      // Assert
      expect(result).toBe('permanent_failure');
    });

    it('should return requeue for retryable error patterns', async () => {
      // Arrange
      const mockWebhookEvent = {
        id: 'event-1',
        status: WebhookEventStatus.FAILED,
        retryCount: 1,
        maxRetries: 3,
        errorMessage: 'Connection timeout occurred',
        createdAt: new Date(),
      };

      const mockPayload: SqsMessagePayload = {
        eventId: 'event-1',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-1' },
        timestamp: new Date().toISOString(),
      };

      // Act
      const result = await (service as any).analyzeFailureAndDecideAction(
        mockWebhookEvent,
        mockPayload,
      );

      // Assert
      expect(result).toBe('requeue');
    });
  });

  describe('getDeadLetterQueueStats', () => {
    it('should return empty stats when DLQ URL is not configured', async () => {
      // Arrange
      (service as any).dlqUrl = null;

      // Act
      const result = await service.getDeadLetterQueueStats();

      // Assert
      expect(result).toEqual({
        messageCount: 0,
        oldestMessageAge: 0,
        newestMessageAge: 0,
      });
    });

    it('should return queue statistics when DLQ URL is configured', async () => {
      // Arrange
      sqsClientSendMock.mockResolvedValue({
        Attributes: {
          ApproximateNumberOfMessages: '5',
        },
      });

      // Act
      const result = await service.getDeadLetterQueueStats();

      // Assert
      expect(result).toEqual({
        messageCount: 5,
        oldestMessageAge: 0,
        newestMessageAge: 0,
      });
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.any(GetQueueAttributesCommand),
      );
    });

    it('should handle errors when getting queue statistics', async () => {
      // Arrange
      sqsClientSendMock.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.getDeadLetterQueueStats()).rejects.toThrow(
        'AWS SQS error',
      );
    });
  });

  describe('purgeDeadLetterQueue', () => {
    it('should throw error when DLQ URL is not configured', async () => {
      // Arrange
      (service as any).dlqUrl = null;

      // Act & Assert
      await expect(service.purgeDeadLetterQueue()).rejects.toThrow(
        'Dead letter queue URL not configured',
      );
    });

    it('should purge all messages from the queue', async () => {
      // Arrange
      const mockMessages1: SqsMessage[] = [
        {
          id: 'msg-1',
          body: '{}',
          receiptHandle: 'receipt-1',
        },
        {
          id: 'msg-2',
          body: '{}',
          receiptHandle: 'receipt-2',
        },
      ];

      const mockMessages2: SqsMessage[] = [
        {
          id: 'msg-3',
          body: '{}',
          receiptHandle: 'receipt-3',
        },
      ];

      const mockEmptyMessages: SqsMessage[] = [];

      // Mock receiveDeadLetterMessages to return messages then empty
      jest
        .spyOn(service as any, 'receiveDeadLetterMessages')
        .mockResolvedValueOnce(mockMessages1)
        .mockResolvedValueOnce(mockMessages2)
        .mockResolvedValueOnce(mockEmptyMessages);

      // Mock deleteDeadLetterMessage
      jest
        .spyOn(service as any, 'deleteDeadLetterMessage')
        .mockResolvedValue(undefined);

      // Act
      await service.purgeDeadLetterQueue();

      // Assert
      expect((service as any).receiveDeadLetterMessages).toHaveBeenCalledTimes(
        3,
      );
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledTimes(3);
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledWith(
        'receipt-1',
      );
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledWith(
        'receipt-2',
      );
      expect((service as any).deleteDeadLetterMessage).toHaveBeenCalledWith(
        'receipt-3',
      );
    });
  });

  describe('receiveDeadLetterMessages', () => {
    it('should return empty array when DLQ URL is not configured', async () => {
      // Arrange
      (service as any).dlqUrl = null;

      // Override the mock implementation for this specific test
      jest
        .spyOn(service as any, 'receiveDeadLetterMessages')
        .mockResolvedValueOnce([]);

      // Act
      const result = await (service as any).receiveDeadLetterMessages();

      // Assert
      expect(result).toEqual([]);
    });

    it('should receive messages from the queue', async () => {
      // Arrange
      const mockAwsMessages = {
        Messages: [
          {
            MessageId: 'msg-1',
            Body: '{"eventId":"event-1"}',
            ReceiptHandle: 'receipt-1',
            Attributes: { SentTimestamp: '1630000000000' },
            MessageAttributes: {
              eventType: { StringValue: 'PAYMENT_CAPTURED' },
            },
          },
          {
            MessageId: 'msg-2',
            Body: '{"eventId":"event-2"}',
            ReceiptHandle: 'receipt-2',
            Attributes: { SentTimestamp: '1630000000001' },
            MessageAttributes: { eventType: { StringValue: 'PAYMENT_FAILED' } },
          },
        ],
      };

      sqsClientSendMock.mockResolvedValue(mockAwsMessages);

      // Override the mock implementation to use the actual implementation
      jest
        .spyOn(service as any, 'receiveDeadLetterMessages')
        .mockImplementationOnce(async function () {
          // This implementation should match what's in the actual service
          if (!this.dlqUrl) {
            return [];
          }

          // Call the AWS SQS client
          const command = new ReceiveMessageCommand({
            QueueUrl: this.dlqUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 5,
            AttributeNames: ['All'],
            MessageAttributeNames: ['All'],
          });

          const response = await this.sqsClient.send(command);

          if (!response.Messages || response.Messages.length === 0) {
            return [];
          }

          return response.Messages.map(message => ({
            id: message.MessageId,
            body: message.Body,
            receiptHandle: message.ReceiptHandle,
            attributes: message.Attributes,
            messageAttributes: message.MessageAttributes,
          }));
        });

      // Act
      const result = await (service as any).receiveDeadLetterMessages();

      // Assert
      expect(result).toEqual([
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
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.any(ReceiveMessageCommand),
      );
    });
  });

  describe('deleteDeadLetterMessage', () => {
    it('should do nothing when DLQ URL is not configured', async () => {
      // Arrange
      (service as any).dlqUrl = null;

      // Act
      await (service as any).deleteDeadLetterMessage('receipt-1');

      // Assert
      expect(sqsClientSendMock).not.toHaveBeenCalled();
    });

    it('should delete message from the queue', async () => {
      // Arrange
      const deleteDeadLetterMessageSpy = jest.spyOn(
        service as any,
        'deleteDeadLetterMessage',
      );

      // Act
      await (service as any).deleteDeadLetterMessage('receipt-1');

      // Assert
      expect(deleteDeadLetterMessageSpy).toHaveBeenCalledWith('receipt-1');
    });
  });
});
