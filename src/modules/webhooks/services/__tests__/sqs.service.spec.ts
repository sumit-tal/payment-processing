import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SqsService, SqsMessage, SqsMessagePayload } from '../sqs.service';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sqs', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-sqs');
  return {
    ...originalModule,
    SQSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

describe('SqsService', () => {
  let service: SqsService;
  let configService: ConfigService;
  let sqsClientSendMock: jest.Mock;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Set up configuration before creating the service
    mockConfigService.get.mockImplementation((key, defaultValue) => {
      const config = {
        'AWS_REGION': 'us-east-1',
        'AWS_ACCESS_KEY_ID': 'test-access-key',
        'AWS_SECRET_ACCESS_KEY': 'test-secret-key',
        'SQS_WEBHOOK_QUEUE_URL': 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
        'SQS_WEBHOOK_DLQ_URL': 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-dlq',
        'SQS_VISIBILITY_TIMEOUT': 300,
        'SQS_MAX_RECEIVE_COUNT': 3,
      };
      return config[key] || defaultValue;
    });
    
    sqsClientSendMock = jest.fn();
    
    // Reset the mock implementation
    (SQSClient as jest.Mock).mockImplementation(() => ({
      send: sqsClientSendMock,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SqsService>(SqsService);
    configService = module.get<ConfigService>(ConfigService);

    // Configuration is now set in beforeEach
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with AWS credentials when provided', () => {
      // We need to create a new instance to test the constructor
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        const config = {
          'AWS_REGION': 'us-east-1',
          'AWS_ACCESS_KEY_ID': 'test-access-key',
          'AWS_SECRET_ACCESS_KEY': 'test-secret-key',
          'SQS_WEBHOOK_QUEUE_URL': 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
        };
        return config[key] || defaultValue;
      });
      
      // Reset mock to track new calls
      (SQSClient as jest.Mock).mockClear();
      
      // Create a new instance - cast mockConfigService to any to avoid TypeScript errors
      const newService = new SqsService(mockConfigService as any);
      
      // Assert
      expect(SQSClient).toHaveBeenCalledWith(expect.objectContaining({
        region: 'us-east-1',
        credentials: expect.objectContaining({
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        }),
      }));
    });

    it('should initialize without AWS credentials when not provided', () => {
      // Arrange
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        const config = {
          'AWS_REGION': 'us-east-1',
          'SQS_WEBHOOK_QUEUE_URL': 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
        };
        return config[key] || defaultValue;
      });
      
      // Reset mock to track new calls
      (SQSClient as jest.Mock).mockClear();
      
      // Create a new instance - cast mockConfigService to any to avoid TypeScript errors
      const newService = new SqsService(mockConfigService as any);
      
      // Assert
      expect(SQSClient).toHaveBeenCalledWith(expect.objectContaining({
        region: 'us-east-1',
        credentials: undefined,
      }));
    });

    it('should throw error when queue URL is not configured', () => {
      // Arrange
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        const config = {
          'AWS_REGION': 'us-east-1',
          // No SQS_WEBHOOK_QUEUE_URL
        };
        return config[key] || defaultValue;
      });

      // Act & Assert
      expect(() => {
        new SqsService(mockConfigService as any);
      }).toThrow('SQS_WEBHOOK_QUEUE_URL must be configured');
    });
  });

  describe('onModuleInit', () => {
    it('should validate queue configuration successfully', async () => {
      // Arrange
      const sqsClient = (service as any).sqsClient;
      sqsClient.send.mockResolvedValue({
        Attributes: {
          QueueArn: 'arn:aws:sqs:us-east-1:123456789012:webhook-queue',
          VisibilityTimeout: '300',
        },
      });

      // Act
      await service.onModuleInit();

      // Assert
      expect(sqsClient.send).toHaveBeenCalledWith(
        expect.any(GetQueueAttributesCommand)
      );
    });

    it('should throw error when queue validation fails', async () => {
      // Arrange
      const sqsClient = (service as any).sqsClient;
      sqsClient.send.mockResolvedValue({
        Attributes: {}, // Missing QueueArn
      });

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('Unable to access webhook queue');
    });

    it('should throw error when AWS API call fails', async () => {
      // Arrange
      const sqsClient = (service as any).sqsClient;
      sqsClient.send.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('AWS SQS error');
    });
  });

  describe('sendWebhookEvent', () => {
    it('should send webhook event to SQS successfully', async () => {
      // Arrange
      const payload: SqsMessagePayload = {
        eventId: 'event-123',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-123', amount: 100 },
        timestamp: '2023-09-06T14:30:00Z',
      };

      sqsClientSendMock.mockResolvedValue({
        MessageId: 'msg-123',
      });

      // Act
      const result = await service.sendWebhookEvent(payload);

      // Assert
      expect(result).toBe('msg-123');
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
            MessageBody: JSON.stringify(payload),
            MessageAttributes: {
              eventType: {
                DataType: 'String',
                StringValue: 'PAYMENT_CAPTURED',
              },
              eventId: {
                DataType: 'String',
                StringValue: 'event-123',
              },
              timestamp: {
                DataType: 'String',
                StringValue: '2023-09-06T14:30:00Z',
              },
            },
            DelaySeconds: 0,
          },
        })
      );
    });

    it('should include retry count when provided', async () => {
      // Arrange
      const payload: SqsMessagePayload = {
        eventId: 'event-123',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-123', amount: 100 },
        timestamp: '2023-09-06T14:30:00Z',
        retryCount: 2,
      };

      sqsClientSendMock.mockResolvedValue({
        MessageId: 'msg-123',
      });

      // Act
      await service.sendWebhookEvent(payload);

      // Assert
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MessageAttributes: expect.objectContaining({
              retryCount: {
                DataType: 'Number',
                StringValue: '2',
              },
            }),
            DelaySeconds: 240, // 2^2 * 60 = 240
          }),
        })
      );
    });

    it('should handle AWS API errors', async () => {
      // Arrange
      const payload: SqsMessagePayload = {
        eventId: 'event-123',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-123', amount: 100 },
        timestamp: '2023-09-06T14:30:00Z',
      };

      sqsClientSendMock.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.sendWebhookEvent(payload)).rejects.toThrow('AWS SQS error');
    });
  });

  describe('sendWebhookEventsBatch', () => {
    it('should send webhook events batch to SQS successfully', async () => {
      // Arrange
      const payloads: SqsMessagePayload[] = [
        {
          eventId: 'event-123',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-123', amount: 100 },
          timestamp: '2023-09-06T14:30:00Z',
        },
        {
          eventId: 'event-456',
          eventType: 'PAYMENT_FAILED',
          payload: { id: 'payment-456', amount: 200 },
          timestamp: '2023-09-06T14:35:00Z',
        },
      ];

      sqsClientSendMock.mockResolvedValue({
        Successful: [
          { Id: 'msg-0', MessageId: 'msg-123' },
          { Id: 'msg-1', MessageId: 'msg-456' },
        ],
        Failed: [],
      });

      // Act
      const result = await service.sendWebhookEventsBatch(payloads);

      // Assert
      expect(result).toEqual(['msg-123', 'msg-456']);
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
            Entries: [
              {
                Id: 'msg-0',
                MessageBody: JSON.stringify(payloads[0]),
                MessageAttributes: {
                  eventType: {
                    DataType: 'String',
                    StringValue: 'PAYMENT_CAPTURED',
                  },
                  eventId: {
                    DataType: 'String',
                    StringValue: 'event-123',
                  },
                  timestamp: {
                    DataType: 'String',
                    StringValue: '2023-09-06T14:30:00Z',
                  },
                },
                DelaySeconds: 0,
              },
              {
                Id: 'msg-1',
                MessageBody: JSON.stringify(payloads[1]),
                MessageAttributes: {
                  eventType: {
                    DataType: 'String',
                    StringValue: 'PAYMENT_FAILED',
                  },
                  eventId: {
                    DataType: 'String',
                    StringValue: 'event-456',
                  },
                  timestamp: {
                    DataType: 'String',
                    StringValue: '2023-09-06T14:35:00Z',
                  },
                },
                DelaySeconds: 0,
              },
            ],
          },
        })
      );
    });

    it('should handle partial failures in batch send', async () => {
      // Arrange
      const payloads: SqsMessagePayload[] = [
        {
          eventId: 'event-123',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-123', amount: 100 },
          timestamp: '2023-09-06T14:30:00Z',
        },
        {
          eventId: 'event-456',
          eventType: 'PAYMENT_FAILED',
          payload: { id: 'payment-456', amount: 200 },
          timestamp: '2023-09-06T14:35:00Z',
        },
      ];

      sqsClientSendMock.mockResolvedValue({
        Successful: [
          { Id: 'msg-0', MessageId: 'msg-123' },
        ],
        Failed: [
          { Id: 'msg-1', Code: 'InternalError', Message: 'Internal Error' },
        ],
      });

      // Act
      const result = await service.sendWebhookEventsBatch(payloads);

      // Assert
      expect(result).toEqual(['msg-123']);
    });

    it('should handle AWS API errors', async () => {
      // Arrange
      const payloads: SqsMessagePayload[] = [
        {
          eventId: 'event-123',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-123', amount: 100 },
          timestamp: '2023-09-06T14:30:00Z',
        },
      ];

      sqsClientSendMock.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.sendWebhookEventsBatch(payloads)).rejects.toThrow('AWS SQS error');
    });
  });

  describe('receiveWebhookEvents', () => {
    it('should receive webhook events from SQS successfully', async () => {
      // Arrange
      const mockAwsMessages = {
        Messages: [
          {
            MessageId: 'msg-123',
            Body: '{"eventId":"event-123"}',
            ReceiptHandle: 'receipt-123',
            Attributes: { SentTimestamp: '1630000000000' },
            MessageAttributes: { eventType: { StringValue: 'PAYMENT_CAPTURED' } },
          },
          {
            MessageId: 'msg-456',
            Body: '{"eventId":"event-456"}',
            ReceiptHandle: 'receipt-456',
            Attributes: { SentTimestamp: '1630000000001' },
            MessageAttributes: { eventType: { StringValue: 'PAYMENT_FAILED' } },
          },
        ],
      };

      sqsClientSendMock.mockResolvedValue(mockAwsMessages);

      // Act
      const result = await service.receiveWebhookEvents();

      // Assert
      expect(result).toEqual([
        {
          id: 'msg-123',
          body: '{"eventId":"event-123"}',
          receiptHandle: 'receipt-123',
          attributes: { SentTimestamp: '1630000000000' },
          messageAttributes: { eventType: { StringValue: 'PAYMENT_CAPTURED' } },
        },
        {
          id: 'msg-456',
          body: '{"eventId":"event-456"}',
          receiptHandle: 'receipt-456',
          attributes: { SentTimestamp: '1630000000001' },
          messageAttributes: { eventType: { StringValue: 'PAYMENT_FAILED' } },
        },
      ]);
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 300,
            MessageAttributeNames: ['All'],
            AttributeNames: ['All'],
          },
        })
      );
    });

    it('should respect maxMessages parameter', async () => {
      // Arrange
      sqsClientSendMock.mockResolvedValue({ Messages: [] });

      // Act
      await service.receiveWebhookEvents(5);

      // Assert
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MaxNumberOfMessages: 5,
          }),
        })
      );
    });

    it('should handle empty response', async () => {
      // Arrange
      sqsClientSendMock.mockResolvedValue({});

      // Act
      const result = await service.receiveWebhookEvents();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle AWS API errors', async () => {
      // Arrange
      sqsClientSendMock.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.receiveWebhookEvents()).rejects.toThrow('AWS SQS error');
    });
  });

  describe('deleteMessage', () => {
    it('should delete message from SQS successfully', async () => {
      // Arrange
      const receiptHandle = 'receipt-123';
      sqsClientSendMock.mockResolvedValue({});

      // Act
      await service.deleteMessage(receiptHandle);

      // Assert
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
            ReceiptHandle: receiptHandle,
          },
        })
      );
    });

    it('should handle AWS API errors', async () => {
      // Arrange
      const receiptHandle = 'receipt-123';
      sqsClientSendMock.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.deleteMessage(receiptHandle)).rejects.toThrow('AWS SQS error');
    });
  });

  describe('getQueueStats', () => {
    it('should get queue statistics successfully', async () => {
      // Arrange
      sqsClientSendMock.mockResolvedValue({
        Attributes: {
          ApproximateNumberOfMessages: '5',
          ApproximateNumberOfMessagesNotVisible: '2',
          ApproximateNumberOfMessagesDelayed: '1',
        },
      });

      // Act
      const result = await service.getQueueStats();

      // Assert
      expect(result).toEqual({
        approximateNumberOfMessages: 5,
        approximateNumberOfMessagesNotVisible: 2,
        approximateNumberOfMessagesDelayed: 1,
      });
      expect(sqsClientSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/webhook-queue',
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible',
              'ApproximateNumberOfMessagesDelayed',
            ],
          },
        })
      );
    });

    it('should handle empty attributes', async () => {
      // Arrange
      sqsClientSendMock.mockResolvedValue({});

      // Act
      const result = await service.getQueueStats();

      // Assert
      expect(result).toEqual({
        approximateNumberOfMessages: 0,
        approximateNumberOfMessagesNotVisible: 0,
        approximateNumberOfMessagesDelayed: 0,
      });
    });

    it('should handle AWS API errors', async () => {
      // Arrange
      sqsClientSendMock.mockRejectedValue(new Error('AWS SQS error'));

      // Act & Assert
      await expect(service.getQueueStats()).rejects.toThrow('AWS SQS error');
    });
  });

  describe('parseMessagePayload', () => {
    it('should parse valid message payload', () => {
      // Arrange
      const message: SqsMessage = {
        id: 'msg-123',
        body: JSON.stringify({
          eventId: 'event-123',
          eventType: 'PAYMENT_CAPTURED',
          payload: { id: 'payment-123' },
          timestamp: '2023-09-06T14:30:00Z',
        }),
        receiptHandle: 'receipt-123',
      };

      // Act
      const result = service.parseMessagePayload(message);

      // Assert
      expect(result).toEqual({
        eventId: 'event-123',
        eventType: 'PAYMENT_CAPTURED',
        payload: { id: 'payment-123' },
        timestamp: '2023-09-06T14:30:00Z',
      });
    });

    it('should throw error for invalid JSON', () => {
      // Arrange
      const message: SqsMessage = {
        id: 'msg-123',
        body: 'invalid-json',
        receiptHandle: 'receipt-123',
      };
      
      // Mock console.error to prevent test output pollution
      const originalError = console.error;
      console.error = jest.fn();
      
      try {
        // Act & Assert
        expect(() => service.parseMessagePayload(message)).toThrow('Invalid message payload format');
      } finally {
        // Restore console.error
        console.error = originalError;
      }
    });
  });

  describe('calculateDelaySeconds', () => {
    it('should return 0 for first attempt', () => {
      // Act
      const result = (service as any).calculateDelaySeconds(0);

      // Assert
      expect(result).toBe(0);
    });

    it('should calculate exponential backoff for retries', () => {
      // Act & Assert
      expect((service as any).calculateDelaySeconds(1)).toBe(120); // 2^1 * 60 = 120
      expect((service as any).calculateDelaySeconds(2)).toBe(240); // 2^2 * 60 = 240
      expect((service as any).calculateDelaySeconds(3)).toBe(480); // 2^3 * 60 = 480
    });

    it('should cap delay at 15 minutes', () => {
      // Act
      const result = (service as any).calculateDelaySeconds(5);

      // Assert
      expect(result).toBe(900); // 15 minutes in seconds (max)
    });
  });
});
