import { Test, TestingModule } from '@nestjs/testing';
import type {
  HealthCheckResult,
  HealthCheckStatus,
  HealthIndicatorStatus,
} from '@nestjs/terminus';
import { HealthController } from '../health.controller';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;
  let mockTypeOrmHealthIndicator: jest.Mocked<TypeOrmHealthIndicator>;
  let mockMemoryHealthIndicator: jest.Mocked<MemoryHealthIndicator>;
  let mockDiskHealthIndicator: jest.Mocked<DiskHealthIndicator>;

  beforeEach(async () => {
    const mockHealthCheckServiceValue = {
      check: jest.fn(),
    };
    const mockTypeOrmValue = {
      pingCheck: jest.fn(),
    };
    const mockMemoryValue = {
      checkHeap: jest.fn(),
      checkRSS: jest.fn(),
    };
    const mockDiskValue = {
      checkStorage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckServiceValue },
        { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmValue },
        { provide: MemoryHealthIndicator, useValue: mockMemoryValue },
        { provide: DiskHealthIndicator, useValue: mockDiskValue },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    mockHealthCheckService = module.get(HealthCheckService);
    mockTypeOrmHealthIndicator = module.get(TypeOrmHealthIndicator);
    mockMemoryHealthIndicator = module.get(MemoryHealthIndicator);
    mockDiskHealthIndicator = module.get(DiskHealthIndicator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When checking application health', () => {
    it('Then should return the health status and call all health indicators', async () => {
      const expectedResult: HealthCheckResult = {
        status: 'ok' as HealthCheckStatus,
        info: {},
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('When checking database connectivity', () => {
    it('Then should return the database health status and call database ping check', async () => {
      const expectedResult: HealthCheckResult = {
        status: 'ok' as HealthCheckStatus,
        info: { database: { status: 'up' as HealthIndicatorStatus } },
        error: {},
        details: {},
      };
      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.checkDatabase();

      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
      ]);
      expect(result).toEqual(expectedResult);
    });
  });
});
