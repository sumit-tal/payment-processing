import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../dto/update-api-key.dto';
import {
  ApiKeyResponseDto,
  CreateApiKeyResponseDto,
} from '../dto/api-key-response.dto';
import { ApiKeyAuthGuard } from '../../../common/guards/api-key-auth.guard';
import {
  RequirePermissions,
  Permissions,
  SkipAuth,
} from '../../../common/decorators/auth.decorator';

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(ApiKeyAuthGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @SkipAuth()
  @RequirePermissions(Permissions.ADMIN_API_KEYS)
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: CreateApiKeyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Client ID already exists' })
  async createApiKey(
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    return this.apiKeyService.createApiKey(createApiKeyDto);
  }

  @Get()
  @RequirePermissions(Permissions.ADMIN_API_KEYS)
  @ApiOperation({ summary: 'Get all API keys' })
  @ApiResponse({
    status: 200,
    description: 'List of API keys retrieved successfully',
    type: [ApiKeyResponseDto],
  })
  async getAllApiKeys(): Promise<ApiKeyResponseDto[]> {
    return this.apiKeyService.findAllApiKeys();
  }

  @Get(':id')
  @RequirePermissions(Permissions.ADMIN_API_KEYS)
  @ApiOperation({ summary: 'Get API key by ID' })
  @ApiResponse({
    status: 200,
    description: 'API key retrieved successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getApiKeyById(@Param('id') id: string): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.findApiKeyById(id);
  }

  @Put(':id')
  @RequirePermissions(Permissions.ADMIN_API_KEYS)
  @ApiOperation({ summary: 'Update API key' })
  @ApiResponse({
    status: 200,
    description: 'API key updated successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateApiKey(
    @Param('id') id: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
    @Query('updatedBy') updatedBy: string,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.updateApiKey(id, updateApiKeyDto, updatedBy);
  }

  @Put(':id/deactivate')
  @RequirePermissions(Permissions.ADMIN_API_KEYS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate API key' })
  @ApiResponse({ status: 204, description: 'API key deactivated successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async deactivateApiKey(
    @Param('id') id: string,
    @Query('deactivatedBy') deactivatedBy: string,
  ): Promise<void> {
    return this.apiKeyService.deactivateApiKey(id, deactivatedBy);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.ADMIN_API_KEYS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete API key' })
  @ApiResponse({ status: 204, description: 'API key deleted successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async deleteApiKey(
    @Param('id') id: string,
    @Query('deletedBy') deletedBy: string,
  ): Promise<void> {
    return this.apiKeyService.deleteApiKey(id, deletedBy);
  }
}
