import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltRounds: number;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const secretKey = this.configService.get<string>('ENCRYPTION_KEY') || 'default-encryption-key-change-in-production';
    this.encryptionKey = crypto.scryptSync(secretKey, 'salt', this.keyLength);
  }

  /**
   * Hash API key using bcrypt
   */
  async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, this.saltRounds);
  }

  /**
   * Verify API key against hash
   */
  async verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hash);
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate HMAC signature
   */
  generateHmacSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHmacSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure token for password reset, email verification, etc.
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars * 2) {
      return '*'.repeat(data?.length || 8);
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(data.length - (visibleChars * 2));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Generate checksum for data integrity
   */
  generateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using checksum
   */
  verifyChecksum(data: string, expectedChecksum: string): boolean {
    const actualChecksum = this.generateChecksum(data);
    return crypto.timingSafeEqual(
      Buffer.from(actualChecksum, 'hex'),
      Buffer.from(expectedChecksum, 'hex')
    );
  }
}
