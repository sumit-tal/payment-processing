import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        'BCRYPT_ROUNDS': 12,
        'ENCRYPTION_KEY': 'test-encryption-key-for-testing',
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashApiKey', () => {
    it('should hash API key successfully', async () => {
      const apiKey = 'pk_live_test123456789';
      const hash = await service.hashApiKey(apiKey);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(apiKey);
      expect(typeof hash).toBe('string');
    });

    it('should generate different hashes for same input', async () => {
      const apiKey = 'pk_live_test123456789';
      const hash1 = await service.hashApiKey(apiKey);
      const hash2 = await service.hashApiKey(apiKey);

      expect(hash1).not.toBe(hash2); // bcrypt uses salt
    });
  });

  describe('verifyApiKey', () => {
    it('should verify correct API key', async () => {
      const apiKey = 'pk_live_test123456789';
      const hash = await service.hashApiKey(apiKey);
      const isValid = await service.verifyApiKey(apiKey, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect API key', async () => {
      const apiKey = 'pk_live_test123456789';
      const wrongKey = 'pk_live_wrong123456789';
      const hash = await service.hashApiKey(apiKey);
      const isValid = await service.verifyApiKey(wrongKey, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureRandom', () => {
    it('should generate random string of default length', () => {
      const random = service.generateSecureRandom();
      expect(random).toBeDefined();
      expect(typeof random).toBe('string');
      expect(random.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it('should generate random string of specified length', () => {
      const random = service.generateSecureRandom(16);
      expect(random.length).toBe(32); // 16 bytes * 2 (hex)
    });

    it('should generate different values each time', () => {
      const random1 = service.generateSecureRandom();
      const random2 = service.generateSecureRandom();
      expect(random1).not.toBe(random2);
    });
  });

  describe('generateHmacSignature', () => {
    it('should generate HMAC signature', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      const signature = service.generateHmacSignature(data, secret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex string
    });

    it('should generate same signature for same input', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      const signature1 = service.generateHmacSignature(data, secret);
      const signature2 = service.generateHmacSignature(data, secret);

      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different data', () => {
      const secret = 'test-secret';
      const signature1 = service.generateHmacSignature('data1', secret);
      const signature2 = service.generateHmacSignature('data2', secret);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('verifyHmacSignature', () => {
    it('should verify correct HMAC signature', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      const signature = service.generateHmacSignature(data, secret);
      const isValid = service.verifyHmacSignature(data, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect HMAC signature', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      const wrongSignature = 'wrong-signature';
      const isValid = service.verifyHmacSignature(data, wrongSignature, secret);

      expect(isValid).toBe(false);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data successfully', () => {
      const plaintext = 'sensitive-data-to-encrypt';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(decrypted).toBe(plaintext);
    });

    it('should generate different encrypted values for same input', () => {
      const plaintext = 'sensitive-data-to-encrypt';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail decryption with wrong tag', () => {
      const plaintext = 'sensitive-data-to-encrypt';
      const encrypted = service.encrypt(plaintext);
      encrypted.tag = 'wrong-tag';

      expect(() => service.decrypt(encrypted)).toThrow();
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask data with default visible characters', () => {
      const data = '1234567890123456';
      const masked = service.maskSensitiveData(data);

      expect(masked).toBe('1234********3456');
    });

    it('should mask data with custom visible characters', () => {
      const data = '1234567890123456';
      const masked = service.maskSensitiveData(data, 2);

      expect(masked).toBe('12************56');
    });

    it('should mask short data completely', () => {
      const data = '123';
      const masked = service.maskSensitiveData(data);

      expect(masked).toBe('***');
    });

    it('should handle empty data', () => {
      const masked = service.maskSensitiveData('');

      expect(masked).toBe('********');
    });
  });

  describe('generateChecksum', () => {
    it('should generate checksum for data', () => {
      const data = 'test-data-for-checksum';
      const checksum = service.generateChecksum(data);

      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64); // SHA256 hex string
    });

    it('should generate same checksum for same data', () => {
      const data = 'test-data-for-checksum';
      const checksum1 = service.generateChecksum(data);
      const checksum2 = service.generateChecksum(data);

      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksums for different data', () => {
      const checksum1 = service.generateChecksum('data1');
      const checksum2 = service.generateChecksum('data2');

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('verifyChecksum', () => {
    it('should verify correct checksum', () => {
      const data = 'test-data-for-checksum';
      const checksum = service.generateChecksum(data);
      const isValid = service.verifyChecksum(data, checksum);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect checksum', () => {
      const data = 'test-data-for-checksum';
      const wrongChecksum = 'wrong-checksum';
      const isValid = service.verifyChecksum(data, wrongChecksum);

      expect(isValid).toBe(false);
    });
  });
});
