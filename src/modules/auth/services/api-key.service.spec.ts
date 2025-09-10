import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKey } from '@/database/entities/api-key.entity';
import { CryptoService } from '../../security/services/crypto.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../dto/update-api-key.dto';
import { AuditAction } from '../../../database/entities/audit-log.entity';

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
    verifyApiKey: jest.fn(),
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
    const baseCreateApiKeyDto: CreateApiKeyDto = {
      clientId: 'test-client',
      clientName: 'Test Client',
      permissions: ['payments:read'],
      rateLimit: 1000,
      createdBy: 'admin@test.com',
    };

    const mockApiKeyEntity = {
      id: 'api-key-id',
      clientId: 'test-client',
      clientName: 'Test Client',
      keyHash: 'hashed-api-key',
      keyPrefix: 'pk_live_1234...',
      permissions: ['payments:read'],
      rateLimit: 1000,
      createdBy: 'admin@test.com',
      isActive: true,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    describe('When creating API key with valid data', () => {
      it('Then should create API key successfully', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-api-key');
        mockRepository.create.mockReturnValue(mockApiKeyEntity);
        mockRepository.save.mockResolvedValue(mockApiKeyEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(baseCreateApiKeyDto);

        expect(result).toHaveProperty('apiKey');
        expect(result.apiKey).toMatch(/^pk_live_[a-f0-9]{64}$/);
        expect(result.clientId).toBe('test-client');
        expect(result.clientName).toBe('Test Client');
        expect(result.permissions).toEqual(['payments:read']);
        expect(result.rateLimit).toBe(1000);
        expect(mockRepository.findOne).toHaveBeenCalledWith({
          where: { clientId: 'test-client' },
        });
        expect(mockCryptoService.hashApiKey).toHaveBeenCalled();
        expect(mockRepository.save).toHaveBeenCalled();
        expect(mockAuditLogService.logActivity).toHaveBeenCalledWith({
          action: AuditAction.API_KEY_CREATED,
          entityType: 'ApiKey',
          entityId: mockApiKeyEntity.id,
          userId: 'admin@test.com',
          metadata: {
            clientId: 'test-client',
            clientName: 'Test Client',
            permissions: ['payments:read'],
          },
        });
      });

      it('Then should create API key with default values when optional fields omitted', async () => {
        const minimalDto = {
          clientId: 'minimal-client',
          clientName: 'Minimal Client',
          createdBy: 'admin@test.com',
        };
        const minimalEntity = {
          ...mockApiKeyEntity,
          clientId: 'minimal-client',
          clientName: 'Minimal Client',
          permissions: [],
          rateLimit: 1000,
          metadata: {},
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-api-key');
        mockRepository.create.mockReturnValue(minimalEntity);
        mockRepository.save.mockResolvedValue(minimalEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(
          minimalDto as CreateApiKeyDto,
        );

        expect(result.permissions).toEqual([]);
        expect(result.rateLimit).toBe(1000);
        expect(result.metadata).toEqual({});
      });

      it('Then should create API key with expiration date when provided', async () => {
        const futureDate = new Date(Date.now() + 86400000); // 24 hours from now
        const dtoWithExpiry = {
          ...baseCreateApiKeyDto,
          expiresAt: futureDate.toISOString(),
        };
        const entityWithExpiry = {
          ...mockApiKeyEntity,
          expiresAt: futureDate,
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-api-key');
        mockRepository.create.mockReturnValue(entityWithExpiry);
        mockRepository.save.mockResolvedValue(entityWithExpiry);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(dtoWithExpiry);

        expect(result.expiresAt).toEqual(futureDate);
      });

      it('Then should create API key with custom metadata when provided', async () => {
        const customMetadata = { environment: 'production', version: '1.0' };
        const dtoWithMetadata = {
          ...baseCreateApiKeyDto,
          metadata: customMetadata,
        };
        const entityWithMetadata = {
          ...mockApiKeyEntity,
          metadata: customMetadata,
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-api-key');
        mockRepository.create.mockReturnValue(entityWithMetadata);
        mockRepository.save.mockResolvedValue(entityWithMetadata);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(dtoWithMetadata);

        expect(result.metadata).toEqual(customMetadata);
      });
    });

    describe('When creating API key with duplicate client ID', () => {
      it('Then should throw ConflictException', async () => {
        const existingApiKey = { id: 'existing-id', clientId: 'test-client' };
        mockRepository.findOne.mockResolvedValue(existingApiKey);

        await expect(service.createApiKey(baseCreateApiKeyDto)).rejects.toThrow(
          ConflictException,
        );
        await expect(service.createApiKey(baseCreateApiKeyDto)).rejects.toThrow(
          "API key for client ID 'test-client' already exists",
        );
        expect(mockRepository.findOne).toHaveBeenCalledWith({
          where: { clientId: 'test-client' },
        });
        expect(mockCryptoService.hashApiKey).not.toHaveBeenCalled();
        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository save failure', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-api-key');
        mockRepository.create.mockReturnValue(mockApiKeyEntity);
        mockRepository.save.mockRejectedValue(new Error('Database error'));

        await expect(service.createApiKey(baseCreateApiKeyDto)).rejects.toThrow(
          'Database error',
        );
      });

      it('Then should handle crypto service failure', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockRejectedValue(
          new Error('Crypto error'),
        );

        await expect(service.createApiKey(baseCreateApiKeyDto)).rejects.toThrow(
          'Crypto error',
        );
      });

      it('Then should handle audit log failure gracefully', async () => {
        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-api-key');
        mockRepository.create.mockReturnValue(mockApiKeyEntity);
        mockRepository.save.mockResolvedValue(mockApiKeyEntity);
        mockAuditLogService.logActivity.mockRejectedValue(
          new Error('Audit error'),
        );

        await expect(service.createApiKey(baseCreateApiKeyDto)).rejects.toThrow(
          'Audit error',
        );
      });
    });
  });

  describe('validateApiKey', () => {
    const validApiKey =
      'pk_live_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const mockApiKeyEntity = {
      id: 'api-key-id',
      clientId: 'test-client',
      clientName: 'Test Client',
      keyHash: 'hashed-key',
      isActive: true,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      permissions: ['payments:read'],
      rateLimit: 1000,
    };

    describe('When validating API key format', () => {
      it('Then should return null for empty API key', async () => {
        const result = await service.validateApiKey('');
        expect(result).toBeNull();
      });

      it('Then should return null for null API key', async () => {
        const result = await service.validateApiKey(null as any);
        expect(result).toBeNull();
      });

      it('Then should return null for undefined API key', async () => {
        const result = await service.validateApiKey(undefined as any);
        expect(result).toBeNull();
      });

      it('Then should return null for API key without pk_ prefix', async () => {
        const result = await service.validateApiKey('invalid-key-format');
        expect(result).toBeNull();
      });

      it('Then should return null for API key with wrong prefix', async () => {
        const result = await service.validateApiKey('sk_live_1234567890abcdef');
        expect(result).toBeNull();
      });
    });

    describe('When no active API keys exist', () => {
      it('Then should return null', async () => {
        mockRepository.find.mockResolvedValue([]);
        const result = await service.validateApiKey(validApiKey);
        expect(result).toBeNull();
        expect(mockRepository.find).toHaveBeenCalledWith({
          where: { isActive: true },
        });
      });
    });

    describe('When API key exists and is valid', () => {
      it('Then should return API key entity and update lastUsedAt', async () => {
        mockRepository.find.mockResolvedValue([mockApiKeyEntity]);
        mockCryptoService.verifyApiKey.mockResolvedValue(true);
        mockRepository.update.mockResolvedValue({ affected: 1 });

        const result = await service.validateApiKey(validApiKey);

        expect(result).toBe(mockApiKeyEntity);
        expect(mockCryptoService.verifyApiKey).toHaveBeenCalledWith(
          validApiKey,
          'hashed-key',
        );
        expect(mockRepository.update).toHaveBeenCalledWith('api-key-id', {
          lastUsedAt: expect.any(Date),
        });
      });

      it('Then should handle multiple API keys and find matching one', async () => {
        const otherApiKey = {
          ...mockApiKeyEntity,
          id: 'other-id',
          keyHash: 'other-hash',
        };
        mockRepository.find.mockResolvedValue([otherApiKey, mockApiKeyEntity]);
        mockCryptoService.verifyApiKey
          .mockResolvedValueOnce(false) // First key doesn't match
          .mockResolvedValueOnce(true); // Second key matches
        mockRepository.update.mockResolvedValue({ affected: 1 });

        const result = await service.validateApiKey(validApiKey);

        expect(result).toBe(mockApiKeyEntity);
        expect(mockCryptoService.verifyApiKey).toHaveBeenCalledTimes(2);
      });
    });

    describe('When API key is expired', () => {
      it('Then should return null for expired API key', async () => {
        const expiredApiKey = {
          ...mockApiKeyEntity,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        };

        mockRepository.find.mockResolvedValue([expiredApiKey]);
        mockCryptoService.verifyApiKey.mockResolvedValue(true);

        const result = await service.validateApiKey(validApiKey);

        expect(result).toBeNull();
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('Then should return API key for future expiration date', async () => {
        const futureExpiry = new Date(Date.now() + 86400000); // 24 hours from now
        const validApiKeyWithExpiry = {
          ...mockApiKeyEntity,
          expiresAt: futureExpiry,
        };

        mockRepository.find.mockResolvedValue([validApiKeyWithExpiry]);
        mockCryptoService.verifyApiKey.mockResolvedValue(true);
        mockRepository.update.mockResolvedValue({ affected: 1 });

        const result = await service.validateApiKey(validApiKey);

        expect(result).toBe(validApiKeyWithExpiry);
        expect(mockRepository.update).toHaveBeenCalled();
      });
    });

    describe('When crypto verification fails', () => {
      it('Then should return null when no keys match', async () => {
        mockRepository.find.mockResolvedValue([mockApiKeyEntity]);
        mockCryptoService.verifyApiKey.mockResolvedValue(false);

        const result = await service.validateApiKey(validApiKey);

        expect(result).toBeNull();
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('Then should handle crypto service errors', async () => {
        mockRepository.find.mockResolvedValue([mockApiKeyEntity]);
        mockCryptoService.verifyApiKey.mockRejectedValue(
          new Error('Crypto error'),
        );

        await expect(service.validateApiKey(validApiKey)).rejects.toThrow(
          'Crypto error',
        );
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository find failure', async () => {
        mockRepository.find.mockRejectedValue(new Error('Database error'));

        await expect(service.validateApiKey(validApiKey)).rejects.toThrow(
          'Database error',
        );
      });

      it('Then should handle lastUsedAt update failure', async () => {
        mockRepository.find.mockResolvedValue([mockApiKeyEntity]);
        mockCryptoService.verifyApiKey.mockResolvedValue(true);
        mockRepository.update.mockRejectedValue(new Error('Update error'));

        await expect(service.validateApiKey(validApiKey)).rejects.toThrow(
          'Update error',
        );
      });
    });
  });

  describe('findAllApiKeys', () => {
    const mockApiKeys = [
      {
        id: 'api-key-1',
        clientId: 'client-1',
        clientName: 'Client One',
        keyPrefix: 'pk_live_1234...',
        isActive: true,
        permissions: ['payments:read'],
        rateLimit: 1000,
        createdAt: new Date('2023-01-01'),
        createdBy: 'admin@test.com',
        metadata: {},
      },
      {
        id: 'api-key-2',
        clientId: 'client-2',
        clientName: 'Client Two',
        keyPrefix: 'pk_live_5678...',
        isActive: false,
        permissions: ['payments:write'],
        rateLimit: 500,
        createdAt: new Date('2023-01-02'),
        createdBy: 'admin@test.com',
        metadata: { environment: 'test' },
      },
    ];

    describe('When retrieving all API keys', () => {
      it('Then should return all API keys ordered by creation date', async () => {
        mockRepository.find.mockResolvedValue(mockApiKeys);

        const result = await service.findAllApiKeys();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('api-key-1');
        expect(result[1].id).toBe('api-key-2');
        expect(mockRepository.find).toHaveBeenCalledWith({
          order: { createdAt: 'DESC' },
        });
      });

      it('Then should return empty array when no API keys exist', async () => {
        mockRepository.find.mockResolvedValue([]);

        const result = await service.findAllApiKeys();

        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('Then should map entities to response DTOs correctly', async () => {
        mockRepository.find.mockResolvedValue([mockApiKeys[0]]);

        const result = await service.findAllApiKeys();

        expect(result[0]).toEqual({
          id: 'api-key-1',
          clientId: 'client-1',
          clientName: 'Client One',
          keyPrefix: 'pk_live_1234...',
          isActive: true,
          permissions: ['payments:read'],
          rateLimit: 1000,
          lastUsedAt: undefined,
          expiresAt: undefined,
          createdAt: new Date('2023-01-01'),
          createdBy: 'admin@test.com',
          metadata: {},
        });
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository find failure', async () => {
        mockRepository.find.mockRejectedValue(new Error('Database error'));

        await expect(service.findAllApiKeys()).rejects.toThrow(
          'Database error',
        );
      });
    });
  });

  describe('findApiKeyById', () => {
    const mockApiKey = {
      id: 'api-key-id',
      clientId: 'test-client',
      clientName: 'Test Client',
      keyPrefix: 'pk_live_1234...',
      isActive: true,
      permissions: ['payments:read'],
      rateLimit: 1000,
      lastUsedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      createdBy: 'admin@test.com',
      metadata: {},
    };

    describe('When finding API key by valid ID', () => {
      it('Then should return API key when found', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);

        const result = await service.findApiKeyById('api-key-id');

        expect(result).toBeDefined();
        expect(result.id).toBe('api-key-id');
        expect(result.clientId).toBe('test-client');
        expect(mockRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'api-key-id' },
        });
      });

      it('Then should map entity to response DTO correctly', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);

        const result = await service.findApiKeyById('api-key-id');

        expect(result).toEqual({
          id: 'api-key-id',
          clientId: 'test-client',
          clientName: 'Test Client',
          keyPrefix: 'pk_live_1234...',
          isActive: true,
          permissions: ['payments:read'],
          rateLimit: 1000,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: expect.any(Date),
          createdBy: 'admin@test.com',
          metadata: {},
        });
      });
    });

    describe('When API key not found', () => {
      it('Then should throw NotFoundException', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(service.findApiKeyById('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
        await expect(service.findApiKeyById('non-existent-id')).rejects.toThrow(
          "API key with ID 'non-existent-id' not found",
        );
      });

      it('Then should handle empty string ID', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(service.findApiKeyById('')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('Then should handle invalid UUID format', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(service.findApiKeyById('invalid-uuid')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository findOne failure', async () => {
        mockRepository.findOne.mockRejectedValue(new Error('Database error'));

        await expect(service.findApiKeyById('api-key-id')).rejects.toThrow(
          'Database error',
        );
      });
    });
  });

  describe('updateApiKey', () => {
    const mockApiKey = {
      id: 'api-key-id',
      clientId: 'test-client',
      clientName: 'Test Client',
      keyPrefix: 'pk_live_1234...',
      isActive: true,
      permissions: ['payments:read'],
      rateLimit: 1000,
      expiresAt: null,
      metadata: {},
      createdBy: 'admin@test.com',
      createdAt: new Date(),
    };

    const updateDto: UpdateApiKeyDto = {
      clientName: 'Updated Client Name',
      permissions: ['payments:read', 'payments:write'],
      rateLimit: 2000,
      metadata: { environment: 'production' },
    };

    describe('When updating API key with valid data', () => {
      it('Then should update API key successfully', async () => {
        const updatedApiKey = { ...mockApiKey, ...updateDto };
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.save.mockResolvedValue(updatedApiKey);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.updateApiKey(
          'api-key-id',
          updateDto,
          'admin@test.com',
        );

        expect(result.clientName).toBe('Updated Client Name');
        expect(result.permissions).toEqual(['payments:read', 'payments:write']);
        expect(result.rateLimit).toBe(2000);
        expect(mockRepository.save).toHaveBeenCalledWith(
          expect.objectContaining(updateDto),
        );
        expect(mockAuditLogService.logActivity).toHaveBeenCalledWith({
          action: AuditAction.API_KEY_UPDATED,
          entityType: 'ApiKey',
          entityId: 'api-key-id',
          userId: 'admin@test.com',
          metadata: {
            clientId: 'test-client',
            changes: updateDto,
          },
        });
      });

      it('Then should update expiration date when provided', async () => {
        const futureDate = new Date(Date.now() + 86400000);
        const updateWithExpiry = {
          ...updateDto,
          expiresAt: futureDate.toISOString(),
        };
        const updatedApiKey = {
          ...mockApiKey,
          ...updateWithExpiry,
          expiresAt: futureDate,
        };

        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.save.mockResolvedValue(updatedApiKey);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.updateApiKey(
          'api-key-id',
          updateWithExpiry,
          'admin@test.com',
        );

        expect(result.expiresAt).toEqual(futureDate);
      });

      it('Then should preserve existing expiration when not provided', async () => {
        const existingExpiry = new Date(Date.now() + 86400000);
        const apiKeyWithExpiry = { ...mockApiKey, expiresAt: existingExpiry };
        const updatedApiKey = { ...apiKeyWithExpiry, ...updateDto };

        mockRepository.findOne.mockResolvedValue(apiKeyWithExpiry);
        mockRepository.save.mockResolvedValue(updatedApiKey);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.updateApiKey(
          'api-key-id',
          updateDto,
          'admin@test.com',
        );

        expect(result.expiresAt).toEqual(existingExpiry);
      });

      it('Then should handle partial updates', async () => {
        const partialUpdate = { clientName: 'Partially Updated' };
        const updatedApiKey = {
          ...mockApiKey,
          clientName: 'Partially Updated',
          permissions: ['payments:read'], // Explicitly preserve original permissions
          rateLimit: 1000, // Explicitly preserve original rate limit
        };

        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.save.mockResolvedValue(updatedApiKey);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.updateApiKey(
          'api-key-id',
          partialUpdate,
          'admin@test.com',
        );

        expect(result.clientName).toBe('Partially Updated');
        expect(result.permissions).toEqual(['payments:read']); // Should preserve original
        expect(result.rateLimit).toBe(1000); // Should preserve original
      });
    });

    describe('When API key not found', () => {
      it('Then should throw NotFoundException', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(
          service.updateApiKey('non-existent-id', updateDto, 'admin@test.com'),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.updateApiKey('non-existent-id', updateDto, 'admin@test.com'),
        ).rejects.toThrow("API key with ID 'non-existent-id' not found");
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository findOne failure', async () => {
        mockRepository.findOne.mockRejectedValue(new Error('Database error'));

        await expect(
          service.updateApiKey('api-key-id', updateDto, 'admin@test.com'),
        ).rejects.toThrow('Database error');
      });

      it('Then should handle repository save failure', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.save.mockRejectedValue(new Error('Save error'));

        await expect(
          service.updateApiKey('api-key-id', updateDto, 'admin@test.com'),
        ).rejects.toThrow('Save error');
      });

      it('Then should handle audit log failure', async () => {
        const updatedApiKey = { ...mockApiKey, ...updateDto };
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.save.mockResolvedValue(updatedApiKey);
        mockAuditLogService.logActivity.mockRejectedValue(
          new Error('Audit error'),
        );

        await expect(
          service.updateApiKey('api-key-id', updateDto, 'admin@test.com'),
        ).rejects.toThrow('Audit error');
      });
    });
  });

  describe('deactivateApiKey', () => {
    const mockApiKey = {
      id: 'api-key-id',
      clientId: 'test-client',
      clientName: 'Test Client',
      isActive: true,
    };

    describe('When deactivating existing API key', () => {
      it('Then should deactivate API key successfully', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.update.mockResolvedValue({ affected: 1 });
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        await service.deactivateApiKey('api-key-id', 'admin@test.com');

        expect(mockRepository.update).toHaveBeenCalledWith('api-key-id', {
          isActive: false,
        });
        expect(mockAuditLogService.logActivity).toHaveBeenCalledWith({
          action: AuditAction.API_KEY_DEACTIVATED,
          entityType: 'ApiKey',
          entityId: 'api-key-id',
          userId: 'admin@test.com',
          metadata: {
            clientId: 'test-client',
          },
        });
      });

      it('Then should handle already deactivated API key', async () => {
        const deactivatedApiKey = { ...mockApiKey, isActive: false };
        mockRepository.findOne.mockResolvedValue(deactivatedApiKey);
        mockRepository.update.mockResolvedValue({ affected: 1 });
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        await service.deactivateApiKey('api-key-id', 'admin@test.com');

        expect(mockRepository.update).toHaveBeenCalledWith('api-key-id', {
          isActive: false,
        });
      });
    });

    describe('When API key not found', () => {
      it('Then should throw NotFoundException', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(
          service.deactivateApiKey('non-existent-id', 'admin@test.com'),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.deactivateApiKey('non-existent-id', 'admin@test.com'),
        ).rejects.toThrow("API key with ID 'non-existent-id' not found");
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository findOne failure', async () => {
        mockRepository.findOne.mockRejectedValue(new Error('Database error'));

        await expect(
          service.deactivateApiKey('api-key-id', 'admin@test.com'),
        ).rejects.toThrow('Database error');
      });

      it('Then should handle repository update failure', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.update.mockRejectedValue(new Error('Update error'));

        await expect(
          service.deactivateApiKey('api-key-id', 'admin@test.com'),
        ).rejects.toThrow('Update error');
      });

      it('Then should handle audit log failure', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.update.mockResolvedValue({ affected: 1 });
        mockAuditLogService.logActivity.mockRejectedValue(
          new Error('Audit error'),
        );

        await expect(
          service.deactivateApiKey('api-key-id', 'admin@test.com'),
        ).rejects.toThrow('Audit error');
      });
    });
  });

  describe('deleteApiKey', () => {
    const mockApiKey = {
      id: 'api-key-id',
      clientId: 'test-client',
      clientName: 'Test Client',
      isActive: true,
    };

    describe('When deleting existing API key', () => {
      it('Then should delete API key successfully', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.delete.mockResolvedValue({ affected: 1 });
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        await service.deleteApiKey('api-key-id', 'admin@test.com');

        expect(mockRepository.delete).toHaveBeenCalledWith('api-key-id');
        expect(mockAuditLogService.logActivity).toHaveBeenCalledWith({
          action: AuditAction.API_KEY_DELETED,
          entityType: 'ApiKey',
          entityId: 'api-key-id',
          userId: 'admin@test.com',
          metadata: {
            clientId: 'test-client',
          },
        });
      });

      it('Then should delete inactive API key', async () => {
        const inactiveApiKey = { ...mockApiKey, isActive: false };
        mockRepository.findOne.mockResolvedValue(inactiveApiKey);
        mockRepository.delete.mockResolvedValue({ affected: 1 });
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        await service.deleteApiKey('api-key-id', 'admin@test.com');

        expect(mockRepository.delete).toHaveBeenCalledWith('api-key-id');
      });
    });

    describe('When API key not found', () => {
      it('Then should throw NotFoundException', async () => {
        mockRepository.findOne.mockResolvedValue(null);

        await expect(
          service.deleteApiKey('non-existent-id', 'admin@test.com'),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.deleteApiKey('non-existent-id', 'admin@test.com'),
        ).rejects.toThrow("API key with ID 'non-existent-id' not found");
      });
    });

    describe('When database operations fail', () => {
      it('Then should handle repository findOne failure', async () => {
        mockRepository.findOne.mockRejectedValue(new Error('Database error'));

        await expect(
          service.deleteApiKey('api-key-id', 'admin@test.com'),
        ).rejects.toThrow('Database error');
      });

      it('Then should handle repository delete failure', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.delete.mockRejectedValue(new Error('Delete error'));

        await expect(
          service.deleteApiKey('api-key-id', 'admin@test.com'),
        ).rejects.toThrow('Delete error');
      });

      it('Then should handle audit log failure', async () => {
        mockRepository.findOne.mockResolvedValue(mockApiKey);
        mockRepository.delete.mockResolvedValue({ affected: 1 });
        mockAuditLogService.logActivity.mockRejectedValue(
          new Error('Audit error'),
        );

        await expect(
          service.deleteApiKey('api-key-id', 'admin@test.com'),
        ).rejects.toThrow('Audit error');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('When handling large data sets', () => {
      it('Then should handle API key with very long client name', async () => {
        const longClientName = 'A'.repeat(500);
        const createDto = {
          clientId: 'long-name-client',
          clientName: longClientName,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'long-name-client',
          clientName: longClientName,
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: 1000,
          isActive: true,
          metadata: {},
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto as CreateApiKeyDto);

        expect(result.clientName).toBe(longClientName);
      });

      it('Then should handle API key with large permissions array', async () => {
        const largePermissions = Array.from(
          { length: 100 },
          (_, i) => `permission:${i}`,
        );
        const createDto = {
          clientId: 'large-permissions-client',
          clientName: 'Large Permissions Client',
          permissions: largePermissions,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'large-permissions-client',
          clientName: 'Large Permissions Client',
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: largePermissions,
          rateLimit: 1000,
          isActive: true,
          metadata: {},
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto);

        expect(result.permissions).toHaveLength(100);
        expect(result.permissions[0]).toBe('permission:0');
        expect(result.permissions[99]).toBe('permission:99');
      });

      it('Then should handle API key with complex metadata', async () => {
        const complexMetadata = {
          environment: 'production',
          version: '2.1.0',
          features: ['feature1', 'feature2', 'feature3'],
          config: {
            timeout: 30000,
            retries: 3,
            endpoints: {
              primary: 'https://api.example.com',
              fallback: 'https://api-backup.example.com',
            },
          },
          tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
        };
        const createDto = {
          clientId: 'complex-metadata-client',
          clientName: 'Complex Metadata Client',
          metadata: complexMetadata,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'complex-metadata-client',
          clientName: 'Complex Metadata Client',
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: 1000,
          isActive: true,
          metadata: complexMetadata,
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto);

        expect(result.metadata).toEqual(complexMetadata);
        expect(result.metadata.tags).toHaveLength(50);
      });
    });

    describe('When handling special characters and Unicode', () => {
      it('Then should handle client names with special characters', async () => {
        const specialClientName =
          'Client™ & Co. (测试) - [Special] {Characters}';
        const createDto = {
          clientId: 'special-chars-client',
          clientName: specialClientName,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'special-chars-client',
          clientName: specialClientName,
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: 1000,
          isActive: true,
          metadata: {},
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto as CreateApiKeyDto);

        expect(result.clientName).toBe(specialClientName);
      });

      it('Then should handle Unicode in metadata', async () => {
        const unicodeMetadata = {
          description: '这是一个测试API密钥',
          emoji: '🔑🚀💻',
          languages: ['English', 'Español', '中文', '日本語', 'العربية'],
        };
        const createDto = {
          clientId: 'unicode-client',
          clientName: 'Unicode Client',
          metadata: unicodeMetadata,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'unicode-client',
          clientName: 'Unicode Client',
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: 1000,
          isActive: true,
          metadata: unicodeMetadata,
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto);

        expect(result.metadata).toEqual(unicodeMetadata);
        expect(result.metadata.emoji).toBe('🔑🚀💻');
      });
    });

    describe('When handling boundary rate limits', () => {
      it('Then should handle zero rate limit', async () => {
        const createDto = {
          clientId: 'zero-rate-client',
          clientName: 'Zero Rate Client',
          rateLimit: 0,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'zero-rate-client',
          clientName: 'Zero Rate Client',
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: 0,
          isActive: true,
          metadata: {},
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto);

        expect(result.rateLimit).toBe(0);
      });

      it('Then should handle very high rate limit', async () => {
        const highRateLimit = Number.MAX_SAFE_INTEGER;
        const createDto = {
          clientId: 'high-rate-client',
          clientName: 'High Rate Client',
          rateLimit: highRateLimit,
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'high-rate-client',
          clientName: 'High Rate Client',
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: highRateLimit,
          isActive: true,
          metadata: {},
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto);

        expect(result.rateLimit).toBe(highRateLimit);
      });
    });

    describe('When handling date edge cases', () => {
      it('Then should handle API key expiring exactly now', async () => {
        const pastTime = new Date(Date.now() - 1000); // 1 second ago
        const apiKeyExpiringNow = {
          id: 'api-key-id',
          clientId: 'test-client',
          keyHash: 'hashed-key',
          isActive: true,
          expiresAt: pastTime, // Already expired
        };

        mockRepository.find.mockResolvedValue([apiKeyExpiringNow]);
        mockCryptoService.verifyApiKey.mockResolvedValue(true);

        const result = await service.validateApiKey('pk_live_validkey');

        expect(result).toBeNull();
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('Then should handle very far future expiration dates', async () => {
        const farFuture = new Date('2099-12-31T23:59:59.999Z');
        const createDto = {
          clientId: 'far-future-client',
          clientName: 'Far Future Client',
          expiresAt: farFuture.toISOString(),
          createdBy: 'admin@test.com',
        };
        const mockEntity = {
          id: 'api-key-id',
          clientId: 'far-future-client',
          clientName: 'Far Future Client',
          keyHash: 'hashed-key',
          keyPrefix: 'pk_live_1234...',
          permissions: [],
          rateLimit: 1000,
          isActive: true,
          expiresAt: farFuture,
          metadata: {},
          createdBy: 'admin@test.com',
          createdAt: new Date(),
        };

        mockRepository.findOne.mockResolvedValue(null);
        mockCryptoService.hashApiKey.mockResolvedValue('hashed-key');
        mockRepository.create.mockReturnValue(mockEntity);
        mockRepository.save.mockResolvedValue(mockEntity);
        mockAuditLogService.logActivity.mockResolvedValue(undefined);

        const result = await service.createApiKey(createDto);

        expect(result.expiresAt).toEqual(farFuture);
      });
    });

    describe('When handling concurrent operations', () => {
      it('Then should handle multiple simultaneous validations', async () => {
        const apiKeyEntity = {
          id: 'api-key-id',
          clientId: 'test-client',
          keyHash: 'hashed-key',
          isActive: true,
          expiresAt: null,
        };

        mockRepository.find.mockResolvedValue([apiKeyEntity]);
        mockCryptoService.verifyApiKey.mockResolvedValue(true);
        mockRepository.update.mockResolvedValue({ affected: 1 });

        const validApiKey = 'pk_live_validkey';
        const promises = Array.from({ length: 10 }, () =>
          service.validateApiKey(validApiKey),
        );

        const results = await Promise.all(promises);

        results.forEach(result => {
          expect(result).toBe(apiKeyEntity);
        });
        expect(mockRepository.update).toHaveBeenCalledTimes(10);
      });
    });
  });
});
