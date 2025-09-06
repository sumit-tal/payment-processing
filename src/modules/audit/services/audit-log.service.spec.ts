import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: Repository<AuditLog>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should create audit log successfully', async () => {
      const createAuditLogDto: CreateAuditLogDto = {
        action: AuditAction.PAYMENT_INITIATED,
        entityType: 'Transaction',
        entityId: 'txn-123',
        userId: 'user-123',
        success: true,
      };

      const auditLog = { id: 'audit-123', ...createAuditLogDto };
      mockRepository.create.mockReturnValue(auditLog);
      mockRepository.save.mockResolvedValue(auditLog);

      await service.logActivity(createAuditLogDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createAuditLogDto,
        success: true,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(auditLog);
    });

    it('should handle audit log creation failure gracefully', async () => {
      const createAuditLogDto: CreateAuditLogDto = {
        action: AuditAction.PAYMENT_INITIATED,
        entityType: 'Transaction',
        entityId: 'txn-123',
      };

      mockRepository.create.mockReturnValue(createAuditLogDto);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(service.logActivity(createAuditLogDto)).resolves.toBeUndefined();
    });
  });

  describe('logPaymentActivity', () => {
    it('should log payment activity with correct parameters', async () => {
      const spy = jest.spyOn(service, 'logActivity').mockResolvedValue(undefined);

      await service.logPaymentActivity(
        AuditAction.PAYMENT_INITIATED,
        'txn-123',
        'user-123',
        { amount: 100 },
        true,
        undefined,
        500
      );

      expect(spy).toHaveBeenCalledWith({
        action: AuditAction.PAYMENT_INITIATED,
        entityType: 'Transaction',
        entityId: 'txn-123',
        userId: 'user-123',
        metadata: { amount: 100 },
        success: true,
        errorMessage: undefined,
        durationMs: 500,
      });
    });
  });

  describe('findAuditLogs', () => {
    it('should return audit logs with default parameters', async () => {
      const mockLogs = [
        { id: 'audit-1', action: AuditAction.PAYMENT_INITIATED },
        { id: 'audit-2', action: AuditAction.PAYMENT_CAPTURED },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockLogs, 2]);

      const result = await service.findAuditLogs();

      expect(result).toEqual({ logs: mockLogs, total: 2 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
        where: {},
      });
    });

    it('should filter audit logs by action', async () => {
      const mockLogs = [
        { id: 'audit-1', action: AuditAction.PAYMENT_INITIATED },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockLogs, 1]);

      const result = await service.findAuditLogs({
        action: AuditAction.PAYMENT_INITIATED,
        limit: 50,
        offset: 10,
      });

      expect(result).toEqual({ logs: mockLogs, total: 1 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 10,
        where: { action: AuditAction.PAYMENT_INITIATED },
      });
    });
  });

  describe('getAuditStatistics', () => {
    it('should return audit statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
      };

      mockRepository.count
        .mockResolvedValueOnce(100) // totalLogs
        .mockResolvedValueOnce(10); // failedLogs

      mockRepository.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder) // actionStats
        .mockReturnValueOnce(mockQueryBuilder); // dailyStats

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { action: 'PAYMENT_INITIATED', count: '50' },
          { action: 'PAYMENT_CAPTURED', count: '30' },
        ])
        .mockResolvedValueOnce([
          { date: '2024-01-01', count: '20' },
          { date: '2024-01-02', count: '25' },
        ]);

      const result = await service.getAuditStatistics(30);

      expect(result).toEqual({
        totalLogs: 100,
        failedLogs: 10,
        successRate: '90.00',
        actionStats: [
          { action: 'PAYMENT_INITIATED', count: '50' },
          { action: 'PAYMENT_CAPTURED', count: '30' },
        ],
        dailyStats: [
          { date: '2024-01-01', count: '20' },
          { date: '2024-01-02', count: '25' },
        ],
        period: '30 days',
      });
    });
  });

  describe('cleanupOldLogs', () => {
    it('should cleanup old audit logs', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 50 }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.cleanupOldLogs(365);

      expect(result).toBe(50);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'createdAt < :cutoffDate',
        { cutoffDate: expect.any(Date) }
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });
});
