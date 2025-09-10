import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyService } from '../idempotency.service';
import { WebhookEvent } from '@/database/entities/webhook-event.entity';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let webhookEventRepository: Repository<WebhookEvent>;

  const mockWebhookEventRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: mockWebhookEventRepository,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    webhookEventRepository = module.get<Repository<WebhookEvent>>(
      getRepositoryToken(WebhookEvent),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('generateIdempotencyKey', () => {
    it('should generate a consistent hash for the same inputs', () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };

      // Act
      const key1 = service.generateIdempotencyKey(externalId, eventType, payload);
      const key2 = service.generateIdempotencyKey(externalId, eventType, payload);

      // Assert
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash is 64 hex chars
    });

    it('should generate different hashes for different payloads', () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload1 = { id: 'payment-123', amount: 100 };
      const payload2 = { id: 'payment-123', amount: 200 };

      // Act
      const key1 = service.generateIdempotencyKey(externalId, eventType, payload1);
      const key2 = service.generateIdempotencyKey(externalId, eventType, payload2);

      // Assert
      expect(key1).not.toBe(key2);
    });

    it('should generate different hashes for different event types', () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType1 = 'PAYMENT_CAPTURED';
      const eventType2 = 'PAYMENT_FAILED';
      const payload = { id: 'payment-123', amount: 100 };

      // Act
      const key1 = service.generateIdempotencyKey(externalId, eventType1, payload);
      const key2 = service.generateIdempotencyKey(externalId, eventType2, payload);

      // Assert
      expect(key1).not.toBe(key2);
    });

    it('should generate different hashes for different external IDs', () => {
      // Arrange
      const externalId1 = 'ext-123';
      const externalId2 = 'ext-456';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };

      // Act
      const key1 = service.generateIdempotencyKey(externalId1, eventType, payload);
      const key2 = service.generateIdempotencyKey(externalId2, eventType, payload);

      // Assert
      expect(key1).not.toBe(key2);
    });
  });

  describe('checkWebhookIdempotency', () => {
    it('should return idempotent result when webhook with external ID exists', async () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };
      
      const existingEvent = {
        id: 'event-123',
        externalId,
        status: 'PROCESSED',
      };
      
      mockWebhookEventRepository.findOne.mockResolvedValue(existingEvent);

      // Act
      const result = await service.checkWebhookIdempotency(externalId, eventType, payload);

      // Assert
      expect(result).toEqual({
        isIdempotent: true,
        existingResult: existingEvent,
        shouldProcess: false,
      });
      expect(mockWebhookEventRepository.findOne).toHaveBeenCalledWith({
        where: { externalId },
      });
    });

    it('should return idempotent result when webhook is found in cache', async () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };
      
      mockWebhookEventRepository.findOne.mockResolvedValue(null);
      
      // Add item to cache
      const idempotencyKey = service.generateIdempotencyKey(externalId, eventType, payload);
      const cachedResult = { id: 'event-123', status: 'PROCESSED' };
      
      (service as any).idempotencyCache.set(idempotencyKey, {
        result: cachedResult,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour in the future
      });

      // Act
      const result = await service.checkWebhookIdempotency(externalId, eventType, payload);

      // Assert
      expect(result).toEqual({
        isIdempotent: true,
        existingResult: cachedResult,
        shouldProcess: false,
      });
    });

    it('should return non-idempotent result when webhook is not found', async () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };
      
      mockWebhookEventRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.checkWebhookIdempotency(externalId, eventType, payload);

      // Assert
      expect(result).toEqual({
        isIdempotent: false,
        shouldProcess: true,
      });
    });

    it('should return non-idempotent result when error occurs', async () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };
      
      mockWebhookEventRepository.findOne.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.checkWebhookIdempotency(externalId, eventType, payload);

      // Assert
      expect(result).toEqual({
        isIdempotent: false,
        shouldProcess: true,
      });
    });
  });

  describe('storeProcessingResult', () => {
    it('should store result in cache with correct expiry', async () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };
      const result = { id: 'event-123', status: 'PROCESSED' };
      const ttlMinutes = 30;
      
      const now = new Date(2023, 0, 1, 12, 0, 0); // 2023-01-01 12:00:00
      jest.setSystemTime(now);
      
      // Spy on cache set
      const cacheSpy = jest.spyOn((service as any).idempotencyCache, 'set');

      // Act
      await service.storeProcessingResult(externalId, eventType, payload, result, ttlMinutes);

      // Assert
      const idempotencyKey = service.generateIdempotencyKey(externalId, eventType, payload);
      expect(cacheSpy).toHaveBeenCalledWith(
        idempotencyKey,
        {
          result,
          expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        }
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const externalId = 'ext-123';
      const eventType = 'PAYMENT_CAPTURED';
      const payload = { id: 'payment-123', amount: 100 };
      const result = { id: 'event-123', status: 'PROCESSED' };
      
      // Force an error by making the cache.set throw
      jest.spyOn((service as any).idempotencyCache, 'set').mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      // Spy on logger
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // Act & Assert - should not throw
      await expect(service.storeProcessingResult(externalId, eventType, payload, result)).resolves.not.toThrow();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('checkSqsMessageIdempotency', () => {
    it('should return idempotent result when SQS message is found in cache', async () => {
      // Arrange
      const messageId = 'msg-123';
      const eventId = 'event-123';
      const cachedResult = { processedAt: new Date() };
      
      const cacheKey = `sqs_message_${messageId}`;
      (service as any).idempotencyCache.set(cacheKey, {
        result: cachedResult,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour in the future
      });

      // Act
      const result = await service.checkSqsMessageIdempotency(messageId, eventId);

      // Assert
      expect(result).toEqual({
        isIdempotent: true,
        existingResult: cachedResult,
        shouldProcess: false,
      });
    });

    it('should return non-idempotent result when SQS message is not found in cache', async () => {
      // Arrange
      const messageId = 'msg-123';
      const eventId = 'event-123';

      // Act
      const result = await service.checkSqsMessageIdempotency(messageId, eventId);

      // Assert
      expect(result).toEqual({
        isIdempotent: false,
        shouldProcess: true,
      });
    });

    it('should return non-idempotent result when error occurs', async () => {
      // Arrange
      const messageId = 'msg-123';
      const eventId = 'event-123';
      
      // Force an error
      jest.spyOn(service as any, 'getCachedResult').mockImplementation(() => {
        throw new Error('Cache error');
      });

      // Act
      const result = await service.checkSqsMessageIdempotency(messageId, eventId);

      // Assert
      expect(result).toEqual({
        isIdempotent: false,
        shouldProcess: true,
      });
    });
  });

  describe('markSqsMessageProcessed', () => {
    it('should store SQS message processing result in cache', async () => {
      // Arrange
      const messageId = 'msg-123';
      const eventId = 'event-123';
      const result = { status: 'success' };
      const ttlMinutes = 30;
      
      const now = new Date(2023, 0, 1, 12, 0, 0); // 2023-01-01 12:00:00
      jest.setSystemTime(now);
      
      // Spy on cache set
      const cacheSpy = jest.spyOn((service as any).idempotencyCache, 'set');

      // Act
      await service.markSqsMessageProcessed(messageId, eventId, result, ttlMinutes);

      // Assert
      const cacheKey = `sqs_message_${messageId}`;
      expect(cacheSpy).toHaveBeenCalledWith(
        cacheKey,
        {
          result: {
            eventId,
            result,
            processedAt: expect.any(Date),
          },
          expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        }
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const messageId = 'msg-123';
      const eventId = 'event-123';
      const result = { status: 'success' };
      
      // Force an error by making the cache.set throw
      jest.spyOn((service as any).idempotencyCache, 'set').mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      // Spy on logger
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // Act & Assert - should not throw
      await expect(service.markSqsMessageProcessed(messageId, eventId, result)).resolves.not.toThrow();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('hashPayload', () => {
    it('should create consistent hash for the same payload', () => {
      // Arrange
      const payload = { id: 'payment-123', amount: 100 };
      
      // Act
      const hash1 = (service as any).hashPayload(payload);
      const hash2 = (service as any).hashPayload(payload);

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash is 64 hex chars
    });

    it('should create same hash regardless of property order', () => {
      // Arrange
      const payload1 = { id: 'payment-123', amount: 100 };
      const payload2 = { amount: 100, id: 'payment-123' };
      
      // Act
      const hash1 = (service as any).hashPayload(payload1);
      const hash2 = (service as any).hashPayload(payload2);

      // Assert
      expect(hash1).toBe(hash2);
    });

    it('should handle nested objects and arrays', () => {
      // Arrange
      const payload = { 
        id: 'payment-123', 
        amount: 100,
        customer: {
          id: 'cust-123',
          details: {
            name: 'John Doe'
          }
        },
        items: [
          { id: 'item-1', price: 50 },
          { id: 'item-2', price: 50 }
        ]
      };
      
      // Act
      const hash = (service as any).hashPayload(payload);

      // Assert
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should use fallback when error occurs', () => {
      // Arrange
      const payload = { id: 'payment-123', amount: 100 };
      
      // Force an error in sortObjectKeys
      jest.spyOn(service as any, 'sortObjectKeys').mockImplementation(() => {
        throw new Error('Sort error');
      });
      
      // Spy on logger
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      // Act
      const hash = (service as any).hashPayload(payload);

      // Assert
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('sortObjectKeys', () => {
    it('should return primitive values as is', () => {
      // Arrange & Act & Assert
      expect((service as any).sortObjectKeys(123)).toBe(123);
      expect((service as any).sortObjectKeys('string')).toBe('string');
      expect((service as any).sortObjectKeys(true)).toBe(true);
      expect((service as any).sortObjectKeys(null)).toBe(null);
      expect((service as any).sortObjectKeys(undefined)).toBe(undefined);
    });

    it('should sort object keys alphabetically', () => {
      // Arrange
      const obj = { c: 1, a: 2, b: 3 };
      
      // Act
      const sorted = (service as any).sortObjectKeys(obj);

      // Assert
      const keys = Object.keys(sorted);
      expect(keys).toEqual(['a', 'b', 'c']);
    });

    it('should handle nested objects', () => {
      // Arrange
      const obj = { 
        c: 1, 
        a: { z: 1, y: 2, x: 3 }, 
        b: 3 
      };
      
      // Act
      const sorted = (service as any).sortObjectKeys(obj);

      // Assert
      expect(Object.keys(sorted)).toEqual(['a', 'b', 'c']);
      expect(Object.keys(sorted.a)).toEqual(['x', 'y', 'z']);
    });

    it('should handle arrays', () => {
      // Arrange
      const obj = { 
        items: [
          { c: 1, a: 2, b: 3 },
          { z: 1, x: 2, y: 3 }
        ]
      };
      
      // Act
      const sorted = (service as any).sortObjectKeys(obj);

      // Assert
      expect(Object.keys(sorted.items[0])).toEqual(['a', 'b', 'c']);
      expect(Object.keys(sorted.items[1])).toEqual(['x', 'y', 'z']);
    });
  });

  describe('getCachedResult', () => {
    it('should return null when key is not in cache', () => {
      // Arrange
      const key = 'non-existent-key';
      
      // Act
      const result = (service as any).getCachedResult(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should return cached result when not expired', () => {
      // Arrange
      const key = 'test-key';
      const cachedValue = { result: 'test-result', expiresAt: new Date(Date.now() + 3600000) };
      (service as any).idempotencyCache.set(key, cachedValue);
      
      // Act
      const result = (service as any).getCachedResult(key);

      // Assert
      expect(result).toBe('test-result');
    });

    it('should return null and delete key when expired', () => {
      // Arrange
      const key = 'expired-key';
      const cachedValue = { result: 'test-result', expiresAt: new Date(Date.now() - 3600000) };
      (service as any).idempotencyCache.set(key, cachedValue);
      
      // Spy on delete
      const deleteSpy = jest.spyOn((service as any).idempotencyCache, 'delete');
      
      // Act
      const result = (service as any).getCachedResult(key);

      // Assert
      expect(result).toBeNull();
      expect(deleteSpy).toHaveBeenCalledWith(key);
    });
  });

  describe('cleanupExpiredCacheEntries', () => {
    it('should remove expired entries from cache', () => {
      // Arrange
      const now = new Date(2023, 0, 1, 12, 0, 0);
      jest.setSystemTime(now);
      
      // Add some expired and non-expired entries
      (service as any).idempotencyCache.set('expired-1', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() - 3600000) 
      });
      (service as any).idempotencyCache.set('expired-2', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() - 1800000) 
      });
      (service as any).idempotencyCache.set('valid-1', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() + 3600000) 
      });
      
      // Spy on delete
      const deleteSpy = jest.spyOn((service as any).idempotencyCache, 'delete');
      
      // Act
      (service as any).cleanupExpiredCacheEntries();

      // Assert
      expect(deleteSpy).toHaveBeenCalledTimes(2);
      expect(deleteSpy).toHaveBeenCalledWith('expired-1');
      expect(deleteSpy).toHaveBeenCalledWith('expired-2');
      expect((service as any).idempotencyCache.size).toBe(1);
      expect((service as any).idempotencyCache.has('valid-1')).toBe(true);
    });

    it('should log cleanup results when entries are removed', () => {
      // Arrange
      const now = new Date(2023, 0, 1, 12, 0, 0);
      jest.setSystemTime(now);
      
      // Add some expired entries
      (service as any).idempotencyCache.set('expired-1', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() - 3600000) 
      });
      
      // Spy on logger
      const loggerSpy = jest.spyOn((service as any).logger, 'debug');
      
      // Act
      (service as any).cleanupExpiredCacheEntries();

      // Assert
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should not log when no entries are removed', () => {
      // Arrange
      const now = new Date(2023, 0, 1, 12, 0, 0);
      jest.setSystemTime(now);
      
      // Add only valid entries
      (service as any).idempotencyCache.set('valid-1', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() + 3600000) 
      });
      
      // Spy on logger
      const loggerSpy = jest.spyOn((service as any).logger, 'debug');
      
      // Act
      (service as any).cleanupExpiredCacheEntries();

      // Assert
      expect(loggerSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', () => {
      // Arrange
      const now = new Date(2023, 0, 1, 12, 0, 0);
      jest.setSystemTime(now);
      
      // Add some expired and non-expired entries
      (service as any).idempotencyCache.set('expired-1', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() - 3600000) 
      });
      (service as any).idempotencyCache.set('valid-1', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() + 3600000) 
      });
      (service as any).idempotencyCache.set('valid-2', { 
        result: 'test', 
        expiresAt: new Date(now.getTime() + 7200000) 
      });
      
      // Act
      const stats = service.getCacheStats();

      // Assert
      expect(stats).toEqual({
        totalEntries: 3,
        expiredEntries: 1,
        memoryUsageEstimate: 3 * 200, // 3 entries * 200 bytes
      });
    });
  });

  describe('clearCache', () => {
    it('should clear all entries from cache', () => {
      // Arrange
      (service as any).idempotencyCache.set('key-1', { result: 'test', expiresAt: new Date() });
      (service as any).idempotencyCache.set('key-2', { result: 'test', expiresAt: new Date() });
      
      // Spy on clear
      const clearSpy = jest.spyOn((service as any).idempotencyCache, 'clear');
      
      // Spy on logger
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');
      
      // Act
      service.clearCache();

      // Assert
      expect(clearSpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Idempotency cache cleared', {
        previousSize: 2,
      });
      expect((service as any).idempotencyCache.size).toBe(0);
    });
  });
});
