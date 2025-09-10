import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApiKeyController } from '../api-key.controller';
import { ApiKeyService } from '../../services/api-key.service';
import { CreateApiKeyDto } from '../../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../../dto/update-api-key.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto } from '../../dto/api-key-response.dto';
import { ApiKeyAuthGuard } from '../../../../common/guards/api-key-auth.guard';

/**
 * ApiKeyController unit tests
 *
 * Testing strategy:
 * - Mock ApiKeyService to isolate controller logic
 * - Cover positive, negative, and edge cases per endpoint
 * - Follow Arrange-Act-Assert pattern for readability
 */
describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let service: jest.Mocked<ApiKeyService>;

  const mockApiKeyService: jest.Mocked<ApiKeyService> = {
    createApiKey: jest.fn<Promise<CreateApiKeyResponseDto>, [CreateApiKeyDto]>(),
    validateApiKey: jest.fn(),
    findAllApiKeys: jest.fn<Promise<ApiKeyResponseDto[]>, []>(),
    findApiKeyById: jest.fn<Promise<ApiKeyResponseDto>, [string]>(),
    updateApiKey: jest.fn<Promise<ApiKeyResponseDto>, [string, UpdateApiKeyDto, string]>(),
    deactivateApiKey: jest.fn<Promise<void>, [string, string]>(),
    deleteApiKey: jest.fn<Promise<void>, [string, string]>(),
  } as unknown as jest.Mocked<ApiKeyService>;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        {
          provide: ApiKeyService,
          useValue: mockApiKeyService,
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
    service = module.get(ApiKeyService);

    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create a new API key (happy path)', async () => {
      // Arrange
      const dto: CreateApiKeyDto = {
        clientId: 'test-client',
        clientName: 'Test Client',
        permissions: ['payments:read'],
        rateLimit: 1000,
        createdBy: 'admin@test.com',
      };
      const expected: CreateApiKeyResponseDto = {
        id: 'id-1',
        clientId: 'test-client',
        clientName: 'Test Client',
        keyPrefix: 'pk_live_abcd...',
        isActive: true,
        permissions: ['payments:read'],
        rateLimit: 1000,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        createdBy: 'admin@test.com',
        metadata: {},
        apiKey: 'pk_live_verysecret',
      };
      service.createApiKey.mockResolvedValue(expected);

      // Act
      const result = await controller.createApiKey(dto);

      // Assert
      expect(result).toEqual(expected);
      expect(service.createApiKey).toHaveBeenCalledWith(dto);
    });

    it('should propagate ConflictException when clientId already exists (negative)', async () => {
      // Arrange
      const dto: CreateApiKeyDto = {
        clientId: 'dup-client',
        clientName: 'Dup Client',
        createdBy: 'admin@test.com',
        permissions: [],
        rateLimit: 1000,
      };
      service.createApiKey.mockRejectedValue(new ConflictException('exists'));

      // Act & Assert
      await expect(controller.createApiKey(dto)).rejects.toThrow(ConflictException);
      expect(service.createApiKey).toHaveBeenCalledWith(dto);
    });
  });

  describe('getAllApiKeys', () => {
    it('should return list of API keys (happy path)', async () => {
      // Arrange
      const items: ApiKeyResponseDto[] = [
        {
          id: 'id-1',
          clientId: 'a',
          clientName: 'A',
          keyPrefix: 'pk_live_a...',
          isActive: true,
          permissions: [],
          rateLimit: 1000,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
          createdBy: 'sys',
          metadata: {},
        },
      ];
      service.findAllApiKeys.mockResolvedValue(items);

      // Act
      const result = await controller.getAllApiKeys();

      // Assert
      expect(result).toEqual(items);
      expect(service.findAllApiKeys).toHaveBeenCalled();
    });

    it('should return empty list when there are no API keys (edge)', async () => {
      // Arrange
      service.findAllApiKeys.mockResolvedValue([]);

      // Act
      const result = await controller.getAllApiKeys();

      // Assert
      expect(result).toEqual([]);
      expect(service.findAllApiKeys).toHaveBeenCalled();
    });
  });

  describe('getApiKeyById', () => {
    it('should return API key by id (happy path)', async () => {
      // Arrange
      const item: ApiKeyResponseDto = {
        id: 'id-1',
        clientId: 'a',
        clientName: 'A',
        keyPrefix: 'pk_live_a...',
        isActive: true,
        permissions: [],
        rateLimit: 1000,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        createdBy: 'sys',
        metadata: {},
      };
      service.findApiKeyById.mockResolvedValue(item);

      // Act
      const result = await controller.getApiKeyById('id-1');

      // Assert
      expect(result).toEqual(item);
      expect(service.findApiKeyById).toHaveBeenCalledWith('id-1');
    });

    it('should propagate NotFoundException when API key does not exist (negative)', async () => {
      // Arrange
      service.findApiKeyById.mockRejectedValue(new NotFoundException('not found'));

      // Act & Assert
      await expect(controller.getApiKeyById('missing')).rejects.toThrow(NotFoundException);
      expect(service.findApiKeyById).toHaveBeenCalledWith('missing');
    });
  });

  describe('updateApiKey', () => {
    it('should update API key with provided query param updatedBy (happy path)', async () => {
      // Arrange
      const dto: UpdateApiKeyDto = { clientName: 'Updated' };
      const expected: ApiKeyResponseDto = {
        id: 'id-1',
        clientId: 'a',
        clientName: 'Updated',
        keyPrefix: 'pk_live_a...',
        isActive: true,
        permissions: [],
        rateLimit: 1000,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        createdBy: 'sys',
        metadata: {},
      };
      service.updateApiKey.mockResolvedValue(expected);

      // Act
      const result = await controller.updateApiKey('id-1', dto, 'admin@test.com');

      // Assert
      expect(result).toEqual(expected);
      expect(service.updateApiKey).toHaveBeenCalledWith('id-1', dto, 'admin@test.com');
    });

    it('should pass undefined updatedBy when query param missing (edge)', async () => {
      // Arrange
      const dto: UpdateApiKeyDto = { rateLimit: 2000 };
      const expected: ApiKeyResponseDto = {
        id: 'id-1',
        clientId: 'a',
        clientName: 'A',
        keyPrefix: 'pk_live_a...',
        isActive: true,
        permissions: [],
        rateLimit: 2000,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        createdBy: 'sys',
        metadata: {},
      };
      service.updateApiKey.mockResolvedValue(expected);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.updateApiKey('id-1', dto, undefined as any);

      // Assert
      expect(result).toEqual(expected);
      expect(service.updateApiKey).toHaveBeenCalledWith('id-1', dto, undefined);
    });

    it('should propagate NotFoundException when API key not found (negative)', async () => {
      // Arrange
      const dto: UpdateApiKeyDto = { clientName: 'Noop' };
      service.updateApiKey.mockRejectedValue(new NotFoundException('missing'));

      // Act & Assert
      await expect(controller.updateApiKey('missing', dto, 'admin@test.com')).rejects.toThrow(NotFoundException);
      expect(service.updateApiKey).toHaveBeenCalledWith('missing', dto, 'admin@test.com');
    });
  });

  describe('deactivateApiKey', () => {
    it('should deactivate API key (happy path)', async () => {
      // Arrange
      service.deactivateApiKey.mockResolvedValue(undefined);

      // Act
      await controller.deactivateApiKey('id-1', 'admin@test.com');

      // Assert
      expect(service.deactivateApiKey).toHaveBeenCalledWith('id-1', 'admin@test.com');
    });

    it('should work when deactivatedBy query param is missing (edge)', async () => {
      // Arrange
      service.deactivateApiKey.mockResolvedValue(undefined);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await controller.deactivateApiKey('id-1', undefined as any);

      // Assert
      expect(service.deactivateApiKey).toHaveBeenCalledWith('id-1', undefined);
    });

    it('should propagate NotFoundException when API key not found (negative)', async () => {
      // Arrange
      service.deactivateApiKey.mockRejectedValue(new NotFoundException('missing'));

      // Act & Assert
      await expect(controller.deactivateApiKey('missing', 'admin@test.com')).rejects.toThrow(NotFoundException);
      expect(service.deactivateApiKey).toHaveBeenCalledWith('missing', 'admin@test.com');
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key (happy path)', async () => {
      // Arrange
      service.deleteApiKey.mockResolvedValue(undefined);

      // Act
      await controller.deleteApiKey('id-1', 'admin@test.com');

      // Assert
      expect(service.deleteApiKey).toHaveBeenCalledWith('id-1', 'admin@test.com');
    });

    it('should work when deletedBy query param is missing (edge)', async () => {
      // Arrange
      service.deleteApiKey.mockResolvedValue(undefined);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await controller.deleteApiKey('id-1', undefined as any);

      // Assert
      expect(service.deleteApiKey).toHaveBeenCalledWith('id-1', undefined);
    });

    it('should propagate NotFoundException when API key not found (negative)', async () => {
      // Arrange
      service.deleteApiKey.mockRejectedValue(new NotFoundException('missing'));

      // Act & Assert
      await expect(controller.deleteApiKey('missing', 'admin@test.com')).rejects.toThrow(NotFoundException);
      expect(service.deleteApiKey).toHaveBeenCalledWith('missing', 'admin@test.com');
    });
  });
});
