import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from '../audit-log.controller';
import { AuditLogService, AuditLogFilter } from '../../services/audit-log.service';
import { AuditLog, AuditAction } from '../../../../database/entities/audit-log.entity';
import { ApiKeyAuthGuard } from '../../../../common/guards/api-key-auth.guard';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockAuditLog: AuditLog = {
    id: 'audit-1',
    action: AuditAction.PAYMENT_INITIATED,
    entityType: 'Transaction',
    entityId: 'txn-123',
    userId: 'user-1',
    ipAddress: '',
    userAgent: '',
    requestId: '',
    success: true,
    metadata: { amount: 100 },
    errorMessage: '',
    durationMs: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  } as AuditLog;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: {
            findAuditLogs: jest.fn(),
            getAuditStatistics: jest.fn(),
            getAuditLogById: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AuditLogController>(AuditLogController);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When getting audit logs', () => {
    it('Then should map query params and return logs (happy path)', async () => {
      // Arrange
      const query: any = {
        action: AuditAction.PAYMENT_INITIATED,
        entityType: 'Transaction',
        entityId: 'txn-123',
        userId: 'user-1',
        success: 'true',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: '50',
        offset: '10',
      };
      const expectedFilter: AuditLogFilter = {
        action: AuditAction.PAYMENT_INITIATED,
        entityType: 'Transaction',
        entityId: 'txn-123',
        userId: 'user-1',
        success: true,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 50,
        offset: 10,
      };
      const serviceResponse = { logs: [mockAuditLog], total: 1 };
      auditLogService.findAuditLogs.mockResolvedValue(serviceResponse);

      // Act
      const result = await controller.getAuditLogs(query);

      // Assert
      expect(result).toEqual(serviceResponse);
      expect(auditLogService.findAuditLogs).toHaveBeenCalledWith(expectedFilter);
    });

    it('Then should handle missing and invalid query values (edge/negative)', async () => {
      // Arrange: invalid limit/offset and invalid dates, unexpected success value
      const query: any = {
        success: 'yes', // not 'true' -> becomes false
        startDate: 'invalid-date', // becomes Invalid Date
        endDate: 'invalid-date', // becomes Invalid Date
        limit: 'abc', // parseInt -> NaN
        offset: 'xyz', // parseInt -> NaN
      };
      const serviceResponse = { logs: [], total: 0 };
      auditLogService.findAuditLogs.mockResolvedValue(serviceResponse);

      // Act
      const result = await controller.getAuditLogs(query);

      // Assert
      expect(result).toEqual(serviceResponse);
      expect(auditLogService.findAuditLogs).toHaveBeenCalledTimes(1);
      const passedFilter = auditLogService.findAuditLogs.mock.calls[0][0] as AuditLogFilter;
      expect(passedFilter.action).toBeUndefined();
      expect(passedFilter.entityType).toBeUndefined();
      expect(passedFilter.entityId).toBeUndefined();
      expect(passedFilter.userId).toBeUndefined();
      expect(passedFilter.success).toBe(false);
      expect(passedFilter.startDate).toBeInstanceOf(Date);
      expect(isNaN((passedFilter.startDate as Date).getTime())).toBe(true);
      expect(passedFilter.endDate).toBeInstanceOf(Date);
      expect(isNaN((passedFilter.endDate as Date).getTime())).toBe(true);
      expect(typeof passedFilter.limit).toBe('number');
      expect(Number.isNaN(passedFilter.limit as number)).toBe(true);
      expect(typeof passedFilter.offset).toBe('number');
      expect(Number.isNaN(passedFilter.offset as number)).toBe(true);
    });

    it('Then should pass through when no query provided (boundary: defaults)', async () => {
      // Arrange
      const expectedFilter: AuditLogFilter = {
        action: undefined,
        entityType: undefined,
        entityId: undefined,
        userId: undefined,
        success: undefined,
        startDate: undefined,
        endDate: undefined,
        limit: undefined,
        offset: undefined,
      };
      const serviceResponse = { logs: [], total: 0 };
      auditLogService.findAuditLogs.mockResolvedValue(serviceResponse);

      // Act
      const result = await controller.getAuditLogs({} as any);

      // Assert
      expect(result).toEqual(serviceResponse);
      expect(auditLogService.findAuditLogs).toHaveBeenCalledWith(expectedFilter);
    });
  });

  describe('When getting audit statistics', () => {
    it('Then should return statistics for given days (happy path)', async () => {
      // Arrange
      const stats = { totalLogs: 10, failedLogs: 1, successRate: '90.00', period: '7 days' } as Record<string, any>;
      auditLogService.getAuditStatistics.mockResolvedValue(stats);

      // Act
      const result = await controller.getAuditStatistics(7);

      // Assert
      expect(result).toBe(stats);
      expect(auditLogService.getAuditStatistics).toHaveBeenCalledWith(7);
    });

    it('Then should return statistics with default days when not provided (boundary)', async () => {
      // Arrange
      const stats = { totalLogs: 0, failedLogs: 0, successRate: '0.00', period: '30 days' } as Record<string, any>;
      auditLogService.getAuditStatistics.mockResolvedValue(stats);

      // Act
      const result = await controller.getAuditStatistics(undefined as unknown as number);

      // Assert
      expect(result).toBe(stats);
      expect(auditLogService.getAuditStatistics).toHaveBeenCalledWith(undefined);
    });
  });

  describe('When getting a single audit log by id', () => {
    it('Then should return the audit log (happy path)', async () => {
      // Arrange
      auditLogService.getAuditLogById.mockResolvedValue(mockAuditLog);

      // Act
      const result = await controller.getAuditLogById('audit-1');

      // Assert
      expect(result).toBe(mockAuditLog);
      expect(auditLogService.getAuditLogById).toHaveBeenCalledWith('audit-1');
    });

    it('Then should return null when not found (negative)', async () => {
      // Arrange
      auditLogService.getAuditLogById.mockResolvedValue(null);

      // Act
      const result = await controller.getAuditLogById('missing');

      // Assert
      expect(result).toBeNull();
      expect(auditLogService.getAuditLogById).toHaveBeenCalledWith('missing');
    });

    it('Then should forward empty id (edge case)', async () => {
      // Arrange
      auditLogService.getAuditLogById.mockResolvedValue(null);

      // Act
      const result = await controller.getAuditLogById('');

      // Assert
      expect(result).toBeNull();
      expect(auditLogService.getAuditLogById).toHaveBeenCalledWith('');
    });
  });
});
