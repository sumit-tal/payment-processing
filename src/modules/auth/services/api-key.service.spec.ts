import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKey } from '../entities/api-key.entity';
import { CryptoService } from '../../security/services/crypto.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repository: Repository<ApiKey>;
  let cryptoService: CryptoService;
  let auditLogService: AuditLogService;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCryptoService = {
    hashApiKey: jest.fn(),
    maskSensitiveData: jest.fn(),
  };

  const mockAuditLogService = {
    logActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockRepository,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    repository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    cryptoService = module.get<CryptoService>(CryptoService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    const createApiKeyDto: CreateApiKeyDto = {
      clientId: 'test-client',
      clientName: 'Test Client',
      permissions: ['payments:read'],
      rateLimit: 1000,
      createdBy: 'admin@test.com',
    };

    it('should create a new API key successfully', async () => {
      const hashedKey = 'hashed-api-key';
      const savedApiKey = {
        id: 'api-key-id',
        clientId: 'test-client',
        clientName: 'Test Client',
        keyHash: hashedKey,
        keyPrefix: 'pk_live_1234...',
        permissions: ['payments:read'],
        rateLimit: 1000,
        createdBy: 'admin@test.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockCryptoService.hashApiKey.mockResolvedValue(hashedKey);
      mockRepository.create.mockReturnValue(savedApiKey);
      mockRepository.save.mockResolvedValue(savedApiKey);
      mockAuditLogService.logActivity.mockResolvedValue(undefined);

      const result = await service.createApiKey(createApiKeyDto);

      expect(result).toHaveProperty('apiKey');
      expect(result.clientId).toBe('test-client');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { clientId: 'test-client' }
      });
      expect(mockCryptoService.hashApiKey).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockAuditLogService.logActivity).toHaveBeenCalled();
    });

    it('should throw ConflictException when client ID already exists', async () => {
      const existingApiKey = { id: 'existing-id', clientId: 'test-client' };
      mockRepository.findOne.mockResolvedValue(existingApiKey);

      await expect(service.createApiKey(createApiKeyDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { clientId: 'test-client' }
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return null for invalid API key format', async () => {
      const result = await service.validateApiKey('invalid-key');
      expect(result).toBeNull();
    });

    it('should return null for non-existent API key', async () => {
      mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateApiKey('pk_live_validformat');
      expect(result).toBeNull();
    });

    it('should return API key entity for valid key', async () => {
      const apiKeyEntity = {
        id: 'api-key-id',
        clientId: 'test-client',
        isActive: true,
        expiresAt: null,
      };

      mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
      mockRepository.findOne.mockResolvedValue(apiKeyEntity);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.validateApiKey('pk_live_validformat');
      expect(result).toBe(apiKeyEntity);
      expect(mockRepository.update).toHaveBeenCalledWith(
        apiKeyEntity.id,
        { lastUsedAt: expect.any(Date) }
      );
    });

    it('should return null for expired API key', async () => {
      const expiredApiKey = {
        id: 'api-key-id',
        clientId: 'test-client',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
      mockRepository.findOne.mockResolvedValue(expiredApiKey);

      const result = await service.validateApiKey('pk_live_validformat');
      expect(result).toBeNull();
    });
  });

  describe('findApiKeyById', () => {
    it('should return API key when found', async () => {
      const apiKey = {
        id: 'api-key-id',
        clientId: 'test-client',
        clientName: 'Test Client',
      };

      mockRepository.findOne.mockResolvedValue(apiKey);

      const result = await service.findApiKeyById('api-key-id');
      expect(result).toBeDefined();
      expect(result.id).toBe('api-key-id');
    });

    it('should throw NotFoundException when API key not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findApiKeyById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateApiKey', () => {
    it('should deactivate API key successfully', async () => {
      const apiKey = {
        id: 'api-key-id',
        clientId: 'test-client',
      };

      mockRepository.findOne.mockResolvedValue(apiKey);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockAuditLogService.logActivity.mockResolvedValue(undefined);

      await service.deactivateApiKey('api-key-id', 'admin@test.com');

      expect(mockRepository.update).toHaveBeenCalledWith('api-key-id', { isActive: false });
      expect(mockAuditLogService.logActivity).toHaveBeenCalled();
    });

    it('should throw NotFoundException when API key not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deactivateApiKey('non-existent-id', 'admin@test.com')).rejects.toThrow(NotFoundException);
    });
  });
});
