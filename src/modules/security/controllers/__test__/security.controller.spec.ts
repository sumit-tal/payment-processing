import { Test, TestingModule } from '@nestjs/testing';
import { SecurityController } from '../security.controller';
import { PciComplianceService, ComplianceCheckResult } from '../../services/pci-compliance.service';
import { ApiKeyAuthGuard } from '../../../../common/guards/api-key-auth.guard';
import * as authDecorator from '../../../../common/decorators/auth.decorator';

describe('SecurityController', () => {
  let controller: SecurityController;
  let mockPciComplianceService: jest.Mocked<PciComplianceService>;

  beforeEach(async () => {
    const mockPciComplianceServiceValue = {
      validateCompliance: jest.fn(),
      generateComplianceReport: jest.fn(),
    };
    
    // Mock the RequirePermissions decorator
    jest.spyOn(authDecorator, 'RequirePermissions').mockImplementation(() => {
      return { KEY: 'test-decorator' } as any;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [
        { provide: PciComplianceService, useValue: mockPciComplianceServiceValue },
        { provide: ApiKeyAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      ],
    })
    .overrideGuard(ApiKeyAuthGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .compile();

    controller = module.get<SecurityController>(SecurityController);
    mockPciComplianceService = module.get(PciComplianceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When checking PCI DSS compliance', () => {
    it('Then should return compliance check result', async () => {
      // Arrange
      const expectedResult: ComplianceCheckResult = {
        compliant: true,
        issues: [],
        recommendations: ['Keep all dependencies up to date'],
        score: 100,
      };
      mockPciComplianceService.validateCompliance.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.checkCompliance();

      // Assert
      expect(mockPciComplianceService.validateCompliance).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('Then should return non-compliant result when issues are found', async () => {
      // Arrange
      const expectedResult: ComplianceCheckResult = {
        compliant: false,
        issues: ['Encryption configuration is not PCI DSS compliant'],
        recommendations: [
          'Review and update security configurations',
          'Consider engaging a PCI DSS consultant',
        ],
        score: 75,
      };
      mockPciComplianceService.validateCompliance.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.checkCompliance();

      // Assert
      expect(mockPciComplianceService.validateCompliance).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('Then should handle service errors gracefully', async () => {
      // Arrange
      mockPciComplianceService.validateCompliance.mockRejectedValue(new Error('Service error'));

      // Act & Assert
      await expect(controller.checkCompliance()).rejects.toThrow('Service error');
      expect(mockPciComplianceService.validateCompliance).toHaveBeenCalledTimes(1);
    });
  });

  describe('When generating PCI DSS compliance report', () => {
    it('Then should return compliance report', async () => {
      // Arrange
      const mockDate = new Date('2025-09-10T00:00:00Z');
      const expectedResult = {
        timestamp: mockDate,
        version: '1.0.0',
        compliance: {
          compliant: true,
          issues: [],
          recommendations: [],
          score: 100,
        },
        systemInfo: {
          environment: 'test',
          encryptionEnabled: true,
          auditingEnabled: true,
          rateLimitingEnabled: true,
        },
        recommendations: [
          'Regularly update security configurations',
          'Conduct quarterly security assessments',
          'Monitor audit logs for suspicious activities',
          'Keep all dependencies up to date',
          'Implement network segmentation where possible',
        ],
      };
      mockPciComplianceService.generateComplianceReport.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.generateComplianceReport();

      // Assert
      expect(mockPciComplianceService.generateComplianceReport).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('Then should handle service errors gracefully', async () => {
      // Arrange
      mockPciComplianceService.generateComplianceReport.mockRejectedValue(
        new Error('Report generation failed')
      );

      // Act & Assert
      await expect(controller.generateComplianceReport()).rejects.toThrow('Report generation failed');
      expect(mockPciComplianceService.generateComplianceReport).toHaveBeenCalledTimes(1);
    });

    it('Then should return report with issues when compliance fails', async () => {
      // Arrange
      const mockDate = new Date('2025-09-10T00:00:00Z');
      const expectedResult = {
        timestamp: mockDate,
        version: '1.0.0',
        compliance: {
          compliant: false,
          issues: ['Audit logging configuration is insufficient'],
          recommendations: ['Implement additional monitoring and alerting'],
          score: 85,
        },
        systemInfo: {
          environment: 'test',
          encryptionEnabled: true,
          auditingEnabled: false,
          rateLimitingEnabled: true,
        },
        recommendations: [
          'Regularly update security configurations',
          'Conduct quarterly security assessments',
          'Monitor audit logs for suspicious activities',
          'Keep all dependencies up to date',
          'Implement network segmentation where possible',
        ],
      };
      mockPciComplianceService.generateComplianceReport.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.generateComplianceReport();

      // Assert
      expect(mockPciComplianceService.generateComplianceReport).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
      expect(result.compliance.compliant).toBe(false);
      expect(result.compliance.issues).toContain('Audit logging configuration is insufficient');
    });
  });
});
