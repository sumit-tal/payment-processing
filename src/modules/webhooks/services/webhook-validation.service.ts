import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface WebhookValidationResult {
  readonly isValid: boolean;
  readonly errorMessage?: string;
}

@Injectable()
export class WebhookValidationService {
  private readonly logger = new Logger(WebhookValidationService.name);
  private readonly webhookSecret: string;
  private readonly signatureHeader: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>('WEBHOOK_SECRET_KEY');
    this.signatureHeader = this.configService.get<string>('WEBHOOK_SIGNATURE_HEADER', 'X-ANET-Signature');
    
    if (!this.webhookSecret) {
      throw new Error('WEBHOOK_SECRET_KEY must be configured');
    }
  }

  /**
   * Validate Authorize.Net webhook signature
   */
  validateAuthorizeNetSignature(
    payload: string,
    signature: string,
  ): WebhookValidationResult {
    try {
      if (!signature) {
        return {
          isValid: false,
          errorMessage: 'Missing webhook signature',
        };
      }

      // Authorize.Net uses HMAC-SHA512 for webhook signatures
      const expectedSignature = this.generateHmacSignature(payload, 'sha512');
      const providedSignature = signature.replace('sha512=', '');

      const isValid = this.secureCompare(expectedSignature, providedSignature);

      if (!isValid) {
        this.logger.warn('Webhook signature validation failed', {
          expectedLength: expectedSignature.length,
          providedLength: providedSignature.length,
        });
      }

      return {
        isValid,
        errorMessage: isValid ? undefined : 'Invalid webhook signature',
      };
    } catch (error) {
      this.logger.error('Error validating webhook signature', {
        error: error.message,
        stack: error.stack,
      });

      return {
        isValid: false,
        errorMessage: 'Signature validation error',
      };
    }
  }

  /**
   * Validate webhook payload structure for Authorize.Net
   */
  validateAuthorizeNetPayload(payload: any): WebhookValidationResult {
    try {
      if (!payload || typeof payload !== 'object') {
        return {
          isValid: false,
          errorMessage: 'Invalid payload format',
        };
      }

      // Check required fields for Authorize.Net webhooks
      const requiredFields = ['notificationId', 'eventType', 'eventDate', 'webhookId'];
      const missingFields = requiredFields.filter(field => !payload[field]);

      if (missingFields.length > 0) {
        return {
          isValid: false,
          errorMessage: `Missing required fields: ${missingFields.join(', ')}`,
        };
      }

      // Validate event type format
      if (!this.isValidEventType(payload.eventType)) {
        return {
          isValid: false,
          errorMessage: 'Invalid event type format',
        };
      }

      // Validate notification ID format (should be UUID-like)
      if (!this.isValidNotificationId(payload.notificationId)) {
        return {
          isValid: false,
          errorMessage: 'Invalid notification ID format',
        };
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error('Error validating webhook payload', {
        error: error.message,
        stack: error.stack,
      });

      return {
        isValid: false,
        errorMessage: 'Payload validation error',
      };
    }
  }

  /**
   * Validate webhook timestamp to prevent replay attacks
   */
  validateTimestamp(eventDate: string, toleranceMinutes: number = 5): WebhookValidationResult {
    try {
      const eventTimestamp = new Date(eventDate);
      
      // Check if the date is invalid
      if (isNaN(eventTimestamp.getTime())) {
        return {
          isValid: false,
          errorMessage: 'Invalid timestamp format',
        };
      }
      
      const currentTimestamp = new Date();
      const timeDifference = Math.abs(currentTimestamp.getTime() - eventTimestamp.getTime());
      const toleranceMs = toleranceMinutes * 60 * 1000;

      if (timeDifference > toleranceMs) {
        return {
          isValid: false,
          errorMessage: `Webhook timestamp is too old. Difference: ${Math.round(timeDifference / 1000)}s`,
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: 'Invalid timestamp format',
      };
    }
  }

  /**
   * Generate HMAC signature for webhook validation
   */
  private generateHmacSignature(payload: string, algorithm: string = 'sha256'): string {
    return crypto
      .createHmac(algorithm, this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  /**
   * Secure comparison to prevent timing attacks
   */
  private secureCompare(expected: string, provided: string): boolean {
    if (expected.length !== provided.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate Authorize.Net event type format
   */
  private isValidEventType(eventType: string): boolean {
    // Authorize.Net event types follow pattern: net.authorize.{category}.{action}.{status}
    const eventTypePattern = /^net\.authorize\.[a-z]+\.[a-z]+\.[a-z]+$/;
    return eventTypePattern.test(eventType);
  }

  /**
   * Validate notification ID format (UUID-like)
   */
  private isValidNotificationId(notificationId: string): boolean {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(notificationId);
  }

  /**
   * Extract and validate webhook headers
   */
  extractWebhookHeaders(headers: Record<string, string>): {
    signature?: string;
    contentType?: string;
    userAgent?: string;
  } {
    return {
      signature: headers[this.signatureHeader.toLowerCase()] || headers[this.signatureHeader],
      contentType: headers['content-type'],
      userAgent: headers['user-agent'],
    };
  }

  /**
   * Comprehensive webhook validation
   */
  async validateWebhook(
    payload: string,
    headers: Record<string, string>,
    parsedPayload: any,
  ): Promise<WebhookValidationResult> {
    try {
      // Extract headers
      const webhookHeaders = this.extractWebhookHeaders(headers);

      // Validate signature
      if (webhookHeaders.signature) {
        const signatureValidation = this.validateAuthorizeNetSignature(
          payload,
          webhookHeaders.signature,
        );
        if (!signatureValidation.isValid) {
          return signatureValidation;
        }
      }

      // Validate payload structure
      const payloadValidation = this.validateAuthorizeNetPayload(parsedPayload);
      if (!payloadValidation.isValid) {
        return payloadValidation;
      }

      // Validate timestamp
      if (parsedPayload.eventDate) {
        const timestampValidation = this.validateTimestamp(parsedPayload.eventDate);
        if (!timestampValidation.isValid) {
          return timestampValidation;
        }
      }

      this.logger.log('Webhook validation successful', {
        eventType: parsedPayload.eventType,
        notificationId: parsedPayload.notificationId,
      });

      return { isValid: true };
    } catch (error) {
      this.logger.error('Comprehensive webhook validation failed', {
        error: error.message,
        stack: error.stack,
      });

      return {
        isValid: false,
        errorMessage: 'Webhook validation failed',
      };
    }
  }
}
