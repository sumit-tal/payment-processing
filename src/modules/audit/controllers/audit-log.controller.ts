import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditLogService, AuditLogFilter } from '../services/audit-log.service';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { ApiKeyAuthGuard } from '../../../common/guards/api-key-auth.guard';
import { RequirePermissions, Permissions } from '../../../common/decorators/auth.decorator';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(ApiKeyAuthGuard)
@ApiBearerAuth()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermissions(Permissions.ADMIN_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get audit logs with filtering' })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        logs: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } },
        total: { type: 'number' },
      },
    },
  })
  async getAuditLogs(@Query() query: any): Promise<{ logs: AuditLog[]; total: number }> {
    const filter: AuditLogFilter = {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      userId: query.userId,
      success: query.success !== undefined ? query.success === 'true' : undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    };

    return this.auditLogService.findAuditLogs(filter);
  }

  @Get('statistics')
  @RequirePermissions(Permissions.ADMIN_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get audit log statistics' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to include in statistics' })
  @ApiResponse({
    status: 200,
    description: 'Audit statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalLogs: { type: 'number' },
        failedLogs: { type: 'number' },
        successRate: { type: 'string' },
        actionStats: { type: 'array' },
        dailyStats: { type: 'array' },
        period: { type: 'string' },
      },
    },
  })
  async getAuditStatistics(@Query('days') days?: number): Promise<Record<string, any>> {
    return this.auditLogService.getAuditStatistics(days);
  }

  @Get(':id')
  @RequirePermissions(Permissions.ADMIN_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({
    status: 200,
    description: 'Audit log retrieved successfully',
    type: AuditLog,
  })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async getAuditLogById(@Param('id') id: string): Promise<AuditLog | null> {
    return this.auditLogService.getAuditLogById(id);
  }
}
