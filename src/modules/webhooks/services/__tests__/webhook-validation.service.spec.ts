import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookValidationService } from '../webhook-validation.service';

describe('WebhookValidationService', () => {
  let service: WebhookValidationService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookValidationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WebhookValidationService>(WebhookValidationService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        WEBHOOK_SECRET_KEY: 'test-secret-key',
        WEBHOOK_SIGNATURE_HEADER: 'X-ANET-Signature',
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAuthorizeNetSignature', () => {
    it('should validate correct signature', () => {
      // Arrange
      const payload = '{"test":"data"}';
      const signature = 'sha512=valid-signature';
      
      // Mock the signature generation to return expected value
      jest.spyOn(service as any, 'generateHmacSignature').mockReturnValue('valid-signature');

      // Act
      const result = service.validateAuthorizeNetSignature(payload, signature);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      // Arrange
      const payload = '{"test":"data"}';
      const signature = 'sha512=invalid-signature';
      
      jest.spyOn(service as any, 'generateHmacSignature').mockReturnValue('valid-signature');

      // Act
      const result = service.validateAuthorizeNetSignature(payload, signature);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Invalid webhook signature');
    });

    it('should reject missing signature', () => {
      // Arrange
      const payload = '{"test":"data"}';
      const signature = '';

      // Act
      const result = service.validateAuthorizeNetSignature(payload, signature);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Missing webhook signature');
    });
  });

  describe('validateAuthorizeNetPayload', () => {
    it('should validate correct payload structure', () => {
      // Arrange
      const payload = {
        notificationId: '12345678-1234-1234-1234-123456789012',
        eventType: 'net.authorize.payment.authcapture.created',
        eventDate: '2023-09-06T14:30:00Z',
        webhookId: 'webhook123',
      };

      // Act
      const result = service.validateAuthorizeNetPayload(payload);

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should reject payload with missing required fields', () => {
      // Arrange
      const payload = {
        notificationId: '12345678-1234-1234-1234-123456789012',
        // Missing eventType, eventDate, webhookId
      };

      // Act
      const result = service.validateAuthorizeNetPayload(payload);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Missing required fields');
    });

    it('should reject invalid event type format', () => {
      // Arrange
      const payload = {
        notificationId: '12345678-1234-1234-1234-123456789012',
        eventType: 'invalid-event-type',
        eventDate: '2023-09-06T14:30:00Z',
        webhookId: 'webhook123',
      };

      // Act
      const result = service.validateAuthorizeNetPayload(payload);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Invalid event type format');
    });

    it('should reject invalid notification ID format', () => {
      // Arrange
      const payload = {
        notificationId: 'invalid-uuid',
        eventType: 'net.authorize.payment.authcapture.created',
        eventDate: '2023-09-06T14:30:00Z',
        webhookId: 'webhook123',
      };

      // Act
      const result = service.validateAuthorizeNetPayload(payload);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Invalid notification ID format');
    });
  });

  describe('validateTimestamp', () => {
    it('should validate recent timestamp', () => {
      // Arrange
      const recentTimestamp = new Date().toISOString();

      // Act
      const result = service.validateTimestamp(recentTimestamp);

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should reject old timestamp', () => {
      // Arrange
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

      // Act
      const result = service.validateTimestamp(oldTimestamp, 5); // 5 minute tolerance

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('timestamp is too old');
    });

    it('should reject invalid timestamp format', () => {
      // Arrange
      const invalidTimestamp = 'invalid-date';

      // Act
      const result = service.validateTimestamp(invalidTimestamp);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Invalid timestamp format');
    });
  });

  describe('validateWebhook', () => {
    it('should validate complete webhook successfully', async () => {
      // Arrange
      const payload = '{"notificationId":"12345678-1234-1234-1234-123456789012","eventType":"net.authorize.payment.authcapture.created","eventDate":"' + new Date().toISOString() + '","webhookId":"webhook123"}';
      const headers = {
        'x-anet-signature': 'sha512=valid-signature',
        'content-type': 'application/json',
      };
      const parsedPayload = JSON.parse(payload);

      jest.spyOn(service as any, 'generateHmacSignature').mockReturnValue('valid-signature');

      // Act
      const result = await service.validateWebhook(payload, headers, parsedPayload);

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      // Arrange
      const payload = '{"notificationId":"12345678-1234-1234-1234-123456789012","eventType":"net.authorize.payment.authcapture.created","eventDate":"' + new Date().toISOString() + '","webhookId":"webhook123"}';
      const headers = {
        'x-anet-signature': 'sha512=invalid-signature',
        'content-type': 'application/json',
      };
      const parsedPayload = JSON.parse(payload);

      jest.spyOn(service as any, 'generateHmacSignature').mockReturnValue('valid-signature');

      // Act
      const result = await service.validateWebhook(payload, headers, parsedPayload);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Invalid webhook signature');
    });
  });

  describe('extractWebhookHeaders', () => {
    it('should extract webhook headers correctly', () => {
      // Arrange
      const headers = {
        'x-anet-signature': 'sha512=signature',
        'content-type': 'application/json',
        'user-agent': 'Authorize.Net Webhooks',
      };

      // Act
      const result = service.extractWebhookHeaders(headers);

      // Assert
      expect(result).toEqual({
        signature: 'sha512=signature',
        contentType: 'application/json',
        userAgent: 'Authorize.Net Webhooks',
      });
    });

    it('should handle missing headers gracefully', () => {
      // Arrange
      const headers = {};

      // Act
      const result = service.extractWebhookHeaders(headers);

      // Assert
      expect(result).toEqual({
        signature: undefined,
        contentType: undefined,
        userAgent: undefined,
      });
    });
  });
});
