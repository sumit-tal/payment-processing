import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '@/database/entities/api-key.entity';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../dto/update-api-key.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto } from '../dto/api-key-response.dto';
import { CryptoService } from '../../security/services/crypto.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { AuditAction } from '@/database/entities/audit-log.entity';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createApiKey(createApiKeyDto: CreateApiKeyDto): Promise<CreateApiKeyResponseDto> {
    // Check if client ID already exists
    const existingApiKey = await this.apiKeyRepository.findOne({
      where: { clientId: createApiKeyDto.clientId }
    });

    if (existingApiKey) {
      throw new ConflictException(`API key for client ID '${createApiKeyDto.clientId}' already exists`);
    }

    // Generate secure API key
    const apiKey = this.generateApiKey();
    const keyHash = await this.cryptoService.hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12) + '...';

    // Create API key entity
    const apiKeyEntity = this.apiKeyRepository.create({
      clientId: createApiKeyDto.clientId,
      clientName: createApiKeyDto.clientName,
      keyHash,
      keyPrefix,
      permissions: createApiKeyDto.permissions || [],
      rateLimit: createApiKeyDto.rateLimit || 1000,
      expiresAt: createApiKeyDto.expiresAt ? new Date(createApiKeyDto.expiresAt) : null,
      createdBy: createApiKeyDto.createdBy,
      metadata: createApiKeyDto.metadata || {},
    });

    const savedApiKey = await this.apiKeyRepository.save(apiKeyEntity);

    // Log API key creation
    await this.auditLogService.logActivity({
      action: AuditAction.API_KEY_CREATED,
      entityType: 'ApiKey',
      entityId: savedApiKey.id,
      userId: createApiKeyDto.createdBy,
      metadata: {
        clientId: savedApiKey.clientId,
        clientName: savedApiKey.clientName,
        permissions: savedApiKey.permissions,
      },
    });

    return {
      ...this.mapToResponseDto(savedApiKey),
      apiKey,
    };
  }

  async validateApiKey(apiKey: string): Promise<ApiKey | null> {
    if (!apiKey || !apiKey.startsWith('pk_')) {
      return null;
    }

    const keyHash = await this.cryptoService.hashApiKey(apiKey);
    const apiKeyEntity = await this.apiKeyRepository.findOne({
      where: { keyHash, isActive: true }
    });

    if (!apiKeyEntity) {
      return null;
    }

    // Check if API key has expired
    if (apiKeyEntity.expiresAt && apiKeyEntity.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await this.apiKeyRepository.update(apiKeyEntity.id, {
      lastUsedAt: new Date(),
    });

    return apiKeyEntity;
  }

  async findAllApiKeys(): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.apiKeyRepository.find({
      order: { createdAt: 'DESC' }
    });

    return apiKeys.map(apiKey => this.mapToResponseDto(apiKey));
  }

  async findApiKeyById(id: string): Promise<ApiKeyResponseDto> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id }
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID '${id}' not found`);
    }

    return this.mapToResponseDto(apiKey);
  }

  async updateApiKey(id: string, updateApiKeyDto: UpdateApiKeyDto, updatedBy: string): Promise<ApiKeyResponseDto> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id }
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID '${id}' not found`);
    }

    // Update fields
    Object.assign(apiKey, {
      ...updateApiKeyDto,
      expiresAt: updateApiKeyDto.expiresAt ? new Date(updateApiKeyDto.expiresAt) : apiKey.expiresAt,
    });

    const updatedApiKey = await this.apiKeyRepository.save(apiKey);

    // Log API key update
    await this.auditLogService.logActivity({
      action: AuditAction.API_KEY_UPDATED,
      entityType: 'ApiKey',
      entityId: updatedApiKey.id,
      userId: updatedBy,
      metadata: {
        clientId: updatedApiKey.clientId,
        changes: updateApiKeyDto,
      },
    });

    return this.mapToResponseDto(updatedApiKey);
  }

  async deactivateApiKey(id: string, deactivatedBy: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id }
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID '${id}' not found`);
    }

    await this.apiKeyRepository.update(id, { isActive: false });

    // Log API key deactivation
    await this.auditLogService.logActivity({
      action: AuditAction.API_KEY_DEACTIVATED,
      entityType: 'ApiKey',
      entityId: id,
      userId: deactivatedBy,
      metadata: {
        clientId: apiKey.clientId,
      },
    });
  }

  async deleteApiKey(id: string, deletedBy: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id }
    });

    if (!apiKey) {
      throw new NotFoundException(`API key with ID '${id}' not found`);
    }

    await this.apiKeyRepository.delete(id);

    // Log API key deletion
    await this.auditLogService.logActivity({
      action: AuditAction.API_KEY_DELETED,
      entityType: 'ApiKey',
      entityId: id,
      userId: deletedBy,
      metadata: {
        clientId: apiKey.clientId,
      },
    });
  }

  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(32);
    const apiKey = `pk_live_${randomBytes.toString('hex')}`;
    return apiKey;
  }

  private mapToResponseDto(apiKey: ApiKey): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      clientId: apiKey.clientId,
      clientName: apiKey.clientName,
      keyPrefix: apiKey.keyPrefix,
      isActive: apiKey.isActive,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      createdBy: apiKey.createdBy,
      metadata: apiKey.metadata,
    };
  }
}
