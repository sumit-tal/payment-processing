import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from '../entities/webhook-event.entity';
import * as crypto from 'crypto';

export interface IdempotencyKey {
  readonly key: string;
  readonly expiresAt: Date;
}

export interface IdempotencyResult<T = any> {
  readonly isIdempotent: boolean;
  readonly existingResult?: T;
  readonly shouldProcess: boolean;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly idempotencyCache = new Map<string, {
    result: any;
    expiresAt: Date;
  }>();

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
  ) {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredCacheEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate idempotency key from webhook payload
   */
  generateIdempotencyKey(
    externalId: string,
    eventType: string,
    payload: Record<string, any>,
  ): string {
    const data = {
      externalId,
      eventType,
      // Include relevant payload fields for uniqueness
      payloadHash: this.hashPayload(payload),
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Check if webhook event is idempotent (already processed)
   */
  async checkWebhookIdempotency(
    externalId: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<IdempotencyResult<WebhookEvent>> {
    try {
      // First check by external ID (primary idempotency mechanism)
      const existingEvent = await this.webhookEventRepository.findOne({
        where: { externalId },
      });

      if (existingEvent) {
        this.logger.log('Webhook event already exists (idempotent)', {
          eventId: existingEvent.id,
          externalId,
          status: existingEvent.status,
        });

        return {
          isIdempotent: true,
          existingResult: existingEvent,
          shouldProcess: false,
        };
      }

      // Secondary check using content-based idempotency key
      const idempotencyKey = this.generateIdempotencyKey(externalId, eventType, payload);
      const cachedResult = this.getCachedResult(idempotencyKey);

      if (cachedResult) {
        this.logger.log('Webhook event found in idempotency cache', {
          idempotencyKey: idempotencyKey.substring(0, 16) + '...',
          externalId,
        });

        return {
          isIdempotent: true,
          existingResult: cachedResult,
          shouldProcess: false,
        };
      }

      return {
        isIdempotent: false,
        shouldProcess: true,
      };

    } catch (error) {
      this.logger.error('Error checking webhook idempotency', {
        error: error.message,
        externalId,
        eventType,
        stack: error.stack,
      });

      // On error, allow processing to continue (fail open)
      return {
        isIdempotent: false,
        shouldProcess: true,
      };
    }
  }

  /**
   * Store processing result for idempotency
   */
  async storeProcessingResult(
    externalId: string,
    eventType: string,
    payload: Record<string, any>,
    result: any,
    ttlMinutes: number = 60,
  ): Promise<void> {
    try {
      const idempotencyKey = this.generateIdempotencyKey(externalId, eventType, payload);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      this.idempotencyCache.set(idempotencyKey, {
        result,
        expiresAt,
      });

      this.logger.debug('Processing result stored for idempotency', {
        idempotencyKey: idempotencyKey.substring(0, 16) + '...',
        externalId,
        ttlMinutes,
      });

    } catch (error) {
      this.logger.error('Error storing processing result for idempotency', {
        error: error.message,
        externalId,
        eventType,
        stack: error.stack,
      });
    }
  }

  /**
   * Check if SQS message is duplicate
   */
  async checkSqsMessageIdempotency(
    messageId: string,
    eventId: string,
  ): Promise<IdempotencyResult> {
    try {
      // Check if we've already processed this SQS message
      const cacheKey = `sqs_message_${messageId}`;
      const cachedResult = this.getCachedResult(cacheKey);

      if (cachedResult) {
        this.logger.log('SQS message already processed (idempotent)', {
          messageId,
          eventId,
        });

        return {
          isIdempotent: true,
          existingResult: cachedResult,
          shouldProcess: false,
        };
      }

      return {
        isIdempotent: false,
        shouldProcess: true,
      };

    } catch (error) {
      this.logger.error('Error checking SQS message idempotency', {
        error: error.message,
        messageId,
        eventId,
        stack: error.stack,
      });

      return {
        isIdempotent: false,
        shouldProcess: true,
      };
    }
  }

  /**
   * Mark SQS message as processed
   */
  async markSqsMessageProcessed(
    messageId: string,
    eventId: string,
    result: any,
    ttlMinutes: number = 30,
  ): Promise<void> {
    try {
      const cacheKey = `sqs_message_${messageId}`;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      this.idempotencyCache.set(cacheKey, {
        result: {
          eventId,
          result,
          processedAt: new Date(),
        },
        expiresAt,
      });

      this.logger.debug('SQS message marked as processed', {
        messageId,
        eventId,
        ttlMinutes,
      });

    } catch (error) {
      this.logger.error('Error marking SQS message as processed', {
        error: error.message,
        messageId,
        eventId,
        stack: error.stack,
      });
    }
  }

  /**
   * Generate deterministic hash of payload for idempotency
   */
  private hashPayload(payload: Record<string, any>): string {
    try {
      // Sort keys to ensure consistent hashing
      const sortedPayload = this.sortObjectKeys(payload);
      const payloadString = JSON.stringify(sortedPayload);
      
      return crypto
        .createHash('sha256')
        .update(payloadString)
        .digest('hex');

    } catch (error) {
      this.logger.warn('Error hashing payload, using fallback', {
        error: error.message,
      });
      
      // Fallback to simple string conversion
      return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
    }
  }

  /**
   * Recursively sort object keys for consistent hashing
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sortedObj: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }

  /**
   * Get cached result if not expired
   */
  private getCachedResult(key: string): any {
    const cached = this.idempotencyCache.get(key);
    
    if (!cached) {
      return null;
    }

    if (cached.expiresAt < new Date()) {
      this.idempotencyCache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCacheEntries(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, cached] of this.idempotencyCache.entries()) {
      if (cached.expiresAt < now) {
        this.idempotencyCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up expired idempotency cache entries', {
        cleanedCount,
        remainingCount: this.idempotencyCache.size,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    memoryUsageEstimate: number;
  } {
    const now = new Date();
    let expiredCount = 0;

    for (const [, cached] of this.idempotencyCache.entries()) {
      if (cached.expiresAt < now) {
        expiredCount++;
      }
    }

    // Rough estimate of memory usage (in bytes)
    const memoryUsageEstimate = this.idempotencyCache.size * 200; // ~200 bytes per entry

    return {
      totalEntries: this.idempotencyCache.size,
      expiredEntries: expiredCount,
      memoryUsageEstimate,
    };
  }

  /**
   * Clear all cached entries (use with caution)
   */
  clearCache(): void {
    const previousSize = this.idempotencyCache.size;
    this.idempotencyCache.clear();
    
    this.logger.warn('Idempotency cache cleared', {
      previousSize,
    });
  }
}
