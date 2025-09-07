import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
import { AuditLog, AuditAction } from '@/database/entities/audit-log.entity';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

export interface AuditLogFilter {
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async logActivity(createAuditLogDto: CreateAuditLogDto): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        ...createAuditLogDto,
        success: createAuditLogDto.success ?? true,
      });

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      // Don't throw errors for audit logging failures to avoid breaking main functionality
      this.logger.error('Failed to create audit log', {
        error: error.message,
        auditData: createAuditLogDto,
      });
    }
  }

  async logPaymentActivity(
    action: AuditAction,
    entityId: string,
    userId?: string,
    metadata?: Record<string, any>,
    success: boolean = true,
    errorMessage?: string,
    durationMs?: number,
  ): Promise<void> {
    await this.logActivity({
      action,
      entityType: 'Transaction',
      entityId,
      userId,
      metadata,
      success,
      errorMessage,
      durationMs,
    });
  }

  async logSubscriptionActivity(
    action: AuditAction,
    entityId: string,
    userId?: string,
    metadata?: Record<string, any>,
    success: boolean = true,
    errorMessage?: string,
  ): Promise<void> {
    await this.logActivity({
      action,
      entityType: 'Subscription',
      entityId,
      userId,
      metadata,
      success,
      errorMessage,
    });
  }

  async logWebhookActivity(
    action: AuditAction,
    entityId: string,
    metadata?: Record<string, any>,
    success: boolean = true,
    errorMessage?: string,
    durationMs?: number,
  ): Promise<void> {
    await this.logActivity({
      action,
      entityType: 'WebhookEvent',
      entityId,
      metadata,
      success,
      errorMessage,
      durationMs,
    });
  }

  async logSecurityEvent(
    action: AuditAction,
    ipAddress?: string,
    userAgent?: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logActivity({
      action,
      entityType: 'Security',
      ipAddress,
      userAgent,
      userId,
      metadata,
      success: false, // Security events are typically failures
    });
  }

  async findAuditLogs(filter: AuditLogFilter = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const options: FindManyOptions<AuditLog> = {
      order: { createdAt: 'DESC' },
      take: filter.limit || 100,
      skip: filter.offset || 0,
    };

    const where: any = {};

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.entityType) {
      where.entityType = filter.entityType;
    }

    if (filter.entityId) {
      where.entityId = filter.entityId;
    }

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.success !== undefined) {
      where.success = filter.success;
    }

    if (filter.startDate && filter.endDate) {
      where.createdAt = Between(filter.startDate, filter.endDate);
    } else if (filter.startDate) {
      where.createdAt = Between(filter.startDate, new Date());
    }

    options.where = where;

    const [logs, total] = await this.auditLogRepository.findAndCount(options);

    return { logs, total };
  }

  async getAuditLogById(id: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOne({
      where: { id },
    });
  }

  async getAuditStatistics(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const totalLogs = await this.auditLogRepository.count({
      where: {
        createdAt: Between(startDate, new Date()),
      },
    });

    const failedLogs = await this.auditLogRepository.count({
      where: {
        createdAt: Between(startDate, new Date()),
        success: false,
      },
    });

    const actionStats = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt >= :startDate', { startDate })
      .groupBy('audit.action')
      .orderBy('count', 'DESC')
      .getRawMany();

    const dailyStats = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('DATE(audit.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt >= :startDate', { startDate })
      .groupBy('DATE(audit.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      totalLogs,
      failedLogs,
      successRate: totalLogs > 0 ? ((totalLogs - failedLogs) / totalLogs * 100).toFixed(2) : 100,
      actionStats,
      dailyStats,
      period: `${days} days`,
    };
  }

  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} audit logs older than ${retentionDays} days`);

    return result.affected || 0;
  }
}
